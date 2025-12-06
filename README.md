# Central de Deudores – Consulta masiva

Aplicación React + Vite que permite cargar un CSV con múltiples CUIL/CUIT y consultar la API pública del BCRA
(<https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/identificacion>). Cada consulta se ejecuta de forma
secuencial con una espera aleatoria entre 5 y 8 segundos para cuidar el servicio. Los resultados se van
acumulando en memoria y se pueden descargar en cualquier momento en formato CSV sin detener el procesamiento.

## Requisitos

- Node.js 18+
- npm

## Puesta en marcha

```bash
npm install
npm run dev
```

La aplicación quedará disponible (por defecto) en <http://localhost:5173>.

## Uso

1. Prepara un archivo `.csv` con una columna que contenga los CUIL/CUIT a consultar (uno por línea).
2. Haz clic en **Cargar CSV de CUIL/CUIT** y selecciona el archivo.
3. La app leerá cada identificación, consultará la API con una pausa aleatoria de 5 a 8 segundos entre llamadas
   y mostrará los resultados en la tabla.
4. El botón **Descargar resultados CSV** está disponible en todo momento para bajar el progreso acumulado sin
   frenar el proceso.

## Formato del CSV de salida

Las columnas generadas son:

```
identificacion, denominacion, entidad, situacion, fechaSit1, monto, diasAtrasoPago, refinanciaciones,
recategorizacionOblig, situacionJuridica, irrecDisposicionTecnica, enRevision, procesoJud
```
