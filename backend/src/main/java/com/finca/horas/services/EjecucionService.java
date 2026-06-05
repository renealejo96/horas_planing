package com.finca.horas.services;

import com.finca.horas.entities.EjecucionActividad;
import com.finca.horas.repositories.EjecucionActividadRepository;
import com.finca.horas.repositories.PlanificacionActividadRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EjecucionService {

    @Autowired
    private EjecucionActividadRepository ejecucionRepo;

    @Autowired
    private PlanificacionActividadRepository planActividadRepo;

    /**
     * Al arrancar el servicio, corrige registros históricos que tienen semana_id NULL
     * (guardados antes del fix del frontend).
     */
    @PostConstruct
    public void fixSemanaIds() {
        try {
            List<EjecucionActividad> sinSemana = ejecucionRepo.findAll().stream()
                .filter(e -> e.getSemana() == null && e.getPlanificacion() != null)
                .toList();
            
            sinSemana.forEach(e -> {
                var plan = e.getPlanificacion();
                if (plan.getSemana() != null) {
                    e.setSemana(plan.getSemana());
                    ejecucionRepo.save(e);
                }
            });
            
            if (!sinSemana.isEmpty()) {
                System.out.println("[EjecucionService] Corregidos " + sinSemana.size() + " registros sin semana_id.");
            }
            
            // Recalcular todos los totales para corregir errores de 0% de avance
            recalcularTodo();
            System.out.println("[EjecucionService] Totales recalculados con éxito.");
            
        } catch (Exception ex) {
            System.out.println("[EjecucionService] Error al corregir semana_ids o recalcular totales: " + ex.getMessage());
        }
    }

    public EjecucionActividad registrarEjecucion(EjecucionActividad ejecucion) {
        if (ejecucion.getPlanificacion() == null) {
            throw new RuntimeException("La ejecución debe estar vinculada a una planificación semanal.");
        }

        // Cargar planificación completa para obtener semana y actividad si faltan
        var plan = planActividadRepo.findById(ejecucion.getPlanificacion().getId())
            .orElseThrow(() -> new RuntimeException("Planificación no encontrada."));

        // Heredar semana y actividad si no están presentes
        if (ejecucion.getSemana() == null) ejecucion.setSemana(plan.getSemana());
        if (ejecucion.getActividad() == null) ejecucion.setActividad(plan.getActividad());

        // Calcular rendimiento real
        if (ejecucion.getHorasReales() != null && ejecucion.getHorasReales() > 0 
                && ejecucion.getUnidadesReales() != null) {
            double rendimientoReal = ejecucion.getUnidadesReales() / ejecucion.getHorasReales();
            ejecucion.setRendimientoReal(rendimientoReal);
        }

        EjecucionActividad guardada = ejecucionRepo.save(ejecucion);

        // Actualizar contadores en la planificación
        actualizarContadoresPlanificacion(plan);

        return guardada;
    }

    public void eliminarEjecucion(Long id) {
        EjecucionActividad e = ejecucionRepo.findById(id).orElse(null);
        if (e != null) {
            var plan = e.getPlanificacion();
            ejecucionRepo.delete(e);
            if (plan != null) {
                actualizarContadoresPlanificacion(plan);
            }
        }
    }

    public void actualizarContadoresPlanificacion(com.finca.horas.entities.PlanificacionActividad plan) {
        Double totalHoras = ejecucionRepo.sumHorasByPlanificacion(plan.getId());
        Double totalUnidades = ejecucionRepo.sumUnidadesByPlanificacion(plan.getId());
        
        plan.setHorasEjecutadas(totalHoras != null ? totalHoras : 0.0);
        plan.setUnidadesEjecutadas(totalUnidades != null ? totalUnidades : 0.0);
        planActividadRepo.save(plan);
    }

    public void recalcularTodo() {
        List<com.finca.horas.entities.PlanificacionActividad> todos = planActividadRepo.findAll();
        for (var p : todos) {
            actualizarContadoresPlanificacion(p);
        }
    }

    public List<EjecucionActividad> obtenerEjecuciones() {
        return ejecucionRepo.findAll();
    }

    public List<EjecucionActividad> obtenerEjecucionesPorSemana(String codigoAass) {
        return ejecucionRepo.findBySemanaCodigoAass(codigoAass);
    }

    public EjecucionActividad actualizarEjecucion(Long id, EjecucionActividad datosNuevos) {
        EjecucionActividad existente = ejecucionRepo.findById(id)
            .orElseThrow(() -> new RuntimeException("Ejecución no encontrada con ID: " + id));

        existente.setFecha(datosNuevos.getFecha());
        existente.setHorasReales(datosNuevos.getHorasReales());
        existente.setUnidadesReales(datosNuevos.getUnidadesReales());
        existente.setObservacion(datosNuevos.getObservacion());

        // Calcular rendimiento real
        if (existente.getHorasReales() != null && existente.getHorasReales() > 0 
                && existente.getUnidadesReales() != null) {
            double rendimientoReal = existente.getUnidadesReales() / existente.getHorasReales();
            existente.setRendimientoReal(rendimientoReal);
        } else {
            existente.setRendimientoReal(0.0);
        }

        EjecucionActividad guardada = ejecucionRepo.save(existente);

        // Actualizar contadores en la planificación
        if (guardada.getPlanificacion() != null) {
            actualizarContadoresPlanificacion(guardada.getPlanificacion());
        }

        return guardada;
    }
}
