package com.finca.horas.entities;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.util.List;

@Entity
@Table(name = "areas")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Area {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String codigo;  // PY_FERTIRRIEGO, PY_FUMIGACION, PY_COSECHA

    private String nombre;  // Fertirriego, Fumigación, Cosecha
    
    private String descripcion;
    
    private Boolean activo;

    @OneToMany(mappedBy = "area", fetch = FetchType.LAZY)
    private List<Actividad> actividades;
    
    @PrePersist
    public void prePersist() {
        if (activo == null) {
            activo = true;
        }
    }
}
