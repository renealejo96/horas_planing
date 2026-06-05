package com.finca.horas.entities;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "unidades_medida")
@Data
public class UnidadMedida {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String codigo;  // CAMAS_HORA, CAMAS_MINUTO, VALVULAS_HORA

    private String nombre;  // Camas por hora
    
    private String descripcion;
    
    private Integer factorAHoras;  // 1 para /hora, 60 para /minuto
    
    private String tipoConversion;  // PLANTAS_A_CAMAS, null si no aplica
    
    @PrePersist
    public void prePersist() {
        if (factorAHoras == null) {
            factorAHoras = 1;
        }
    }
}
