package com.finca.horas.services;

import com.finca.horas.entities.*;
import com.finca.horas.repositories.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

@Service
public class ImportacionRendimientoService {

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private ActividadRepository actividadRepository;

    @Autowired
    private UnidadMedidaRepository unidadMedidaRepository;

    @Autowired
    private RendimientoRepository rendimientoRepository;

    // Densidades por cultivo (plantas/cama)
    private static final Map<String, Double> DENSIDADES = Map.of(
        "GYPSOPHILA", 600.0,
        "VERONICA", 600.0,
        "HYPERICUM", 1200.0,
        "SOLIDAGO", 600.0,
        "SUNFLOWER", 1350.0
    );

    // Unidades que requieren conversión a camas/hora
    private static final Set<String> UNIDADES_PLANTAS = Set.of("plantas/hora", "semillas/hora");
    
    // Unidades que se mantienen sin convertir (métricas específicas)
    private static final Set<String> UNIDADES_ESPECIALES = Set.of("mallas/hora", "pingos/hora");

    @Transactional
    public Map<String, Object> importarDesdeCSV(String rutaArchivo) throws IOException {
        Map<String, Object> resultado = new HashMap<>();
        
        int productosCreados = 0;
        int actividadesCreadas = 0;
        int rendimientosImportados = 0;
        int rendimientosActualizados = 0;
        List<String> errores = new ArrayList<>();
        List<Map<String, Object>> detalles = new ArrayList<>();

        // Asegurar que existe la unidad CAMAS_HORA
        UnidadMedida unidadCamasHora = obtenerOCrearUnidad("CAMAS_HORA", "Camas por hora");
        UnidadMedida unidadMallasHora = obtenerOCrearUnidad("MALLAS_HORA", "Mallas por hora");
        UnidadMedida unidadPingosHora = obtenerOCrearUnidad("PINGOS_HORA", "Pingos por hora");

        // Leer archivo CSV
        Path path = Paths.get(rutaArchivo);
        List<String> lineas = Files.readAllLines(path, StandardCharsets.UTF_8);

        // Saltar encabezado
        for (int i = 1; i < lineas.size(); i++) {
            String linea = lineas.get(i).trim();
            if (linea.isEmpty()) continue;

            try {
                String[] campos = linea.split(";");
                if (campos.length < 4) {
                    errores.add("Línea " + (i + 1) + ": formato inválido");
                    continue;
                }

                String cultivoNombre = campos[0].trim().toUpperCase();
                String laborNombre = campos[1].trim();
                String unidadOriginal = campos[2].trim().toLowerCase();
                double rendimientoOriginal = Double.parseDouble(campos[3].trim().replace(",", "."));

                // 1. Obtener o crear Producto con densidad
                Producto producto = obtenerOCrearProducto(cultivoNombre);
                if (producto.getId() == null) {
                    productosCreados++;
                }

                // 2. Obtener o crear Actividad
                String actividadCodigo = generarCodigo(laborNombre) + "_" + cultivoNombre;
                Actividad actividad = obtenerOCrearActividad(actividadCodigo, laborNombre, producto);
                if (actividad.getId() == null) {
                    actividadesCreadas++;
                }
                actividad = actividadRepository.save(actividad);

                // 3. Calcular rendimiento normalizado
                double rendimientoNormalizado;
                UnidadMedida unidadFinal;
                String notaConversion = null;

                if (UNIDADES_PLANTAS.contains(unidadOriginal)) {
                    // Convertir plantas/hora o semillas/hora a camas/hora
                    Double densidad = DENSIDADES.get(cultivoNombre);
                    if (densidad != null && densidad > 0) {
                        rendimientoNormalizado = rendimientoOriginal / densidad;
                        unidadFinal = unidadCamasHora;
                        notaConversion = String.format("Convertido de %.2f %s (densidad: %.0f)", 
                            rendimientoOriginal, unidadOriginal, densidad);
                    } else {
                        // Sin densidad, mantener valor original
                        rendimientoNormalizado = rendimientoOriginal;
                        unidadFinal = unidadCamasHora;
                        notaConversion = "Sin conversión - densidad no definida";
                    }
                } else if (unidadOriginal.equals("mallas/hora")) {
                    rendimientoNormalizado = rendimientoOriginal;
                    unidadFinal = unidadMallasHora;
                } else if (unidadOriginal.equals("pingos/hora")) {
                    rendimientoNormalizado = rendimientoOriginal;
                    unidadFinal = unidadPingosHora;
                } else {
                    // camas/hora u otras - usar directo
                    rendimientoNormalizado = rendimientoOriginal;
                    unidadFinal = unidadCamasHora;
                }

                // 4. Crear o actualizar Rendimiento
                Optional<Rendimiento> existente = rendimientoRepository.findByProductoAndActividad(producto, actividad);
                Rendimiento rendimiento;
                
                if (existente.isPresent()) {
                    rendimiento = existente.get();
                    rendimiento.setRendimiento(rendimientoNormalizado);
                    rendimiento.setUnidad(unidadFinal);
                    if (notaConversion != null) {
                        rendimiento.setNotas(notaConversion);
                    }
                    rendimientosActualizados++;
                } else {
                    rendimiento = new Rendimiento();
                    rendimiento.setProducto(producto);
                    rendimiento.setActividad(actividad);
                    rendimiento.setRendimiento(rendimientoNormalizado);
                    rendimiento.setUnidad(unidadFinal);
                    rendimiento.setNotas(notaConversion);
                    rendimiento.setActivo(true);
                    rendimientosImportados++;
                }
                
                rendimientoRepository.save(rendimiento);

                // Registro de detalle
                Map<String, Object> detalle = new HashMap<>();
                detalle.put("cultivo", cultivoNombre);
                detalle.put("labor", laborNombre);
                detalle.put("unidadOriginal", unidadOriginal);
                detalle.put("rendimientoOriginal", rendimientoOriginal);
                detalle.put("rendimientoNormalizado", Math.round(rendimientoNormalizado * 1000.0) / 1000.0);
                detalle.put("unidadFinal", unidadFinal.getCodigo());
                detalles.add(detalle);

            } catch (Exception e) {
                errores.add("Línea " + (i + 1) + ": " + e.getMessage());
            }
        }

        resultado.put("productosCreados", productosCreados);
        resultado.put("actividadesCreadas", actividadesCreadas);
        resultado.put("rendimientosImportados", rendimientosImportados);
        resultado.put("rendimientosActualizados", rendimientosActualizados);
        resultado.put("totalProcesados", rendimientosImportados + rendimientosActualizados);
        resultado.put("errores", errores);
        resultado.put("detalles", detalles);

        return resultado;
    }

