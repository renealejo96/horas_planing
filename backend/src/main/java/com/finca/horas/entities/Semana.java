package com.finca.horas.entities;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;

@Entity
@Table(name = "semanas")
@Data
public class Semana {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "codigo_aass", unique = true)
    private String codigoAass;  // 2612 = año 26, semana 12

    private Integer anio;
    private Integer semana;

    @Column(name = "fecha_inicio")
    private LocalDate fechaInicio;

    @Column(name = "fecha_fin")
    private LocalDate fechaFin;

    @Enumerated(EnumType.STRING)
    private EstadoSemana estado;  // FUTURA, PLANIFICACION, EN_EJECUCION, CERRADA

    @Column(name = "planificacion_habilitada")
    private Boolean planificacionHabilitada;

    @Column(name = "planificacion_cerrada")
    private Boolean planificacionCerrada;
    
    public enum EstadoSemana {
        FUTURA,
        PLANIFICACION,
        EN_EJECUCION,
        CERRADA
    }
    
    @PrePersist
    public void prePersist() {
        if (estado == null) {
            estado = EstadoSemana.FUTURA;
        }
        if (planificacionHabilitada == null) {
            planificacionHabilitada = false;
        }
        if (planificacionCerrada == null) {
            planificacionCerrada = false;
        }
    }
}
