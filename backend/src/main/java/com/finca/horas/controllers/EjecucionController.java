package com.finca.horas.controllers;

import com.finca.horas.entities.EjecucionActividad;
import com.finca.horas.services.EjecucionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ejecucion")
public class EjecucionController {

    @Autowired
    private EjecucionService ejecucionService;

    @GetMapping
    public List<EjecucionActividad> obtenerEjecuciones() {
        return ejecucionService.obtenerEjecuciones();
    }

    @GetMapping("/semana/{codigoAass}")
    public List<EjecucionActividad> obtenerEjecucionesPorSemana(@PathVariable String codigoAass) {
        return ejecucionService.obtenerEjecucionesPorSemana(codigoAass);
    }

    @PostMapping
    public EjecucionActividad registrarEjecucion(@RequestBody EjecucionActividad ejecucion) {
        return ejecucionService.registrarEjecucion(ejecucion);
    }

    @PutMapping("/{id}")
    public EjecucionActividad actualizarEjecucion(@PathVariable Long id, @RequestBody EjecucionActividad ejecucion) {
        return ejecucionService.actualizarEjecucion(id, ejecucion);
    }

    @DeleteMapping("/{id}")
    public void eliminarEjecucion(@PathVariable Long id) {
        ejecucionService.eliminarEjecucion(id);
    }

    @PostMapping("/recalcular-todo")
    public void recalcularTodo() {
        ejecucionService.recalcularTodo();
    }
}
