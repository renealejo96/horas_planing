# Especificación Funcional --- Módulo de Rendimientos Agrícolas

## 1. Propósito

El módulo de **Rendimientos Agrícolas** define los parámetros
productivos utilizados por el sistema para calcular:

-   Horas planificadas de trabajo
-   Eficiencia de actividades
-   Consumo de horas
-   Predicción de mano de obra

Los rendimientos representan **la cantidad de unidades de trabajo que un
trabajador puede realizar por hora**, dependiendo de la actividad y del
cultivo.

Ejemplo:

  Actividad    Cultivo   Rendimiento
  ------------ --------- ------------------
  Cosecha      Rosa      350 tallos/hora
  Desbrote     Rosa      120 plantas/hora
  Fumigación   Rosa      25 camas/hora

------------------------------------------------------------------------

# 2. Concepto de Rendimiento

Un **rendimiento** define:

Cantidad de unidades de trabajo realizadas por hora

Fórmula utilizada en el sistema:

horas_planificadas = unidades_trabajo / rendimiento

Ejemplo:

Actividad: Fumigación\
Bloque: 50 camas\
Rendimiento: 25 camas/hora

Horas planificadas = 50 / 25 = 2 horas

------------------------------------------------------------------------

# 3. Unidades de Medida de Rendimiento

El sistema debe soportar diferentes tipos de unidades dependiendo de la
actividad.

  Unidad    Uso
  --------- ---------------
  tallos    cosecha
  plantas   desbrote
  camas     fumigación
  camas     desmalezado
  camas     fertilización

------------------------------------------------------------------------

# 4. Estructura de Base de Datos

## Tabla: unidades_medida

Define las unidades utilizadas para calcular rendimientos.

  Campo         Tipo      Descripción
  ------------- --------- ----------------------
  id            bigint    identificador
  nombre        varchar   nombre de unidad
  descripcion   varchar   descripción opcional

Ejemplo:

  id   nombre
  ---- ---------
  1    tallos
  2    plantas
  3    camas

------------------------------------------------------------------------

## Tabla: rendimientos

Define el rendimiento estándar por cultivo y actividad.

  Campo          Tipo        Descripción
  -------------- ----------- ---------------------
  id             bigint      identificador
  cultivo_id     bigint      cultivo asociado
  actividad_id   bigint      actividad
  unidad_id      bigint      unidad de medida
  rendimiento    decimal     unidades por hora
  activo         boolean     estado del registro
  created_at     timestamp   fecha de creación
  updated_at     timestamp   última modificación

------------------------------------------------------------------------

# 5. Rendimiento Planificado vs Rendimiento Real

## Rendimiento Planificado

Es el rendimiento estándar utilizado para calcular horas de
planificación.

Ejemplo:

350 tallos/hora

## Rendimiento Real

Se calcula automáticamente al registrar la ejecución de actividades.

rendimiento_real = unidades_reales / horas_reales

Ejemplo:

Tallos cosechados = 6800\
Horas reales = 22

rendimiento_real = 309 tallos/hora

------------------------------------------------------------------------

# 6. Uso en Planificación Semanal

Cuando un supervisor planifica una actividad el sistema debe:

1.  Obtener el rendimiento estándar
2.  Calcular horas planificadas automáticamente

horas_planificadas = unidades_planificadas / rendimiento

El supervisor puede **ajustar manualmente las horas si es necesario**.

------------------------------------------------------------------------

# 7. Seguridad

Acceso permitido:

  Rol          Permiso
  ------------ ----------------------------
  ADMIN        crear, modificar, eliminar
  SUPERVISOR   consultar
  ASISTENTE    consultar

⚠️ El sistema **no debe tener rol GERENTE**.

------------------------------------------------------------------------

# 8. Beneficios del Módulo

Implementar correctamente este módulo permitirá:

-   planificaciones más precisas
-   control de productividad
-   comparación de rendimientos reales vs esperados
-   predicción de necesidades de personal
-   análisis en herramientas BI como Power BI
