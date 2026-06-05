package com.finca.horas.entities;

import jakarta.persistence.*;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "trabajadores")
@Data
public class Trabajador {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String cedula;
    
    private String nombre;
    
    private String cargo;  // Cargo original de TTHH (PY_COSECHA, etc.)
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "area_id")
    @JsonIgnoreProperties({"actividades", "hibernateLazyInitializer"})
    private Area area;  // Área asignada según cargo
    
    private Boolean activo;

    @Column(name = "fecha_ingreso")
    private LocalDate fechaIngreso;
    
    @Column(name = "fecha_baja")
    private LocalDate fechaBaja;  // Fecha de renuncia/baja
    
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    public void prePersist() {
        if (activo == null) {
            activo = true;
        }
        createdAt = LocalDateTime.now();
    }
    
    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
