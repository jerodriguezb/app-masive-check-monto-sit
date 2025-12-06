# Central de Deudores - Lotes CSV

Aplicación React (Node 22.17.1) que permite cargar un archivo CSV con CUIL/CUIT, consultarlos uno a uno en la API pública del BCRA con esperas aleatorias de 5 a 8 segundos y descargar un CSV de resultados en cualquier momento.

## Requisitos
- Node.js 22.17.1
- npm

## Cómo usar
1. Instala dependencias: `npm install`.
2. Ejecuta el entorno de desarrollo: `npm run dev` y abre la URL que muestre Vite.
3. Sube un archivo `.csv` con un CUIL/CUIT por línea.
4. Pulsa **Iniciar**. Cada consulta se hace con una pausa aleatoria entre 5 y 8 segundos.
5. Puedes pulsar **Descargar CSV** en cualquier momento para obtener los resultados acumulados sin detener el proceso. Usa **Detener** si quieres pausar las consultas.

## Columnas exportadas
`identificacion, denominacion, entidad, situacion, fechaSit1, monto, diasAtrasoPago, refinanciaciones, recategorizacionOblig, situacionJuridica, irrecDisposicionTecnica, enRevision, procesoJud`.
