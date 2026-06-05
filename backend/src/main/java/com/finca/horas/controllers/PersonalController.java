package com.finca.horas.controllers;

import com.finca.horas.entities.AsignacionPersonal;
import com.finca.horas.entities.Trabajador;
import com.finca.horas.services.PersonalService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/personal")
public class PersonalController {

    @Autowired
    private PersonalService personalService;

    @GetMapping("/trabajadores")
    public List<Trabajador> obtenerTrabajadores() {
        return personalService.obtenerTrabajadores();
    }

    @PostMapping("/trabajadores")
    public Trabajador guardarTrabajador(@RequestBody Trabajador trabajador) {
        return personalService.guardarTrabajador(trabajador);
    }
    
    @PutMapping("/trabajadores/{id}/toggle-activo")
    public ResponseEntity<Trabajador> toggleActivo(@PathVariable Long id) {
        return personalService.obtenerPorId(id)
            .map(t -> {
                t.setActivo(!t.getActivo());
                return ResponseEntity.ok(personalService.guardarTrabajador(t));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/asignaciones")
    public List<AsignacionPersonal> obtenerAsignaciones() {
        return personalService.obtenerAsignaciones();
    }

    @PostMapping("/asignaciones")
    public AsignacionPersonal registrarAsignacion(@RequestBody AsignacionPersonal asignacion) {
        return personalService.registrarAsignacion(asignacion);
    }
    
    @PostMapping("/importar-csv")
    public ResponseEntity<?> importarDesdeCSV(@RequestBody(required = false) Map<String, String> request) {
        try {
            String rutaArchivo = (request != null && request.containsKey("rutaArchivo")) 
                ? request.get("rutaArchivo") 
                : "personal.csv";
            
            Map<String, Object> resultado = personalService.importarDesdeCSV(rutaArchivo);
            return ResponseEntity.ok(resultado);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Error al importar: " + e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}
