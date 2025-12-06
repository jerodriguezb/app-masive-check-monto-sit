# Chequeo masivo de CUIL/CUIT contra BCRA

Aplicación web sencilla (FastAPI + HTML) que permite subir un CSV con CUIL/CUIT y consultar la API de deudas del BCRA con demoras aleatorias de 5 a 8 segundos entre verificaciones. Los resultados se acumulan en un CSV descargable en cualquier momento sin pausar el proceso.

## Requisitos
- Python 3.11+
- `pip` para instalar dependencias

## Instalación
```
pip install -r requirements.txt
```

## Uso
1. Iniciar el servidor de desarrollo:
   ```
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
2. Abrir [http://localhost:8000](http://localhost:8000) en el navegador.
3. Subir un archivo `.csv` con un CUIL/CUIT por línea.
4. Monitorea el avance en la página y usa el botón de descarga para obtener el CSV parcial o final.

## Notas
- Las consultas a la API pública del BCRA se ejecutan secuencialmente con demoras aleatorias entre 5 y 8 segundos.
- Los resultados se almacenan en memoria durante la ejecución del servidor.
