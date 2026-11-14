import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { api } from '../lib/api'
import { notifyError, notifySuccess, notifyWarning } from '../lib/alerts'

const CONJUNTOS = {
  viajes: { etiqueta: 'Viajes', detalle: 'Agendados en el periodo' },
  liquidaciones: { etiqueta: 'Liquidaciones', detalle: 'Liquidadas en el periodo' },
  gastos: { etiqueta: 'Gastos', detalle: 'Registrados en el periodo' },
  combustible: { etiqueta: 'Combustible', detalle: 'Controles cerrados y recargas del periodo' },
  taller: { etiqueta: 'Taller', detalle: 'Ingresos del periodo' },
  vencimientos: { etiqueta: 'Vencimientos', detalle: 'Estado actual de todos los documentos' },
}

const DESFASE_CARACAS_MS = 4 * 60 * 60 * 1000
const hoyCaracas = () => new Date(Date.now() - DESFASE_CARACAS_MS).toISOString().slice(0, 10)
const primerDiaDelMes = () => `${hoyCaracas().slice(0, 8)}01`

// Excel no maneja zonas horarias: muestra los componentes UTC de la fecha.
// Se resta el desfase para que la hora que se lea en la hoja sea la de Venezuela.
const celda = (valor, tipo) => {
  if (valor === null || valor === undefined || valor === '') return null
  if (tipo === 'monto') return { value: Number(valor), type: Number, format: '#,##0.00' }
  if (tipo === 'numero') return { value: Number(valor), type: Number, format: Number.isInteger(Number(valor)) ? '#,##0' : '#,##0.00' }
  if (tipo === 'fechaHora') return { value: new Date(new Date(valor).getTime() - DESFASE_CARACAS_MS), type: Date, format: 'dd/mm/yyyy hh:mm' }
  if (tipo === 'fecha') return { value: new Date(`${valor}T00:00:00.000Z`), type: Date, format: 'dd/mm/yyyy' }
  return { value: String(valor), type: String }
}

const armarHoja = (hoja) => ({
  sheet: hoja.nombre,
  stickyRowsCount: 1,
  columns: hoja.columnas.map((columna) => ({ width: columna.ancho || 18 })),
  data: [
    hoja.columnas.map((columna) => ({ value: columna.titulo, type: String, fontWeight: 'bold', backgroundColor: '#E5E5E5' })),
    ...hoja.filas.map((fila) => hoja.columnas.map((columna) => celda(fila[columna.clave], columna.tipo))),
  ],
})

const descargar = (blob, nombre) => {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Un solo archivo con una hoja por conjunto de datos. El servidor decide que
// puede exportar cada rol; aqui solo se muestran las opciones permitidas.
export default function ExportarExcel({ onClose }) {
  const [permitidos, setPermitidos] = useState([])
  const [seleccion, setSeleccion] = useState([])
  const [desde, setDesde] = useState(primerDiaDelMes)
  const [hasta, setHasta] = useState(hoyCaracas)
  const [generando, setGenerando] = useState(false)

  useEffect(() => {
    let activo = true
    api.get('/exportar/conjuntos')
      .then((response) => {
        if (!activo) return
        const lista = (response.data?.data || []).filter((clave) => CONJUNTOS[clave])
        setPermitidos(lista)
        setSeleccion(lista.filter((clave) => clave !== 'vencimientos'))
      })
      .catch(() => {
        if (activo) notifyError('No se pudieron consultar los datos disponibles para exportar.')
      })
    return () => { activo = false }
  }, [])

  const alternar = (clave) => setSeleccion((actual) => (
    actual.includes(clave) ? actual.filter((item) => item !== clave) : [...actual, clave]
  ))

  const exportar = async (event) => {
    event.preventDefault()
    if (seleccion.length === 0) return notifyError('Selecciona al menos un conjunto de datos.')
    if (!desde || !hasta) return notifyError('Indica el rango de fechas.')
    if (desde > hasta) return notifyError('La fecha "desde" es posterior a la fecha "hasta".')
    setGenerando(true)
    try {
      // Se respeta el orden en que aparecen las opciones, no el orden de los clics.
      const conjuntos = permitidos.filter((clave) => seleccion.includes(clave)).join(',')
      const response = await api.get('/exportar', { params: { desde, hasta, conjuntos } })
      const hojas = response.data?.data?.hojas || []
      const { default: writeExcelFile } = await import('write-excel-file/universal')
      const blob = await writeExcelFile(hojas.map(armarHoja)).toBlob()
      descargar(blob, `San Roman ${desde} a ${hasta}.xlsx`)
      const truncadas = hojas.filter((hoja) => hoja.truncado).map((hoja) => hoja.nombre)
      if (truncadas.length > 0) {
        await notifyWarning('Archivo incompleto', `Estas hojas alcanzaron el maximo de filas: ${truncadas.join(', ')}. Exporta un periodo mas corto para obtenerlas completas.`)
      } else {
        await notifySuccess('Archivo generado')
      }
      onClose()
    } catch (err) {
      notifyError(err.response?.data?.mensaje || 'No se pudo generar el archivo.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid min-h-[100svh] place-items-center bg-neutral-950/40 p-4">
      <form onSubmit={exportar} className="max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-950">Exportar a Excel</h2>
            <p className="text-xs text-neutral-500">Un archivo con una hoja por cada conjunto de datos</p>
          </div>
          <button type="button" onClick={onClose} title="Cerrar" className="grid h-9 w-9 place-items-center rounded-md text-neutral-500 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-500">Desde</span>
              <input type="date" required value={desde} max={hasta || undefined} onChange={(event) => setDesde(event.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-500">Hasta</span>
              <input type="date" required value={hasta} min={desde || undefined} onChange={(event) => setHasta(event.target.value)} className="input" />
            </label>
          </div>

          <div className="rounded-md border border-neutral-200">
            {permitidos.map((clave) => (
              <label key={clave} className="flex cursor-pointer items-start gap-3 border-b border-neutral-100 px-3 py-2.5 last:border-b-0 hover:bg-neutral-50">
                <input type="checkbox" checked={seleccion.includes(clave)} onChange={() => alternar(clave)} className="mt-0.5 h-4 w-4 accent-neutral-950" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-neutral-900">{CONJUNTOS[clave].etiqueta}</span>
                  <span className="block text-xs text-neutral-500">{CONJUNTOS[clave].detalle}</span>
                </span>
              </label>
            ))}
            {permitidos.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-neutral-500">Cargando opciones...</p>}
          </div>
          <p className="text-xs text-neutral-500">El periodo no puede superar un ano. Las horas se muestran en hora de Venezuela.</p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-neutral-100 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-secondary justify-center">Cancelar</button>
          <button disabled={generando || permitidos.length === 0} className="btn-primary justify-center">
            <Download size={16} />
            {generando ? 'Generando...' : 'Descargar'}
          </button>
        </div>
      </form>
    </div>
  )
}
