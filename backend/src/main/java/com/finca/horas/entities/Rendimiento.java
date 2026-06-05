package com.finca.horas.entities;

import jakarta.persistence.*;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.LocalDateTime;

@Entity
@Table(name = "rendimientos")
@Data
public class Rendimiento {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Grupo = Actividad Madre: DESBROTE, SIEMBRA, DESMALEZADO, COSECHA, etc.
    @Column(name = "grupo")
    private String grupo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "producto_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer"})
    private Producto producto;  // SOLIDAGO, VERONICA, HYPERICUM, GYPSOPHILA, SUNFLOWER

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actividad_id")
    @JsonIgnoreProperties({"area", "producto", "hibernateLazyInitializer"})
    private Actividad actividad;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unidad_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer"})
    private UnidadMedida unidad;

    private Double rendimiento;  // Valor numérico (ej: 2.0 camas/minuto)
    
    private String notas;  // Notas adicionales
    
    private Boolean activo;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
        if(activo == null) {
            activo = true;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
