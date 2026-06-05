package com.finca.horas.repositories;

import com.finca.horas.entities.Area;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.List;

@Repository
public interface AreaRepository extends JpaRepository<Area, Long> {
    Optional<Area> findByCodigo(String codigo);
    List<Area> findByActivoTrue();
}
