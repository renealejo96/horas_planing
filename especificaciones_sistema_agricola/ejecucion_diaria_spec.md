# Especificación Funcional --- Ejecución Diaria

## Objetivo

Registrar lo que realmente ocurrió en campo cada día.

Incluye:

-   horas trabajadas
-   unidades reales
-   rendimiento real

------------------------------------------------------------------------

## Flujo

1.  Supervisor selecciona la semana
2.  Selecciona actividad
3.  Selecciona bloque
4.  Ingresa datos reales

------------------------------------------------------------------------

## Tabla ejecucion_actividades

  campo              tipo
  ------------------ -----------
  id                 bigint
  fecha              date
  semana_id          bigint
  bloque_id          bigint
  actividad_id       bigint
  horas_reales       decimal
  unidades_reales    decimal
  rendimiento_real   decimal
  observacion        text
  created_at         timestamp

------------------------------------------------------------------------

## Cálculo rendimiento real

rendimiento_real = unidades_reales / horas_reales

Ejemplo:

6800 tallos / 22 horas = 309 tallos/hora
