package com.finca.horas.repositories;

import com.finca.horas.entities.UnidadMedida;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UnidadMedidaRepository extends JpaRepository<UnidadMedida, Long> {
    Optional<UnidadMedida> findByCodigo(String codigo);
}