    /**
     * Importar rendimientos con formato GRUPO;PRODUCTO;LABOR;RENDIMIENTO
     * GRUPO = Actividad Madre (DESBROTE, SIEMBRA, COSECHA, DESMALEZADO)
     * Solo importa filas que tienen rendimiento (no vacío)
     * 
     * La unidad se obtiene haciendo match con rendimientos.csv (PRODUCTO + LABOR)
     */
    @Transactional
    public Map<String, Object> importarConGrupos(String rutaArchivo) throws IOException {
        Map<String, Object> resultado = new HashMap<>();
        
        int productosCreados = 0;
        int actividadesCreadas = 0;
        int rendimientosImportados = 0;
        int rendimientosActualizados = 0;
        int omitidosSinRendimiento = 0;
        List<String> errores = new ArrayList<>();
        List<Map<String, Object>> detalles = new ArrayList<>();

        // Cargar unidades desde rendimientos.csv
        Map<String, String> unidadesPorKey = cargarUnidadesDesdeRendimientosCSV();

        // Crear/obtener todas las unidades posibles
        UnidadMedida unidadCamasHora = obtenerOCrearUnidad("CAMAS_HORA", "Camas por hora");
        UnidadMedida unidadPlantasHora = obtenerOCrearUnidad("PLANTAS_HORA", "Plantas por hora");
        UnidadMedida unidadMallasHora = obtenerOCrearUnidad("MALLAS_HORA", "Mallas por hora");
        UnidadMedida unidadPingosHora = obtenerOCrearUnidad("PINGOS_HORA", "Pingos por hora");

        // Leer archivo CSV
        Path path = Paths.get(rutaArchivo);
        List<String> lineas = Files.readAllLines(path, StandardCharsets.UTF_8);

        // Saltar encabezado (GRUPO;PRODUCTO;LABOR;RENDIMIENTO)
        for (int i = 1; i < lineas.size(); i++) {
            String linea = lineas.get(i).trim();
            if (linea.isEmpty()) continue;

            try {
                String[] campos = linea.split(";");
                if (campos.length < 3) {
                    errores.add("Línea " + (i + 1) + ": formato inválido (mínimo 3 campos)");
                    continue;
                }

                String grupo = campos[0].trim().toUpperCase();
                String productoCodigo = campos[1].trim().toUpperCase();
                String laborNombre = campos[2].trim();
                
                // Verificar si tiene rendimiento (campo 4)
                String rendimientoStr = campos.length > 3 ? campos[3].trim() : "";
                if (rendimientoStr.isEmpty()) {
                    omitidosSinRendimiento++;
                    continue; // Saltar filas sin rendimiento
                }
                
                double rendimientoValor;
                try {
                    rendimientoValor = Double.parseDouble(rendimientoStr.replace(",", "."));
                } catch (NumberFormatException e) {
                    errores.add("Línea " + (i + 1) + ": rendimiento inválido '" + rendimientoStr + "'");
                    continue;
                }
                
                if (rendimientoValor <= 0) {
                    omitidosSinRendimiento++;
                    continue;
                }

                // 1. Obtener o crear Producto
                Producto producto = obtenerOCrearProducto(productoCodigo);
                if (producto.getId() == null) {
                    producto = productoRepository.save(producto);
                    productosCreados++;
                }

                // 2. Determinar unidad (match con rendimientos.csv o inferir)
                String keyMatch = normalizarKey(productoCodigo, laborNombre);
                String unidadStr = unidadesPorKey.get(keyMatch);
                UnidadMedida unidadFinal;
                
                if (unidadStr != null) {
                    // Match encontrado
                    unidadFinal = seleccionarUnidad(unidadStr, unidadCamasHora, unidadPlantasHora, unidadMallasHora, unidadPingosHora);
                } else {
                    // Inferir por valor: >100 = plantas, ≤100 = camas
                    unidadFinal = rendimientoValor > 100 ? unidadPlantasHora : unidadCamasHora;
                }

                // 3. Obtener o crear Actividad (código único por grupo+producto+labor)
                String actividadCodigo = grupo + "_" + productoCodigo + "_" + generarCodigo(laborNombre);
                Actividad actividad = actividadRepository.findByCodigo(actividadCodigo)
                    .orElseGet(() -> {
                        Actividad a = new Actividad();
                        a.setCodigo(actividadCodigo);
                        a.setNombre(laborNombre);
                        a.setLaborMadre(grupo); // Guardar el grupo como laborMadre
                        a.setRequiereBloque(true);
                        a.setRequierePases(false);
                        a.setEsVarios(false);
                        a.setActivo(true);
                        return a;
                    });
                
                // Actualizar laborMadre y producto si cambió
                if (actividad.getLaborMadre() == null || !actividad.getLaborMadre().equals(grupo)) {
                    actividad.setLaborMadre(grupo);
                }
                if (actividad.getProducto() == null) {
                    actividad.setProducto(producto);
                }
                
                if (actividad.getId() == null) {
                    actividad = actividadRepository.save(actividad);
                    actividadesCreadas++;
                } else {
                    actividad = actividadRepository.save(actividad); // Save updates
                }

                // 4. Crear o actualizar Rendimiento CON GRUPO Y UNIDAD
                Optional<Rendimiento> existente = rendimientoRepository.findByProductoAndActividad(producto, actividad);
                Rendimiento rendimiento;
                
                if (existente.isPresent()) {
                    rendimiento = existente.get();
                    rendimiento.setGrupo(grupo);
                    rendimiento.setRendimiento(rendimientoValor);
                    rendimiento.setUnidad(unidadFinal);
                    rendimientosActualizados++;
                } else {
                    rendimiento = new Rendimiento();
                    rendimiento.setGrupo(grupo);
                    rendimiento.setProducto(producto);
                    rendimiento.setActividad(actividad);
                    rendimiento.setRendimiento(rendimientoValor);
                    rendimiento.setUnidad(unidadFinal);
                    rendimiento.setActivo(true);
                    rendimientosImportados++;
                }
                
                rendimientoRepository.save(rendimiento);

                // Registro de detalle
                Map<String, Object> detalle = new HashMap<>();
                detalle.put("grupo", grupo);
                detalle.put("producto", productoCodigo);
                detalle.put("labor", laborNombre);
                detalle.put("rendimiento", rendimientoValor);
                detalle.put("unidad", unidadFinal.getCodigo());
                detalles.add(detalle);

            } catch (Exception e) {
                errores.add("Línea " + (i + 1) + ": " + e.getMessage());
            }
        }

        resultado.put("productosCreados", productosCreados);
        resultado.put("actividadesCreadas", actividadesCreadas);
        resultado.put("rendimientosImportados", rendimientosImportados);
        resultado.put("rendimientosActualizados", rendimientosActualizados);
        resultado.put("omitidosSinRendimiento", omitidosSinRendimiento);
        resultado.put("totalProcesados", rendimientosImportados + rendimientosActualizados);
        resultado.put("errores", errores);
        resultado.put("detalles", detalles);

        return resultado;
    }

