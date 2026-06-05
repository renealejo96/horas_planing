package com.finca.horas.repositories;

import com.finca.horas.entities.EjecucionActividad;
import com.finca.horas.entities.PlanificacionActividad;
import com.finca.horas.entities.Semana;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface EjecucionActividadRepository extends JpaRepository<EjecucionActividad, Long> {
    
    List<EjecucionActividad> findByFecha(LocalDate fecha);
    
    List<EjecucionActividad> findBySemana(Semana semana);
    
    List<EjecucionActividad> findByPlanificacion(PlanificacionActividad planificacion);
    
    @Query("SELECT e FROM EjecucionActividad e WHERE e.semana.codigoAass = :codigoAass")
    List<EjecucionActividad> findBySemanaCodigoAass(@Param("codigoAass") String codigoAass);
    
    @Query("SELECT e FROM EjecucionActividad e WHERE e.semana.codigoAass = :codigoAass AND e.fecha = :fecha")
    List<EjecucionActividad> findBySemanaAndFecha(@Param("codigoAass") String codigoAass, @Param("fecha") LocalDate fecha);
    
    @Query("SELECT COALESCE(SUM(e.horasReales), 0) FROM EjecucionActividad e WHERE e.planificacion.id = :planificacionId")
    Double sumHorasByPlanificacion(@Param("planificacionId") Long planificacionId);
    
    @Query("SELECT COALESCE(SUM(e.horasReales), 0) FROM EjecucionActividad e WHERE e.semana.id = :semanaId")
    Double sumHorasBySemana(@Param("semanaId") Long semanaId);
    
    @Query("SELECT COALESCE(SUM(e.horasReales), 0) FROM EjecucionActividad e WHERE e.semana.codigoAass = :codigoAass")
    Double sumHorasBySemanaCodigoAass(@Param("codigoAass") String codigoAass);
    
    @Query("SELECT COALESCE(SUM(e.horasReales), 0) FROM EjecucionActividad e WHERE e.semana.codigoAass = :codigoAass AND e.fecha = :fecha")
    Double sumHorasDelDia(@Param("codigoAass") String codigoAass, @Param("fecha") LocalDate fecha);
    
    @Query("SELECT COALESCE(SUM(e.unidadesReales), 0) FROM EjecucionActividad e WHERE e.planificacion.id = :planificacionId")
    Double sumUnidadesByPlanificacion(@Param("planificacionId") Long planificacionId);
}
