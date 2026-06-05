package com.finca.horas.entities;

import jakarta.persistence.*;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@Table(name = "actividades")
@Data
public class Actividad {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String codigo;  // FUMIGACION_LANZA, DRENCH_EDAFICO, COSECHA

    private String nombre;  // Fumigación con lanza, Drench edáfico
    
    private String laborMadre;  // Labor genérica: DESMALEZADO, DESBROTE, COSECHA, etc.
    
    private String descripcion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "area_id")
    @JsonIgnoreProperties({"actividades", "hibernateLazyInitializer"})
    private Area area;  // PY_FERTIRRIEGO, PY_FUMIGACION

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "producto_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer"})
    private Producto producto;  // ROSA, CLAVEL (null si aplica a todos)

    private Boolean requiereBloque;  // true para la mayoría, false para fertirriego válvulas
    
    private Boolean requierePases;   // true para fertirriego con pases
    
    private Boolean esVarios;        // true = descripción libre, sin rendimiento fijo
    
    private Boolean activo;
    
    @PrePersist
    public void prePersist() {
        if (activo == null) activo = true;
        if (requiereBloque == null) requiereBloque = true;
        if (requierePases == null) requierePases = false;
        if (esVarios == null) esVarios = false;
    }
}
