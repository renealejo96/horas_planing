package com.finca.horas.entities;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "ejecucion_actividades")
@Data
public class EjecucionActividad {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDate fecha;

    @ManyToOne
    @JoinColumn(name = "planificacion_id")
    private PlanificacionActividad planificacion;

    @ManyToOne
    @JoinColumn(name = "semana_id")
    private Semana semana;

    @ManyToOne
    @JoinColumn(name = "actividad_id")
    private Actividad actividad;

    @Column(name = "horas_reales")
    private Double horasReales;

    @Column(name = "unidades_reales")
    private Double unidadesReales;

    @Column(name = "rendimiento_real")
    private Double rendimientoReal;

    @Column(columnDefinition = "TEXT")
    private String observacion;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
    }
}
