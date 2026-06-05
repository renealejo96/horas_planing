package com.finca.horas.services;

import com.finca.horas.entities.*;
import com.finca.horas.repositories.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ComparativaService {

    @Autowired
    private SemanaRepository semanaRepo;

    @Autowired
    private PlanificacionActividadRepository planActividadRepo;

    @Autowired
    private PlanificacionDiariaRepository planDiariaRepo;

    @Autowired
    private EjecucionActividadRepository ejecucionRepo;

    // ============ DTOs internos ============

    public static class ComparativaDiaItem {
        public Long planificacionId;
        public String actividad;
        public String bloque;
        public Double horasPlanificadas;
        public Double horasEjecutadas;
        public Double diferencia;
        public Double porcentajeAvance;

        public ComparativaDiaItem(Long planificacionId, String actividad, String bloque,
                Double horasPlanificadas, Double horasEjecutadas) {
            this.planificacionId = planificacionId;
            this.actividad = actividad;
            this.bloque = bloque;
            this.horasPlanificadas = horasPlanificadas != null ? horasPlanificadas : 0.0;
            this.horasEjecutadas = horasEjecutadas != null ? horasEjecutadas : 0.0;
            this.diferencia = this.horasPlanificadas - this.horasEjecutadas;
            this.porcentajeAvance = this.horasPlanificadas > 0 
                ? (this.horasEjecutadas / this.horasPlanificadas) * 100 
                : 0.0;
        }
    }

    public static class ComparativaDiaResumen {
        public LocalDate fecha;
        public List<ComparativaDiaItem> items;
        public Double totalPlanificado;
        public Double totalEjecutado;
        public Double diferencia;
        public Double porcentajeAvance;

        public ComparativaDiaResumen(LocalDate fecha, List<ComparativaDiaItem> items) {
            this.fecha = fecha;
            this.items = items;
            this.totalPlanificado = items.stream().mapToDouble(i -> i.horasPlanificadas).sum();
            this.totalEjecutado = items.stream().mapToDouble(i -> i.horasEjecutadas).sum();
            this.diferencia = this.totalPlanificado - this.totalEjecutado;
            this.porcentajeAvance = this.totalPlanificado > 0 
                ? (this.totalEjecutado / this.totalPlanificado) * 100 
                : 0.0;
        }
    }

    public static class ComparativaSemanaResumen {
        public String codigoAass;
        public LocalDate fechaInicio;
        public LocalDate fechaFin;
        public List<ResumenDia> diasSemana;
        public Double totalHorasPlanificadasSemana;
        public Double totalHorasEjecutadasSemana;
        public Double porcentajeAvanceSemana;
        public boolean alertaActiva;
        public String mensajeAlerta;

        public static class ResumenDia {
            public LocalDate fecha;
            public String diaSemana;
            public Double horasPlanificadas;
            public Double horasEjecutadas;
            public Double diferencia;
            public Double porcentajeAvance;
        }
    }

    public static class AlertaHoras {
        public boolean alertaActiva;
        public Double porcentajeAvance;
        public Double horasPlanificadas;
        public Double horasEjecutadas;
        public Double horasRestantes;
        public String mensaje;
        public String nivel; // "warning" (80-89%), "danger" (90%+)

        public AlertaHoras(Double planificadas, Double ejecutadas) {
            this.horasPlanificadas = planificadas != null ? planificadas : 0.0;
            this.horasEjecutadas = ejecutadas != null ? ejecutadas : 0.0;
            this.horasRestantes = this.horasPlanificadas - this.horasEjecutadas;
            this.porcentajeAvance = this.horasPlanificadas > 0 
                ? (this.horasEjecutadas / this.horasPlanificadas) * 100 
                : 0.0;
            
            if (this.porcentajeAvance >= 90) {
                this.alertaActiva = true;
                this.nivel = "danger";
                this.mensaje = String.format("⚠️ CRÍTICO: %.0f%% de horas consumidas. Solo quedan %.1f horas.", 
                    this.porcentajeAvance, this.horasRestantes);
            } else if (this.porcentajeAvance >= 80) {
                this.alertaActiva = true;
                this.nivel = "warning";
                this.mensaje = String.format("⚠️ %.0f%% de horas semanales consumidas. Quedan %.1f horas.", 
                    this.porcentajeAvance, this.horasRestantes);
            } else {
                this.alertaActiva = false;
                this.nivel = "normal";
                this.mensaje = String.format("%.0f%% de avance. Quedan %.1f horas disponibles.", 
                    this.porcentajeAvance, this.horasRestantes);
            }
        }
    }

    // ============ Métodos principales ============

    /**
     * Obtiene la comparativa detallada de un día específico
     */
    public ComparativaDiaResumen obtenerComparativaDia(LocalDate fecha) {
        // Buscar la semana que contiene esta fecha
        Semana semana = semanaRepo.findByFecha(fecha).orElse(null);
        if (semana == null) {
            return new ComparativaDiaResumen(fecha, Collections.emptyList());
        }

        // Obtener planificaciones diarias para esta fecha
        List<PlanificacionDiaria> planDiarias = planDiariaRepo.findBySemanaAndFecha(semana.getCodigoAass(), fecha);
        
        // Obtener ejecuciones del día
        List<EjecucionActividad> ejecuciones = ejecucionRepo.findBySemanaAndFecha(semana.getCodigoAass(), fecha);
        
        // Mapear ejecuciones por planificación
        Map<Long, Double> horasEjecPorPlan = ejecuciones.stream()
            .filter(e -> e.getPlanificacion() != null)
            .collect(Collectors.groupingBy(
                e -> e.getPlanificacion().getId(),
                Collectors.summingDouble(e -> e.getHorasReales() != null ? e.getHorasReales() : 0.0)
            ));

        // Construir items de comparativa
        List<ComparativaDiaItem> items = planDiarias.stream()
            .map(pd -> {
                Long planId = pd.getPlanificacion().getId();
                String actividad = pd.getPlanificacion().getActividad().getNombre();
                String bloque = pd.getPlanificacion().getBloque();
                Double horasPlan = pd.getHorasAsignadas();
                Double horasEjec = horasEjecPorPlan.getOrDefault(planId, 0.0);
                return new ComparativaDiaItem(planId, actividad, bloque, horasPlan, horasEjec);
            })
            .collect(Collectors.toList());

        // Agregar ejecuciones sin planificación diaria (imprevistas)
        Set<Long> planIdsConPlanDiaria = planDiarias.stream()
            .map(pd -> pd.getPlanificacion().getId())
            .collect(Collectors.toSet());
        
        ejecuciones.stream()
            .filter(e -> e.getPlanificacion() != null && !planIdsConPlanDiaria.contains(e.getPlanificacion().getId()))
            .collect(Collectors.groupingBy(e -> e.getPlanificacion().getId()))
            .forEach((planId, ejecs) -> {
                EjecucionActividad primera = ejecs.get(0);
                String actividad = primera.getPlanificacion().getActividad().getNombre() + " [SIN PLAN DIARIO]";
                String bloque = primera.getPlanificacion().getBloque();
                Double horasEjec = ejecs.stream().mapToDouble(e -> e.getHorasReales() != null ? e.getHorasReales() : 0.0).sum();
                items.add(new ComparativaDiaItem(planId, actividad, bloque, 0.0, horasEjec));
            });

        return new ComparativaDiaResumen(fecha, items);
    }

    /**
     * Obtiene el resumen comparativo de toda la semana
     */
    public ComparativaSemanaResumen obtenerComparativaSemana(String codigoAass) {
        Semana semana = semanaRepo.findByCodigoAass(codigoAass).orElse(null);
        if (semana == null) {
            return null;
        }

        ComparativaSemanaResumen resumen = new ComparativaSemanaResumen();
        resumen.codigoAass = codigoAass;
        resumen.fechaInicio = semana.getFechaInicio();
        resumen.fechaFin = semana.getFechaFin();
        resumen.diasSemana = new ArrayList<>();

        // Calcular totales de la semana
        List<PlanificacionActividad> planActividades = planActividadRepo.findByCodigoSemana(codigoAass);
        resumen.totalHorasPlanificadasSemana = planActividades.stream()
            .mapToDouble(p -> {
                Double horas = p.getHorasAjustadas() != null ? p.getHorasAjustadas() : p.getHorasCalculadas();
                return horas != null ? horas : 0.0;
            })
            .sum();

        resumen.totalHorasEjecutadasSemana = ejecucionRepo.sumHorasBySemanaCodigoAass(codigoAass);

        // Generar resumen por día
        LocalDate fecha = semana.getFechaInicio();
        String[] diasNombres = {"Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"};
        int diaIndex = 0;

        while (!fecha.isAfter(semana.getFechaFin()) && diaIndex < 7) {
            ComparativaSemanaResumen.ResumenDia dia = new ComparativaSemanaResumen.ResumenDia();
            dia.fecha = fecha;
            dia.diaSemana = diasNombres[diaIndex];
            dia.horasPlanificadas = planDiariaRepo.sumHorasPlanificadasDelDia(codigoAass, fecha);
            dia.horasEjecutadas = ejecucionRepo.sumHorasDelDia(codigoAass, fecha);
            dia.diferencia = dia.horasPlanificadas - dia.horasEjecutadas;
            dia.porcentajeAvance = dia.horasPlanificadas > 0 
                ? (dia.horasEjecutadas / dia.horasPlanificadas) * 100 
                : 0.0;
            
            resumen.diasSemana.add(dia);
            fecha = fecha.plusDays(1);
            diaIndex++;
        }

        // Calcular alerta
        AlertaHoras alerta = verificarAlerta(codigoAass);
        resumen.porcentajeAvanceSemana = alerta.porcentajeAvance;
        resumen.alertaActiva = alerta.alertaActiva;
        resumen.mensajeAlerta = alerta.mensaje;

        return resumen;
    }

    /**
     * Verifica si hay alerta de horas (80%+ consumidas)
     */
    public AlertaHoras verificarAlerta(String codigoAass) {
        List<PlanificacionActividad> planActividades = planActividadRepo.findByCodigoSemana(codigoAass);
        
        Double totalPlanificado = planActividades.stream()
            .mapToDouble(p -> {
                Double horas = p.getHorasAjustadas() != null ? p.getHorasAjustadas() : p.getHorasCalculadas();
                return horas != null ? horas : 0.0;
            })
            .sum();

        Double totalEjecutado = ejecucionRepo.sumHorasBySemanaCodigoAass(codigoAass);

        return new AlertaHoras(totalPlanificado, totalEjecutado);
    }

    /**
     * Calcula el porcentaje de avance de la semana
     */
    public Double calcularPorcentajeAvance(String codigoAass) {
        AlertaHoras alerta = verificarAlerta(codigoAass);
        return alerta.porcentajeAvance;
    }
}
