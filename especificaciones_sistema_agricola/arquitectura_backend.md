# Arquitectura Backend --- Sistema Agrícola

Tecnología principal:

Java 17\
Spring Boot 3\
PostgreSQL

------------------------------------------------------------------------

## Arquitectura

Controller Service Repository Entity DTO

------------------------------------------------------------------------

## Estructura del proyecto

src/main/java/com/finca

config/ controllers/ services/ repositories/ entities/ dtos/ security/

------------------------------------------------------------------------

## Principales entidades

Cultivo\
Bloque\
Actividad\
Rendimiento\
PlanificacionActividad\
EjecucionActividad\
Trabajador\
AsignacionPersonal

------------------------------------------------------------------------

## API principal

GET /rendimientos\
POST /rendimientos

GET /planificacion\
POST /planificacion

POST /ejecucion

------------------------------------------------------------------------

## Seguridad

Roles:

ADMIN\
SUPERVISOR\
ASISTENTE

No existe rol GERENTE.
