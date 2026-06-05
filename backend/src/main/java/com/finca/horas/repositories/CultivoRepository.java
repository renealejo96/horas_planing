package com.finca.horas.repositories;

import com.finca.horas.entities.Cultivo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CultivoRepository extends JpaRepository<Cultivo, Long> {
}
