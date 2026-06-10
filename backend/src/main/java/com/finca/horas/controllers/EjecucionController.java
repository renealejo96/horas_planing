package com.finca.horas.controllers;

import com.finca.horas.entities.EjecucionActividad;
import com.finca.horas.entities.Actividad;
import com.finca.horas.repositories.ActividadRepository;
import com.finca.horas.repositories.EjecucionActividadRepository;
import com.finca.horas.repositories.PlanificacionActividadRepository;
import com.finca.horas.services.EjecucionService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ejecucion")
@CrossOrigin(origins = "*")
public class EjecucionController {

    @Autowired
    private EjecucionService ejecucionService;

    @Autowired
    private ActividadRepository actividadRepository;

    @Autowired
    private EjecucionActividadRepository ejecucionActividadRepository;

    @Autowired
    private PlanificacionActividadRepository planificacionActividadRepository;

    @GetMapping
    public List<EjecucionActividad> obtenerEjecuciones() {
        return ejecucionService.obtenerEjecuciones();
    }

    @GetMapping("/semana/{codigoAass}")
    public List<EjecucionActividad> obtenerEjecucionesPorSemana(@PathVariable String codigoAass) {
        return ejecucionService.obtenerEjecucionesPorSemana(codigoAass);
    }

    @PostMapping
    public ResponseEntity<?> registrarEjecucion(HttpServletRequest request, @RequestBody EjecucionActividad ejecucion) {
        String rol = (String) request.getAttribute("rol");
        if ("ADMIN".equals(rol)) {
            return ResponseEntity.ok(ejecucionService.registrarEjecucion(ejecucion));
        }

        Long actId = null;
        if (ejecucion.getActividad() != null) {
            actId = ejecucion.getActividad().getId();
        } else if (ejecucion.getPlanificacion() != null && ejecucion.getPlanificacion().getId() != null) {
            actId = planificacionActividadRepository.findById(ejecucion.getPlanificacion().getId())
                .map(p -> p.getActividad() != null ? p.getActividad().getId() : null)
                .orElse(null);
        }
        
        if (actId == null || !esActividadPermitida(actId, request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Acceso denegado: No tienes permisos para registrar ejecución de esta actividad"));
        }
        
        return ResponseEntity.ok(ejecucionService.registrarEjecucion(ejecucion));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> actualizarEjecucion(HttpServletRequest request, @PathVariable Long id, @RequestBody EjecucionActividad ejecucion) {
        if (!esEjecucionPermitida(id, request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Acceso denegado: No tienes permisos para modificar este registro de ejecución"));
        }
        return ResponseEntity.ok(ejecucionService.actualizarEjecucion(id, ejecucion));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminarEjecucion(HttpServletRequest request, @PathVariable Long id) {
        if (!esEjecucionPermitida(id, request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Acceso denegado: No tienes permisos para eliminar este registro de ejecución"));
        }
        ejecucionService.eliminarEjecucion(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/recalcular-todo")
    public ResponseEntity<?> recalcularTodo(HttpServletRequest request) {
        String rol = (String) request.getAttribute("rol");
        if (!"ADMIN".equals(rol)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Acceso denegado: Solo administradores pueden recalcular todo"));
        }
        ejecucionService.recalcularTodo();
        return ResponseEntity.ok().build();
    }

    // Helpers de validación de permisos
    private boolean esActividadPermitida(Long actividadId, HttpServletRequest request) {
        String rol = (String) request.getAttribute("rol");
        if ("ADMIN".equals(rol)) {
            return true;
        }
        if (actividadId == null) {
            return false;
        }
        String laborMadre = actividadRepository.findById(actividadId)
            .map(Actividad::getLaborMadre)
            .orElse(null);
        if (laborMadre == null) {
            return false;
        }
        String permitidasStr = (String) request.getAttribute("actividadesPermitidas");
        if (permitidasStr == null || permitidasStr.trim().isEmpty()) {
            return false;
        }
        List<String> permitidas = java.util.Arrays.stream(permitidasStr.split(","))
            .map(String::trim)
            .map(String::toUpperCase)
            .toList();
        return permitidas.contains(laborMadre.toUpperCase());
    }

    private boolean esEjecucionPermitida(Long ejecId, HttpServletRequest request) {
        String rol = (String) request.getAttribute("rol");
        if ("ADMIN".equals(rol)) {
            return true;
        }
        if (ejecId == null) {
            return false;
        }
        return ejecucionActividadRepository.findById(ejecId)
            .map(e -> {
                if (e.getActividad() != null) {
                    return esActividadPermitida(e.getActividad().getId(), request);
                } else if (e.getPlanificacion() != null && e.getPlanificacion().getActividad() != null) {
                    return esActividadPermitida(e.getPlanificacion().getActividad().getId(), request);
                }
                return false;
            })
            .orElse(false);
    }
}
