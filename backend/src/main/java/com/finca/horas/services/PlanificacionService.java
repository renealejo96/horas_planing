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
        // Primero, intentar buscar la que tenga estado EN_EJECUCION
        List<Semana> enEjecucion = semanaRepo.findByEstado(EstadoSemana.EN_EJECUCION);
        if (!enEjecucion.isEmpty()) {
            return Optional.of(enEjecucion.get(0));
        }

        LocalDate hoy = LocalDate.now(java.time.ZoneId.of("America/Guayaquil"));
        Optional<Semana> semana = semanaRepo.findByFecha(hoy);
        
        if (semana.isEmpty()) {
            WeekFields weekFields = WeekFields.ISO;
            int numSemana = hoy.get(weekFields.weekOfYear());
            int anio = hoy.getYear();
            semana = semanaRepo.findByAnioAndSemana(anio, numSemana);
        }
        
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
        // Primero, intentar buscar la que tenga estado PLANIFICACION
        List<Semana> enPlanificacion = semanaRepo.findByEstado(EstadoSemana.PLANIFICACION);
        if (!enPlanificacion.isEmpty()) {
            return Optional.of(enPlanificacion.get(0));
        }

        // Si no hay ninguna en estado PLANIFICACION, buscamos la siguiente por fecha a la semana actual y la ponemos en PLANIFICACION
        Optional<Semana> actualOpt = obtenerSemanaActual();
        LocalDate proximoLunes;
        if (actualOpt.isPresent()) {
            proximoLunes = actualOpt.get().getFechaFin().plusDays(1);
        } else {
            LocalDate hoy = LocalDate.now(java.time.ZoneId.of("America/Guayaquil"));
            proximoLunes = hoy.plusWeeks(1).with(DayOfWeek.MONDAY);
        }

        Optional<Semana> semana = semanaRepo.findByFecha(proximoLunes);
        
        if (semana.isEmpty()) {
            WeekFields weekFields = WeekFields.ISO;
            int numSemana = proximoLunes.get(weekFields.weekOfYear());
            int anio = proximoLunes.getYear();
            semana = semanaRepo.findByAnioAndSemana(anio, numSemana);
        }
        
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
        WeekFields weekFields = WeekFields.ISO;
        
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
    
    @Transactional
    public Optional<Semana> cambiarEstadoSemana(String codigoAass, String estado) {
        EstadoSemana nuevoEstado = EstadoSemana.valueOf(estado);
        return semanaRepo.findByCodigoAass(codigoAass)
            .map(semana -> {
                if (nuevoEstado == EstadoSemana.EN_EJECUCION) {
                    // Buscar todas las semanas que están actualmente EN_EJECUCION y cerrarlas
                    List<Semana> activas = semanaRepo.findByEstado(EstadoSemana.EN_EJECUCION);
                    for (Semana activa : activas) {
                        if (!activa.getCodigoAass().equals(codigoAass)) {
                            activa.setEstado(EstadoSemana.CERRADA);
                            activa.setPlanificacionCerrada(true);
                            semanaRepo.save(activa);
                        }
                    }
                }
                
                semana.setEstado(nuevoEstado);
                if (nuevoEstado == EstadoSemana.PLANIFICACION || nuevoEstado == EstadoSemana.EN_EJECUCION) {
                    semana.setPlanificacionHabilitada(true);
                    semana.setPlanificacionCerrada(false);
                } else if (nuevoEstado == EstadoSemana.CERRADA) {
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
                
                // Guardar bloque y valvulas
                existing.setBloque(act.getBloque());
                existing.setValvulas(act.getValvulas());
                
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

    @Transactional
    public List<PlanificacionActividad> copiarPlanificacion(String codigoOrigen, String codigoDestino, List<String> actividadesPermitidas, boolean esAdmin) {
        Semana semanaDestino = semanaRepo.findByCodigoAass(codigoDestino)
            .orElseThrow(() -> new RuntimeException("Semana destino no encontrada: " + codigoDestino));
            
        if (Boolean.TRUE.equals(semanaDestino.getPlanificacionCerrada())) {
            throw new RuntimeException("La planificación de la semana destino está cerrada.");
        }
        
        List<PlanificacionActividad> sourceItems = planificacionRepo.findByCodigoSemana(codigoOrigen);
        List<PlanificacionActividad> destItems = planificacionRepo.findByCodigoSemana(codigoDestino);
        
        List<PlanificacionActividad> clonedItems = new java.util.ArrayList<>();
        
        for (PlanificacionActividad src : sourceItems) {
            if (src.getActividad() == null) continue;
            
            // Si no es admin, validar que la actividad esté permitida
            if (!esAdmin) {
                String laborMadre = src.getActividad().getLaborMadre();
                if (laborMadre == null || !actividadesPermitidas.contains(laborMadre.toUpperCase())) {
                    continue;
                }
            }
            
            // Verificar si ya existe un item equivalente en la semana de destino
            boolean existe = destItems.stream().anyMatch(dst -> 
                dst.getActividad() != null && src.getActividad() != null &&
                dst.getActividad().getId().equals(src.getActividad().getId()) &&
                java.util.Objects.equals(dst.getBloque(), src.getBloque()) &&
                java.util.Objects.equals(dst.getValvulas(), src.getValvulas())
            );
            
            if (!existe) {
                PlanificacionActividad nuevo = new PlanificacionActividad();
                nuevo.setSemana(semanaDestino);
                nuevo.setActividad(src.getActividad());
                nuevo.setBloque(src.getBloque());
                nuevo.setValvulas(src.getValvulas());
                nuevo.setUnidadesPlanificadas(src.getUnidadesPlanificadas());
                nuevo.setRendimientoUsado(src.getRendimientoUsado());
                nuevo.setHorasCalculadas(src.getHorasCalculadas());
                nuevo.setHorasAjustadas(src.getHorasAjustadas());
                nuevo.setHorasEjecutadas(0.0);
                nuevo.setUnidadesEjecutadas(0.0);
                
                clonedItems.add(planificacionRepo.save(nuevo));
            }
        }
        
        return clonedItems;
    }
}
