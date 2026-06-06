# Plan de Implementación: Sistema de Login, Roles y Permisos (PYGANFLOR)

Este documento detalla la estrategia y el plan paso a paso para implementar un sistema de autenticación seguro, control de accesos basado en roles (Admin vs. Supervisor) y restricciones por actividades madre (ej. Cosecha), además de las mejoras en el dashboard.

---

## 1. Arquitectura de Seguridad
Para cumplir con los estándares de seguridad sin complejidades innecesarias de redirección en una Single Page App (SPA), implementaremos:

1. **Autenticación basada en JWT (JSON Web Tokens)**:
   - El servidor generará un token JWT firmado tras un inicio de sesión exitoso.
   - El cliente guardará el token en `localStorage` y lo enviará en la cabecera `Authorization: Bearer <token>` de cada petición HTTP.
2. **Encriptación de Contraseñas con BCrypt**:
   - Usaremos la librería estándar **BCrypt** (mediante la dependencia `jbcrypt`) para hashear las contraseñas antes de almacenarlas en Supabase (PostgreSQL). Nunca guardaremos contraseñas en texto plano.
3. **Filtro/Interceptor en Spring Boot**:
   - Implementaremos un `HandlerInterceptor` o un filtro HTTP que valide la firma del JWT en los endpoints de `/api/**`, excepto para `/api/auth/login`.

---

## 2. Modelo de Datos y Permisos (Base de Datos)

Crearemos una nueva tabla `usuarios` en PostgreSQL (Supabase) con la siguiente estructura:

### Tabla: `usuarios`
| Campo | Tipo | Restricción | Descripción |
| :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | Primary Key, Auto-increment | Identificador único |
| `username` | `VARCHAR(50)` | Unique, Not Null | Nombre de usuario único |
| `password` | `VARCHAR(100)` | Not Null | Hash BCrypt de la contraseña |
| `email` | `VARCHAR(100)` | Unique, Not Null | Correo electrónico |
| `rol` | `VARCHAR(20)` | Not Null | `ADMIN` (acceso a todo) o `SUPERVISOR` |
| `modificar_rendimientos` | `BOOLEAN` | Default `false` | Permiso específico para editar rendimientos |
| `actividades_permitidas` | `TEXT` | Nullable | Lista de actividades madre permitidas (separadas por comas, ej. `"COSECHA"`, o `"COSECHA,DESMALEZADO"`) |
| `activo` | `BOOLEAN` | Default `true` | Estado del usuario |

> [!NOTE]
> Para el plan piloto, el primer usuario supervisor tendrá:
> - `rol`: `SUPERVISOR`
> - `modificar_rendimientos`: `false`
> - `actividades_permitidas`: `"COSECHA"`

---

## 3. Endpoints del Backend

Implementaremos los siguientes endpoints bajo `/api/auth` y `/api/admin/usuarios`:

1. **`POST /api/auth/login`**:
   - Recibe `{ username, password }`.
   - Verifica el usuario y compara el password usando `BCrypt.checkpw()`.
   - Si es correcto, genera y devuelve un token JWT junto con los datos de perfil y permisos del usuario.
2. **`GET /api/auth/me`**:
   - Endpoint protegido. Retorna los datos y permisos del usuario del token JWT actual.
3. **`GET /api/admin/usuarios`** (Solo Admin):
   - Retorna la lista de todos los usuarios registrados.
4. **`POST /api/admin/usuarios`** (Solo Admin):
   - Crea un nuevo usuario. Hashea la contraseña con BCrypt antes de guardar.
5. **`PUT /api/admin/usuarios/{id}`** (Solo Admin):
   - Modifica los detalles de un usuario existente (incluyendo permisos y contraseña si se envía una nueva).
6. **`DELETE /api/admin/usuarios/{id}`** o desactivar (Solo Admin):
   - Permite dar de baja o desactivar a un usuario.

---

## 4. Restricciones de Acceso (Lógica de Negocio)

### A. Filtrar Actividades en el Backend
Cuando un usuario con rol `SUPERVISOR` solicite actividades o labores madre para planificar, registrar ejecución, etc., el backend (o en su defecto el cliente basándose en el perfil autenticado) filtrará los datos:
- Si `actividades_permitidas` es `"COSECHA"`, solo se retornarán o mostrarán las actividades cuyo campo `laborMadre` sea `"COSECHA"`.
- Los administradores (`ADMIN`) verán todas las actividades sin filtro.

