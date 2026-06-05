package com.finca.horas.repositories;

import com.finca.horas.entities.Bloque;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BloqueRepository extends JpaRepository<Bloque, Long> {
}
