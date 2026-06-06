package com.finca.horas.services;

import com.finca.horas.entities.PlanificacionActividad;
import com.finca.horas.entities.PlanificacionDiaria;
import com.finca.horas.repositories.PlanificacionActividadRepository;
import com.finca.horas.repositories.PlanificacionDiariaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
public class PlanificacionDiariaService {

    @Autowired
    private PlanificacionDiariaRepository planDiariaRepo;

    @Autowired
    private PlanificacionActividadRepository planActividadRepo;

    /**
     * Obtiene todas las planificaciones diarias para una fecha específica
     */
    public List<PlanificacionDiaria> obtenerPlanDia(LocalDate fecha) {
        return planDiariaRepo.findByFecha(fecha);
    }

    /**
     * Obtiene las planificaciones diarias de una semana específica
     */
    public List<PlanificacionDiaria> obtenerPlanSemana(String codigoAass) {
        return planDiariaRepo.findBySemana(codigoAass);
    }

    /**
     * Obtiene las planificaciones diarias para una semana y fecha específica
     */
    public List<PlanificacionDiaria> obtenerPlanSemanaFecha(String codigoAass, LocalDate fecha) {
        return planDiariaRepo.findBySemanaAndFecha(codigoAass, fecha);
    }

    /**
     * Crea o actualiza una asignación diaria
     * @throws IllegalArgumentException si las horas exceden lo disponible
     */
    @Transactional
    public PlanificacionDiaria crearOActualizarAsignacion(Long planificacionId, LocalDate fecha, 
            Double horasAsignadas, Double unidadesAsignadas, String observacion) {
        
        PlanificacionActividad planActividad = planActividadRepo.findById(planificacionId)
            .orElseThrow(() -> new IllegalArgumentException("Planificación no encontrada: " + planificacionId));

        // Validar que no exceda las horas disponibles de la planificación semanal
        Double horasSemanales = planActividad.getHorasAjustadas() != null 
            ? planActividad.getHorasAjustadas() 
            : planActividad.getHorasCalculadas();
        
        if (horasSemanales == null) {
            horasSemanales = 0.0;
        }

        // Sumar horas ya asignadas a otros días (excluyendo el día actual si existe)
        Double horasYaAsignadas = planDiariaRepo.sumHorasAsignadasByPlanificacion(planificacionId);
        
        Optional<PlanificacionDiaria> existente = planDiariaRepo.findByPlanificacionAndFecha(planActividad, fecha);
        if (existente.isPresent()) {
            horasYaAsignadas -= existente.get().getHorasAsignadas();
        }

        // Double horasDisponibles = horasSemanales - horasYaAsignadas;
        
        // Remove strict restriction to allow flexible daily scheduling (e.g. for weekends or adjustments)
        // if (horasAsignadas > horasDisponibles) {
        //     throw new IllegalArgumentException(
        //         String.format("Horas solicitadas (%.1f) exceden las disponibles (%.1f) para esta actividad", 
        //             horasAsignadas, horasDisponibles));
        // }

        // Crear o actualizar
        PlanificacionDiaria planDiaria;
        if (existente.isPresent()) {
            planDiaria = existente.get();
        } else {
            planDiaria = new PlanificacionDiaria();
            planDiaria.setPlanificacion(planActividad);
            planDiaria.setFecha(fecha);
        }
        
        planDiaria.setHorasAsignadas(horasAsignadas);
        planDiaria.setUnidadesAsignadas(unidadesAsignadas);
        planDiaria.setObservacion(observacion);
        
        return planDiariaRepo.save(planDiaria);
    }

    /**
     * Elimina una asignación diaria
     */
    @Transactional
    public void eliminarAsignacion(Long id) {
        planDiariaRepo.deleteById(id);
    }

    /**
     * Obtiene las horas disponibles para asignar de una planificación semanal
     */
    public Double obtenerHorasDisponibles(Long planificacionId) {
        PlanificacionActividad planActividad = planActividadRepo.findById(planificacionId)
            .orElseThrow(() -> new IllegalArgumentException("Planificación no encontrada"));

        Double horasSemanales = planActividad.getHorasAjustadas() != null 
            ? planActividad.getHorasAjustadas() 
            : planActividad.getHorasCalculadas();
        
        if (horasSemanales == null) return 0.0;

        Double horasAsignadas = planDiariaRepo.sumHorasAsignadasByPlanificacion(planificacionId);
        return horasSemanales - horasAsignadas;
    }

    /**
     * Obtiene el total de horas planificadas para un día específico de una semana
     */
    public Double obtenerTotalHorasDia(String codigoAass, LocalDate fecha) {
        return planDiariaRepo.sumHorasPlanificadasDelDia(codigoAass, fecha);
    }
}