### B. Proteger la Modificación de Rendimientos
En los controladores correspondientes a rendimientos (`RendimientoController.java` o en los métodos de `AdminController.java` bajo `/rendimientos`), antes de ejecutar operaciones `POST`, `PUT` o `DELETE`, validaremos que:
1. El usuario tenga rol `ADMIN`, O
2. Tenga rol `SUPERVISOR` y su campo `modificar_rendimientos` sea `true`.
De lo contrario, se retornará un código HTTP `403 Forbidden`.

---

## 5. Diseño e Implementación en el Frontend

### A. Ventana de Login (Estética Premium)
- Diseñaremos una pantalla de login de pantalla completa con efecto **glassmorphism** (fondo desenfocado, gradiente moderno, bordes sutiles).
- Integración en `index.html`: Si no hay un token válido en `localStorage`, la app ocultará el contenedor principal (`.app-container`) y mostrará únicamente la pantalla de login.
- Validaciones instantáneas y feedback visual animado en caso de error de credenciales.

### B. Gestión de Usuarios (Vista Admin)
- Crearemos una nueva vista `/js/views/usuarios.js`.
- Los administradores verán una nueva opción "Usuarios" en la barra lateral.
- En esta interfaz el administrador podrá:
  - Ver una lista de usuarios en una tabla interactiva.
  - Abrir un modal para crear un nuevo usuario con campos de: Nombre, Correo, Contraseña, Rol.
  - Configurar los permisos mediante checkboxes interactivos:
    - `[ ] Permitir modificar rendimientos`
    - `[ ] Acceso a Cosecha`
    - `[ ] Acceso a Desmalezado` (y demás actividades madre que se detecten dinámicamente en el sistema).

### C. Desglose de Horas en el Dashboard (Para Todos los Usuarios)
El dashboard mantendrá el acceso global a todos los usuarios para que puedan monitorear a sus compañeros.
- **Totales de Horas con Desglose**: Debajo de la visualización principal de **Horas Planificadas** y **Horas Ejecutadas**, añadiremos una lista con barras de progreso sutiles que muestren el desglose por cada Actividad Madre activa en la semana actual.
- **Ejemplo de Estructura Visual**:
  ```
  [ Arco del Velocímetro de Avance ]

  HORAS PLANIFICADAS: 250.0h             HORAS EJECUTADAS: 180.0h
  ┌───────────────────────────────┐     ┌───────────────────────────────┐
  │ Desglose por labor madre:      │     │ Desglose por labor madre:      │
  │ • COSECHA: 120.0h             │     │ • COSECHA: 95.0h              │
  │ • DESBROTE: 80.0h             │     │ • DESBROTE: 55.0h             │
  │ • INFRAESTRUCTURA: 50.0h      │     │ • INFRAESTRUCTURA: 30.0h      │
  └───────────────────────────────┘     └───────────────────────────────┘
  ```
- Este desglose permitirá a cualquier usuario (incluso si solo gestiona Cosecha) ver cómo avanza el resto de sus compañeros en las demás actividades madre.

---

## 6. Plan de Trabajo Paso a Paso

1. **Añadir Dependencias**: Registrar `jbcrypt` y `java-jwt` en `pom.xml`.
2. **Crear Entidad Usuario**: Definir la clase `Usuario` y su `UsuarioRepository`.
3. **Servicios de Seguridad**: Crear `JWTService` para firmar y validar tokens, e implementarlo en un `HandlerInterceptor` o filtro de Spring Boot.
4. **API de Autenticación**: Crear `AuthController` y los endpoints para login y gestión de usuarios.
5. **Filtros en Servicios**: Aplicar lógica en controladores/servicios para restringir actividades y bloquear edición de rendimientos.
6. **Interfaz de Login**: Agregar maquetación CSS/HTML de la ventana de login.
7. **Panel Admin de Usuarios**: Programar la vista `usuarios.js` para administración.
8. **Desglose en Dashboard**: Modificar `dashboard.js` para agregar el desglose debajo de las horas planificadas y ejecutadas.

---

¡Este plan garantiza una transición segura y ordenada hacia un control multiusuario premium para la finca PYGANFLOR!
