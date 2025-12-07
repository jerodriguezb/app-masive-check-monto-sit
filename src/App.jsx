import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';

const API_URL = 'https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/';
const DELAY_RANGE = { min: 5000, max: 8000 };
const RETRY_ATTEMPTS = 3;

const COLUMNS = [
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
  'procesoJud',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomDelay = () =>
  Math.floor(Math.random() * (DELAY_RANGE.max - DELAY_RANGE.min + 1) + DELAY_RANGE.min);

function normalizeRows(identificacion, payload) {
  const baseRow = {
    identificacion,
    denominacion: '',
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
    procesoJud: '',
  };

  const results = payload?.results;
  const denominacion = results?.denominacion ?? '';
  const periodos = Array.isArray(results?.periodos) ? results.periodos : [];

  const rows = periodos.flatMap((periodo) => {
    const entidades = Array.isArray(periodo?.entidades) ? periodo.entidades : [];
    if (!entidades.length) {
      return [];
    }

    return entidades.map((entidad) => ({
      ...baseRow,
      identificacion,
      denominacion,
      entidad: entidad?.entidad ?? '',
      situacion: entidad?.situacion ?? '',
      fechaSit1: entidad?.fechaSit1 ?? '',
      monto: entidad?.monto ?? '',
      diasAtrasoPago: entidad?.diasAtrasoPago ?? '',
      refinanciaciones: entidad?.refinanciaciones ?? '',
      recategorizacionOblig: entidad?.recategorizacionOblig ?? '',
      situacionJuridica: entidad?.situacionJuridica ?? '',
      irrecDisposicionTecnica: entidad?.irrecDisposicionTecnica ?? '',
      enRevision: entidad?.enRevision ?? '',
      procesoJud: entidad?.procesoJud ?? '',
    }));
  });

  if (rows.length) return rows;
  return [{ ...baseRow, identificacion, denominacion }];
}

function App() {
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('Esperando archivo CSV...');
  const [theme, setTheme] = useState('light');
  const autoDownloadedRef = useRef(false);
  const abortRef = useRef(null);

  const parsedCount = results.length;
  const pendingCount = queue.length - parsedCount;

  useEffect(() => {
    document.body.classList.toggle('theme-dark', theme === 'dark');
  }, [theme]);

  const loadCsv = useCallback((file) => {
    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (parsed) => {
        const items = parsed.data
          .flat()
          .map((row) => (Array.isArray(row) ? row[0] : row))
          .map((value) => String(value ?? '').trim())
          .map((value) => value.replace(/\D/g, ''))
          .filter(Boolean);

        setQueue(items);
        setResults([]);
        setCurrentIndex(0);
        setIsRunning(false);
        autoDownloadedRef.current = false;
        setStatus(
          items.length
            ? `Archivo listo. ${items.length} CUIL/CUIT cargados.`
            : 'El archivo no contenía identificaciones válidas.'
        );
      },
      error: () => {
        setStatus('No se pudo leer el archivo.');
      },
    });
  }, []);

  const handleFileChange = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      loadCsv(file);
    },
    [loadCsv]
  );

  const downloadCsv = useCallback(() => {
    if (!results.length) return;
    const csv = Papa.unparse(results, { columns: COLUMNS });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `central-de-deudores-${now}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [results]);

  const fetchDebtRows = useCallback(async (identificacion) => {
    const baseRow = {
      identificacion,
      denominacion: '',
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
      procesoJud: '',
    };

    const controller = new AbortController();
    abortRef.current = controller;

    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(`${API_URL}${identificacion}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Error ${response.status}`);
        }
        const payload = await response.json();
        if (payload?.status && payload.status !== 200) {
          return [{ ...baseRow, situacion: `Error ${payload.status}` }];
        }
        const rows = normalizeRows(identificacion, payload);
        if (!rows.length) return rows;

        const totalMonto = rows.reduce((acc, row) => acc + Number(row.monto || 0), 0);
        const totalRow = {
          ...baseRow,
          identificacion,
          denominacion: rows[0]?.denominacion ?? '',
          entidad: 'TOTAL',
          monto: totalMonto,
        };

        return [...rows, totalRow];
      } catch (error) {
        if (error.name === 'AbortError') {
          return [{ ...baseRow, situacion: 'Consulta cancelada' }];
        }

        if (attempt < RETRY_ATTEMPTS) {
          setStatus(
            `Conexión interrumpida para ${identificacion}. Reintentando (${attempt + 1}/${RETRY_ATTEMPTS})...`
          );
          await sleep(1000 * attempt);
          continue;
        }

        return [{ ...baseRow, situacion: error?.message ?? 'Error desconocido' }];
      }
    }

    return [{ ...baseRow, situacion: 'Error desconocido' }];
  }, [setStatus]);

  useEffect(() => {
    if (!isRunning) return undefined;
    if (currentIndex >= queue.length) {
      setIsRunning(false);
      setStatus('Proceso completado.');
      return undefined;
    }

    let cancelled = false;
    const identificacion = queue[currentIndex];

    const run = async () => {
      const delayMs = randomDelay();
      setStatus(`Esperando ${Math.round(delayMs / 1000)}s para consultar ${identificacion}...`);
      await sleep(delayMs);
      if (cancelled) return;

      setStatus(`Consultando ${identificacion}...`);
      const rows = await fetchDebtRows(identificacion);
      if (cancelled) return;

      setResults((prev) => [...prev, ...rows]);
      setCurrentIndex((prev) => prev + 1);
    };

    run();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [currentIndex, fetchDebtRows, isRunning, queue]);

  const progress = useMemo(() => {
    if (!queue.length) return 0;
    return Math.round((parsedCount / queue.length) * 100);
  }, [parsedCount, queue.length]);

  const startProcessing = useCallback(() => {
    if (!queue.length) {
      setStatus('Primero carga un CSV con CUIL/CUIT.');
      return;
    }
    setIsRunning(true);
    autoDownloadedRef.current = false;
    setStatus('Iniciando consultas...');
  }, [queue.length]);

  const stopProcessing = useCallback(() => {
    setIsRunning(false);
    abortRef.current?.abort();
    setStatus('Proceso pausado por el usuario.');
  }, []);

  const rowsPreview = useMemo(() => queue.join(', '), [queue]);

  useEffect(() => {
    const completed = !isRunning && queue.length > 0 && currentIndex >= queue.length && results.length > 0;
    if (completed && !autoDownloadedRef.current) {
      autoDownloadedRef.current = true;
      downloadCsv();
      setStatus('Proceso completado. CSV descargado automáticamente.');
    }
  }, [currentIndex, downloadCsv, isRunning, queue.length, results.length]);

  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <div>
            <h1>Chequeo masivo de deudas BCRA</h1>
            <p className="small">
              Sube un archivo CSV con CUIL/CUIT. Cada consulta usa la API pública con una pausa aleatoria de
              5 a 8 segundos entre pedidos para no sobrecargar el servicio.
            </p>
          </div>
          <div className="header-controls">
            <div className="theme-toggle" aria-label="Cambiar tema">
              <span aria-hidden="true">☀️</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={theme === 'dark'}
                  onChange={(event) => setTheme(event.target.checked ? 'dark' : 'light')}
                />
                <span className="slider" />
              </label>
              <span aria-hidden="true">🌙</span>
            </div>
            <span className="badge" aria-label="Versión">
              Node 22.17.1
            </span>
          </div>
        </div>

        <label>
          Archivo CSV con CUIL/CUIT
          <input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
        </label>

        {queue.length > 0 && (
          <div className="status">
            {queue.length} identificaciones cargadas. Ejemplo de contenido: {rowsPreview.slice(0, 80)}
            {rowsPreview.length > 80 ? '...' : ''}
          </div>
        )}

        <div className="actions">
          <button onClick={startProcessing} disabled={isRunning || !queue.length}>
            {isRunning ? 'Procesando...' : 'Iniciar proceso'}
          </button>
          <button onClick={stopProcessing} disabled={!isRunning}>
            Pausar
          </button>
          <button onClick={downloadCsv} disabled={!results.length}>
            Descargar CSV parcial
          </button>
        </div>

        <div className="status">{status}</div>
        <div className="status">
          Completados: {parsedCount} / {queue.length || 0} — Pendientes: {Math.max(pendingCount, 0)}
        </div>
        <div className="progress" aria-label="Progreso de consultas">
          <div style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="flex-row">
          <h2>Resultados acumulados</h2>
          <span className="tag">Actualización continua</span>
        </div>
        <p className="small">
          Puedes descargar el CSV en cualquier momento sin interrumpir el proceso. La tabla muestra todos los
          registros consultados hasta ahora.
        </p>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((row, index) => (
                <tr key={`${row.identificacion}-${index}`}>
                  {COLUMNS.map((column) => (
                    <td key={`${column}-${index}`}>{row[column] ?? ''}</td>
                  ))}
                </tr>
              ))}
              {!results.length && (
                <tr>
                  <td colSpan={COLUMNS.length} style={{ textAlign: 'center', color: '#94a3b8' }}>
                    Aún no hay datos. Inicia el proceso para ver los resultados aquí.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
