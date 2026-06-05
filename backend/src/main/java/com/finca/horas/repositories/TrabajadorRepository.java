package com.finca.horas.repositories;

import com.finca.horas.entities.Trabajador;
import com.finca.horas.entities.Area;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface TrabajadorRepository extends JpaRepository<Trabajador, Long> {
    Optional<Trabajador> findByCedula(String cedula);
    List<Trabajador> findByActivoTrue();
    List<Trabajador> findByArea(Area area);
    List<Trabajador> findByAreaAndActivoTrue(Area area);
    List<Trabajador> findByCargo(String cargo);
    long countByAreaAndActivoTrue(Area area);
}
