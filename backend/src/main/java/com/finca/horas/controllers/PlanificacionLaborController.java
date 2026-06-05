package com.finca.horas.controllers;

import com.finca.horas.entities.*;
import com.finca.horas.repositories.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/planificacion")
@CrossOrigin(origins = "*")
public class PlanificacionLaborController {

    @Autowired
    private RendimientoRepository rendimientoRepository;
    
    @Autowired
    private ProductoRepository productoRepository;
    
    @Autowired
    private ActividadRepository actividadRepository;

    // Tallos por malla por defecto (si no está configurado en el producto)
    private static final Map<String, Integer> TALLOS_POR_MALLA_DEFAULT = Map.of(
        "GYPSOPHILA", 25,
        "HYPERICUM", 25,
        "VERONICA", 25,
        "SOLIDAGO", 25,
        "SUNFLOWER", 30
    );

    /**
     * Obtener todas las labores madre únicas del sistema
     * Agrupa actividades similares (ej: Desbrote 1, Desbrote 2 → Desbrote)
     */
    @GetMapping("/labores")
    public ResponseEntity<List<Map<String, Object>>> getLaboresMadre() {
        List<String> labores = rendimientoRepository.findDistinctLabores();
        
        // Agrupar labores por su nombre base (sin números ni variantes)
        Set<String> laboresAgrupadas = new LinkedHashSet<>();
        for (String labor : labores) {
            if (esFertirriegoOFumigacion(labor)) continue;
            String laborBase = extraerLaborBase(labor);
            laboresAgrupadas.add(laborBase);
        }
        
        // Crear respuesta estructurada
        List<Map<String, Object>> resultado = laboresAgrupadas.stream()
            .map(labor -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("nombre", labor);
                item.put("codigo", generarCodigo(labor));
                item.put("esCosecha", labor.equalsIgnoreCase("Cosecha"));
                return item;
            })
            .collect(Collectors.toList());
        
