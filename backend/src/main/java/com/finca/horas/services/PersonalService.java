package com.finca.horas.services;

import com.finca.horas.entities.Area;
import com.finca.horas.entities.AsignacionPersonal;
import com.finca.horas.entities.Trabajador;
import com.finca.horas.repositories.AreaRepository;
import com.finca.horas.repositories.AsignacionPersonalRepository;
import com.finca.horas.repositories.TrabajadorRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

@Service
public class PersonalService {

    @Autowired
    private TrabajadorRepository trabajadorRepo;

    @Autowired
    private AsignacionPersonalRepository asignacionRepo;
    
    @Autowired
    private AreaRepository areaRepo;

    public List<Trabajador> obtenerTrabajadores() {
        return trabajadorRepo.findAll();
    }
    
    public Optional<Trabajador> obtenerPorId(Long id) {
        return trabajadorRepo.findById(id);
    }

    public Trabajador guardarTrabajador(Trabajador trabajador) {
        return trabajadorRepo.save(trabajador);
    }

    public List<AsignacionPersonal> obtenerAsignaciones() {
        return asignacionRepo.findAll();
    }

    public AsignacionPersonal registrarAsignacion(AsignacionPersonal asignacion) {
        return asignacionRepo.save(asignacion);
    }
    
    /**
     * Importar trabajadores desde CSV
     * Formato: CEDULA;NOMBRE;CARGO
     */
    @Transactional
    public Map<String, Object> importarDesdeCSV(String rutaArchivo) throws IOException {
        Map<String, Object> resultado = new HashMap<>();
        
        int creados = 0;
        int actualizados = 0;
        int errores = 0;
        List<String> detallesErrores = new ArrayList<>();
        
        Path path = Paths.get(rutaArchivo);
        List<String> lineas = Files.readAllLines(path, StandardCharsets.UTF_8);
        
        // Procesar líneas (saltar encabezado)
        for (int i = 1; i < lineas.size(); i++) {
            String linea = lineas.get(i).trim();
            if (linea.isEmpty()) continue;
            
            try {
                String[] campos = linea.split(";");
                if (campos.length < 2) {
                    detallesErrores.add("Línea " + (i+1) + ": formato inválido");
                    errores++;
                    continue;
                }
                
                String cedula = campos[0].trim();
                String nombre = campos[1].trim().toUpperCase();
                String cargo = campos.length > 2 ? campos[2].trim().toUpperCase() : "";
                
                if (cedula.isEmpty() || nombre.isEmpty()) {
                    detallesErrores.add("Línea " + (i+1) + ": cédula o nombre vacío");
                    errores++;
                    continue;
                }
                
                // Buscar o crear trabajador
                Optional<Trabajador> existente = trabajadorRepo.findByCedula(cedula);
                Trabajador trabajador;
                
                if (existente.isPresent()) {
                    trabajador = existente.get();
                    trabajador.setNombre(nombre);
                    trabajador.setCargo(cargo);
                    actualizados++;
                } else {
                    trabajador = new Trabajador();
                    trabajador.setCedula(cedula);
                    trabajador.setNombre(nombre);
                    trabajador.setCargo(cargo);
                    trabajador.setActivo(true);
                    creados++;
                }
                
                // Inferir área desde cargo (ej: PY_COSECHA -> COSECHA)
                if (!cargo.isEmpty()) {
                    String areaInferida = inferirAreaDesdeCargo(cargo);
                    if (areaInferida != null) {
                        areaRepo.findByCodigo(areaInferida).ifPresent(trabajador::setArea);
                    }
                }
                
                trabajadorRepo.save(trabajador);
                
            } catch (Exception e) {
                detallesErrores.add("Línea " + (i+1) + ": " + e.getMessage());
                errores++;
            }
        }
        
        resultado.put("creados", creados);
        resultado.put("actualizados", actualizados);
        resultado.put("errores", errores);
        resultado.put("totalProcesados", creados + actualizados);
        resultado.put("detallesErrores", detallesErrores);
        
        return resultado;
    }
    
    private String inferirAreaDesdeCargo(String cargo) {
        if (cargo == null) return null;
        cargo = cargo.toUpperCase();
        
        // Retornar el cargo directamente si empieza con PY_
        if (cargo.startsWith("PY_")) return cargo;
        
        // Inferir área si no tiene prefijo
        if (cargo.contains("COSECHA")) return "PY_COSECHA";
        if (cargo.contains("SIEMBRA")) return "PY_SIEMBRA";
        if (cargo.contains("DESBROT")) return "PY_DESBROTE";
        if (cargo.contains("DESMALEZAD")) return "PY_DESMALEZADO";
        if (cargo.contains("FUMIG")) return "PY_FUMIGACION";
        if (cargo.contains("RIEGO")) return "PY_RIEGO";
        if (cargo.contains("FERTIRRI")) return "PY_FERTIRRIEGO";
        
        return null;
    }
}
