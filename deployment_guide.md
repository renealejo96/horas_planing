# Guía de Despliegue en VPS (Hostinger) usando Docker

Esta guía describe el proceso paso a paso para subir el proyecto a **GitHub** y desplegarlo en un **VPS de Hostinger** mediante contenedores Docker.

---

## 1. Subir el Proyecto a GitHub

Sigue estos comandos en tu terminal local (desde la raíz de `horas_app`) para inicializar el repositorio y subirlo:

```bash
# 1. Inicializar repositorio de Git
git init

# 2. Agregar todos los archivos (el archivo .gitignore evitará archivos innecesarios)
git add .

# 3. Crear el primer commit
git commit -m "feat: integración de API Cosecha y Dockerizacion"

# 4. Cambiar a la rama principal (main)
git branch -M main

# 5. Asociar tu repositorio remoto de GitHub
# (Reemplaza la URL con la de tu repositorio de GitHub)
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git

# 6. Empujar los cambios a GitHub
git push -u origin main
```

> [!NOTE]
> Para modificaciones futuras, solo debes ejecutar:
> ```bash
> git add .
> git commit -m "descripción del cambio"
> git push origin main
> ```

---

## 2. Preparar el VPS en Hostinger

Una vez que tengas contratado tu VPS con Hostinger (se recomienda usar **Ubuntu 22.04 LTS** o **Ubuntu 24.04 LTS**):

### Paso A: Conectarse por SSH
Abre la terminal en tu máquina local y conéctate a tu VPS:
```bash
ssh root@IP_DE_TU_VPS
```
*(Ingresa la contraseña que definiste al configurar el VPS).*

### Paso B: Instalar Docker y Docker Compose
Ejecuta los siguientes comandos para instalar Docker y Docker Compose en tu VPS:
```bash
# 1. Actualizar repositorios del sistema
sudo apt-get update

# 2. Instalar Docker
sudo apt-get install -y docker.io docker-compose

# 3. Iniciar y habilitar el servicio de Docker
sudo systemctl start docker
sudo systemctl enable docker
```

---

## 3. Despliegue en el VPS

Una vez que el VPS tiene Docker, sigue estos pasos para desplegar tu aplicación:

### Paso A: Clonar el Repositorio de GitHub
Clona el repositorio que creaste en el paso 1:
```bash
git clone https://github.com/TU_USUARIO/TU_REPOSITORIO.git
cd TU_REPOSITORIO
```

### Paso B: Iniciar la Aplicación con Docker Compose
La aplicación ya está configurada con Docker y Nginx proxy. Para iniciarla ejecuta:
```bash
docker-compose up -d --build
```

### Paso C: Verificar que esté en Funcionamiento
* El **Frontend** (Nginx) responderá en el puerto estándar **80** (puedes acceder ingresando la IP de tu VPS en el navegador, ej: `http://IP_DE_TU_VPS`).
* El **Backend** (Spring Boot) correrá internamente y Nginx le redirigirá las llamadas de `/api/*`.

---

## 4. Flujo de Actualizaciones (Sin Fricción)

Cuando hagas una modificación en tu máquina local y quieras ver los cambios reflejados en el VPS:

1. **En Local:**
   ```bash
   git add .
   git commit -m "Ajuste de código"
   git push origin main
   ```

2. **En el VPS (vía SSH):**
   ```bash
   # Ir al directorio del proyecto
   cd ~/TU_REPOSITORIO

   # Descargar los cambios más recientes
   git pull origin main

   # Reconstruir e iniciar los contenedores en segundo plano
   docker-compose up -d --build
   ```

*¡Los contenedores se reconstruirán y la aplicación se actualizará sin interrupciones!*
