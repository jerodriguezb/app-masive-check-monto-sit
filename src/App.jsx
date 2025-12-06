import { useEffect, useMemo, useRef, useState } from 'react';

const API_URL = 'https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/';
const OUTPUT_HEADERS = [
  'identificacion',
  'denominacion',
  'entidad',
  'situacion',
  'fechaSit1',
  'monto',
  'diasAtrasoPago',
  'refinanciaciones',
  'recategorizacionOblig',
  'situacionJuridica',
  'irrecDisposicionTecnica',
  'enRevision',
  'procesoJud'
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomDelay = () => Math.floor(5000 + Math.random() * 3000);

function parseCsvIds(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function buildCsv(rows) {
  const headerLine = OUTPUT_HEADERS.join(',');
  const body = rows
    .map((row) =>
      OUTPUT_HEADERS.map((key) => {
        const value = row[key] ?? '';
        const safe = String(value).replace(/"/g, '""');
        return /[",\n]/.test(safe) ? `"${safe}"` : safe;
      }).join(',')
    )
    .join('\n');
  return `${headerLine}\n${body}`;
}

function extractDebtEntry(data) {
  if (!data) return {};
  if (Array.isArray(data) && data.length > 0) {
    return data[0];
  }
  if (data.deudas && Array.isArray(data.deudas) && data.deudas.length > 0) {
    return data.deudas[0];
  }
  if (data.resultados && Array.isArray(data.resultados) && data.resultados.length > 0) {
    return data.resultados[0];
  }
  return data;
}

function App() {
  const [pendingIds, setPendingIds] = useState([]);
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [processed, setProcessed] = useState(0);
  const controllerRef = useRef({ cancel: false, paused: false });

  useEffect(() => {
    controllerRef.current.cancel = status === 'idle';
  }, [status]);

  const progress = useMemo(() => {
    if (pendingIds.length === 0) return 0;
    return Math.round((processed / pendingIds.length) * 100);
  }, [pendingIds.length, processed]);

  const handleCsvUpload = async (event) => {
    setError('');
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const ids = parseCsvIds(text);
    setPendingIds(ids);
    setResults([]);
    setProcessed(0);
    setStatus('ready');
  };

  const fetchDebt = async (identificacion) => {
    try {
      const response = await fetch(`${API_URL}${encodeURIComponent(identificacion)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const entry = extractDebtEntry(payload);
      return {
        identificacion,
        denominacion: entry.denominacion ?? entry.nombre ?? '',
        entidad: entry.entidad ?? entry.entidadFinanciera ?? '',
        situacion: entry.situacion ?? entry.situacion1 ?? '',
        fechaSit1: entry.fechaSit1 ?? entry.fecha ?? '',
        monto: entry.monto ?? entry.importe ?? '',
        diasAtrasoPago: entry.diasAtrasoPago ?? '',
        refinanciaciones: entry.refinanciaciones ?? '',
        recategorizacionOblig: entry.recategorizacionOblig ?? '',
        situacionJuridica: entry.situacionJuridica ?? '',
        irrecDisposicionTecnica: entry.irrecDisposicionTecnica ?? '',
        enRevision: entry.enRevision ?? '',
        procesoJud: entry.procesoJud ?? ''
      };
    } catch (err) {
      return {
        identificacion,
        denominacion: 'Error',
        entidad: '',
        situacion: '',
        fechaSit1: '',
        monto: '',
        diasAtrasoPago: '',
        refinanciaciones: '',
        recategorizacionOblig: '',
        situacionJuridica: '',
        irrecDisposicionTecnica: '',
        enRevision: '',
        procesoJud: err.message
      };
    }
  };

  const processQueue = async () => {
    if (status === 'running') return;
    if (pendingIds.length === 0) {
      setError('Sube un CSV con al menos un CUIL.');
      return;
    }
    setStatus('running');
    controllerRef.current.cancel = false;

    for (let i = processed; i < pendingIds.length; i += 1) {
      if (controllerRef.current.cancel) break;

      while (controllerRef.current.paused) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(300);
      }

      const identificacion = pendingIds[i];
      // eslint-disable-next-line no-await-in-loop
      const row = await fetchDebt(identificacion);
      setResults((prev) => [...prev, row]);
      setProcessed(i + 1);

      if (i < pendingIds.length - 1) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(randomDelay());
      }
    }

    setStatus('completed');
  };

  const downloadCsv = () => {
    const csv = buildCsv(results);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'deudas-bcra.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePauseToggle = () => {
    if (status !== 'running') return;
    controllerRef.current.paused = !controllerRef.current.paused;
    setStatus(controllerRef.current.paused ? 'paused' : 'running');
  };

  const handleReset = () => {
    controllerRef.current.cancel = true;
    controllerRef.current.paused = false;
    setStatus('idle');
    setPendingIds([]);
    setResults([]);
    setProcessed(0);
    setError('');
  };

  const currentStatusLabel = {
    idle: 'Sin proceso en curso',
    ready: 'Archivo cargado, listo para procesar',
    running: 'Procesando...',
    paused: 'Procesamiento en pausa',
    completed: 'Proceso terminado'
  }[status];

  return (
    <div className="app-shell">
      <div className="panel">
        <h1>Chequeo masivo de deudas (BCRA)</h1>
        <p className="description">
          Sube un archivo CSV con múltiples CUIL y consulta la API de forma secuencial con esperas aleatorias de 5 a 8 segundos.
          El archivo de resultados se puede descargar en cualquier momento sin detener el proceso.
        </p>

        <div className="upload-area">
          <label htmlFor="csvInput">
            <strong>Seleccionar archivo CSV</strong> con la columna de CUIL.
          </label>
          <input id="csvInput" type="file" accept=".csv" onChange={handleCsvUpload} />
          <p className="note">Formato esperado: una identificación (CUIL) por línea.</p>
        </div>

        <div className="button-row">
          <button onClick={processQueue} disabled={status === 'running' || pendingIds.length === 0}>
            Iniciar proceso
          </button>
          <button
            className="secondary"
            onClick={handlePauseToggle}
            disabled={status !== 'running' && status !== 'paused'}
          >
            {status === 'paused' ? 'Reanudar' : 'Pausar'}
          </button>
          <button className="secondary" onClick={handleReset} disabled={status === 'running' && !controllerRef.current.paused}>
            Reiniciar
          </button>
          <button className="secondary" onClick={downloadCsv} disabled={results.length === 0}>
            Descargar CSV parcial
          </button>
        </div>

        <div className="status-grid">
          <div className="status-card">
            <span>Estado</span>
            <div className="badge">{currentStatusLabel}</div>
          </div>
          <div className="status-card">
            <span>Total en archivo</span>
            <strong>{pendingIds.length}</strong>
          </div>
          <div className="status-card">
            <span>Procesados</span>
            <strong>{processed}</strong>
          </div>
          <div className="status-card">
            <span>Faltan</span>
            <strong>{Math.max(pendingIds.length - processed, 0)}</strong>
          </div>
        </div>

        <div className="progress" aria-label="Avance del procesamiento">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>

        {error && <p className="error">{error}</p>}
        <p className="note">
          Cada chequeo espera entre 5 y 8 segundos para no sobrecargar la API. Puedes descargar el archivo en cualquier momento
          mientras el proceso continúa.
        </p>
      </div>

      <div className="panel">
        <h2>Resultados ({results.length})</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {OUTPUT_HEADERS.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((row, index) => (
                <tr key={`${row.identificacion}-${index}`}>
                  {OUTPUT_HEADERS.map((header) => (
                    <td key={header}>{row[header] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
