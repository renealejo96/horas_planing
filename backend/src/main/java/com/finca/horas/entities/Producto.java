package com.finca.horas.entities;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "productos")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Producto {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String codigo;  // ROSA, CLAVEL, GYPSOPHILA

    private String nombre;  // Rosa de exportación
    
    private String descripcion;
    
    private Double densidad;  // Plantas por cama (ej: 600 para GYPSOPHILA)
    
    private Integer tallosPorMalla;  // Para cálculo de cosecha (ej: 25 para GYPSOPHILA)
    
    private Boolean activo;
    
    @PrePersist
    public void prePersist() {
        if (activo == null) {
            activo = true;
        }
    }
}