    /**
     * Cargar unidades desde rendimientos.csv en un Map<key, unidad>
     * key = normalizarKey(PRODUCTO, LABOR)
     */
    private Map<String, String> cargarUnidadesDesdeRendimientosCSV() {
        Map<String, String> unidadesPorKey = new HashMap<>();
        try {
            Path path = Paths.get("rendimientos.csv");
            if (!Files.exists(path)) {
                System.out.println("WARNING: rendimientos.csv no encontrado, se inferirán unidades");
                return unidadesPorKey;
            }
            
            List<String> lineas = Files.readAllLines(path, StandardCharsets.UTF_8);
            // Formato: CULTIVO;LABOR;UNIDAD;RENDIMIENTO;KEY
            for (int i = 1; i < lineas.size(); i++) {
                String linea = lineas.get(i).trim();
                if (linea.isEmpty()) continue;
                
                String[] campos = linea.split(";");
                if (campos.length >= 3) {
                    String cultivo = campos[0].trim().toUpperCase();
                    String labor = campos[1].trim();
                    String unidad = campos[2].trim().toLowerCase();
                    
                    String key = normalizarKey(cultivo, labor);
                    unidadesPorKey.put(key, unidad);
                }
            }
            System.out.println("Cargadas " + unidadesPorKey.size() + " unidades desde rendimientos.csv");
        } catch (Exception e) {
            System.out.println("Error cargando rendimientos.csv: " + e.getMessage());
        }
        return unidadesPorKey;
    }

