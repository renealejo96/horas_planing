package com.finca.horas.entities;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "bloques")
@Data
public class Bloque {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nombre;

    @ManyToOne
    @JoinColumn(name = "cultivo_id")
    private Cultivo cultivo;

    private Double hectareas;
}
