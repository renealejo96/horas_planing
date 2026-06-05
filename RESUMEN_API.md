# RESUMEN API - Guia de Integracion para Otras Apps/IA

Esta guia explica como conectarte a la API desde otra aplicacion (por ejemplo, Hostinger) y como extraer cosecha por semana, producto maestro y dia.

## 1) Base URL

Usa tu dominio de produccion en Render:

- https://TU_APP.onrender.com

En local:

- http://localhost:5000

---

## 2) Endpoint clave para tu caso

### GET /api/semanas/tallos-producto-maestro

Entrega datos de cosecha:

- Por semana
- Por producto maestro
- Con desglose por dia dentro de cada producto

### Parametros

- semana (opcional): formato AASS. Ejemplo: 2546.

Si envias semana, devuelve solo esa semana.
Si no envias semana, devuelve todas las semanas disponibles.

### URLs de ejemplo

- https://TU_APP.onrender.com/api/semanas/tallos-producto-maestro
- https://TU_APP.onrender.com/api/semanas/tallos-producto-maestro?semana=2546

### Respuesta (estructura)

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
        }
      ]
    }
  ]
}
```

### Significado de campos

- filtro_semana: semana enviada en query string, o null si no enviaste filtro.
- total_semanas: cantidad de semanas incluidas en la respuesta.
- semanas[].semana: identificador de semana en formato AASS.
- semanas[].productos[]: lista de productos maestros para esa semana.
- producto_maestro: categoria principal.
- total_tallos: suma total de tallos del producto en la semana.
- total_mallas: suma total de mallas del producto en la semana.
- total_registros: cantidad de registros usados para ese total.
- dias[]: detalle diario del producto dentro de la semana.
- dias[].fecha: fecha exacta (YYYY-MM-DD).
- dias[].dia_semana: nombre del dia.
- dias[].total_tallos: tallos del producto ese dia.
- dias[].total_mallas: mallas del producto ese dia.
- dias[].total_registros: registros del producto ese dia.

---

## 3) Endpoint auxiliar de semanas

### GET /api/semanas

Devuelve el listado de semanas disponibles para construir filtros.

Ejemplo:

- https://TU_APP.onrender.com/api/semanas

Respuesta:

```json
{
  "total": 24,
  "semanas": ["2546", "2545", "2544"]
}
```

---

## 4) Flujo recomendado para otra IA o app en Hostinger

1. Llamar /api/semanas.
2. Tomar la semana requerida (por ejemplo la primera, que suele ser la mas reciente).
3. Llamar /api/semanas/tallos-producto-maestro?semana=XXXX.
4. Consumir semanas[0].productos y su arreglo dias.

Con eso tienes directamente:

- Total semanal por producto maestro.
- Total diario por producto maestro.

---

## 5) Ejemplo rapido en Python

```python
import requests

BASE = "https://TU_APP.onrender.com"

# 1) semanas disponibles
semanas = requests.get(f"{BASE}/api/semanas", timeout=30).json()["semanas"]
semana = semanas[0]

# 2) resumen por producto maestro con detalle diario
data = requests.get(
    f"{BASE}/api/semanas/tallos-producto-maestro",
    params={"semana": semana},
    timeout=30
).json()

for producto in data["semanas"][0]["productos"]:
    print(producto["producto_maestro"], producto["total_tallos"])
    for dia in producto["dias"]:
        print("  ", dia["fecha"], dia["total_tallos"])
```

---

## 6) Ejemplo rapido en JavaScript

```javascript
const BASE = "https://TU_APP.onrender.com";

async function cargar() {
  const semanasResp = await fetch(`${BASE}/api/semanas`);
  const semanasData = await semanasResp.json();
  const semana = semanasData.semanas[0];

  const resp = await fetch(
    `${BASE}/api/semanas/tallos-producto-maestro?semana=${encodeURIComponent(semana)}`
  );
  const data = await resp.json();

  const productos = data.semanas?.[0]?.productos || [];
  productos.forEach((p) => {
    console.log(p.producto_maestro, p.total_tallos);
    p.dias.forEach((d) => console.log("  ", d.fecha, d.total_tallos));
  });
}

cargar();
```

---

## 7) Notas de integracion

- Metodo HTTP: GET.
- Formato de respuesta: JSON.
- Recomendado: timeout de 30s en cliente.
- Si no hay datos para el filtro, la API responde con semanas vacio.
- Para produccion, reemplaza localhost por tu dominio real en Render.
