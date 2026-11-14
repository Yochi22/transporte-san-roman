import { useEffect, useState } from 'react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import { confirmAction, notifyError } from '../lib/alerts'
import { formatearFechaDocumento, textoDiasRestantes } from '../lib/documentos'
import { EstadoDocumentoBadge } from './DocumentoEstado.jsx'

const filaVacia = { tipo: '', fechaVencimiento: '', numero: '', nota: '', noVence: false }

// Documentos de un chofer o de una unidad. Todos los roles con acceso a
// Recursos pueden consultarlos; solo ADMIN agrega, renueva o elimina.
export default function DocumentosModal({ entidad, titular, isAdmin, onClose, onChange }) {
  const [documentos, setDocumentos] = useState([])
  const [tipos, setTipos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [edicion, setEdicion] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [version, setVersion] = useState(0)
  const filtro = entidad === 'chofer' ? { choferId: titular.id } : { camionId: titular.id }
  const recargar = () => setVersion((actual) => actual + 1)

  useEffect(() => {
    let activo = true
    Promise.all([
      api.get('/documentos', { params: entidad === 'chofer' ? { choferId: titular.id } : { camionId: titular.id } }),
      api.get('/documentos/catalogo'),
    ])
      .then(([lista, catalogo]) => {
        if (!activo) return
        setDocumentos(lista.data?.data || [])
        setTipos(catalogo.data?.data?.[entidad] || [])
      })
      .catch((err) => {
        if (activo) notifyError(err.response?.data?.mensaje || 'No se pudieron cargar los documentos.')
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => { activo = false }
  }, [entidad, titular.id, version])

  const tiposDisponibles = tipos.filter((tipo) => !documentos.some((documento) => documento.tipo === tipo.valor))

  const guardar = async () => {
    if (!edicion) return
    if (!edicion.id && !edicion.tipo) return notifyError('Selecciona el tipo de documento.')
    if (!edicion.noVence && !edicion.fechaVencimiento) return notifyError('Indica la fecha de vencimiento o marca "No vence".')
    const payload = {
      fechaVencimiento: edicion.noVence ? null : edicion.fechaVencimiento,
      numero: edicion.numero,
      nota: edicion.nota,
    }
    setGuardando(true)
    try {
      if (edicion.id) await api.put(`/documentos/${edicion.id}`, payload)
      else await api.post('/documentos', { ...filtro, tipo: edicion.tipo, ...payload })
      setEdicion(null)
      recargar()
      onChange?.()
    } catch (err) {
      notifyError(err.response?.data?.mensaje || 'No se pudo guardar el documento.')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (documento) => {
    const result = await confirmAction('Eliminar documento', `Se quitara "${documento.tipoEtiqueta}" de ${titular.nombre}. Si solo se renovo, edita la fecha en lugar de eliminarlo.`, 'Eliminar')
    if (!result.isConfirmed) return
    try {
      await api.delete(`/documentos/${documento.id}`)
      recargar()
      onChange?.()
    } catch (err) {
      notifyError(err.response?.data?.mensaje || 'No se pudo eliminar el documento.')
    }
  }

  const editar = (documento) => setEdicion({
    id: documento.id,
    tipo: documento.tipo,
    tipoEtiqueta: documento.tipoEtiqueta,
    fechaVencimiento: documento.fechaVencimiento || '',
    numero: documento.numero || '',
    nota: documento.nota || '',
    noVence: !documento.fechaVencimiento,
  })

  return (
    <div className="fixed inset-0 z-50 grid min-h-[100svh] place-items-center bg-neutral-950/40 p-4">
      <div className="max-h-[92svh] w-full max-w-2xl overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-neutral-950">Documentos de {titular.nombre}</h2>
            <p className="text-xs text-neutral-500">{entidad === 'chofer' ? 'Chofer' : 'Unidad'} · {documentos.length} registrados</p>
          </div>
          <button type="button" onClick={onClose} title="Cerrar" className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-neutral-500 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>

        <div>
          {cargando && <p className="px-5 py-8 text-center text-[13px] text-neutral-500">Cargando documentos...</p>}
          {!cargando && documentos.length === 0 && !edicion && (
            <p className="px-5 py-8 text-center text-[13px] text-neutral-500">Sin documentos registrados.</p>
          )}
          {documentos.map((documento) => (
            edicion?.id === documento.id ? null : (
              <div key={documento.id} className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-950">{documento.tipoEtiqueta}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {formatearFechaDocumento(documento.fechaVencimiento)}
                    {textoDiasRestantes(documento) && ` · ${textoDiasRestantes(documento)}`}
                    {documento.numero && ` · N° ${documento.numero}`}
                  </p>
                  {documento.nota && <p className="mt-0.5 truncate text-xs text-neutral-400">{documento.nota}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <EstadoDocumentoBadge estado={documento.estado} />
                  {isAdmin && (
                    <>
                      <button type="button" onClick={() => editar(documento)} className="h-8 rounded-md border border-neutral-200 px-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
                        Renovar
                      </button>
                      <button type="button" onClick={() => eliminar(documento)} title="Eliminar documento" className="grid h-8 w-8 place-items-center rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-700">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          ))}

          {edicion && (
            <div className="grid gap-3 border-b border-neutral-100 bg-neutral-50 px-5 py-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-500">Documento</span>
                {edicion.id ? (
                  <input value={edicion.tipoEtiqueta} disabled className="input" />
                ) : (
                  <select value={edicion.tipo} onChange={(event) => setEdicion({ ...edicion, tipo: event.target.value })} className="input">
                    <option value="">Selecciona...</option>
                    {tiposDisponibles.map((tipo) => <option key={tipo.valor} value={tipo.valor}>{tipo.etiqueta}</option>)}
                  </select>
                )}
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-500">Fecha de vencimiento</span>
                <input
                  type="date"
                  value={edicion.fechaVencimiento}
                  disabled={edicion.noVence}
                  onChange={(event) => setEdicion({ ...edicion, fechaVencimiento: event.target.value })}
                  className="input"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-500">Numero (opcional)</span>
                <input value={edicion.numero} maxLength={60} onChange={(event) => setEdicion({ ...edicion, numero: event.target.value })} className="input" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-500">Nota (opcional)</span>
                <input value={edicion.nota} maxLength={300} onChange={(event) => setEdicion({ ...edicion, nota: event.target.value })} className="input" />
              </label>
              <label className="flex items-center gap-2 text-[13px] text-neutral-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={edicion.noVence}
                  onChange={(event) => setEdicion({ ...edicion, noVence: event.target.checked, fechaVencimiento: event.target.checked ? '' : edicion.fechaVencimiento })}
                  className="h-4 w-4 accent-neutral-950"
                />
                Este documento no vence
              </label>
              <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setEdicion(null)} className="btn-secondary justify-center">Cancelar</button>
                <button type="button" onClick={guardar} disabled={guardando} className="btn-primary justify-center">
                  <Check size={16} />
                  {edicion.id ? 'Guardar cambios' : 'Agregar'}
                </button>
              </div>
            </div>
          )}
        </div>

        {isAdmin && !edicion && !cargando && (
          <div className="px-5 py-4">
            {tiposDisponibles.length > 0 ? (
              <button type="button" onClick={() => setEdicion({ ...filaVacia })} className="btn-secondary">
                <Plus size={16} />
                Agregar documento
              </button>
            ) : (
              <p className="text-xs text-neutral-500">Ya estan registrados todos los tipos de documento. Usa Renovar para actualizar una fecha.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
