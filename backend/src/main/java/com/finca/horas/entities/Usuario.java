package com.finca.horas.entities;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "usuarios")
@Data
public class Usuario {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String username;

    @Column(nullable = false, length = 100)
    private String password;

    @Column(unique = true, nullable = false, length = 100)
    private String email;

    @Column(nullable = false, length = 20)
    private String rol; // ADMIN, SUPERVISOR

    private Boolean modificarRendimientos; // true si puede modificar tablas de rendimientos

    @Column(columnDefinition = "TEXT")
    private String actividadesPermitidas; // Comma-separated list of laborMadre, e.g. "COSECHA"

    private Boolean activo;

    @PrePersist
    public void prePersist() {
        if (activo == null) activo = true;
        if (modificarRendimientos == null) modificarRendimientos = false;
        if (rol == null) rol = "SUPERVISOR";
    }
}
