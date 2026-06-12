package com.finca.horas.services;

import com.finca.horas.entities.PlanificacionActividad;
import com.finca.horas.entities.Semana;
import com.finca.horas.entities.Semana.EstadoSemana;
import com.finca.horas.entities.Rendimiento;
import com.finca.horas.entities.PlanificacionDiaria;
import com.finca.horas.entities.EjecucionActividad;
import com.finca.horas.entities.Actividad;
import com.finca.horas.repositories.ActividadRepository;
import com.finca.horas.repositories.PlanificacionActividadRepository;
import com.finca.horas.repositories.SemanaRepository;
import com.finca.horas.repositories.PlanificacionDiariaRepository;
import com.finca.horas.repositories.EjecucionActividadRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class PlanificacionService {

    @Autowired
    private PlanificacionActividadRepository planificacionRepo;

    @Autowired
    private SemanaRepository semanaRepo;

    @Autowired
    private PlanificacionDiariaRepository planificacionDiariaRepo;

    @Autowired
    private EjecucionActividadRepository ejecucionActividadRepo;

    @Autowired
    private ActividadRepository actividadRepo;

    // ==================== SEMANAS ====================

    public List<Semana> obtenerSemanas() {
        return semanaRepo.findAll();
    }
    
    public List<Semana> obtenerSemanasDisponibles() {
        return semanaRepo.findSemanasDisponibles();
    }
    
    public Optional<Semana> obtenerSemanaActual() {
        LocalDate hoy = LocalDate.now();
        Optional<Semana> semana = semanaRepo.findByFecha(hoy);
        
        // Si existe, asegurar que está en EN_EJECUCION
        semana.ifPresent(s -> {
            if (s.getEstado() != EstadoSemana.EN_EJECUCION && s.getEstado() != EstadoSemana.CERRADA) {
                s.setEstado(EstadoSemana.EN_EJECUCION);
                s.setPlanificacionHabilitada(true);
                semanaRepo.save(s);
            }
        });
        
        return semana;
    }
    
    public Optional<Semana> obtenerSemanaSiguiente() {
        LocalDate proximoLunes = LocalDate.now().plusWeeks(1).with(DayOfWeek.MONDAY);
        Optional<Semana> semana = semanaRepo.findByFecha(proximoLunes);
        
        // Si existe, asegurar que está en PLANIFICACION
        semana.ifPresent(s -> {
            if (s.getEstado() == EstadoSemana.FUTURA) {
                s.setEstado(EstadoSemana.PLANIFICACION);
                s.setPlanificacionHabilitada(true);
                semanaRepo.save(s);
            }
        });
        
        return semana;
    }
    
    public List<Semana> generarSemanasAnio(Integer anio, Integer cantidad) {
        List<Semana> semanas = new ArrayList<>();
        WeekFields weekFields = WeekFields.of(Locale.getDefault());
        
        LocalDate fecha = LocalDate.of(anio, 1, 1).with(DayOfWeek.MONDAY);
        if (fecha.getYear() < anio) {
            fecha = fecha.plusWeeks(1);
        }
        
        for (int i = 0; i < cantidad && fecha.getYear() <= anio; i++) {
            int numSemana = fecha.get(weekFields.weekOfYear());
            String codigoAass = String.format("%02d%02d", anio % 100, numSemana);
            
            // Verificar si ya existe
            if (semanaRepo.findByCodigoAass(codigoAass).isEmpty()) {
                Semana semana = new Semana();
                semana.setCodigoAass(codigoAass);
                semana.setAnio(anio);
                semana.setSemana(numSemana);
                semana.setFechaInicio(fecha);
                semana.setFechaFin(fecha.plusDays(6));
                semana.setEstado(EstadoSemana.FUTURA);
                semana.setPlanificacionHabilitada(false);
                semana.setPlanificacionCerrada(false);
                
                semanas.add(semanaRepo.save(semana));
            }
            
            fecha = fecha.plusWeeks(1);
        }
        
        return semanas;
    }

    public Semana guardarSemana(Semana semana) {
        return semanaRepo.save(semana);
    }

    public Semana habilitarSemana(String codigoAass) {
        Semana semana = semanaRepo.findByCodigoAass(codigoAass)
            .orElseThrow(() -> new RuntimeException("Semana no encontrada"));
        semana.setPlanificacionHabilitada(true);
        semana.setPlanificacionCerrada(false);
        semana.setEstado(EstadoSemana.PLANIFICACION);
        return semanaRepo.save(semana);
    }

    public Semana cerrarPlanificacion(String codigoAass) {
        Semana semana = semanaRepo.findByCodigoAass(codigoAass)
            .orElseThrow(() -> new RuntimeException("Semana no encontrada"));
        semana.setPlanificacionCerrada(true);
        semana.setEstado(EstadoSemana.CERRADA);
        return semanaRepo.save(semana);
    }
    
    public Optional<Semana> cambiarEstadoSemana(String codigoAass, String estado) {
        return semanaRepo.findByCodigoAass(codigoAass)
            .map(semana -> {
                semana.setEstado(EstadoSemana.valueOf(estado));
                if (estado.equals("PLANIFICACION") || estado.equals("EN_EJECUCION")) {
                    semana.setPlanificacionHabilitada(true);
                    semana.setPlanificacionCerrada(false);
                } else if (estado.equals("CERRADA")) {
                    semana.setPlanificacionCerrada(true);
                }
                return semanaRepo.save(semana);
            });
    }

    // ==================== PLANIFICACIÓN ====================

    public PlanificacionActividad planificarActividad(PlanificacionActividad act) {
        if(act.getSemana() == null || act.getSemana().getId() == null) {
            throw new RuntimeException("La semana es obligatoria");
        }
        
        Semana semana = semanaRepo.findById(act.getSemana().getId()).orElseThrow();
        if (Boolean.TRUE.equals(semana.getPlanificacionCerrada())) {
            throw new RuntimeException("La planificación para esta semana ya está cerrada.");
        }

        // Validar que el bloque no esté vacío (a excepción de la actividad madre COSECHA)
        if (act.getActividad() == null || act.getActividad().getId() == null) {
            throw new RuntimeException("La actividad es obligatoria");
        }
        Actividad actividad = actividadRepo.findById(act.getActividad().getId())
            .orElseThrow(() -> new RuntimeException("Actividad no encontrada"));
        
        String laborMadre = actividad.getLaborMadre();
        if (laborMadre == null || !laborMadre.equalsIgnoreCase("COSECHA")) {
            boolean tieneBloque = act.getBloque() != null && !act.getBloque().trim().isEmpty();
            boolean tieneValvulas = act.getValvulas() != null && !act.getValvulas().trim().isEmpty();
            if (!tieneBloque && !tieneValvulas) {
                throw new RuntimeException("El campo bloque es obligatorio para la actividad madre: " + (laborMadre != null ? laborMadre : ""));
            }
        }

        // Cálculo de horas: unidades / rendimiento (considerando factor)
        calcularHoras(act);

        return planificacionRepo.save(act);
    }

    public List<PlanificacionActividad> obtenerPlanificacion() {
        return planificacionRepo.findAll();
    }
    
    public List<PlanificacionActividad> obtenerPlanificacionPorSemana(String codigoAass) {
        return planificacionRepo.findByCodigoSemana(codigoAass);
    }
    
    public List<PlanificacionActividad> obtenerPlanificacionPorSemanaYArea(String codigoAass, Long areaId) {
        return planificacionRepo.findByCodigoSemanaAndAreaId(codigoAass, areaId);
    }
    
    public Optional<PlanificacionActividad> actualizarPlanificacion(Long id, PlanificacionActividad act) {
        return planificacionRepo.findById(id)
            .map(existing -> {
                if (act.getUnidadesPlanificadas() != null) {
                    existing.setUnidadesPlanificadas(act.getUnidadesPlanificadas());
                }
                if (act.getRendimientoUsado() != null) {
                    existing.setRendimientoUsado(act.getRendimientoUsado());
                }
                if (act.getHorasAjustadas() != null) {
                    existing.setHorasAjustadas(act.getHorasAjustadas());
                }
                
                calcularHoras(existing);
                return planificacionRepo.save(existing);
            });
    }
    
    @Transactional
    public boolean eliminarPlanificacion(Long id) {
        return planificacionRepo.findById(id)
            .map(plan -> {
                // 1. Eliminar asignaciones diarias asociadas
                List<PlanificacionDiaria> diarias = planificacionDiariaRepo.findByPlanificacion(plan);
                planificacionDiariaRepo.deleteAll(diarias);
                
                // 2. Desvincular ejecuciones (poner planificacion_id = null)
                List<EjecucionActividad> ejecuciones = ejecucionActividadRepo.findByPlanificacion(plan);
                for (EjecucionActividad e : ejecuciones) {
                    e.setPlanificacion(null);
                    ejecucionActividadRepo.save(e);
                }
                
                // 3. Eliminar la planificación semanal
                planificacionRepo.delete(plan);
                return true;
            })
            .orElse(false);
    }
    
    private void calcularHoras(PlanificacionActividad act) {
        if (act.getRendimientoUsado() != null && act.getRendimientoUsado() > 0 
            && act.getUnidadesPlanificadas() != null) {
            
            // TODO: Considerar factorAHoras de la unidad (ej: minutos -> horas)
            // TODO: Considerar pases si aplica
            double horas = act.getUnidadesPlanificadas() / act.getRendimientoUsado();
            act.setHorasCalculadas(horas);

            if (act.getHorasAjustadas() == null) {
                act.setHorasAjustadas(horas);
            }
        }
    }

    @Transactional
    public void propagarRendimiento(Rendimiento rend) {
        if (rend == null || rend.getActividad() == null || rend.getRendimiento() == null) {
            return;
        }
        
        List<PlanificacionActividad> planificaciones = planificacionRepo.findByActividad(rend.getActividad());
        for (PlanificacionActividad plan : planificaciones) {
            if (plan.getSemana() != null && plan.getSemana().getEstado() != EstadoSemana.CERRADA) {
                if (plan.getUnidadesPlanificadas() != null && rend.getRendimiento() > 0) {
                    double oldHorasCalculadas = plan.getHorasCalculadas() != null ? plan.getHorasCalculadas() : 0.0;
                    double newRendimiento = rend.getRendimiento();
                    double newHoras = plan.getUnidadesPlanificadas() / newRendimiento;
                    
                    plan.setRendimientoUsado(newRendimiento);
                    plan.setHorasCalculadas(newHoras);
                    
                    if (plan.getHorasAjustadas() == null || Math.abs(plan.getHorasAjustadas() - oldHorasCalculadas) < 0.001) {
                        plan.setHorasAjustadas(newHoras);
                    }
                    
                    planificacionRepo.save(plan);
                }
            }
        }
    }
}
