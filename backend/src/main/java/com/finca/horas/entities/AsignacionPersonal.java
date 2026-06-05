package com.finca.horas.entities;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;

@Entity
@Table(name = "asignacion_personal")
@Data
public class AsignacionPersonal {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDate fecha;

    @ManyToOne
    @JoinColumn(name = "trabajador_id")
    private Trabajador trabajador;

    @ManyToOne
    @JoinColumn(name = "bloque_id")
    private Bloque bloque;

    @ManyToOne
    @JoinColumn(name = "actividad_planificada_id")
    private Actividad actividadPlanificada;

    @ManyToOne
    @JoinColumn(name = "actividad_real_id")
    private Actividad actividadReal;

    private Double horas;

    @Column(name = "supervisor_id")
    private Long supervisorId;

    @Column(columnDefinition = "TEXT")
    private String observacion;
}
