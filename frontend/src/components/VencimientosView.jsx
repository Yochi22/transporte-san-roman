import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { api } from '../lib/api'
import { FILTROS_ESTADO, formatearFechaDocumento, textoDiasRestantes } from '../lib/documentos'
import { EstadoDocumentoBadge } from './DocumentoEstado.jsx'
import DocumentosModal from './DocumentosModal.jsx'

const PAGE_SIZE = 15

// Vista de conjunto: todos los documentos de choferes y unidades activos,
// lo mas urgente primero. La edicion se hace abriendo los documentos del titular.
export default function VencimientosView({ isAdmin, resumen, onChange }) {
  const [estado, setEstado] = useState('TODOS')
  const [entidad, setEntidad] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [documentos, setDocumentos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [pagina, setPagina] = useState(1)
  const [seleccion, setSeleccion] = useState(null)
  const [version, setVersion] = useState(0)
  const rangoInvertido = Boolean(desde && hasta && desde > hasta)

  useEffect(() => {
    if (rangoInvertido) return undefined
    let activo = true
    api.get('/documentos', {
      params: {
        estado: estado === 'TODOS' ? undefined : estado,
        entidad: entidad || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
      },
    })
      .then((response) => {
        if (!activo) return
        setDocumentos(response.data?.data || [])
        setError('')
      })
      .catch((err) => {
        if (activo) setError(err.response?.data?.mensaje || 'No se pudieron consultar los vencimientos.')
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => { activo = false }
  }, [estado, entidad, desde, hasta, rangoInvertido, version])

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return documentos
    return documentos.filter((documento) => (
      `${documento.titular || ''} ${documento.titularDetalle || ''} ${documento.tipoEtiqueta}`.toLowerCase().includes(texto)
    ))
  }, [documentos, busqueda])

  const paginas = Math.max(1, Math.ceil(visibles.length / PAGE_SIZE))
  const paginaActual = Math.min(pagina, paginas)
  const filas = visibles.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE)
  const cambiar = (setter) => (valor) => { setter(valor); setPagina(1) }
  const hayFiltros = estado !== 'TODOS' || entidad || desde || hasta || busqueda

  const limpiar = () => {
    setEstado('TODOS'); setEntidad(''); setDesde(''); setHasta(''); setBusqueda(''); setPagina(1)
  }

  const alCambiar = () => {
    setVersion((actual) => actual + 1)
    onChange?.()
  }

  return (
    <section className="rounded-md border border-neutral-200 bg-white">
      <div className="space-y-3 border-b border-neutral-100 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-neutral-950">Vencimientos de documentos</h2>
            <p className="text-xs text-neutral-500">
              {resumen?.vencidos || 0} vencidos · {resumen?.porVencer || 0} por vencer en 30 dias · {resumen?.proximos || 0} entre 31 y 60 dias
            </p>
          </div>
          {hayFiltros && (
            <button type="button" onClick={limpiar} className="h-8 rounded-md border border-neutral-200 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1 rounded-md border border-neutral-200 bg-white p-1">
          {FILTROS_ESTADO.map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              onClick={() => cambiar(setEstado)(valor)}
              className={`h-8 px-3 text-xs font-medium ${estado === valor ? 'rounded bg-neutral-950 text-white' : 'text-neutral-600'}`}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-500">Pertenece a</span>
            <select value={entidad} onChange={(event) => cambiar(setEntidad)(event.target.value)} className="input">
              <option value="">Choferes y unidades</option>
              <option value="chofer">Solo choferes</option>
              <option value="camion">Solo unidades</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-500">Vence desde</span>
            <input type="date" value={desde} onChange={(event) => cambiar(setDesde)(event.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-500">Vence hasta</span>
            <input type="date" value={hasta} onChange={(event) => cambiar(setHasta)(event.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-500">Buscar</span>
            <span className="relative block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
              <input value={busqueda} onChange={(event) => cambiar(setBusqueda)(event.target.value)} placeholder="Nombre, placa o documento" className="input pl-9" />
            </span>
          </label>
        </div>
        {rangoInvertido && <p className="text-xs text-red-600">La fecha "desde" es posterior a la fecha "hasta".</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead className="border-b border-neutral-100 text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Chofer / Unidad</th>
              <th className="px-4 py-2 font-medium">Documento</th>
              <th className="px-4 py-2 font-medium">Vence</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filas.map((documento) => (
              <tr key={documento.id} className="border-b border-neutral-100 last:border-b-0">
                <td className="max-w-[240px] px-4 py-2.5">
                  <p className="truncate font-medium text-neutral-950">{documento.titular}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {documento.entidad === 'chofer' ? 'Chofer' : 'Unidad'}{documento.titularDetalle ? ` · ${documento.titularDetalle}` : ''}
                  </p>
                </td>
                <td className="px-4 py-2.5">
                  <p className="text-neutral-900">{documento.tipoEtiqueta}</p>
                  {documento.numero && <p className="text-xs text-neutral-500">N° {documento.numero}</p>}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <p className="text-neutral-900">{formatearFechaDocumento(documento.fechaVencimiento)}</p>
                  <p className="text-xs text-neutral-500">{textoDiasRestantes(documento)}</p>
                </td>
                <td className="px-4 py-2.5"><EstadoDocumentoBadge estado={documento.estado} /></td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => setSeleccion({ entidad: documento.entidad, titular: { id: documento.choferId || documento.camionId, nombre: documento.titular } })}
                    className="h-8 whitespace-nowrap rounded-md border border-neutral-200 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    {isAdmin ? 'Renovar' : 'Ver'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!cargando && visibles.length === 0 && (
          <p className="px-4 py-8 text-center text-[13px] text-neutral-500">
            {hayFiltros ? 'Ningun documento coincide con los filtros.' : 'Aun no hay documentos registrados. Agregalos desde la ficha de cada chofer o unidad.'}
          </p>
        )}
        {cargando && <p className="px-4 py-8 text-center text-[13px] text-neutral-500">Cargando vencimientos...</p>}
      </div>

      {visibles.length > PAGE_SIZE && (
        <div className="flex flex-col gap-2 border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <span>{visibles.length} documentos · Pagina {paginaActual} de {paginas}</span>
          <div className="flex gap-2">
            <button type="button" disabled={paginaActual <= 1} onClick={() => setPagina(paginaActual - 1)} className="btn-secondary h-8 px-3">Anterior</button>
            <button type="button" disabled={paginaActual >= paginas} onClick={() => setPagina(paginaActual + 1)} className="btn-secondary h-8 px-3">Siguiente</button>
          </div>
        </div>
      )}

      {seleccion && (
        <DocumentosModal
          entidad={seleccion.entidad}
          titular={seleccion.titular}
          isAdmin={isAdmin}
          onClose={() => setSeleccion(null)}
          onChange={alCambiar}
        />
      )}
    </section>
  )
}