    /**
     * Normalizar key para match: uppercase, sin espacios, sin acentos
     */
    private String normalizarKey(String producto, String labor) {
        String key = (producto + labor).toUpperCase()
            .replaceAll("\\s+", "")
            .replaceAll("[ÁÀÄÂ]", "A")
            .replaceAll("[ÉÈËÊ]", "E")
            .replaceAll("[ÍÌÏÎ]", "I")
            .replaceAll("[ÓÒÖÔ]", "O")
            .replaceAll("[ÚÙÜÛ]", "U")
            .replaceAll("[Ñ]", "N");
        return key;
    }

    /**
     * Seleccionar UnidadMedida según string de unidad
     */
    private UnidadMedida seleccionarUnidad(String unidadStr, UnidadMedida camas, UnidadMedida plantas, 
                                            UnidadMedida mallas, UnidadMedida pingos) {
        if (unidadStr.contains("planta") || unidadStr.contains("semilla")) {
            return plantas;
        } else if (unidadStr.contains("malla")) {
            return mallas;
        } else if (unidadStr.contains("pingo")) {
            return pingos;
        } else {
            return camas;
        }
    }

    private UnidadMedida obtenerOCrearUnidad(String codigo, String nombre) {
        return unidadMedidaRepository.findByCodigo(codigo)
            .orElseGet(() -> {
                UnidadMedida unidad = new UnidadMedida();
                unidad.setCodigo(codigo);
                unidad.setNombre(nombre);
                unidad.setFactorAHoras(1);
                return unidadMedidaRepository.save(unidad);
            });
    }

    private Producto obtenerOCrearProducto(String codigo) {
        return productoRepository.findByCodigo(codigo)
            .map(p -> {
                // Actualizar densidad si no está definida
                if (p.getDensidad() == null && DENSIDADES.containsKey(codigo)) {
                    p.setDensidad(DENSIDADES.get(codigo));
                    return productoRepository.save(p);
                }
                return p;
            })
            .orElseGet(() -> {
                Producto producto = new Producto();
                producto.setCodigo(codigo);
                producto.setNombre(codigo.substring(0, 1) + codigo.substring(1).toLowerCase());
                producto.setDensidad(DENSIDADES.get(codigo));
                producto.setActivo(true);
                return productoRepository.save(producto);
            });
    }

    private Actividad obtenerOCrearActividad(String codigo, String nombre, Producto producto) {
        return actividadRepository.findByCodigo(codigo)
            .orElseGet(() -> {
                Actividad actividad = new Actividad();
                actividad.setCodigo(codigo);
                actividad.setNombre(nombre);
                actividad.setProducto(producto);
                actividad.setRequiereBloque(true);
                actividad.setRequierePases(false);
                actividad.setEsVarios(false);
                actividad.setActivo(true);
                return actividad; // No guardar aquí, se guarda después
            });
    }

    private String generarCodigo(String texto) {
        return texto.toUpperCase()
            .replaceAll("[ÁÀÄÂ]", "A")
            .replaceAll("[ÉÈËÊ]", "E")
            .replaceAll("[ÍÌÏÎ]", "I")
            .replaceAll("[ÓÒÖÔ]", "O")
            .replaceAll("[ÚÙÜÛ]", "U")
            .replaceAll("[Ñ]", "N")
            .replaceAll("[^A-Z0-9]", "_")
            .replaceAll("_+", "_")
            .replaceAll("^_|_$", "");
    }
}
