package com.finca.horas.controllers;

import com.finca.horas.entities.Rendimiento;
import com.finca.horas.services.RendimientoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rendimientos")
public class RendimientoController {

    @Autowired
    private RendimientoService rendimientoService;

    @GetMapping
    public List<Rendimiento> obtenerTodos() {
        return rendimientoService.obtenerTodos();
    }

    @PostMapping
    public Rendimiento guardar(@RequestBody Rendimiento rendimiento) {
        return rendimientoService.guardar(rendimiento);
    }
}
