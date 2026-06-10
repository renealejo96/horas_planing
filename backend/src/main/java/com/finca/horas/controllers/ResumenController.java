package com.finca.horas.controllers;

import com.finca.horas.entities.Actividad;
import com.finca.horas.entities.EjecucionActividad;
import com.finca.horas.entities.Producto;
import com.finca.horas.entities.Semana;
import com.finca.horas.repositories.EjecucionActividadRepository;
import com.finca.horas.repositories.SemanaRepository;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ResumenController {

    @Autowired
    private SemanaRepository semanaRepo;

    @Autowired
    private EjecucionActividadRepository ejecucionActividadRepo;

    // Helper method to retrieve the week
    private Semana obtenerSemanaPorParametro(String codigoAass) {
        if (codigoAass != null && !codigoAass.trim().isEmpty()) {
            return semanaRepo.findByCodigoAass(codigoAass).orElse(null);
        }
        // Fallback 1: Semana por fecha actual
        Optional<Semana> currentByDate = semanaRepo.findByFecha(LocalDate.now());
        if (currentByDate.isPresent()) {
            return currentByDate.get();
        }
        // Fallback 2: Semana en estado EN_EJECUCION
        List<Semana> enEjecucion = semanaRepo.findByEstado(Semana.EstadoSemana.EN_EJECUCION);
        if (!enEjecucion.isEmpty()) {
            return enEjecucion.get(0);
        }
        // Fallback 3: Última semana registrada
        List<Semana> todas = semanaRepo.findAll();
        if (!todas.isEmpty()) {
            todas.sort((a, b) -> b.getCodigoAass().compareTo(a.getCodigoAass()));
            return todas.get(0);
        }
        return null;
    }

    /**
     * GET /api/semanas
     * Devuelve todas las semanas disponibles en la base de datos (códigos).
     */
    @GetMapping("/semanas")
    public ResponseEntity<?> obtenerSemanasResumen() {
        List<Semana> todas = semanaRepo.findAll();
        todas.sort((a, b) -> b.getCodigoAass().compareTo(a.getCodigoAass())); // Descendente
        List<String> codigos = todas.stream().map(Semana::getCodigoAass).toList();
        
        Map<String, Object> response = new HashMap<>();
        response.put("total", codigos.size());
        response.put("semanas", codigos);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/resumen
     * Devuelve los datos del resumen en formato JSON (plano o jerárquico).
     */
    @GetMapping("/resumen")
    public ResponseEntity<?> obtenerResumenCosecha(
            @RequestParam(value = "semana", required = false) String codigoAass,
            @RequestParam(value = "formato", defaultValue = "plano") String formato) {
        
        Semana sem = obtenerSemanaPorParametro(codigoAass);
        if (sem == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Semana no encontrada"));
        }
        
        List<EjecucionActividad> ejecuciones = ejecucionActividadRepo.findBySemanaCodigoAass(sem.getCodigoAass());
        
        // Filtrar ejecuciones de Cosecha
        List<EjecucionActividad> cosechas = ejecuciones.stream()
            .filter(e -> {
                Actividad act = e.getActividad();
                if (act == null && e.getPlanificacion() != null) {
                    act = e.getPlanificacion().getActividad();
                }
                if (act == null) return false;
                String lm = act.getLaborMadre() != null ? act.getLaborMadre().toUpperCase() : "";
                String nm = act.getNombre() != null ? act.getNombre().toUpperCase() : "";
                String cod = act.getCodigo() != null ? act.getCodigo().toUpperCase() : "";
                return lm.contains("COSECHA") || nm.contains("COSECHA") || cod.contains("COSECHA");
            })
            .toList();
            
        if ("jerarquico".equalsIgnoreCase(formato)) {
            return obtenerResumenJerarquico(sem, cosechas);
        }
        
        // Formato Plano
        List<Map<String, Object>> datosJson = new ArrayList<>();
        Map<String, Integer> tallosPorMallaDefaults = Map.of(
            "GYPSOPHILA", 25, 
            "HYPERICUM", 25, 
            "VERONICA", 25, 
            "SOLIDAGO", 25, 
            "SUNFLOWER", 30
        );
        
        for (EjecucionActividad c : cosechas) {
            Actividad act = c.getActividad();
            if (act == null && c.getPlanificacion() != null) {
                act = c.getPlanificacion().getActividad();
            }
            Producto prod = (act != null) ? act.getProducto() : null;
            String prodCodigo = (prod != null) ? prod.getCodigo().toUpperCase() : "GENERAL";
            String prodNombre = (prod != null) ? prod.getNombre() : "General";
            int tallosMalla = (prod != null && prod.getTallosPorMalla() != null) 
                ? prod.getTallosPorMalla() 
                : tallosPorMallaDefaults.getOrDefault(prodCodigo, 25);
            
            double totalTallos = (c.getUnidadesReales() != null) ? c.getUnidadesReales() : 0.0;
            double mallas = totalTallos / tallosMalla;
            
            String diaSemana = "Lunes";
            switch (c.getFecha().getDayOfWeek()) {
                case MONDAY: diaSemana = "Lunes"; break;
                case TUESDAY: diaSemana = "Martes"; break;
                case WEDNESDAY: diaSemana = "Miércoles"; break;
                case THURSDAY: diaSemana = "Jueves"; break;
                case FRIDAY: diaSemana = "Viernes"; break;
                case SATURDAY: diaSemana = "Sábado"; break;
                case SUNDAY: diaSemana = "Domingo"; break;
            }
            
            String modulo = (c.getPlanificacion() != null) ? c.getPlanificacion().getBloque() : null;
            if (modulo == null && c.getPlanificacion() != null) {
                modulo = c.getPlanificacion().getValvulas();
            }
            if (modulo == null) {
                modulo = "-";
            }
            
            String horaCosecha = c.getCreatedAt() != null 
                ? c.getCreatedAt().toLocalTime().toString().substring(0, 8) 
                : "08:00:00";
                
            String responsable = c.getObservacion() != null && !c.getObservacion().trim().isEmpty()
                ? c.getObservacion()
                : "Operario";
            
            Map<String, Object> item = new HashMap<>();
            item.put("semana", sem.getCodigoAass());
            item.put("producto_maestro", prodCodigo);
            item.put("variedad", prodNombre);
            item.put("fecha", c.getFecha().toString());
            item.put("dia_semana", diaSemana);
            item.put("modulo", modulo);
            item.put("hora_cosecha", horaCosecha);
            item.put("tallos_por_malla", tallosMalla);
            item.put("mallas", Math.round(mallas * 100.0) / 100.0);
            item.put("total_tallos", (int) totalTallos);
            item.put("responsable", responsable);
            item.put("viaje", "Viaje 1");
            
            datosJson.add(item);
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("semana", sem.getCodigoAass());
        response.put("total_registros", datosJson.size());
        response.put("datos", datosJson);
        
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/semanas/tallos-producto-maestro
     * Totales de cosecha por producto maestro agrupados por semana y desglosados por día.
     */
    @GetMapping("/semanas/tallos-producto-maestro")
    public ResponseEntity<?> obtenerTallosProductoMaestro(
            @RequestParam(value = "semana", required = false) String codigoAass) {
        
        List<Semana> semanasAConsultar = new ArrayList<>();
        if (codigoAass != null && !codigoAass.trim().isEmpty()) {
            semanaRepo.findByCodigoAass(codigoAass).ifPresent(semanasAConsultar::add);
        } else {
            semanasAConsultar.addAll(semanaRepo.findAll());
        }
        
        List<Map<String, Object>> semanasJson = new ArrayList<>();
        Map<String, Integer> tallosPorMallaDefaults = Map.of(
            "GYPSOPHILA", 25, 
            "HYPERICUM", 25, 
            "VERONICA", 25, 
            "SOLIDAGO", 25, 
            "SUNFLOWER", 30
        );
        
        for (Semana sem : semanasAConsultar) {
            List<EjecucionActividad> ejecuciones = ejecucionActividadRepo.findBySemanaCodigoAass(sem.getCodigoAass());
            List<EjecucionActividad> cosechas = ejecuciones.stream()
                .filter(e -> {
                    Actividad act = e.getActividad();
                    if (act == null && e.getPlanificacion() != null) {
                        act = e.getPlanificacion().getActividad();
                    }
                    if (act == null) return false;
                    String lm = act.getLaborMadre() != null ? act.getLaborMadre().toUpperCase() : "";
                    String nm = act.getNombre() != null ? act.getNombre().toUpperCase() : "";
                    String cod = act.getCodigo() != null ? act.getCodigo().toUpperCase() : "";
                    return lm.contains("COSECHA") || nm.contains("COSECHA") || cod.contains("COSECHA");
                })
                .toList();
                
            Map<String, List<EjecucionActividad>> porProducto = new HashMap<>();
            for (EjecucionActividad c : cosechas) {
                Actividad act = c.getActividad();
                if (act == null && c.getPlanificacion() != null) {
                    act = c.getPlanificacion().getActividad();
                }
                Producto prod = (act != null) ? act.getProducto() : null;
                String prodCodigo = (prod != null) ? prod.getCodigo().toUpperCase() : "GENERAL";
                porProducto.computeIfAbsent(prodCodigo, k -> new ArrayList<>()).add(c);
            }
            
            List<Map<String, Object>> productosJson = new ArrayList<>();
            for (Map.Entry<String, List<EjecucionActividad>> entry : porProducto.entrySet()) {
                String prodCodigo = entry.getKey();
                List<EjecucionActividad> execs = entry.getValue();
                
                int tallosMalla = tallosPorMallaDefaults.getOrDefault(prodCodigo, 25);
                for (EjecucionActividad c : execs) {
                    Actividad act = c.getActividad();
                    if (act == null && c.getPlanificacion() != null) {
                        act = c.getPlanificacion().getActividad();
                    }
                    if (act != null && act.getProducto() != null && act.getProducto().getTallosPorMalla() != null) {
                        tallosMalla = act.getProducto().getTallosPorMalla();
                        break;
                    }
                }
                
                double totalTallos = 0;
                Map<LocalDate, List<EjecucionActividad>> porDia = new HashMap<>();
                for (EjecucionActividad c : execs) {
                    porDia.computeIfAbsent(c.getFecha(), k -> new ArrayList<>()).add(c);
                    totalTallos += (c.getUnidadesReales() != null) ? c.getUnidadesReales() : 0.0;
                }
                
                List<Map<String, Object>> diasJson = new ArrayList<>();
                for (Map.Entry<LocalDate, List<EjecucionActividad>> diaEntry : porDia.entrySet()) {
                    LocalDate fecha = diaEntry.getKey();
                    List<EjecucionActividad> diaExecs = diaEntry.getValue();
                    
                    double diaTallos = diaExecs.stream()
                        .mapToDouble(e -> (e.getUnidadesReales() != null) ? e.getUnidadesReales() : 0.0)
                        .sum();
                    
                    double diaMallas = diaTallos / tallosMalla;
                    String diaSemana = "Lunes";
                    switch (fecha.getDayOfWeek()) {
                        case MONDAY: diaSemana = "Lunes"; break;
                        case TUESDAY: diaSemana = "Martes"; break;
                        case WEDNESDAY: diaSemana = "Miércoles"; break;
                        case THURSDAY: diaSemana = "Jueves"; break;
                        case FRIDAY: diaSemana = "Viernes"; break;
                        case SATURDAY: diaSemana = "Sábado"; break;
                        case SUNDAY: diaSemana = "Domingo"; break;
                    }
                    
                    Map<String, Object> diaJson = new HashMap<>();
                    diaJson.put("fecha", fecha.toString());
                    diaJson.put("dia_semana", diaSemana);
                    diaJson.put("total_tallos", (int) diaTallos);
                    diaJson.put("total_mallas", Math.round(diaMallas * 100.0) / 100.0);
                    diaJson.put("total_registros", diaExecs.size());
                    
                    diasJson.add(diaJson);
                }
                
                diasJson.sort((a, b) -> ((String) a.get("fecha")).compareTo((String) b.get("fecha")));
                double totalMallas = totalTallos / tallosMalla;
                
                Map<String, Object> prodJson = new HashMap<>();
                prodJson.put("producto_maestro", prodCodigo);
                prodJson.put("total_tallos", (int) totalTallos);
                prodJson.put("total_mallas", Math.round(totalMallas * 100.0) / 100.0);
                prodJson.put("total_registros", execs.size());
                prodJson.put("dias", diasJson);
                
                productosJson.add(prodJson);
            }
            
            productosJson.sort((a, b) -> ((String) a.get("producto_maestro")).compareTo((String) b.get("producto_maestro")));
            
            Map<String, Object> semJson = new HashMap<>();
            semJson.put("semana", sem.getCodigoAass());
            semJson.put("total_productos", productosJson.size());
            semJson.put("productos", productosJson);
            
            semanasJson.add(semJson);
        }
        
        semanasJson.sort((a, b) -> ((String) b.get("semana")).compareTo((String) a.get("semana")));
        
        Map<String, Object> response = new HashMap<>();
        response.put("filtro_semana", codigoAass);
        response.put("total_semanas", semanasJson.size());
        response.put("semanas", semanasJson);
        
        return ResponseEntity.ok(response);
    }

    // Response helper for hierarchical format
    private ResponseEntity<?> obtenerResumenJerarquico(Semana sem, List<EjecucionActividad> cosechas) {
        ResponseEntity<?> base = obtenerTallosProductoMaestro(sem.getCodigoAass());
        Map<String, Object> body = (Map<String, Object>) base.getBody();
        if (body != null && body.containsKey("semanas")) {
            List<Map<String, Object>> semanas = (List<Map<String, Object>>) body.get("semanas");
            if (!semanas.isEmpty()) {
                return ResponseEntity.ok(semanas.get(0));
            }
        }
        return ResponseEntity.ok(Map.of("semana", sem.getCodigoAass(), "productos", Collections.emptyList()));
    }

    /**
     * GET /api/resumen/excel
     * Descarga del reporte de cosecha en formato Excel (.xlsx).
     */
    @GetMapping("/resumen/excel")
    public void descargarExcel(
            @RequestParam(value = "semana", required = false) String codigoAass,
            HttpServletResponse response) throws IOException {
        
        Semana sem = obtenerSemanaPorParametro(codigoAass);
        if (sem == null) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Semana no encontrada");
            return;
        }
        
        List<EjecucionActividad> ejecuciones = ejecucionActividadRepo.findBySemanaCodigoAass(sem.getCodigoAass());
        
        List<EjecucionActividad> cosechas = ejecuciones.stream()
            .filter(e -> {
                Actividad act = e.getActividad();
                if (act == null && e.getPlanificacion() != null) {
                    act = e.getPlanificacion().getActividad();
                }
                if (act == null) return false;
                String lm = act.getLaborMadre() != null ? act.getLaborMadre().toUpperCase() : "";
                String nm = act.getNombre() != null ? act.getNombre().toUpperCase() : "";
                String cod = act.getCodigo() != null ? act.getCodigo().toUpperCase() : "";
                return lm.contains("COSECHA") || nm.contains("COSECHA") || cod.contains("COSECHA");
            })
            .toList();
            
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Resumen Cosecha");
            
            Row headerRow = sheet.createRow(0);
            String[] headers = {
                "Semana", "Producto Maestro", "Variedad", "Fecha", "Día Semana", 
                "Módulo", "Hora Cosecha", "Tallos por Malla", "Mallas", 
                "Total Tallos", "Responsable", "Viaje"
            };
            
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }
            
            Map<String, Integer> tallosPorMallaDefaults = Map.of(
                "GYPSOPHILA", 25, 
                "HYPERICUM", 25, 
                "VERONICA", 25, 
                "SOLIDAGO", 25, 
                "SUNFLOWER", 30
            );
            
            int rowIdx = 1;
            for (EjecucionActividad c : cosechas) {
                Row row = sheet.createRow(rowIdx++);
                
                Actividad act = c.getActividad();
                if (act == null && c.getPlanificacion() != null) {
                    act = c.getPlanificacion().getActividad();
                }
                Producto prod = (act != null) ? act.getProducto() : null;
                String prodCodigo = (prod != null) ? prod.getCodigo().toUpperCase() : "GENERAL";
                String prodNombre = (prod != null) ? prod.getNombre() : "General";
                int tallosMalla = (prod != null && prod.getTallosPorMalla() != null) 
                    ? prod.getTallosPorMalla() 
                    : tallosPorMallaDefaults.getOrDefault(prodCodigo, 25);
                
                double totalTallos = (c.getUnidadesReales() != null) ? c.getUnidadesReales() : 0.0;
                double mallas = totalTallos / tallosMalla;
                
                String diaSemana = "Lunes";
                switch (c.getFecha().getDayOfWeek()) {
                    case MONDAY: diaSemana = "Lunes"; break;
                    case TUESDAY: diaSemana = "Martes"; break;
                    case WEDNESDAY: diaSemana = "Miércoles"; break;
                    case THURSDAY: diaSemana = "Jueves"; break;
                    case FRIDAY: diaSemana = "Viernes"; break;
                    case SATURDAY: diaSemana = "Sábado"; break;
                    case SUNDAY: diaSemana = "Domingo"; break;
                }
                
                String modulo = (c.getPlanificacion() != null) ? c.getPlanificacion().getBloque() : null;
                if (modulo == null && c.getPlanificacion() != null) {
                    modulo = c.getPlanificacion().getValvulas();
                }
                if (modulo == null) {
                    modulo = "-";
                }
                
                String horaCosecha = c.getCreatedAt() != null 
                    ? c.getCreatedAt().toLocalTime().toString().substring(0, 8) 
                    : "08:00:00";
                    
                String responsable = c.getObservacion() != null && !c.getObservacion().trim().isEmpty()
                    ? c.getObservacion()
                    : "Operario";
                
                row.createCell(0).setCellValue(sem.getCodigoAass());
                row.createCell(1).setCellValue(prodCodigo);
                row.createCell(2).setCellValue(prodNombre);
                row.createCell(3).setCellValue(c.getFecha().toString());
                row.createCell(4).setCellValue(diaSemana);
                row.createCell(5).setCellValue(modulo);
                row.createCell(6).setCellValue(horaCosecha);
                row.createCell(7).setCellValue(tallosMalla);
                row.createCell(8).setCellValue(Math.round(mallas * 100.0) / 100.0);
                row.createCell(9).setCellValue((int) totalTallos);
                row.createCell(10).setCellValue(responsable);
                row.createCell(11).setCellValue("Viaje 1");
            }
            
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }
            
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            String headerKey = "Content-Disposition";
            String headerValue = "attachment; filename=resumen_cosecha_semana_" + sem.getCodigoAass() + ".xlsx";
            response.setHeader(headerKey, headerValue);
            
            workbook.write(response.getOutputStream());
        }
    }

    /**
     * GET /api/ejecucion/cosechas-externas
     * Proxy to bypass browser CORS restrictions when fetching harvest data.
     */
    @GetMapping("/ejecucion/cosechas-externas")
    public ResponseEntity<?> obtenerCosechasExternas(@RequestParam("semana") String semana) {
        String url = "https://cosecha-app-1.onrender.com/api/resumen?semana=" + semana;
        org.springframework.web.client.RestTemplate restTemplate = crearRestTemplateSeguro();
        try {
            Map<?, ?> response = restTemplate.getForObject(url, Map.class);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Error al conectar con la API de cosecha: " + e.getMessage());
            return ResponseEntity.status(502).body(error);
        }
    }

    private org.springframework.web.client.RestTemplate crearRestTemplateSeguro() {
        try {
            javax.net.ssl.SSLContext sslContext = javax.net.ssl.SSLContext.getInstance("TLS");
            javax.net.ssl.TrustManager[] trustAllCerts = new javax.net.ssl.TrustManager[]{
                new javax.net.ssl.X509TrustManager() {
                    public java.security.cert.X509Certificate[] getAcceptedIssuers() { return null; }
                    public void checkClientTrusted(java.security.cert.X509Certificate[] certs, String authType) {}
                    public void checkServerTrusted(java.security.cert.X509Certificate[] certs, String authType) {}
                }
            };
            sslContext.init(null, trustAllCerts, new java.security.SecureRandom());
            
            org.springframework.http.client.SimpleClientHttpRequestFactory requestFactory = 
                new org.springframework.http.client.SimpleClientHttpRequestFactory() {
                    @Override
                    protected void prepareConnection(java.net.HttpURLConnection connection, String httpMethod) throws java.io.IOException {
                        if (connection instanceof javax.net.ssl.HttpsURLConnection) {
                            ((javax.net.ssl.HttpsURLConnection) connection).setSSLSocketFactory(sslContext.getSocketFactory());
                            ((javax.net.ssl.HttpsURLConnection) connection).setHostnameVerifier((hostname, session) -> true);
                        }
                        super.prepareConnection(connection, httpMethod);
                    }
                };
            
            // Timeout de 60 segundos para permitir el arranque en frío de Render (normalmente toma ~50s)
            requestFactory.setConnectTimeout(60000);
            requestFactory.setReadTimeout(60000);
            
            return new org.springframework.web.client.RestTemplate(requestFactory);
        } catch (Exception e) {
            // Fallback al RestTemplate por defecto en caso de error de configuración
            return new org.springframework.web.client.RestTemplate();
        }
    }
}
