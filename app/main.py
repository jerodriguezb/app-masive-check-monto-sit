import csv
import io
import random
import threading
import time
import uuid
from typing import Dict, List, Optional

import requests
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

BCRA_ENDPOINT = "https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/"


class Job:
    def __init__(self, cuils: List[str]):
        self.id = str(uuid.uuid4())
        self.cuils = cuils
        self.results: List[Dict[str, Optional[str]]] = []
        self.status = "pending"
        self.error: Optional[str] = None
        self.current_index = 0
        self.lock = threading.Lock()
        self.thread = threading.Thread(target=self._run, daemon=True)

    def start(self):
        self.status = "running"
        self.thread.start()

    def _run(self):
        try:
            for idx, cuil in enumerate(self.cuils):
                record = fetch_cuil_data(cuil)
                with self.lock:
                    self.results.append(record)
                    self.current_index = idx + 1
                time.sleep(random.uniform(5, 8))
        except Exception as exc:  # pragma: no cover - background safeguard
            self.error = str(exc)
            self.status = "failed"
            return
        self.status = "completed"


jobs: Dict[str, Job] = {}
jobs_lock = threading.Lock()

app = FastAPI(title="Chequeo de Deudas BCRA")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"]
)

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def index():
    with open("static/index.html", "r", encoding="utf-8") as file:
        return HTMLResponse(file.read())


@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="El archivo debe ser formato .csv")

    content = await file.read()
    decoded = content.decode("utf-8", errors="ignore")
    reader = csv.reader(io.StringIO(decoded))
    cuils = [row[0].strip() for row in reader if row]

    if not cuils:
        raise HTTPException(status_code=400, detail="No se encontraron CUIL en el archivo")

    job = Job(cuils)
    with jobs_lock:
        jobs[job.id] = job
    job.start()

    return {"jobId": job.id, "total": len(cuils)}


@app.get("/api/jobs/{job_id}")
async def job_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado")
    with job.lock:
        return {
            "jobId": job.id,
            "status": job.status,
            "total": len(job.cuils),
            "processed": job.current_index,
            "results": job.results,
            "error": job.error,
        }


@app.get("/api/jobs/{job_id}/download")
async def download_results(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado")

    header = [
        "identificacion",
        "denominacion",
        "entidad",
        "situacion",
        "fechaSit1",
        "monto",
        "diasAtrasoPago",
        "refinanciaciones",
        "recategorizacionOblig",
        "situacionJuridica",
        "irrecDisposicionTecnica",
        "enRevision",
        "procesoJud",
        "mensaje",
    ]
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=header)
    writer.writeheader()
    with job.lock:
        rows = list(job.results)
    for row in rows:
        writer.writerow(row)
    output.seek(0)

    filename = f"resultados_{job_id}.csv"
    return StreamingResponse(io.StringIO(output.getvalue()), media_type="text/csv", headers={
        "Content-Disposition": f"attachment; filename={filename}"
    })


def fetch_cuil_data(cuil: str) -> Dict[str, Optional[str]]:
    url = f"{BCRA_ENDPOINT}{cuil}"
    try:
        response = requests.get(url, timeout=20)
        response.raise_for_status()
        payload = response.json()
    except Exception as exc:
        return _empty_row(cuil, f"Error consultando API: {exc}")

    main_record: Dict[str, Optional[str]] = {}
    if isinstance(payload, dict):
        if isinstance(payload.get("deudas"), list) and payload["deudas"]:
            main_record = payload["deudas"][0]
        else:
            main_record = payload

    return {
        "identificacion": main_record.get("identificacion", cuil),
        "denominacion": main_record.get("denominacion"),
        "entidad": main_record.get("entidad"),
        "situacion": main_record.get("situacion"),
        "fechaSit1": main_record.get("fechaSit1"),
        "monto": main_record.get("monto"),
        "diasAtrasoPago": main_record.get("diasAtrasoPago"),
        "refinanciaciones": main_record.get("refinanciaciones"),
        "recategorizacionOblig": main_record.get("recategorizacionOblig"),
        "situacionJuridica": main_record.get("situacionJuridica"),
        "irrecDisposicionTecnica": main_record.get("irrecDisposicionTecnica"),
        "enRevision": main_record.get("enRevision"),
        "procesoJud": main_record.get("procesoJud"),
        "mensaje": main_record.get("mensaje"),
    }


def _empty_row(cuil: str, message: str) -> Dict[str, Optional[str]]:
    return {
        "identificacion": cuil,
        "denominacion": None,
        "entidad": None,
        "situacion": None,
        "fechaSit1": None,
        "monto": None,
        "diasAtrasoPago": None,
        "refinanciaciones": None,
        "recategorizacionOblig": None,
        "situacionJuridica": None,
        "irrecDisposicionTecnica": None,
        "enRevision": None,
        "procesoJud": None,
        "mensaje": message,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
