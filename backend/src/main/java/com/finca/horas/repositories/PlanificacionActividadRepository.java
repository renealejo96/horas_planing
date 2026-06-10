package com.finca.horas.repositories;

import com.finca.horas.entities.PlanificacionActividad;
import com.finca.horas.entities.Semana;
import com.finca.horas.entities.Actividad;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PlanificacionActividadRepository extends JpaRepository<PlanificacionActividad, Long> {
    List<PlanificacionActividad> findBySemana(Semana semana);
    
    List<PlanificacionActividad> findByActividad(Actividad actividad);
    
    @Query("SELECT p FROM PlanificacionActividad p WHERE p.semana.codigoAass = :codigoAass")
    List<PlanificacionActividad> findByCodigoSemana(String codigoAass);
    
    @Query("SELECT p FROM PlanificacionActividad p WHERE p.semana.codigoAass = :codigoAass AND p.actividad.area.id = :areaId")
    List<PlanificacionActividad> findByCodigoSemanaAndAreaId(String codigoAass, Long areaId);
}
