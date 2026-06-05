package com.finca.horas.repositories;

import com.finca.horas.entities.PlanificacionDiaria;
import com.finca.horas.entities.PlanificacionActividad;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface PlanificacionDiariaRepository extends JpaRepository<PlanificacionDiaria, Long> {
    
    List<PlanificacionDiaria> findByFecha(LocalDate fecha);
    
    List<PlanificacionDiaria> findByPlanificacion(PlanificacionActividad planificacion);
    
    Optional<PlanificacionDiaria> findByPlanificacionAndFecha(PlanificacionActividad planificacion, LocalDate fecha);
    
    @Query("SELECT pd FROM PlanificacionDiaria pd WHERE pd.planificacion.semana.codigoAass = :codigoAass AND pd.fecha = :fecha")
    List<PlanificacionDiaria> findBySemanaAndFecha(@Param("codigoAass") String codigoAass, @Param("fecha") LocalDate fecha);
    
    @Query("SELECT pd FROM PlanificacionDiaria pd WHERE pd.planificacion.semana.codigoAass = :codigoAass")
    List<PlanificacionDiaria> findBySemana(@Param("codigoAass") String codigoAass);
    
    @Query("SELECT COALESCE(SUM(pd.horasAsignadas), 0) FROM PlanificacionDiaria pd WHERE pd.planificacion.id = :planificacionId")
    Double sumHorasAsignadasByPlanificacion(@Param("planificacionId") Long planificacionId);
    
    @Query("SELECT COALESCE(SUM(pd.horasAsignadas), 0) FROM PlanificacionDiaria pd WHERE pd.planificacion.semana.codigoAass = :codigoAass AND pd.fecha = :fecha")
    Double sumHorasPlanificadasDelDia(@Param("codigoAass") String codigoAass, @Param("fecha") LocalDate fecha);
}
