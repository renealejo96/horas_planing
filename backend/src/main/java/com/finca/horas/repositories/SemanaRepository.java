package com.finca.horas.repositories;

import com.finca.horas.entities.Semana;
import com.finca.horas.entities.Semana.EstadoSemana;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface SemanaRepository extends JpaRepository<Semana, Long> {
    Optional<Semana> findByCodigoAass(String codigoAass);
    Optional<Semana> findByAnioAndSemana(Integer anio, Integer semana);
    List<Semana> findByEstado(EstadoSemana estado);
    
    @Query("SELECT s FROM Semana s WHERE s.fechaInicio <= :fecha AND s.fechaFin >= :fecha")
    Optional<Semana> findByFecha(LocalDate fecha);
    
    @Query("SELECT s FROM Semana s WHERE s.estado IN ('PLANIFICACION', 'EN_EJECUCION') ORDER BY s.fechaInicio")
    List<Semana> findSemanasDisponibles();
}
