# Documentación de la API de Resumen de Cosecha

## Descripción General
Esta API permite consumir los datos del resumen de cosecha desde aplicaciones externas como Excel, Power BI, o cualquier cliente HTTP.

## Endpoints Disponibles

### 1. GET `/api/resumen`
Devuelve los datos del resumen en formato JSON.

#### Parámetros de consulta (opcionales):
- `semana`: Semana específica en formato AASS (ej: `2546`). Si no se especifica, devuelve la semana actual.
- `formato`: Tipo de respuesta
  - `plano` (por defecto): Datos en formato tabla, ideal para Excel
  - `jerarquico`: Datos agrupados por producto/variedad/día

#### Ejemplos de uso:
```
http://localhost:5000/api/resumen
http://localhost:5000/api/resumen?semana=2546
http://localhost:5000/api/resumen?semana=2546&formato=jerarquico
```

#### Respuesta (formato plano):
```json
{
  "semana": "2546",
  "total_registros": 150,
  "datos": [
    {
      "semana": "2546",
      "producto_maestro": "FREEDOM",
      "variedad": "Freedom",
      "fecha": "2025-11-10",
      "dia_semana": "Lunes",
      "modulo": "F6",
      "hora_cosecha": "08:30:00",
      "tallos_por_malla": 25,
      "mallas": 10,
      "total_tallos": 250,
      "responsable": "Juan Pérez",
      "viaje": "Viaje 1"
    }
  ]
}
```

---

### 2. GET `/api/resumen/excel`
Genera y descarga un archivo Excel con los datos del resumen.

#### Parámetros de consulta (opcionales):
- `semana`: Semana específica en formato AASS (ej: `2546`). Si no se especifica, devuelve la semana actual.

#### Ejemplos de uso:
```
http://localhost:5000/api/resumen/excel
http://localhost:5000/api/resumen/excel?semana=2546
```

#### Respuesta:
Archivo Excel (.xlsx) descargable con el nombre `resumen_cosecha_semana_XXXX.xlsx`

---

### 3. GET `/api/semanas`
Devuelve todas las semanas disponibles en la base de datos.

#### Ejemplos de uso:
```
http://localhost:5000/api/semanas
```

#### Respuesta:
```json
{
  "total": 24,
  "semanas": ["2546", "2545", "2544", "2543", ...]
}
```

---

### 4. GET `/api/semanas/tallos-producto-maestro`
Devuelve los totales de cosecha por producto maestro agrupados por semana, con desglose por dia.

#### Parámetros de consulta (opcionales):
- `semana`: Semana especifica en formato AASS (ej: `2546`).
  - Si se envia, devuelve solo esa semana.
  - Si no se envia, devuelve todas las semanas disponibles.

#### Ejemplos de uso:
```
http://localhost:5000/api/semanas/tallos-producto-maestro
http://localhost:5000/api/semanas/tallos-producto-maestro?semana=2546
```

#### Respuesta:
```json
{
  "filtro_semana": "2546",
  "total_semanas": 1,
  "semanas": [
    {
      "semana": "2546",
      "total_productos": 2,
      "productos": [
        {
          "producto_maestro": "FREEDOM",
          "total_tallos": 12500,
          "total_mallas": 520,
          "total_registros": 44,
          "dias": [
            {
              "fecha": "2026-05-11",
              "dia_semana": "Lunes",
              "total_tallos": 2100,
              "total_mallas": 85,
              "total_registros": 8
            },
            {
              "fecha": "2026-05-12",
              "dia_semana": "Martes",
              "total_tallos": 1800,
              "total_mallas": 76,
              "total_registros": 7
            }
          ]
        },
        {
          "producto_maestro": "EXPLORER",
          "total_tallos": 9800,
          "total_mallas": 410,
          "total_registros": 36,
          "dias": [
            {
              "fecha": "2026-05-11",
              "dia_semana": "Lunes",
              "total_tallos": 1600,
              "total_mallas": 66,
              "total_registros": 6
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Consumir desde Excel usando Power Query

### Método 1: Importar datos JSON

1. En Excel, ve a **Datos > Obtener datos > Desde otras fuentes > Desde web**
2. Ingresa la URL: `http://localhost:5000/api/resumen?semana=2546`
3. Haz clic en **Aceptar**
4. En el Editor de Power Query, expande la columna `datos`
5. Selecciona las columnas que necesites
6. Haz clic en **Cerrar y cargar**

