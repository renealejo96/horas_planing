package com.finca.horas.controllers;

import com.finca.horas.entities.PlanificacionDiaria;
import com.finca.horas.entities.PlanificacionActividad;
import com.finca.horas.repositories.ActividadRepository;
import com.finca.horas.repositories.PlanificacionActividadRepository;
import com.finca.horas.repositories.PlanificacionDiariaRepository;
import com.finca.horas.services.ComparativaService;
import com.finca.horas.services.PlanificacionDiariaService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ComparativaController {

    @Autowired
    private ComparativaService comparativaService;

    @Autowired
    private PlanificacionDiariaService planDiariaService;

    @Autowired
    private ActividadRepository actividadRepository;

    @Autowired
    private PlanificacionActividadRepository planActividadRepository;

    @Autowired
    private PlanificacionDiariaRepository planDiariaRepository;

    // ==================== COMPARATIVAS ====================

    /**
     * Obtiene la comparativa detallada de un día específico
     * GET /api/comparativa/dia/2026-03-14
     */
    @GetMapping("/comparativa/dia/{fecha}")
    public ComparativaService.ComparativaDiaResumen obtenerComparativaDia(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
        return comparativaService.obtenerComparativaDia(fecha);
    }

    /**
     * Obtiene el resumen comparativo de toda la semana
     * GET /api/comparativa/semana/2612
     */
    @GetMapping("/comparativa/semana/{codigoAass}")
    public ResponseEntity<ComparativaService.ComparativaSemanaResumen> obtenerComparativaSemana(
            @PathVariable String codigoAass) {
        ComparativaService.ComparativaSemanaResumen resumen = comparativaService.obtenerComparativaSemana(codigoAass);
        if (resumen == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(resumen);
    }

    /**
     * Verifica el estado de alerta de horas de la semana
     * GET /api/comparativa/alerta/2612
     */
    @GetMapping("/comparativa/alerta/{codigoAass}")
    public ComparativaService.AlertaHoras obtenerAlerta(@PathVariable String codigoAass) {
        return comparativaService.verificarAlerta(codigoAass);
    }

    // ==================== PLANIFICACIÓN DIARIA ====================

    /**
     * Obtiene las planificaciones diarias para una fecha específica
     * GET /api/planificacion-diaria/2026-03-14
     */
    @GetMapping("/planificacion-diaria/{fecha}")
    public List<PlanificacionDiaria> obtenerPlanDia(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
        return planDiariaService.obtenerPlanDia(fecha);
    }

    /**
     * Obtiene las planificaciones diarias de una semana específica
     * GET /api/planificacion-diaria/semana/2612
     */
    @GetMapping("/planificacion-diaria/semana/{codigoAass}")
    public List<PlanificacionDiaria> obtenerPlanSemana(@PathVariable String codigoAass) {
        return planDiariaService.obtenerPlanSemana(codigoAass);
    }

    /**
     * Obtiene las planificaciones diarias de una semana y fecha específica
     * GET /api/planificacion-diaria/semana/2612/fecha/2026-03-14
     */
    @GetMapping("/planificacion-diaria/semana/{codigoAass}/fecha/{fecha}")
    public List<PlanificacionDiaria> obtenerPlanSemanaFecha(
            @PathVariable String codigoAass,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
        return planDiariaService.obtenerPlanSemanaFecha(codigoAass, fecha);
    }

    /**
     * Crea o actualiza una asignación de horas para un día
     * POST /api/planificacion-diaria
     * Body: { planificacionId: 1, fecha: "2026-03-14", horasAsignadas: 4.5, observacion: "..." }
     */
    @PostMapping("/planificacion-diaria")
    public ResponseEntity<?> crearAsignacionDiaria(HttpServletRequest request, @RequestBody Map<String, Object> body) {
        try {
            Long planificacionId = Long.valueOf(body.get("planificacionId").toString());
            
            if (!esPlanificacionPermitida(planificacionId, request)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Acceso denegado: No tienes permisos para planificar esta actividad"));
            }

            LocalDate fecha = LocalDate.parse(body.get("fecha").toString());
            Double horasAsignadas = Double.valueOf(body.get("horasAsignadas").toString());
            Double unidadesAsignadas = body.get("unidadesAsignadas") != null ? Double.valueOf(body.get("unidadesAsignadas").toString()) : null;
            String observacion = body.get("observacion") != null ? body.get("observacion").toString() : null;

            PlanificacionDiaria resultado = planDiariaService.crearOActualizarAsignacion(
                planificacionId, fecha, horasAsignadas, unidadesAsignadas, observacion);
            
            return ResponseEntity.ok(resultado);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Actualiza una asignación diaria existente
     * PUT /api/planificacion-diaria/{id}
     */
    @PutMapping("/planificacion-diaria/{id}")
    public ResponseEntity<?> actualizarAsignacion(
            HttpServletRequest request,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        try {
            if (!esAsignacionDiariaPermitida(id, request)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Acceso denegado: No tienes permisos para modificar esta planificación diaria"));
            }

            Long planificacionId = Long.valueOf(body.get("planificacionId").toString());
            
            if (!esPlanificacionPermitida(planificacionId, request)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Acceso denegado: No tienes permisos para reasignar a esta actividad"));
            }

            LocalDate fecha = LocalDate.parse(body.get("fecha").toString());
            Double horasAsignadas = Double.valueOf(body.get("horasAsignadas").toString());
            Double unidadesAsignadas = body.get("unidadesAsignadas") != null ? Double.valueOf(body.get("unidadesAsignadas").toString()) : null;
            String observacion = body.get("observacion") != null ? body.get("observacion").toString() : null;

            PlanificacionDiaria resultado = planDiariaService.crearOActualizarAsignacion(
                planificacionId, fecha, horasAsignadas, unidadesAsignadas, observacion);
            
            return ResponseEntity.ok(resultado);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Elimina una asignación diaria
     * DELETE /api/planificacion-diaria/{id}
     */
    @DeleteMapping("/planificacion-diaria/{id}")
    public ResponseEntity<?> eliminarAsignacion(HttpServletRequest request, @PathVariable Long id) {
        if (!esAsignacionDiariaPermitida(id, request)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Acceso denegado: No tienes permisos para eliminar esta planificación diaria"));
        }
        planDiariaService.eliminarAsignacion(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Obtiene las horas disponibles para asignar de una planificación
     * GET /api/planificacion-diaria/disponibles/{planificacionId}
     */
    @GetMapping("/planificacion-diaria/disponibles/{planificacionId}")
    public Map<String, Double> obtenerHorasDisponibles(@PathVariable Long planificacionId) {
        Double disponibles = planDiariaService.obtenerHorasDisponibles(planificacionId);
        return Map.of("horasDisponibles", disponibles);
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
            .map(act -> act.getLaborMadre())
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

    private boolean esPlanificacionPermitida(Long planId, HttpServletRequest request) {
        String rol = (String) request.getAttribute("rol");
        if ("ADMIN".equals(rol)) {
            return true;
        }
        if (planId == null) {
            return false;
        }
        return planActividadRepository.findById(planId)
            .map(p -> p.getActividad() != null && esActividadPermitida(p.getActividad().getId(), request))
            .orElse(false);
    }

    private boolean esAsignacionDiariaPermitida(Long asignacionId, HttpServletRequest request) {
        String rol = (String) request.getAttribute("rol");
        if ("ADMIN".equals(rol)) {
            return true;
        }
        if (asignacionId == null) {
            return false;
        }
        return planDiariaRepository.findById(asignacionId)
            .map(pd -> pd.getPlanificacion() != null && esPlanificacionPermitida(pd.getPlanificacion().getId(), request))
            .orElse(false);
    }
}