        return ResponseEntity.ok(resultado);
    }
    
    /**
     * Extraer la labor base de un nombre de actividad
     * Ej: "Desbrote 1" → "Desbrote", "Cosecha dumps" → "Cosecha"
     */
    private String extraerLaborBase(String labor) {
        if (labor == null) return "";
        // Remover números y sufijos comunes
        String base = labor.replaceAll("\\s+\\d+$", "")  // Quitar números al final
                          .replaceAll("\\s+(poda|siembra|siem|selección|seleccion|nuevo|viejo|con\\s+\\w+|sin\\s+\\w+)$", "") // Quitar sufijos
                          .replaceAll("\\s+dumps$", "")
                          .trim();
        // Capitalizar primera letra
        if (!base.isEmpty()) {
            base = base.substring(0, 1).toUpperCase() + base.substring(1);
        }
        return base;
    }

    /**
     * Obtener cultivos que tienen una labor específica
     */
    @GetMapping("/labores/{laborNombre}/cultivos")
    public ResponseEntity<List<Map<String, Object>>> getCultivosPorLabor(@PathVariable String laborNombre) {
        // Decodificar el nombre de labor (puede venir con guiones bajos)
        String laborDecodificado = laborNombre.replace("_", " ");
        
        List<Producto> productos = rendimientoRepository.findProductosByLaborNombre(laborDecodificado);
        
        List<Map<String, Object>> resultado = productos.stream()
            .map(p -> {
                Map<String, Object> item = new HashMap<>();
                item.put("id", p.getId());
                item.put("codigo", p.getCodigo());
                item.put("nombre", p.getNombre());
                item.put("densidad", p.getDensidad());
                item.put("tallosPorMalla", p.getTallosPorMalla() != null ? 
                    p.getTallosPorMalla() : 
                    TALLOS_POR_MALLA_DEFAULT.getOrDefault(p.getCodigo(), 25));
                return item;
            })
            .collect(Collectors.toList());
        
        return ResponseEntity.ok(resultado);
    }

    /**
     * Obtener rendimiento para una combinación de labor + cultivo
     */
    @GetMapping("/rendimiento/{laborNombre}/{productoCodigo}")
    public ResponseEntity<Map<String, Object>> getRendimiento(
            @PathVariable String laborNombre,
            @PathVariable String productoCodigo) {
        
        String laborDecodificado = laborNombre.replace("_", " ");
        
        List<Rendimiento> rendimientos = rendimientoRepository.findByLaborAndProducto(
            laborDecodificado, productoCodigo.toUpperCase());
        
        if (rendimientos.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        // Tomar el primer rendimiento encontrado
        Rendimiento r = rendimientos.get(0);
        
        Map<String, Object> resultado = new HashMap<>();
        resultado.put("id", r.getId());
        resultado.put("labor", r.getActividad().getNombre());
        resultado.put("cultivo", r.getProducto().getCodigo());
        resultado.put("rendimiento", r.getRendimiento());
        resultado.put("unidad", r.getUnidad() != null ? r.getUnidad().getCodigo() : "CAMAS_HORA");
        resultado.put("actividadId", r.getActividad().getId());
        resultado.put("productoId", r.getProducto().getId());
        
        return ResponseEntity.ok(resultado);
    }

    /**
     * Obtener todos los cultivos con sus datos de cosecha
     */
    @GetMapping("/cosecha/cultivos")
    public ResponseEntity<List<Map<String, Object>>> getCultivosCosecha() {
        List<Producto> productos = productoRepository.findByActivoTrue();
        
        List<Map<String, Object>> resultado = new ArrayList<>();
        
        for (Producto p : productos) {
            // Buscar rendimiento de cosecha para este producto
            Optional<Rendimiento> rendCosecha = rendimientoRepository.findRendimientoCosecha(p.getCodigo());
            
            if (rendCosecha.isPresent()) {
                Rendimiento r = rendCosecha.get();
                int tallosPorMalla = p.getTallosPorMalla() != null ? 
                    p.getTallosPorMalla() : 
                    TALLOS_POR_MALLA_DEFAULT.getOrDefault(p.getCodigo(), 25);
                
                double mallasHora = r.getRendimiento();
                double tallosHora = mallasHora * tallosPorMalla;
                
                Map<String, Object> item = new HashMap<>();
                item.put("id", p.getId());
                item.put("codigo", p.getCodigo());
                item.put("nombre", p.getNombre());
                item.put("tallosPorMalla", tallosPorMalla);
                item.put("mallasHora", mallasHora);
                item.put("tallosHora", tallosHora);
                item.put("rendimientoId", r.getId());
                item.put("actividadId", r.getActividad().getId());
                
                resultado.add(item);
            }
        }
        
        return ResponseEntity.ok(resultado);
    }

    /**
     * Calcular horas para cosecha dado un cultivo y cantidad de tallos
     */
    @PostMapping("/cosecha/calcular")
    public ResponseEntity<Map<String, Object>> calcularHorasCosecha(@RequestBody Map<String, Object> request) {
        String productoCodigo = (String) request.get("cultivo");
        Number tallosNum = (Number) request.get("tallos");
        
        if (productoCodigo == null || tallosNum == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Faltan parámetros: cultivo y tallos"));
        }
        
        int tallos = tallosNum.intValue();
        
        Optional<Rendimiento> rendCosecha = rendimientoRepository.findRendimientoCosecha(productoCodigo.toUpperCase());
        
        if (rendCosecha.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        Rendimiento r = rendCosecha.get();
        Producto p = r.getProducto();
        
        int tallosPorMalla = p.getTallosPorMalla() != null ? 
            p.getTallosPorMalla() : 
            TALLOS_POR_MALLA_DEFAULT.getOrDefault(p.getCodigo(), 25);
        
        double mallasHora = r.getRendimiento();
        double mallas = (double) tallos / tallosPorMalla;
        double horas = mallas / mallasHora;
        
        Map<String, Object> resultado = new HashMap<>();
        resultado.put("cultivo", p.getCodigo());
        resultado.put("tallos", tallos);
        resultado.put("tallosPorMalla", tallosPorMalla);
        resultado.put("mallas", Math.round(mallas * 100.0) / 100.0);
        resultado.put("mallasHora", mallasHora);
        resultado.put("horas", Math.round(horas * 1000.0) / 1000.0);
        resultado.put("actividadId", r.getActividad().getId());
        resultado.put("productoId", p.getId());
        
        return ResponseEntity.ok(resultado);
    }

    /**
     * Actualizar tallos por malla para un producto
     */
    @PutMapping("/productos/{id}/tallos-malla")
    public ResponseEntity<?> updateTallosPorMalla(@PathVariable Long id, @RequestBody Map<String, Integer> request) {
        Integer tallosPorMalla = request.get("tallosPorMalla");
        
        return productoRepository.findById(id)
            .map(producto -> {
                producto.setTallosPorMalla(tallosPorMalla);
                productoRepository.save(producto);
                return ResponseEntity.ok(Map.of(
                    "mensaje", "Actualizado",
                    "producto", producto.getCodigo(),
                    "tallosPorMalla", tallosPorMalla
                ));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    // ==================== ENDPOINTS POR GRUPO (Actividad Madre) ====================

    /**
     * Obtener todos los grupos únicos (DESBROTE, SIEMBRA, COSECHA, DESMALEZADO)
     * Solo retorna grupos que tienen al menos un rendimiento válido
     */
    @GetMapping("/grupos")
    public ResponseEntity<List<String>> getGrupos() {
        List<String> grupos = rendimientoRepository.findDistinctGrupos();
        return ResponseEntity.ok(grupos);
    }

    /**
     * Obtener todos los rendimientos de un grupo con sus cultivos y labores
     * Formato: [{producto, productoCodigo, labor, rendimiento, actividadId, tallosPorMalla, unidad, unidadCodigo, unidadAbrev}]
     */
    @GetMapping("/grupos/{grupo}/rendimientos")
    public ResponseEntity<List<Map<String, Object>>> getRendimientosPorGrupo(@PathVariable String grupo) {
        List<Rendimiento> rendimientos = rendimientoRepository.findByGrupoConRendimiento(grupo.toUpperCase());
        
        List<Map<String, Object>> resultado = rendimientos.stream().map(r -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", r.getId());
            item.put("producto", r.getProducto().getNombre());
            item.put("productoCodigo", r.getProducto().getCodigo());
            item.put("labor", r.getActividad().getNombre());
            item.put("rendimiento", r.getRendimiento());
            item.put("actividadId", r.getActividad().getId());
            item.put("productoId", r.getProducto().getId());
            item.put("tallosPorMalla", r.getProducto().getTallosPorMalla() != null ? 
                r.getProducto().getTallosPorMalla() : 
                TALLOS_POR_MALLA_DEFAULT.getOrDefault(r.getProducto().getCodigo(), 25));
            
            // Agregar información de unidad
            if (r.getUnidad() != null) {
                item.put("unidad", r.getUnidad().getNombre());
                item.put("unidadCodigo", r.getUnidad().getCodigo());
                item.put("unidadAbrev", getUnidadAbreviatura(r.getUnidad().getCodigo()));
            } else {
                item.put("unidad", "Camas por hora");
                item.put("unidadCodigo", "CAMAS_HORA");
                item.put("unidadAbrev", "cam/h");
            }
            
            return item;
        }).collect(Collectors.toList());
        
        return ResponseEntity.ok(resultado);
    }

    /**
     * Obtener abreviatura de unidad para mostrar en UI
     */
    private String getUnidadAbreviatura(String codigo) {
        if (codigo == null) return "u/h";
        switch (codigo) {
            case "PLANTAS_HORA": return "pl/h";
            case "MALLAS_HORA": return "m/h";
            case "PINGOS_HORA": return "pg/h";
            case "CAMAS_HORA": 
            default: return "cam/h";
        }
    }

    /**
     * Obtener cultivos únicos de un grupo
     */
    @GetMapping("/grupos/{grupo}/cultivos")
    public ResponseEntity<List<Map<String, Object>>> getCultivosPorGrupo(@PathVariable String grupo) {
        List<Rendimiento> rendimientos = rendimientoRepository.findByGrupoConRendimiento(grupo.toUpperCase());
        
        // Agrupar por producto único
        Map<String, Producto> productosUnicos = new LinkedHashMap<>();
        for (Rendimiento r : rendimientos) {
            productosUnicos.putIfAbsent(r.getProducto().getCodigo(), r.getProducto());
        }
        
        List<Map<String, Object>> resultado = productosUnicos.values().stream().map(p -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", p.getId());
            item.put("codigo", p.getCodigo());
            item.put("nombre", p.getNombre());
            item.put("densidad", p.getDensidad());
            return item;
        }).collect(Collectors.toList());
        
        return ResponseEntity.ok(resultado);
    }

    /**
     * Obtener labores de un grupo para un cultivo específico
     */
    @GetMapping("/grupos/{grupo}/cultivos/{productoCodigo}/labores")
    public ResponseEntity<List<Map<String, Object>>> getLaboresPorGrupoCultivo(
            @PathVariable String grupo, 
            @PathVariable String productoCodigo) {
        
        List<Rendimiento> rendimientos = rendimientoRepository.findByGrupoAndProducto(
            grupo.toUpperCase(), productoCodigo.toUpperCase());
        
        List<Map<String, Object>> resultado = rendimientos.stream().map(r -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", r.getId());
            item.put("labor", r.getActividad().getNombre());
            item.put("rendimiento", r.getRendimiento());
            item.put("actividadId", r.getActividad().getId());
            return item;
        }).collect(Collectors.toList());
        
        return ResponseEntity.ok(resultado);
    }

    // Helpers
    private boolean esFertirriegoOFumigacion(String labor) {
        String laborLower = labor.toLowerCase();
        return laborLower.contains("fumiga") || 
               laborLower.contains("enraizant") || 
               laborLower.contains("giberélic") ||
               laborLower.contains("drench") ||
               laborLower.contains("desinfec") ||
               laborLower.contains("operador") ||
               laborLower.contains("manguera") ||
               laborLower.contains("blaukorn") ||
               laborLower.contains("calcimed") ||
               laborLower.contains("surco") ||
               laborLower.contains("picar camino");
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
