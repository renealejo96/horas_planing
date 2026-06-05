# Especificación Funcional --- Planificación Semanal

## Objetivo

Permitir planificar las horas de trabajo por semana agrícola usando el
formato **AASS (año-semana)**.

Ejemplo: 2611 = Año 2026 semana 11

La planificación debe calcular automáticamente las horas usando los
**rendimientos definidos**.

------------------------------------------------------------------------

## Flujo de planificación

1.  El administrador habilita la planificación de la siguiente semana.
2.  Los supervisores ingresan actividades por bloque.
3.  El sistema calcula automáticamente las horas.
4.  El administrador revisa el total de horas.
5.  Cuando gerencia aprueba, el administrador **cierra la
    planificación**.

Una vez cerrada: - nadie puede modificar la planificación - excepto el
administrador

------------------------------------------------------------------------

## Cálculo de horas

Formula:

horas_planificadas = unidades / rendimiento

Ejemplo:

50 camas fumigación\
rendimiento = 25 camas/hora

horas = 50 / 25 = 2

------------------------------------------------------------------------

## Tabla semanas

  campo                      tipo
  -------------------------- ---------
  id                         bigint
  codigo_aass                varchar
  anio                       integer
  semana                     integer
  fecha_inicio               date
  fecha_fin                  date
  planificacion_habilitada   boolean
  planificacion_cerrada      boolean

------------------------------------------------------------------------

## Tabla planificacion_actividades

  campo                   tipo
  ----------------------- -----------
  id                      bigint
  semana_id               bigint
  bloque_id               bigint
  actividad_id            bigint
  unidades_planificadas   decimal
  rendimiento_usado       decimal
  horas_calculadas        decimal
  horas_ajustadas         decimal
  creado_por              bigint
  created_at              timestamp

------------------------------------------------------------------------

## Indicadores

El sistema debe mostrar:

-   horas totales planificadas
-   horas disponibles
-   horas restantes

Visualmente mediante **barra de progreso**.
