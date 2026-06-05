package com.finca.horas.entities;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "planificacion_diaria", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"planificacion_id", "fecha"})
})
@Data
public class PlanificacionDiaria {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "planificacion_id", nullable = false)
    private PlanificacionActividad planificacion;

    @Column(nullable = false)
    private LocalDate fecha;

    @Column(name = "horas_asignadas", nullable = false)
    private Double horasAsignadas;

    @Column(name = "unidades_asignadas")
    private Double unidadesAsignadas;

    @Column(columnDefinition = "TEXT")
    private String observacion;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
