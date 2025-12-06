import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import './App.css'

const API_BASE = 'https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/'
const CSV_HEADERS = [
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
]

const randomDelay = () => (Math.floor(Math.random() * 4) + 5) * 1000

const mapResponseToRow = (identificacion, payload) => {
  if (!payload) {
    return {
      identificacion,
      denominacion: 'Sin datos',
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
    }
  }

  return {
    identificacion,
    denominacion: payload.denominacion ?? '',
    entidad: payload.entidad ?? '',
    situacion: payload.situacion ?? '',
    fechaSit1: payload.fechaSit1 ?? '',
    monto: payload.monto ?? '',
    diasAtrasoPago: payload.diasAtrasoPago ?? '',
    refinanciaciones: payload.refinanciaciones ?? '',
    recategorizacionOblig: payload.recategorizacionOblig ?? '',
    situacionJuridica: payload.situacionJuridica ?? '',
    irrecDisposicionTecnica: payload.irrecDisposicionTecnica ?? '',
    enRevision: payload.enRevision ?? '',
    procesoJud: payload.procesoJud ?? '',
  }
}

function App() {
  const [queue, setQueue] = useState([])
  const [results, setResults] = useState([])
  const [processing, setProcessing] = useState(false)
  const [currentId, setCurrentId] = useState('')
  const [logs, setLogs] = useState([])
  const [error, setError] = useState('')
  const timerRef = useRef(null)
  const isMounted = useRef(true)

  useEffect(() => () => {
    isMounted.current = false
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
  }, [])

  const handleFile = (event) => {
    const [file] = event.target.files
    if (!file) return

    setError('')
    Papa.parse(file, {
      complete: (result) => {
        const ids = result.data
          .flat()
          .map((value) => `${value}`.trim())
          .filter((value) => value)

        if (!ids.length) {
          setError('El archivo CSV no contiene CUIL/CUIT válidos.')
          return
        }

        setQueue(ids)
        setResults([])
        setLogs([`Archivo cargado con ${ids.length} identidades.`])
      },
      error: () => {
        setError('No se pudo leer el archivo CSV.')
      },
    })
  }

  const fetchDebtData = async (identificacion) => {
    try {
      const response = await fetch(`${API_BASE}${identificacion}`)
      if (!response.ok) {
        throw new Error(`Error ${response.status}`)
      }
      const payload = await response.json()
      return mapResponseToRow(identificacion, payload)
    } catch (err) {
      setLogs((prev) => [...prev, `No se pudo consultar ${identificacion}: ${err.message}`])
      return mapResponseToRow(identificacion, null)
    }
  }

  const processQueue = async (index = 0) => {
    if (!isMounted.current) return

    if (index >= queue.length) {
      setProcessing(false)
      setCurrentId('')
      setLogs((prev) => [...prev, 'Procesamiento finalizado.'])
      return
    }

    const identificacion = queue[index]
    setCurrentId(identificacion)
    setLogs((prev) => [...prev, `Consultando ${identificacion}...`])

    const row = await fetchDebtData(identificacion)
    if (!isMounted.current) return

    setResults((prev) => [...prev, row])

    const delay = randomDelay()
    setLogs((prev) => [...prev, `Siguiente consulta en ${(delay / 1000).toFixed(1)}s`])

    timerRef.current = setTimeout(() => processQueue(index + 1), delay)
  }

  const startProcessing = () => {
    if (!queue.length) {
      setError('Sube un CSV primero.')
      return
    }
    if (processing) return

    setProcessing(true)
    setLogs((prev) => [...prev, 'Iniciando consultas...'])
    processQueue(0)
  }

  const stopProcessing = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    setProcessing(false)
    setCurrentId('')
    setLogs((prev) => [...prev, 'Procesamiento detenido por el usuario.'])
  }

  const exportCsv = () => {
    if (!results.length) {
      setError('Aún no hay resultados para exportar.')
      return
    }

    const csv = Papa.unparse({ fields: CSV_HEADERS, data: results })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = 'deudas.csv'
    link.click()

    URL.revokeObjectURL(url)
  }

  const progress = useMemo(() => {
    if (!queue.length) return 0
    return Math.min(100, Math.round((results.length / queue.length) * 100))
  }, [queue.length, results.length])

  return (
    <div className="app">
      <header>
        <h1>Central de Deudores</h1>
        <p>Chequeo masivo de CUIL/CUIT con pausas aleatorias de 5-8s.</p>
      </header>

      <section className="panel">
        <div className="controls">
          <label className="file-input">
            <span>Subir CSV de CUIL/CUIT</span>
            <input type="file" accept=".csv" onChange={handleFile} />
          </label>
          <div className="actions">
            <button onClick={startProcessing} disabled={processing}>Iniciar</button>
            <button onClick={stopProcessing} disabled={!processing}>Detener</button>
            <button onClick={exportCsv} disabled={!results.length}>Descargar CSV</button>
          </div>
          {error && <p className="error">{error}</p>}
        </div>

        <div className="status">
          <p>En cola: {queue.length}</p>
          <p>Procesados: {results.length}</p>
          <p>Actual: {currentId || '---'}</p>
          <div className="progress">
            <div className="bar" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <section className="logs">
        <h2>Actividad</h2>
        <div className="log-box">
          {logs.map((item, idx) => (
            <p key={idx}>{item}</p>
          ))}
        </div>
      </section>

      <section className="table-section">
        <div className="table-header">
          <h2>Resultados parciales ({results.length})</h2>
          <p>Podés descargar el CSV en cualquier momento sin interrumpir el proceso.</p>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {CSV_HEADERS.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={`${row.identificacion}-${row.entidad}-${row.situacion}`}>
                  {CSV_HEADERS.map((field) => (
                    <td key={field}>{row[field]}</td>
                  ))}
                </tr>
              ))}
              {!results.length && (
                <tr>
                  <td colSpan={CSV_HEADERS.length} className="empty">
                    Aún no hay resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default App
