package com.finca.horas.controllers;

import com.finca.horas.entities.PlanificacionDiaria;
import com.finca.horas.services.ComparativaService;
import com.finca.horas.services.PlanificacionDiariaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
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
    public ResponseEntity<?> crearAsignacionDiaria(@RequestBody Map<String, Object> request) {
        try {
            Long planificacionId = Long.valueOf(request.get("planificacionId").toString());
            LocalDate fecha = LocalDate.parse(request.get("fecha").toString());
            Double horasAsignadas = Double.valueOf(request.get("horasAsignadas").toString());
            Double unidadesAsignadas = request.get("unidadesAsignadas") != null ? Double.valueOf(request.get("unidadesAsignadas").toString()) : null;
            String observacion = request.get("observacion") != null ? request.get("observacion").toString() : null;

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
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        try {
            Long planificacionId = Long.valueOf(request.get("planificacionId").toString());
            LocalDate fecha = LocalDate.parse(request.get("fecha").toString());
            Double horasAsignadas = Double.valueOf(request.get("horasAsignadas").toString());
            Double unidadesAsignadas = request.get("unidadesAsignadas") != null ? Double.valueOf(request.get("unidadesAsignadas").toString()) : null;
            String observacion = request.get("observacion") != null ? request.get("observacion").toString() : null;

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
    public ResponseEntity<Void> eliminarAsignacion(@PathVariable Long id) {
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
}
