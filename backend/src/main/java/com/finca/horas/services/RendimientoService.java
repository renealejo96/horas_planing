package com.finca.horas.services;

import com.finca.horas.entities.Rendimiento;
import com.finca.horas.repositories.RendimientoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RendimientoService {

    @Autowired
    private RendimientoRepository rendimientoRepository;

    public List<Rendimiento> obtenerTodos() {
        return rendimientoRepository.findAll();
    }

    public Rendimiento guardar(Rendimiento rendimiento) {
        return rendimientoRepository.save(rendimiento);
    }
}
