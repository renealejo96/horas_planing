package com.finca.horas.controllers;

import com.finca.horas.entities.*;
import com.finca.horas.repositories.*;
import com.finca.horas.services.ImportacionRendimientoService;
import com.finca.horas.services.PlanificacionService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class AdminController {

    @Autowired
    private AreaRepository areaRepository;
    
    @Autowired
    private ProductoRepository productoRepository;
    
    @Autowired
    private ActividadRepository actividadRepository;
    
    @Autowired
    private UnidadMedidaRepository unidadMedidaRepository;
    
    @Autowired
    private RendimientoRepository rendimientoRepository;
    
    @Autowired
    private TrabajadorRepository trabajadorRepository;
    
    @Autowired
    private ImportacionRendimientoService importacionRendimientoService;
    
    @Autowired
    private PlanificacionService planificacionService;
    
    @Value("${app.csv.path:}")
    private String csvBasePath;

    // ==================== ÁREAS ====================
    
    @GetMapping("/areas")
    public List<Area> getAreas() {
        return areaRepository.findByActivoTrue();
    }
    
    @GetMapping("/areas/{id}")
    public ResponseEntity<Area> getArea(@PathVariable Long id) {
        return areaRepository.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
    
    @PostMapping("/areas")
    public Area createArea(@RequestBody Area area) {
        return areaRepository.save(area);
    }
    
    @PutMapping("/areas/{id}")
    public ResponseEntity<Area> updateArea(@PathVariable Long id, @RequestBody Area areaDetails) {
        return areaRepository.findById(id)
            .map(area -> {
                area.setNombre(areaDetails.getNombre());
                area.setCodigo(areaDetails.getCodigo());
                area.setDescripcion(areaDetails.getDescripcion());
                return ResponseEntity.ok(areaRepository.save(area));
            })
            .orElse(ResponseEntity.notFound().build());
    }
    
    @DeleteMapping("/areas/{id}")
    public ResponseEntity<?> deleteArea(@PathVariable Long id) {
        return areaRepository.findById(id)
            .map(area -> {
                area.setActivo(false);
                areaRepository.save(area);
                return ResponseEntity.ok().build();
            })
            .orElse(ResponseEntity.notFound().build());
    }

    // ==================== PRODUCTOS ====================
    
    @GetMapping("/productos")
    public List<Producto> getProductos() {
        return productoRepository.findByActivoTrue();
    }
    
    @GetMapping("/productos/{id}")
    public ResponseEntity<Producto> getProducto(@PathVariable Long id) {
        return productoRepository.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
    
    @PostMapping("/productos")
    public Producto createProducto(@RequestBody Producto producto) {
        return productoRepository.save(producto);
    }
    
    @PutMapping("/productos/{id}")
    public ResponseEntity<Producto> updateProducto(@PathVariable Long id, @RequestBody Producto productoDetails) {
        return productoRepository.findById(id)
            .map(producto -> {
                producto.setNombre(productoDetails.getNombre());
                producto.setCodigo(productoDetails.getCodigo());
                producto.setDescripcion(productoDetails.getDescripcion());
                producto.setDensidad(productoDetails.getDensidad());
                producto.setTallosPorMalla(productoDetails.getTallosPorMalla());
                return ResponseEntity.ok(productoRepository.save(producto));
            })
            .orElse(ResponseEntity.notFound().build());
    }
    
    @DeleteMapping("/productos/{id}")
    public ResponseEntity<?> deleteProducto(@PathVariable Long id) {
        return productoRepository.findById(id)
            .map(producto -> {
                producto.setActivo(false);
                productoRepository.save(producto);
                return ResponseEntity.ok().build();
            })
            .orElse(ResponseEntity.notFound().build());
    }

    // ==================== ACTIVIDADES ====================
    
    @GetMapping("/actividades")
    public List<Actividad> getActividades(HttpServletRequest request) {
        List<Actividad> todas = actividadRepository.findByActivoTrue();
        return filtrarActividades(todas, request);
    }
    
    @GetMapping("/actividades/area/{areaId}")
    public List<Actividad> getActividadesByArea(@PathVariable Long areaId, HttpServletRequest request) {
        List<Actividad> todas = areaRepository.findById(areaId)
            .map(area -> actividadRepository.findByAreaAndActivoTrue(area))
            .orElse(List.of());
        return filtrarActividades(todas, request);
    }

    private List<Actividad> filtrarActividades(List<Actividad> actividades, HttpServletRequest request) {
        String rol = (String) request.getAttribute("rol");
        if ("ADMIN".equals(rol)) {
            return actividades;
        }
        String permitidasStr = (String) request.getAttribute("actividadesPermitidas");
        if (permitidasStr == null || permitidasStr.trim().isEmpty()) {
            return List.of();
        }
        List<String> permitidas = java.util.Arrays.stream(permitidasStr.split(","))
            .map(String::trim)
            .map(String::toUpperCase)
            .toList();
            
        return actividades.stream()
            .filter(act -> act.getLaborMadre() != null && permitidas.contains(act.getLaborMadre().toUpperCase()))
            .toList();
    }

    private boolean puedeModificarRendimientos(HttpServletRequest request) {
        String rol = (String) request.getAttribute("rol");
        if ("ADMIN".equals(rol)) {
            return true;
        }
        Boolean modificar = (Boolean) request.getAttribute("modificarRendimientos");
        return modificar != null && modificar;
    }
    
    @GetMapping("/actividades/{id}")
    public ResponseEntity<Actividad> getActividad(@PathVariable Long id) {
        return actividadRepository.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
    
    @PostMapping("/actividades")
    public ResponseEntity<?> createActividad(@RequestBody Map<String, Object> request) {
        Actividad actividad = new Actividad();
        actividad.setCodigo((String) request.get("codigo"));
        actividad.setNombre((String) request.get("nombre"));
        actividad.setDescripcion((String) request.get("descripcion"));
        actividad.setRequiereBloque((Boolean) request.getOrDefault("requiereBloque", true));
        actividad.setRequierePases((Boolean) request.getOrDefault("requierePases", false));
        actividad.setEsVarios((Boolean) request.getOrDefault("esVarios", false));
        
        if (request.get("laborMadre") != null) {
            actividad.setLaborMadre((String) request.get("laborMadre"));
        }
        
        if (request.get("areaId") != null) {
            Long areaId = Long.valueOf(request.get("areaId").toString());
            areaRepository.findById(areaId).ifPresent(actividad::setArea);
        }
        
        if (request.get("productoId") != null) {
            Long productoId = Long.valueOf(request.get("productoId").toString());
            productoRepository.findById(productoId).ifPresent(actividad::setProducto);
        }
        
        return ResponseEntity.ok(actividadRepository.save(actividad));
    }
    
    @PutMapping("/actividades/{id}")
    public ResponseEntity<?> updateActividad(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        return actividadRepository.findById(id)
            .map(actividad -> {
                if (request.get("codigo") != null) actividad.setCodigo((String) request.get("codigo"));
                if (request.get("nombre") != null) actividad.setNombre((String) request.get("nombre"));
                if (request.get("descripcion") != null) actividad.setDescripcion((String) request.get("descripcion"));
                if (request.get("laborMadre") != null) actividad.setLaborMadre((String) request.get("laborMadre"));
                if (request.get("requiereBloque") != null) actividad.setRequiereBloque((Boolean) request.get("requiereBloque"));
                if (request.get("requierePases") != null) actividad.setRequierePases((Boolean) request.get("requierePases"));
                if (request.get("esVarios") != null) actividad.setEsVarios((Boolean) request.get("esVarios"));
                
                if (request.get("areaId") != null) {
                    Long areaId = Long.valueOf(request.get("areaId").toString());
                    areaRepository.findById(areaId).ifPresent(actividad::setArea);
                }
                
                if (request.get("productoId") != null) {
                    Long productoId = Long.valueOf(request.get("productoId").toString());
                    productoRepository.findById(productoId).ifPresent(actividad::setProducto);
                }
                
                return ResponseEntity.ok(actividadRepository.save(actividad));
            })
            .orElse(ResponseEntity.notFound().build());
    }
    
    @DeleteMapping("/actividades/{id}")
    public ResponseEntity<?> deleteActividad(@PathVariable Long id) {
        return actividadRepository.findById(id)
            .map(actividad -> {
                actividad.setActivo(false);
                actividadRepository.save(actividad);
                return ResponseEntity.ok().build();
            })
            .orElse(ResponseEntity.notFound().build());
    }

    // ==================== UNIDADES DE MEDIDA ====================
    
    @GetMapping("/unidades")
    public List<UnidadMedida> getUnidades() {
        return unidadMedidaRepository.findAll();
    }
    
    @PostMapping("/unidades")
    public UnidadMedida createUnidad(@RequestBody UnidadMedida unidad) {
        return unidadMedidaRepository.save(unidad);
    }
    
    @PutMapping("/unidades/{id}")
    public ResponseEntity<UnidadMedida> updateUnidad(@PathVariable Long id, @RequestBody UnidadMedida unidadDetails) {
        return unidadMedidaRepository.findById(id)
            .map(unidad -> {
                unidad.setNombre(unidadDetails.getNombre());
                unidad.setCodigo(unidadDetails.getCodigo());
                unidad.setDescripcion(unidadDetails.getDescripcion());
                unidad.setFactorAHoras(unidadDetails.getFactorAHoras());
                unidad.setTipoConversion(unidadDetails.getTipoConversion());
                return ResponseEntity.ok(unidadMedidaRepository.save(unidad));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    // ==================== RENDIMIENTOS ====================
    
    @GetMapping("/rendimientos")
    public List<Rendimiento> getRendimientos() {
        return rendimientoRepository.findByActivoTrue();
    }
    
    @GetMapping("/rendimientos/actividad/{actividadId}")
    public List<Rendimiento> getRendimientosByActividad(@PathVariable Long actividadId) {
        return actividadRepository.findById(actividadId)
            .map(actividad -> rendimientoRepository.findByActividad(actividad))
            .orElse(List.of());
    }
    
    @GetMapping("/rendimientos/producto/{productoId}/actividad/{actividadId}")
    public ResponseEntity<Rendimiento> getRendimiento(@PathVariable Long productoId, @PathVariable Long actividadId) {
        Producto producto = productoRepository.findById(productoId).orElse(null);
        Actividad actividad = actividadRepository.findById(actividadId).orElse(null);
        
        if (actividad == null) {
            return ResponseEntity.notFound().build();
        }
        
        return rendimientoRepository.findByProductoAndActividad(producto, actividad)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
    
    @PostMapping("/rendimientos")
    public ResponseEntity<?> createRendimiento(HttpServletRequest httpReq, @RequestBody Map<String, Object> request) {
        if (!puedeModificarRendimientos(httpReq)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Acceso denegado: No tienes permisos para modificar rendimientos"));
        }
        
        Rendimiento rendimiento = new Rendimiento();
        rendimiento.setRendimiento(Double.valueOf(request.get("rendimiento").toString()));
        rendimiento.setNotas((String) request.get("notes") != null ? (String) request.get("notes") : (String) request.get("notas"));
        
        if (request.get("grupo") != null) {
            rendimiento.setGrupo((String) request.get("grupo"));
        }
        
        // Producto
        if (request.get("productoId") != null) {
            Long productoId = Long.valueOf(request.get("productoId").toString());
            productoRepository.findById(productoId).ifPresent(rendimiento::setProducto);
        } else if (request.get("producto") instanceof Map) {
            Object idObj = ((Map<?,?>) request.get("producto")).get("id");
            if (idObj != null) {
                productoRepository.findById(Long.valueOf(idObj.toString())).ifPresent(rendimiento::setProducto);
            }
        }
        
        // Actividad
        if (request.get("actividadId") != null) {
            Long actividadId = Long.valueOf(request.get("actividadId").toString());
            actividadRepository.findById(actividadId).ifPresent(rendimiento::setActividad);
        } else if (request.get("actividad") instanceof Map) {
            Object idObj = ((Map<?,?>) request.get("actividad")).get("id");
            if (idObj != null) {
                actividadRepository.findById(Long.valueOf(idObj.toString())).ifPresent(rendimiento::setActividad);
            }
        }
        
        // Unidad de medida
        if (request.get("unidadId") != null) {
            Long unidadId = Long.valueOf(request.get("unidadId").toString());
            unidadMedidaRepository.findById(unidadId).ifPresent(rendimiento::setUnidad);
        } else if (request.get("unidad") instanceof Map) {
            Object idObj = ((Map<?,?>) request.get("unidad")).get("id");
            if (idObj != null) {
                unidadMedidaRepository.findById(Long.valueOf(idObj.toString())).ifPresent(rendimiento::setUnidad);
            }
        }
        
        // Asegurar que la actividad tenga la laborMadre y producto correspondiente al grupo y rendimiento
        if (rendimiento.getActividad() != null) {
            Actividad act = rendimiento.getActividad();
            boolean changed = false;
            if (rendimiento.getGrupo() != null && (act.getLaborMadre() == null || !act.getLaborMadre().equals(rendimiento.getGrupo()))) {
                act.setLaborMadre(rendimiento.getGrupo());
                changed = true;
            }
            if (rendimiento.getProducto() != null && act.getProducto() == null) {
                act.setProducto(rendimiento.getProducto());
                changed = true;
            }
            if (changed) {
                actividadRepository.save(act);
            }
        }
        
        Rendimiento saved = rendimientoRepository.save(rendimiento);
        planificacionService.propagarRendimiento(saved);
        return ResponseEntity.ok(saved);
    }
    
    @PutMapping("/rendimientos/{id}")
    public ResponseEntity<?> updateRendimiento(HttpServletRequest httpReq, @PathVariable Long id, @RequestBody Map<String, Object> body) {
        if (!puedeModificarRendimientos(httpReq)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Acceso denegado: No tienes permisos para modificar rendimientos"));
        }
        
        return rendimientoRepository.findById(id)
            .map(rendimiento -> {
                if (body.get("rendimiento") != null) {
                    rendimiento.setRendimiento(Double.valueOf(body.get("rendimiento").toString()));
                }
                if (body.get("notas") != null) {
                    rendimiento.setNotas((String) body.get("notas"));
                }
                if (body.get("grupo") != null) {
                    rendimiento.setGrupo((String) body.get("grupo"));
                }
                // Actualizar producto (cultivo)
                if (body.get("productoId") != null) {
                    Long productoId = Long.valueOf(body.get("productoId").toString());
                    productoRepository.findById(productoId).ifPresent(rendimiento::setProducto);
                } else if (body.get("producto") instanceof Map) {
                    Object idObj = ((Map<?,?>) body.get("producto")).get("id");
                    if (idObj != null) {
                        productoRepository.findById(Long.valueOf(idObj.toString())).ifPresent(rendimiento::setProducto);
                    }
                }
                // Actualizar actividad (labor)
                if (body.get("actividadId") != null) {
                    Long actividadId = Long.valueOf(body.get("actividadId").toString());
                    actividadRepository.findById(actividadId).ifPresent(rendimiento::setActividad);
                } else if (body.get("actividad") instanceof Map) {
                    Object idObj = ((Map<?,?>) body.get("actividad")).get("id");
                    if (idObj != null) {
                        actividadRepository.findById(Long.valueOf(idObj.toString())).ifPresent(rendimiento::setActividad);
                    }
                }
                // Actualizar unidad de medida
                if (body.get("unidadId") != null) {
                    Long unidadId = Long.valueOf(body.get("unidadId").toString());
                    unidadMedidaRepository.findById(unidadId).ifPresent(rendimiento::setUnidad);
                } else if (body.get("unidad") instanceof Map) {
                    Object idObj = ((Map<?,?>) body.get("unidad")).get("id");
                    if (idObj != null) {
                        unidadMedidaRepository.findById(Long.valueOf(idObj.toString())).ifPresent(rendimiento::setUnidad);
                    }
                }
                
                // Asegurar que la actividad tenga la laborMadre y producto correspondiente al grupo y rendimiento
                if (rendimiento.getActividad() != null) {
                    Actividad act = rendimiento.getActividad();
                    boolean changed = false;
                    if (rendimiento.getGrupo() != null && (act.getLaborMadre() == null || !act.getLaborMadre().equals(rendimiento.getGrupo()))) {
                        act.setLaborMadre(rendimiento.getGrupo());
                        changed = true;
                    }
                    if (rendimiento.getProducto() != null && act.getProducto() == null) {
                        act.setProducto(rendimiento.getProducto());
                        changed = true;
                    }
                    if (changed) {
                        actividadRepository.save(act);
                    }
                }
                
                Rendimiento saved = rendimientoRepository.save(rendimiento);
                planificacionService.propagarRendimiento(saved);
                return ResponseEntity.ok(saved);
            })
            .orElse(ResponseEntity.notFound().build());
    }
    
    @DeleteMapping("/rendimientos/{id}")
    public ResponseEntity<?> deleteRendimiento(HttpServletRequest httpReq, @PathVariable Long id) {
        if (!puedeModificarRendimientos(httpReq)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Acceso denegado: No tienes permisos para modificar rendimientos"));
        }
        return rendimientoRepository.findById(id)
            .map(rendimiento -> {
                rendimiento.setActivo(false);
                rendimientoRepository.save(rendimiento);
                return ResponseEntity.ok().build();
            })
            .orElse(ResponseEntity.notFound().build());
    }
    
    @DeleteMapping("/rendimientos-limpiar")
    public ResponseEntity<?> limpiarRendimientos(HttpServletRequest httpReq) {
        if (!puedeModificarRendimientos(httpReq)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Acceso denegado: No tienes permisos para modificar rendimientos"));
        }
        try {
            rendimientoRepository.deleteAll();
            Map<String, String> response = new HashMap<>();
            response.put("mensaje", "Todos los rendimientos han sido eliminados");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Error al limpiar: " + e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    // ==================== DASHBOARD / RESUMEN ====================
    
    @GetMapping("/dashboard")
    public Map<String, Object> getDashboard() {
        Map<String, Object> dashboard = new HashMap<>();
        
        // Conteos generales
        dashboard.put("totalAreas", areaRepository.findByActivoTrue().size());
        dashboard.put("totalProductos", productoRepository.findByActivoTrue().size());
        dashboard.put("totalActividades", actividadRepository.findByActivoTrue().size());
        dashboard.put("totalTrabajadores", trabajadorRepository.findByActivoTrue().size());
        dashboard.put("totalRendimientos", rendimientoRepository.findByActivoTrue().size());
        
        // Personal por área
        List<Map<String, Object>> personalPorArea = areaRepository.findByActivoTrue().stream()
            .map(area -> {
                Map<String, Object> item = new HashMap<>();
                item.put("area", area.getNombre());
                item.put("codigo", area.getCodigo());
                item.put("cantidad", trabajadorRepository.countByAreaAndActivoTrue(area));
                return item;
            })
            .toList();
        dashboard.put("personalPorArea", personalPorArea);
        
        return dashboard;
    }

    // ==================== IMPORTACIÓN DE RENDIMIENTOS ====================
    
    @PostMapping("/importar-rendimientos")
    public ResponseEntity<?> importarRendimientos(HttpServletRequest httpReq, @RequestBody(required = false) Map<String, String> body) {
        if (!puedeModificarRendimientos(httpReq)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Acceso denegado: No tienes permisos para modificar rendimientos"));
        }
        
        try {
            // Usar ruta del request o ruta por defecto
            String rutaArchivo;
            if (body != null && body.containsKey("rutaArchivo")) {
                rutaArchivo = body.get("rutaArchivo");
            } else {
                // Ruta por defecto: archivo RENDIMIENTOS.csv en el directorio del backend
                rutaArchivo = "RENDIMIENTOS.csv";
            }
            
            Map<String, Object> resultado = importacionRendimientoService.importarDesdeCSV(rutaArchivo);
            return ResponseEntity.ok(resultado);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Error al importar: " + e.getMessage());
            error.put("tipo", e.getClass().getSimpleName());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * Importar rendimientos con formato GRUPO;PRODUCTO;LABOR;RENDIMIENTO
     * Usa el archivo cons_rendimientos.csv por defecto
     */
    @PostMapping("/importar-rendimientos-grupos")
    public ResponseEntity<?> importarRendimientosConGrupos(HttpServletRequest httpReq, @RequestBody(required = false) Map<String, String> body) {
        if (!puedeModificarRendimientos(httpReq)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Acceso denegado: No tienes permisos para modificar rendimientos"));
        }
        
        try {
            String rutaArchivo;
            if (body != null && body.containsKey("rutaArchivo")) {
                rutaArchivo = body.get("rutaArchivo");
            } else {
                rutaArchivo = "cons_rendimientos.csv";
            }
            
            Map<String, Object> resultado = importacionRendimientoService.importarConGrupos(rutaArchivo);
            return ResponseEntity.ok(resultado);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Error al importar: " + e.getMessage());
            error.put("tipo", e.getClass().getSimpleName());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    @GetMapping("/importar-rendimientos/preview")
    public ResponseEntity<?> previewImportacion() {
        Map<String, Object> preview = new HashMap<>();
        preview.put("densidades", Map.of(
            "GYPSOPHILA", 600,
            "VERONICA", 600,
            "HYPERICUM", 1200,
            "SOLIDAGO", 600,
            "SUNFLOWER", 1350
        ));
        preview.put("conversiones", Map.of(
            "plantas/hora", "÷ densidad = camas/hora",
            "semillas/hora", "÷ densidad = camas/hora",
            "camas/hora", "sin conversión",
            "mallas/hora", "se mantiene (métrica de cosecha)",
            "pingos/hora", "se mantiene (métrica de infraestructura)"
        ));
        preview.put("archivoEsperado", "RENDIMIENTOS.csv");
        preview.put("formatoCSV", "CULTIVO;LABOR;UNIDAD;RENDIMIENTO");
        return ResponseEntity.ok(preview);
    }
    
    /**
     * Sincronizar laborMadre de actividades desde los rendimientos
     * Esto actualiza las actividades existentes con el grupo del rendimiento relacionado
     */
    @PostMapping("/sync-labor-madre")
    public ResponseEntity<?> syncLaborMadre(HttpServletRequest httpReq) {
        if (!puedeModificarRendimientos(httpReq)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Acceso denegado: No tienes permisos para modificar rendimientos"));
        }
        Map<String, Object> resultado = new HashMap<>();
        int actualizadas = 0;
        
        List<Rendimiento> rendimientos = rendimientoRepository.findAll();
        for (Rendimiento r : rendimientos) {
            if (r.getGrupo() != null && r.getActividad() != null) {
                Actividad act = r.getActividad();
                if (act.getLaborMadre() == null || !act.getLaborMadre().equals(r.getGrupo())) {
                    act.setLaborMadre(r.getGrupo());
                    if (r.getProducto() != null && act.getProducto() == null) {
                        act.setProducto(r.getProducto());
                    }
                    actividadRepository.save(act);
                    actualizadas++;
                }
            }
        }
        
        resultado.put("actividadesActualizadas", actualizadas);
        resultado.put("totalRendimientos", rendimientos.size());
        return ResponseEntity.ok(resultado);
    }
}
