import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const API_BASE = 'https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas';
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

const randomDelay = () => Math.floor(Math.random() * (8000 - 5000 + 1)) + 5000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'SI' : 'NO';
  return String(value);
};

const normalizePayload = (identificacion, payload) => {
  const source = Array.isArray(payload?.deudas)
    ? payload.deudas?.[0]
    : Array.isArray(payload)
      ? payload?.[0]
      : payload;

  return {
    identificacion,
    denominacion: source?.denominacion ?? payload?.denominacion ?? '',
    entidad: source?.entidad ?? payload?.entidad ?? '',
    situacion: source?.situacion ?? payload?.situacion ?? '',
    fechaSit1: source?.fechaSit1 ?? source?.fecha ?? payload?.fechaSit1 ?? '',
    monto: source?.monto ?? source?.montoTotal ?? payload?.monto ?? '',
    diasAtrasoPago: source?.diasAtrasoPago ?? payload?.diasAtrasoPago ?? '',
    refinanciaciones: source?.refinanciaciones ?? payload?.refinanciaciones ?? '',
    recategorizacionOblig:
      source?.recategorizacionOblig ?? payload?.recategorizacionOblig ?? '',
    situacionJuridica: source?.situacionJuridica ?? payload?.situacionJuridica ?? '',
    irrecDisposicionTecnica:
      source?.irrecDisposicionTecnica ?? payload?.irrecDisposicionTecnica ?? '',
    enRevision: source?.enRevision ?? payload?.enRevision ?? '',
    procesoJud: source?.procesoJud ?? payload?.procesoJud ?? '',
  };
};

function App() {
  const [queue, setQueue] = useState([]);
  const [results, setResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [nextDelay, setNextDelay] = useState(null);
  const processingRef = useRef(false);
  const queueRef = useRef([]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const parseCsv = useCallback((text) => {
    const lines = text
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.split(',')[0]?.trim())
      .filter((value) => Boolean(value));
    return Array.from(new Set(lines));
  }, []);

  const handleFile = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result ?? '';
        const ids = parseCsv(String(content));
        setQueue((prev) => [...prev, ...ids]);
      };
      reader.readAsText(file);
      event.target.value = '';
    },
    [parseCsv],
  );

  const downloadCsv = useCallback(() => {
    if (!results.length) return;
    const header = `${COLUMNS.join(',')}\n`;
    const rows = results.map((row) =>
      COLUMNS.map((key) => {
        const value = sanitizeValue(row[key]);
        return `"${value.replace(/"/g, '""')}"`;
      }).join(','),
    );

    const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'resultado-deudas.csv';
    link.click();
    URL.revokeObjectURL(url);
  }, [results]);

  const checkIdentification = useCallback(async (identificacion) => {
    setActiveId(identificacion);
    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(identificacion)}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }
      const payload = await response.json();
      const normalized = normalizePayload(identificacion, payload);
      setResults((prev) => [...prev, { status: 'ok', ...normalized }]);
    } catch (error) {
      setResults((prev) => [
        ...prev,
        {
          status: 'error',
          identificacion,
          denominacion: '',
          entidad: '',
          situacion: 'Error',
          fechaSit1: '',
          monto: '',
          diasAtrasoPago: '',
          refinanciaciones: '',
          recategorizacionOblig: '',
          situacionJuridica: '',
          irrecDisposicionTecnica: '',
          enRevision: '',
          procesoJud: '',
          error: error.message,
        },
      ]);
    }
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return;
    processingRef.current = true;
    setIsProcessing(true);

    while (queueRef.current.length > 0) {
      const currentId = queueRef.current[0];
      await checkIdentification(currentId);
      setQueue((prev) => prev.slice(1));

      if (queueRef.current.length > 0) {
        const delay = randomDelay();
        setNextDelay(delay);
        await sleep(delay);
      }
    }

    setActiveId('');
    setNextDelay(null);
    setIsProcessing(false);
    processingRef.current = false;
  }, [checkIdentification]);

  useEffect(() => {
    if (!processingRef.current && queueRef.current.length > 0) {
      processQueue();
    }
  }, [queue, processQueue]);

  const summary = useMemo(
    () => ({ processed: results.length, pending: queue.length, running: isProcessing }),
    [results.length, queue.length, isProcessing],
  );

  return (
    <div className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Central de Deudores - BCRA</p>
          <h1>Consulta masiva de CUIL/CUIT</h1>
          <p className="subtitle">
            Sube un archivo CSV con múltiples identificaciones. Cada consulta se ejecuta con una espera
            aleatoria entre 5 y 8 segundos para evitar sobrecargar la API pública.
          </p>
        </div>
        <div className="actions">
          <label className="upload-btn">
            <input type="file" accept=".csv" onChange={handleFile} />
            Cargar CSV de CUIL/CUIT
          </label>
          <button type="button" className="secondary" disabled={!results.length} onClick={downloadCsv}>
            Descargar resultados CSV
          </button>
        </div>
      </header>

      <section className="status">
        <div>
          <p className="label">Procesados</p>
          <p className="value">{summary.processed}</p>
        </div>
        <div>
          <p className="label">En cola</p>
          <p className="value">{summary.pending}</p>
        </div>
        <div>
          <p className="label">Estado</p>
          <p className="value">{summary.running ? 'Consultando' : 'En espera'}</p>
        </div>
        <div>
          <p className="label">Consultando ahora</p>
          <p className="value">{activeId || '-'} </p>
        </div>
        <div>
          <p className="label">Próxima espera</p>
          <p className="value">{nextDelay ? `${Math.round(nextDelay / 1000)}s` : '-'}</p>
        </div>
      </section>

      <section className="table-wrapper">
        <div className="table-header">
          <h2>Resultados (se actualizan en vivo)</h2>
          <p className="hint">Puedes descargar el CSV en cualquier momento sin detener el procesamiento.</p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                {COLUMNS.map((col) => (
                  <th key={col}>{col}</th>
                ))}
                <th>estado</th>
                <th>mensaje</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row, index) => (
                <tr key={`${row.identificacion}-${index}`} className={row.status === 'error' ? 'error' : ''}>
                  <td>{index + 1}</td>
                  {COLUMNS.map((col) => (
                    <td key={`${row.identificacion}-${col}`}>{sanitizeValue(row[col])}</td>
                  ))}
                  <td className={row.status === 'error' ? 'badge error' : 'badge ok'}>
                    {row.status === 'error' ? 'Error' : 'OK'}
                  </td>
                  <td>{row.error || ''}</td>
                </tr>
              ))}
              {!results.length && (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="empty">
                    No hay resultados aún. Carga un CSV para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default App;
