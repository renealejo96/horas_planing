package com.finca.horas.repositories;

import com.finca.horas.entities.AsignacionPersonal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AsignacionPersonalRepository extends JpaRepository<AsignacionPersonal, Long> {
}