### Método 2: Descargar directamente el Excel

1. Abre tu navegador
2. Ingresa la URL: `http://localhost:5000/api/resumen/excel?semana=2546`
3. Se descargará automáticamente el archivo Excel
4. Abre el archivo en Excel

### Método 3: Usar VBA para importar JSON

```vba
Sub ImportarDatosCosecha()
    Dim http As Object
    Dim url As String
    Dim semana As String
    
    ' Configurar semana a consultar
    semana = "2546"
    url = "http://localhost:5000/api/resumen?semana=" & semana
    
    ' Crear objeto HTTP
    Set http = CreateObject("MSXML2.XMLHTTP")
    
    ' Hacer la petición
    http.Open "GET", url, False
    http.send
    
    ' Obtener respuesta
    Dim response As String
    response = http.responseText
    
    ' Procesar el JSON (requiere librería de JSON)
    ' O usar Power Query como se muestra arriba
    
    MsgBox "Datos recibidos: " & Left(response, 100) & "..."
End Sub
```

---

## Consumir desde Power BI

1. En Power BI Desktop, haz clic en **Obtener datos > Web**
2. Ingresa la URL: `http://localhost:5000/api/resumen`
3. Haz clic en **Aceptar**
4. Power BI detectará automáticamente el formato JSON
5. Expande la columna `datos` y selecciona los campos necesarios
6. Haz clic en **Cargar**

---

## Ejemplos de Código

### Python
```python
import requests
import pandas as pd

# Obtener datos JSON
response = requests.get('http://localhost:5000/api/resumen?semana=2546')
data = response.json()
df = pd.DataFrame(data['datos'])
print(df)
```

### JavaScript / Node.js
```javascript
const fetch = require('node-fetch');

async function obtenerResumen(semana) {
    const response = await fetch(`http://localhost:5000/api/resumen?semana=${semana}`);
    const data = await response.json();
    console.log(data);
}

obtenerResumen('2546');
```

### cURL (línea de comandos)
```bash
# Obtener JSON
curl "http://localhost:5000/api/resumen?semana=2546"

# Descargar Excel
curl -o resumen.xlsx "http://localhost:5000/api/resumen/excel?semana=2546"
```

---

## Notas Importantes

1. **URL de Producción**: Cuando despliegues en producción (Render), reemplaza `localhost:5000` con tu URL de producción (ej: `https://tu-app.onrender.com`)

2. **Formato de Semana**: El formato de semana es AASS donde:
   - AA = Año (ej: 25 para 2025)
   - SS = Número de semana (ej: 46 para semana 46)

3. **Columnas disponibles** (formato plano):
   - `semana`: Semana en formato AASS
   - `producto_maestro`: Categoría del producto
   - `variedad`: Variedad específica
   - `fecha`: Fecha de cosecha (YYYY-MM-DD)
   - `dia_semana`: Día de la semana (Lunes, Martes, etc.)
   - `modulo`: Bloque/módulo de cosecha
   - `hora_cosecha`: Hora de cosecha (HH:MM:SS)
   - `tallos_por_malla`: Número de tallos por malla (10, 15, 25, 30)
   - `mallas`: Cantidad de mallas cosechadas
   - `total_tallos`: Total de tallos (tallos_por_malla × mallas)
   - `responsable`: Persona responsable
   - `viaje`: Identificador del viaje

4. **Actualización de datos**: Los datos se actualizan en tiempo real desde la base de datos.

5. **Rendimiento**: Para grandes volúmenes de datos, considera usar el endpoint `/api/resumen/excel` que descarga directamente el archivo Excel.

---

## Soporte y Contacto

Para dudas o problemas con la API, consulta la aplicación principal o revisa los logs del servidor.
