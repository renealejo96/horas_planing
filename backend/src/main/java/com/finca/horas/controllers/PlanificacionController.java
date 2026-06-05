package com.finca.horas.controllers;

import com.finca.horas.entities.PlanificacionActividad;
import com.finca.horas.entities.Semana;
import com.finca.horas.services.PlanificacionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/planificacion")
@CrossOrigin(origins = "*")
public class PlanificacionController {

    @Autowired
    private PlanificacionService planificacionService;

    // ==================== SEMANAS ====================

    @GetMapping("/semanas")
    public List<Semana> obtenerSemanas() {
        return planificacionService.obtenerSemanas();
    }
    
    @GetMapping("/semanas/disponibles")
    public List<Semana> obtenerSemanasDisponibles() {
        return planificacionService.obtenerSemanasDisponibles();
    }
    
    @GetMapping("/semana-actual")
    public ResponseEntity<Semana> obtenerSemanaActual() {
        return planificacionService.obtenerSemanaActual()
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
    
    @GetMapping("/semana-siguiente")
    public ResponseEntity<Semana> obtenerSemanaSiguiente() {
        return planificacionService.obtenerSemanaSiguiente()
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/semanas")
    public Semana crearSemana(@RequestBody Semana semana) {
        return planificacionService.guardarSemana(semana);
    }
    
    @PostMapping("/semanas/generar")
    public List<Semana> generarSemanas(@RequestBody Map<String, Integer> request) {
        Integer anio = request.get("anio");
        Integer cantidad = request.getOrDefault("cantidad", 52);
        return planificacionService.generarSemanasAnio(anio, cantidad);
    }
    
    @PutMapping("/semanas/{codigoAass}/habilitar")
    public Semana habilitarSemana(@PathVariable String codigoAass) {
        return planificacionService.habilitarSemana(codigoAass);
    }

    @PutMapping("/semanas/{codigoAass}/cerrar")
    public Semana cerrarPlanificacion(@PathVariable String codigoAass) {
        return planificacionService.cerrarPlanificacion(codigoAass);
    }
    
    @PutMapping("/semanas/{codigoAass}/estado")
    public ResponseEntity<Semana> cambiarEstado(@PathVariable String codigoAass, @RequestBody Map<String, String> request) {
        String estado = request.get("estado");
        return planificacionService.cambiarEstadoSemana(codigoAass, estado)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    // ==================== PLANIFICACIÓN DE ACTIVIDADES ====================

    @GetMapping("/actividades")
    public List<PlanificacionActividad> obtenerPlanificacion() {
        return planificacionService.obtenerPlanificacion();
    }
    
    @GetMapping("/actividades/semana/{codigoAass}")
    public List<PlanificacionActividad> obtenerPlanificacionPorSemana(@PathVariable String codigoAass) {
        return planificacionService.obtenerPlanificacionPorSemana(codigoAass);
    }
    
    @GetMapping("/actividades/semana/{codigoAass}/area/{areaId}")
    public List<PlanificacionActividad> obtenerPlanificacionPorSemanaYArea(
            @PathVariable String codigoAass, 
            @PathVariable Long areaId) {
        return planificacionService.obtenerPlanificacionPorSemanaYArea(codigoAass, areaId);
    }

    @PostMapping("/actividades")
    public PlanificacionActividad planificarActividad(@RequestBody PlanificacionActividad act) {
        return planificacionService.planificarActividad(act);
    }
    
    @PutMapping("/actividades/{id}")
    public ResponseEntity<PlanificacionActividad> actualizarPlanificacion(
            @PathVariable Long id, 
            @RequestBody PlanificacionActividad act) {
        return planificacionService.actualizarPlanificacion(id, act)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
    
    @DeleteMapping("/actividades/{id}")
    public ResponseEntity<?> eliminarPlanificacion(@PathVariable Long id) {
        if (planificacionService.eliminarPlanificacion(id)) {
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }
}
