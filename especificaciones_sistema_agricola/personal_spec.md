# Especificación Funcional --- Personal

## Objetivo

Gestionar trabajadores y asignaciones diarias.

Debe permitir mover trabajadores entre actividades según necesidad.

Ejemplo:

Planificado: fumigación\
Real: desmalezado

------------------------------------------------------------------------

## Tabla trabajadores

  campo           tipo
  --------------- ---------
  id              bigint
  cedula          varchar
  nombre          varchar
  cargo           varchar
  activo          boolean
  fecha_ingreso   date

------------------------------------------------------------------------

## Tabla asignacion_personal

  campo                   tipo
  ----------------------- ---------
  id                      bigint
  fecha                   date
  trabajador_id           bigint
  bloque_id               bigint
  actividad_planificada   bigint
  actividad_real          bigint
  horas                   decimal
  supervisor_id           bigint
  observacion             text

------------------------------------------------------------------------

## Permisos

Tipos:

-   vacaciones
-   enfermedad
-   permiso
