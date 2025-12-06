# Chequeo masivo de deudas (BCRA)

Aplicación React con Vite que permite consultar la API pública del BCRA `https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/{identificacion}` usando múltiples CUILs cargados desde un archivo CSV.

## Funcionalidades
- Carga de un archivo `.csv` con una identificación por línea.
- Procesamiento secuencial con esperas aleatorias de 5 a 8 segundos entre solicitudes para proteger la API.
- Acumulación de resultados en una tabla con las columnas exigidas por el enunciado.
- Descarga del CSV de resultados en cualquier momento sin interrumpir el proceso.
- Controles para pausar/reanudar y reiniciar el flujo.

## Scripts
- `npm install` para instalar dependencias.
- `npm run dev` para levantar el entorno de desarrollo.
- `npm run build` para generar los artefactos de producción.
- `npm run preview` para previsualizar la build.
