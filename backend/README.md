# Guía de Ejecución y Configuración de Supabase (PostgreSQL)

Este proyecto está construido con Java 17 y Spring Boot 3. A continuación tienes los pasos detallados para ejecutarlo y cómo conectarlo a una base de datos en Supabase.

## 1. Configurar Supabase (PostgreSQL en la nube)

Supabase ofrece una base de datos PostgreSQL gratuita y lista para usar. Sigue estos pasos:

1. Ve a [Supabase.com](https://supabase.com/) y crea una cuenta o inicia sesión.
2. Haz clic en **"New Project"** y selecciona una organización.
3. Dale un nombre a tu proyecto (ej: `horas-app-db`) y crea una **contraseña segura para la base de datos**. *¡Guarda esta contraseña, la necesitarás!*
4. Espera un par de minutos a que la base de datos se aprovisione.
5. Una vez listo, ve a la sección de configuración (engranaje en la barra lateral) -> **Database**.
6. Desplázate hacia abajo hasta la sección **Connection string** y selecciona la pestaña **URI** o **JDBC**.
7. La cadena de conexión JDBC se verá algo así:
   `jdbc:postgresql://aws-0-REGION.pooler.supabase.com:6543/postgres?user=postgres.TU_PROJECT_REF&password=TU_PASSWORD`

## 2. Configurar las Credenciales en Spring Boot

Abre el archivo `src/main/resources/application.properties` en tu editor y reemplaza las configuraciones de la base de datos con los datos de Supabase:

```properties
spring.application.name=horas-app

# 1. Reemplaza esta URL con la cadena JDBC de Supabase
spring.datasource.url=jdbc:postgresql://[TU_URL_DE_SUPABASE]:6543/postgres?sslmode=require

# 2. Tu usuario de Supabase (suele ser postgres.referenciadelproyecto)
spring.datasource.username=postgres.[TU_REFERENCIA_DE_PROYECTO]

# 3. La contraseña que creaste en el paso 3 de Supabase
spring.datasource.password=TU_CONTRASEÑA_AQUI

# Hibernate - create-drop (para borrar y recrear tablas al inicio) o update (para mantener datos)
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true

server.port=8080
spring.jackson.serialization.write-dates-as-timestamps=false
```

## 3. Ejecutar el Backend

Como vi que no tenías Maven (`mvn`) instalado globalmente en tu terminal en los pasos previos, tienes un par de alternativas fáciles:

### Opción A: Usar Visual Studio Code o IntelliJ (Recomendado)
1. Abre la carpeta `backend` directamente en tu IDE (VS Code, IntelliJ, Eclipse).
2. Si usas VS Code, asegúrate de tener instalada la extensión **"Extension Pack for Java"** y **"Spring Boot Extension Pack"**.
3. El IDE detectará automáticamente que es un proyecto Maven e importará las dependencias de internet.
4. Abre el archivo `src/main/java/com/finca/horas/HorasAppApplication.java`.
5. Verás un botón de **"Run"** o **"Debug"** justo encima del método `main`. Haz clic en él.

### Opción B: Instalar Maven
1. Descarga e instala Maven (o usa un gestor de paquetes como Chocolatey en Windows: `choco install maven`).
2. Abre la terminal en la carpeta `backend`.
3. Ejecuta el comando: `mvn spring-boot:run`

### Opción C: Maven Wrapper (Si lo agregamos al proyecto)
Si descargas un `.zip` desde *Spring Initializr*, suele venir con los archivos `mvnw` y `mvnw.cmd`. En ese caso correrías `.\mvnw spring-boot:run`.

---

¡Una vez que la aplicación arranque, verás en la consola de Spring Boot que las tablas se han creado automáticamente en tu base de datos de Supabase! El backend estará ejecutándose en `http://localhost:8080`.
