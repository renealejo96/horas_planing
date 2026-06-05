package com.finca.horas.entities;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "planificacion_actividades")
@Data
public class PlanificacionActividad {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "semana_id")
    private Semana semana;

    @ManyToOne
    @JoinColumn(name = "actividad_id")
    private Actividad actividad;

    // Bloque como texto libre (múltiples bloques: "B1, B2, Sur-1")
    @Column(name = "bloque")
    private String bloque;
    
    // Válvulas para fertirriego
    @Column(name = "valvulas")
    private String valvulas;

    @Column(name = "unidades_planificadas")
    private Double unidadesPlanificadas;

    @Column(name = "rendimiento_usado")
    private Double rendimientoUsado;

    @Column(name = "horas_calculadas")
    private Double horasCalculadas;

    @Column(name = "horas_ajustadas")
    private Double horasAjustadas;
    
    // Campos de ejecución
    @Column(name = "horas_ejecutadas")
    private Double horasEjecutadas;
    
    @Column(name = "unidades_ejecutadas")
    private Double unidadesEjecutadas;

    @Column(name = "creado_por")
    private Long creadoPor;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
        if (horasEjecutadas == null) horasEjecutadas = 0.0;
        if (unidadesEjecutadas == null) unidadesEjecutadas = 0.0;
    }
}
