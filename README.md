# App de chequeo masivo BCRA

Aplicación React (Vite) compatible con Node 22.17.1 para consultar la API pública de Central de Deudores del BCRA a partir de un archivo CSV con múltiples CUIL/CUIT.

## Características
- Carga de archivos `.csv` con identificaciones.
- Procesamiento secuencial con demoras aleatorias entre 5 y 8 segundos por consulta para respetar la API.
- Acumulación continua de resultados en memoria.
- Descarga del CSV parcial o final sin pausar el proceso en curso (y descarga automática al completar la cola).
- Posibilidad de pausar manualmente las consultas.
- Reintentos automáticos ante caídas de conexión con la API para continuar sin recargar la página.
- Interruptor para cambiar entre modo claro y oscuro.

## Requisitos
- Node `22.17.1` (verificado con `nvm` en el entorno de desarrollo).

## Puesta en marcha
```bash
npm install
npm run dev
```
El servidor de desarrollo queda disponible (por defecto en `http://localhost:5173`).

Para generar una versión lista para producción:
```bash
npm run build
```

## Uso
1. Inicia la app y sube un archivo CSV que contenga una columna con los CUIL/CUIT a consultar.
2. Presiona **Iniciar proceso** para comenzar las consultas.
3. Observa el progreso y la tabla de resultados. El CSV acumulado puede descargarse en cualquier momento con el botón **Descargar CSV parcial** sin interrumpir el chequeo.
4. Usa **Pausar** si necesitas detener temporalmente las consultas.

Las columnas generadas en el CSV de salida son: `identificacion`, `denominacion`, `entidad`, `situacion`, `fechaSit1`, `monto`, `diasAtrasoPago`, `refinanciaciones`, `recategorizacionOblig`, `situacionJuridica`, `irrecDisposicionTecnica`, `enRevision` y `procesoJud`.
