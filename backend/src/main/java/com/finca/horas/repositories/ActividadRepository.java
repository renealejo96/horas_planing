package com.finca.horas.repositories;

import com.finca.horas.entities.Actividad;
import com.finca.horas.entities.Area;
import com.finca.horas.entities.Producto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ActividadRepository extends JpaRepository<Actividad, Long> {
    Optional<Actividad> findByCodigo(String codigo);
    List<Actividad> findByArea(Area area);
    List<Actividad> findByAreaAndActivoTrue(Area area);
    List<Actividad> findByProducto(Producto producto);
    List<Actividad> findByActivoTrue();
}
