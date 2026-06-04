import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'
import logo from './assets/logo.png'
import {
  AlertTriangle,
  Banknote,
  Bell,
  Check,
  ChevronRight,
  ClipboardList,
  Calculator,
  Download,
  Edit3,
  FileCheck,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Plus,
  RefreshCw,
  Route,
  Search,
  Send,
  Truck,
  Trash2,
  User,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin

const api = axios.create({ baseURL: API_BASE })
const socket = io(SOCKET_URL, { autoConnect: false })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const tabs = [
  { id: 'monitor', label: 'Resumen', icon: LayoutDashboard },
  { id: 'viajes', label: 'Viajes', icon: Route },
  { id: 'despacho', label: 'Agendamiento', icon: Send },
  { id: 'recursos', label: 'Recursos', icon: Users },
  { id: 'liquidaciones', label: 'Liquidaciones', icon: Calculator },
]

const paradaStyles = {
  PENDIENTE: 'border-neutral-200 bg-white text-neutral-500',
  EN_CURSO: 'border-blue-300 bg-blue-50 text-blue-700',
  COMPLETADA: 'border-emerald-300 bg-emerald-50 text-emerald-700',
}

const reporteStyles = {
  CARGANDO: 'bg-blue-50 text-blue-700',
  EN_RUTA: 'bg-neutral-100 text-neutral-700',
  DESCARGADO: 'bg-emerald-50 text-emerald-700',
  ESPERANDO_INSTRUCCIONES: 'bg-amber-50 text-amber-700',
  EN_PERNOCTA: 'bg-indigo-50 text-indigo-700',
  LIBRE: 'bg-emerald-50 text-emerald-700',
  OTRO: 'bg-neutral-100 text-neutral-600',
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(localStorage.getItem('token')))
  const [activeTab, setActiveTab] = useState('monitor')
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedViaje, setSelectedViaje] = useState(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [alertas, setAlertas] = useState([])

  const [viajes, setViajes] = useState([])
  const [choferes, setChoferes] = useState([])
  const [camiones, setCamiones] = useState([])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setIsAuthenticated(false)
    setSelectedViaje(null)
  }, [])

  const fetchData = useCallback(async ({ refreshSelected = false } = {}) => {
    if (!localStorage.getItem('token')) return
    setLoading(true)
    setError('')

    try {
      const [viajesRes, choferesRes, camionesRes] = await Promise.all([
        api.get('/viajes'),
        api.get('/choferes'),
        api.get('/camiones'),
      ])

      const nextViajes = viajesRes.data?.data || []
      setViajes(nextViajes)
      setChoferes(choferesRes.data?.data || [])
      setCamiones(camionesRes.data?.data || [])

      if (refreshSelected) {
        setSelectedViaje((current) => {
          if (!current) return current
          return nextViajes.find((viaje) => viaje.id === current.id) || current
        })
      }
    } catch (err) {
      if (err.response?.status === 401) {
        logout()
      } else {
        setError('No se pudo cargar la operacion.')
      }
    } finally {
      setLoading(false)
    }
  }, [logout])

  useEffect(() => {
    if (!isAuthenticated) return

    const initialRefresh = setTimeout(() => fetchData(), 0)
    socket.connect()

    const refresh = () => fetchData({ refreshSelected: true })
    const handleReporte = (payload) => {
      playAlertSound()
      setAlertas((prev) => [{
        ...payload,
        id: crypto.randomUUID(),
        at: new Date(),
        mensaje: payload?.mensaje || `Nuevo reporte de ${payload?.chofer?.nombre || 'chofer'}`,
      }, ...prev].slice(0, 8))
      refresh()
    }
    const pushAlerta = (alerta) => {
      setAlertas((prev) => [{ ...alerta, id: crypto.randomUUID(), at: new Date() }, ...prev].slice(0, 5))
      refresh()
    }

    socket.on('reporte:nuevo', handleReporte)
    socket.on('gasto:nuevo', refresh)
    socket.on('viaje_actualizado', refresh)
    socket.on('operaciones:alerta', pushAlerta)

    const interval = setInterval(refresh, 30000)
    return () => {
      clearInterval(interval)
      clearTimeout(initialRefresh)
      socket.off('reporte:nuevo', handleReporte)
      socket.off('gasto:nuevo', refresh)
      socket.off('viaje_actualizado', refresh)
      socket.off('operaciones:alerta', pushAlerta)
      socket.disconnect()
    }
  }, [fetchData, isAuthenticated])

  const data = useMemo(() => buildOperationalData({ viajes, choferes, camiones, query }), [viajes, choferes, camiones, query])

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />
  }

  return (
    <div className="min-h-screen bg-stone-50 text-neutral-950">
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-neutral-200 bg-white transition-transform lg:static lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex h-full flex-col px-5 py-5">
            <div className="flex items-center gap-3 px-2 py-2">
              <img src={logo} alt="Transporte San Roman" className="h-12 w-20 rounded-md object-cover object-center" />
              <div>
                <p className="text-sm font-semibold tracking-wide">San Roman</p>
                <p className="text-xs text-neutral-500">Control operativo</p>
              </div>
            </div>

            <nav className="mt-8 space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const active = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id)
                      setMenuOpen(false)
                    }}
                    className={`flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition ${active ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950'}`}
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
                )
              })}
            </nav>

            <div className="mt-auto space-y-3">
              <button onClick={() => fetchData({ refreshSelected: true })} className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                <RefreshCw size={16} />
                Actualizar
              </button>
              <button onClick={logout} className="flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50">
                <LogOut size={16} />
                Salir
              </button>
            </div>
          </div>
        </aside>

        {menuOpen && <button className="fixed inset-0 z-30 bg-neutral-950/20 lg:hidden" onClick={() => setMenuOpen(false)} />}

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-neutral-200 bg-stone-50/95 backdrop-blur">
            <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
              <button onClick={() => setMenuOpen(true)} className="grid h-10 w-10 place-items-center rounded-md border border-neutral-200 bg-white lg:hidden">
                <Menu size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-lg font-semibold">{pageTitle(activeTab)}</h1>
                <p className="hidden text-sm text-neutral-500 sm:block">{data.activos.length} viajes en curso · {data.pendientesLiquidacion.length} por liquidar</p>
              </div>
              <div className="relative hidden w-full max-w-sm md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar viaje, chofer o placa"
                  className="h-10 w-full rounded-md border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-neutral-400"
                />
              </div>
            </div>
          </header>

          <div className="px-4 py-5 sm:px-6 lg:px-8">
            <div className="relative mb-4 md:hidden">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar en el modulo"
                className="h-10 w-full rounded-md border border-neutral-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-neutral-400"
              />
            </div>
            {error && <Banner tone="danger" icon={AlertTriangle} text={error} />}
            {loading && <Banner tone="neutral" icon={RefreshCw} text="Actualizando datos..." />}

            {activeTab === 'monitor' && (
              <Monitor data={data} alertas={alertas} onSelect={setSelectedViaje} />
            )}
            {activeTab === 'viajes' && (
              <ViajesView data={data} onSelect={setSelectedViaje} />
            )}
            {activeTab === 'despacho' && (
              <DespachoView choferes={data.choferesOperativos} camiones={data.camionesOperativos.filter((camion) => camion.estado !== 'EN_TALLER')} viajesActivos={data.activos} onDone={() => fetchData()} />
            )}
            {activeTab === 'recursos' && (
              <RecursosView data={data} onDone={() => fetchData()} />
            )}
            {activeTab === 'liquidaciones' && (
              <LiquidacionesView viajes={data.liquidados} choferes={choferes} onDone={() => fetchData()} />
            )}
          </div>
        </main>
      </div>

      {selectedViaje && (
        <ViajeDrawer
          viaje={selectedViaje}
          onClose={() => setSelectedViaje(null)}
          onDone={() => fetchData({ refreshSelected: true })}
        />
      )}
    </div>
  )
}

function Monitor({ data, alertas, onSelect }) {
  const [tripPage, setTripPage] = useState(1)
  const [reportPage, setReportPage] = useState(1)
  const tripPageSize = 6
  const reportPageSize = 6
  const activeTrips = paginate(data.activos, tripPage, tripPageSize)
  const latestReports = paginate(data.reportes, reportPage, reportPageSize)

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="En curso" value={data.activos.length} icon={Route} />
        <Metric title="Esperando" value={data.esperando.length} icon={Bell} tone="amber" />
        <Metric title="Por liquidar" value={data.pendientesLiquidacion.length} icon={Wallet} tone="blue" />
        <Metric title="Fuera de servicio" value={data.camionesTaller.length} icon={Wrench} tone="amber" />
      </section>

      {data.camionesTaller.length > 0 && (
        <Banner
          tone="danger"
          icon={Wrench}
          text={`${data.camionesTaller.length} unidades fuera de servicio: ${data.camionesTaller.map((camion) => camion.placa).join(', ')}`}
        />
      )}

      {alertas.length > 0 && (
        <section className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Bell size={16} />
            Alertas recientes
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {alertas.map((alerta) => (
              <div key={alerta.id} className="rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-amber-900">
                {alerta.mensaje || alerta.tipo || 'Alerta operativa'}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <div className="space-y-3">
          <SectionTitle title="Viajes activos" subtitle="Seguimiento logistico por paradas" />
          <div className="grid gap-3 lg:grid-cols-2">
            {activeTrips.map((viaje) => (
              <TripCard key={viaje.id} viaje={viaje} onSelect={onSelect} />
            ))}
            {data.activos.length === 0 && <Empty text="No hay viajes en curso." />}
          </div>
          <Pagination page={tripPage} total={data.activos.length} pageSize={tripPageSize} onChange={setTripPage} />
        </div>

        <div className="space-y-3">
          <SectionTitle title="Ultimos reportes" subtitle="Mensajes recibidos de choferes" />
          <div className="rounded-md border border-neutral-200 bg-white">
            {latestReports.map((reporte) => (
              <ReportRow key={reporte.id} reporte={reporte} compact />
            ))}
            {latestReports.length === 0 && <Empty text="Sin reportes recientes." />}
          </div>
          <Pagination page={reportPage} total={data.reportes.length} pageSize={reportPageSize} onChange={setReportPage} />
        </div>
      </section>
    </div>
  )
}

function ViajesView({ data, onSelect }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-2">
        <TripList title="En curso" viajes={data.activos} onSelect={onSelect} />
        <TripList title="Pendientes de liquidacion" viajes={data.pendientesLiquidacion} onSelect={onSelect} />
      </div>
      <TripList title="Archivo logistico" viajes={data.completados} onSelect={onSelect} />
    </div>
  )
}

function TripList({ title, viajes, onSelect }) {
  const [page, setPage] = useState(1)
  const pageSize = 8
  const pageItems = paginate(viajes, page, pageSize)

  return (
    <section className="space-y-3">
      <SectionTitle title={title} subtitle={`${viajes.length} registros`} />
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
        {pageItems.map((viaje) => (
          <button key={viaje.id} onClick={() => onSelect(viaje)} className="flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left last:border-b-0 hover:bg-neutral-50">
            <StatusDot estado={viaje.estadoLogistico} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{viaje.codigo}</p>
              <p className="truncate text-xs text-neutral-500">{viaje.chofer?.nombre || 'Sin chofer'} · {formatRoute(viaje)}</p>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{money(balance(viaje))}</p>
              <p className="text-xs text-neutral-500">{viaje.estadoFinanciero}</p>
            </div>
            <ChevronRight className="text-neutral-400" size={18} />
          </button>
        ))}
        {viajes.length === 0 && <Empty text="Sin registros." />}
      </div>
      <Pagination page={page} total={viajes.length} pageSize={pageSize} onChange={setPage} />
    </section>
  )
}

function TripCard({ viaje, onSelect }) {
  const progreso = getProgress(viaje)
  const ultimoReporte = viaje.reportes?.[0]

  return (
    <button onClick={() => onSelect(viaje)} className="rounded-md border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-300 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-neutral-500">{viaje.camion?.placa || 'Sin placa'}</p>
          <h3 className="mt-1 truncate text-lg font-semibold">{viaje.codigo}</h3>
          <p className="mt-1 truncate text-sm text-neutral-600">{viaje.chofer?.nombre || 'Sin chofer'}</p>
        </div>
        <span className="rounded-md bg-neutral-950 px-2 py-1 text-xs font-medium text-white">{viaje.estadoLogistico}</span>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex justify-between text-xs text-neutral-500">
          <span>{formatRoute(viaje)}</span>
          <span>{progreso.completadas}/{progreso.total}</span>
        </div>
        <div className="h-2 rounded-full bg-neutral-100">
          <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${progreso.percent}%` }} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
        <MapPin size={14} />
        {viaje.chofer?.ubicacionActual || 'Sin ubicacion reportada'}
      </div>

      <div className="mt-4 grid gap-2">
        {viaje.paradas?.slice(0, 3).map((parada) => (
          <ParadaPill key={parada.id} parada={parada} />
        ))}
      </div>

      {ultimoReporte && (
        <div className="mt-4 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
          {ultimoReporte.tipoReporte}: {ultimoReporte.ubicacion || ultimoReporte.mensajeOriginal}
        </div>
      )}
    </button>
  )
}

function DespachoView({ choferes, camiones, viajesActivos, onDone }) {
  const [form, setForm] = useState({ choferId: '', camionId: '', viaticosDepositados: '' })
  const [paradas, setParadas] = useState([
    { id: crypto.randomUUID(), tipo: 'CARGA', lugar: '', ciudad: '' },
    { id: crypto.randomUUID(), tipo: 'DESCARGA', lugar: '', ciudad: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const viajeExistente = viajesActivos.find(
    (viaje) => viaje.choferId === form.choferId && viaje.camionId === form.camionId
  )

  const updateParada = (id, patch) => {
    setParadas((prev) => prev.map((parada) => (parada.id === id ? { ...parada, ...patch } : parada)))
  }

  const addParada = () => {
    setParadas((prev) => [...prev, { id: crypto.randomUUID(), tipo: 'DESCARGA', lugar: '', ciudad: '' }])
  }

  const removeParada = (id) => {
    setParadas((prev) => (prev.length > 2 ? prev.filter((parada) => parada.id !== id) : prev))
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      await api.post('/viajes', {
        camionId: form.camionId,
        choferId: form.choferId,
        viaticosDepositados: Number(form.viaticosDepositados) || 0,
        paradas: paradas.map(({ tipo, lugar, ciudad }) => ({ tipo, lugar, ciudad })),
      })
      setForm({ choferId: '', camionId: '', viaticosDepositados: '' })
      setParadas([
        { id: crypto.randomUUID(), tipo: 'CARGA', lugar: '', ciudad: '' },
        { id: crypto.randomUUID(), tipo: 'DESCARGA', lugar: '', ciudad: '' },
      ])
      onDone()
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo crear el viaje.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl space-y-5">
      {error && <Banner tone="danger" icon={AlertTriangle} text={error} />}
      {viajeExistente && (
        <Banner
          tone="neutral"
          icon={Route}
          text={`Esta ruta se agregara como un nuevo tramo de ${viajeExistente.codigo}.`}
        />
      )}

      <section className="rounded-md border border-neutral-200 bg-white p-4 sm:p-5">
        <SectionTitle title="Nuevo despacho" subtitle="Chofer, unidad, viaticos y ruta" />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Chofer">
            <select required value={form.choferId} onChange={(event) => setForm({ ...form, choferId: event.target.value })} className="input">
              <option value="">Seleccionar</option>
              {choferes.map((chofer) => <option key={chofer.id} value={chofer.id}>{chofer.nombre} · {chofer.estadoCalculado}</option>)}
            </select>
          </Field>
          <Field label="Camion">
            <select required value={form.camionId} onChange={(event) => setForm({ ...form, camionId: event.target.value })} className="input">
              <option value="">Seleccionar</option>
              {camiones.map((camion) => <option key={camion.id} value={camion.id}>{vehicleLabel(camion)} · {camion.estadoCalculado}</option>)}
            </select>
          </Field>
          <Field label="Viaticos">
            <input required type="number" min="0" step="0.01" value={form.viaticosDepositados} onChange={(event) => setForm({ ...form, viaticosDepositados: event.target.value })} className="input" placeholder="0.00" />
          </Field>
        </div>
      </section>

      <section className="rounded-md border border-neutral-200 bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle title="Paradas" subtitle="Orden logistico del viaje" />
          <button type="button" onClick={addParada} className="btn-secondary">
            <Plus size={16} />
            Agregar
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {paradas.map((parada, index) => (
            <div key={parada.id} className="grid gap-3 rounded-md border border-neutral-200 p-3 md:grid-cols-[64px_160px_1fr_1fr_40px]">
              <div className="flex h-10 items-center text-sm font-semibold text-neutral-500">#{index + 1}</div>
              <select value={parada.tipo} onChange={(event) => updateParada(parada.id, { tipo: event.target.value })} className="input">
                <option value="CARGA">Carga</option>
                <option value="DESCARGA">Descarga</option>
                <option value="PERNOCTA">Pernocta</option>
              </select>
              <input required value={parada.lugar} onChange={(event) => updateParada(parada.id, { lugar: event.target.value })} className="input" placeholder="Lugar" />
              <input required value={parada.ciudad} onChange={(event) => updateParada(parada.id, { ciudad: event.target.value })} className="input" placeholder="Ciudad" />
              <button type="button" onClick={() => removeParada(parada.id)} className="grid h-10 w-10 place-items-center rounded-md text-neutral-400 hover:bg-red-50 hover:text-red-600">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button disabled={saving} className="btn-primary">
            <Send size={16} />
            {saving ? 'Guardando' : viajeExistente ? 'Agregar tramo' : 'Despachar'}
          </button>
        </div>
      </section>
    </form>
  )
}

function RecursosView({ data, onDone }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ResourcePanel title="Choferes" items={data.choferesOperativos} type="chofer" onDone={onDone} />
      <ResourcePanel title="Camiones" items={data.camionesOperativos} type="camion" onDone={onDone} />
    </div>
  )
}

function ResourcePanel({ title, items, type, onDone }) {
  const [open, setOpen] = useState(false)
  const emptyForm = () => type === 'chofer'
    ? { nombre: '', cedula: '', telefono: '' }
    : { tipoVehiculo: 'NPR', placa: '', placaFurgon: '', placaChuto: '', marcaModelo: '' }
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [page, setPage] = useState(1)
  const pageSize = 8
  const pageItems = paginate(items, page, pageSize)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    try {
      const endpoint = type === 'chofer' ? '/choferes' : '/camiones'
      if (editingId) {
        await api.put(`${endpoint}/${editingId}`, form)
      } else {
        await api.post(endpoint, form)
      }
      setForm(emptyForm())
      setEditingId(null)
      setOpen(false)
      onDone()
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo guardar.')
    }
  }

  const editar = (item) => {
    setEditingId(item.id)
    setForm(
      type === 'chofer'
        ? { nombre: item.nombre, cedula: item.cedula, telefono: item.telefono }
        : {
            tipoVehiculo: item.tipoVehiculo || 'NPR',
            placa: item.placa,
            placaFurgon: item.placaFurgon || '',
            placaChuto: item.placaChuto || '',
            marcaModelo: item.marcaModelo,
          }
    )
    setOpen(true)
  }

  const eliminar = async (item) => {
    if (!window.confirm(`Eliminar ${type === 'chofer' ? item.nombre : item.placa}?`)) return
    try {
      await api.delete(`/${type === 'chofer' ? 'choferes' : 'camiones'}/${item.id}`)
      onDone()
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo eliminar.')
    }
  }

  const cambiarTaller = async (item) => {
    if (item.estado === 'EN_TALLER') {
      await api.patch(`/camiones/${item.id}/salir-taller`)
    } else {
      const motivo = window.prompt('Motivo de fuera de servicio')
      if (!motivo) return
      await api.patch(`/camiones/${item.id}/taller`, { motivo })
    }
    onDone()
  }

  return (
    <section className="rounded-md border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <SectionTitle title={title} subtitle={`${items.length} registros`} />
        <button onClick={() => { setEditingId(null); setForm(emptyForm()); setOpen((value) => !value) }} className="btn-secondary">
          <Plus size={16} />
          Nuevo
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="grid gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-4 md:grid-cols-3">
          {type === 'chofer' ? (
            <>
              <input required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} className="input" placeholder="Nombre" />
              <input required value={form.cedula} onChange={(event) => setForm({ ...form, cedula: event.target.value })} className="input" placeholder="Cedula" />
              <input required value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} className="input" placeholder="Telefono" />
            </>
          ) : (
            <>
              <select value={form.tipoVehiculo} onChange={(event) => setForm({ ...form, tipoVehiculo: event.target.value })} className="input">
                <option value="NPR">NPR</option>
                <option value="TORONTO">Toronto</option>
                <option value="FURGON">Furgon</option>
              </select>
              {form.tipoVehiculo === 'FURGON' ? (
                <>
                  <input required value={form.placaFurgon} onChange={(event) => setForm({ ...form, placaFurgon: event.target.value })} className="input" placeholder="Placa del furgon" />
                  <input required value={form.placaChuto} onChange={(event) => setForm({ ...form, placaChuto: event.target.value })} className="input" placeholder="Placa del chuto" />
                </>
              ) : (
                <input required value={form.placa} onChange={(event) => setForm({ ...form, placa: event.target.value })} className="input md:col-span-2" placeholder="Placa" />
              )}
              <input value={form.marcaModelo} onChange={(event) => setForm({ ...form, marcaModelo: event.target.value })} className="input md:col-span-3" placeholder="Marca / modelo (opcional)" />
            </>
          )}
          <button className="btn-primary md:col-span-3">
            <Check size={16} />
            {editingId ? 'Actualizar' : 'Guardar'}
          </button>
          {error && <p className="text-sm text-red-600 md:col-span-3">{error}</p>}
        </form>
      )}

      <div>
        {pageItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{type === 'chofer' ? item.nombre : item.placa}</p>
              <p className="truncate text-xs text-neutral-500">
                {type === 'chofer'
                  ? item.telefono
                  : item.tipoVehiculo === 'FURGON'
                    ? `Furgon ${item.placaFurgon} · Chuto ${item.placaChuto}`
                    : `${item.tipoVehiculo || 'NPR'} · ${item.marcaModelo}`}
              </p>
              <p className="mt-1 flex items-center gap-1 truncate text-xs text-neutral-400">
                <MapPin size={12} />
                {item.ubicacionActual || 'Sin ubicacion reportada'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className={`rounded-md px-2 py-1 text-xs font-medium ${item.estadoCalculado === 'DISPONIBLE' ? 'bg-emerald-50 text-emerald-700' : item.estadoCalculado === 'EN_TALLER' ? 'bg-red-50 text-red-700' : 'bg-neutral-100 text-neutral-700'}`}>
                {item.estadoCalculado}
              </span>
              {type === 'camion' && (
                <button onClick={() => cambiarTaller(item)} title={item.estado === 'EN_TALLER' ? 'Volver a servicio' : 'Fuera de servicio'} className="grid h-8 w-8 place-items-center rounded-md text-neutral-500 hover:bg-amber-50 hover:text-amber-700">
                  <Wrench size={14} />
                </button>
              )}
              <button onClick={() => editar(item)} title="Editar" className="grid h-8 w-8 place-items-center rounded-md text-neutral-500 hover:bg-neutral-100">
                <Edit3 size={14} />
              </button>
              <button onClick={() => eliminar(item)} title="Eliminar" className="grid h-8 w-8 place-items-center rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-700">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-3">
        <Pagination page={page} total={items.length} pageSize={pageSize} onChange={setPage} />
      </div>
    </section>
  )
}

function LiquidacionesView({ viajes, choferes, onDone }) {
  const [periodo, setPeriodo] = useState('mes')
  const [choferId, setChoferId] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const desde = periodStart(periodo)
  const filtrados = viajes.filter((viaje) => {
    const fecha = new Date(viaje.fechaLiquidacion || viaje.fechaCierre || viaje.updatedAt)
    return fecha >= desde && (!choferId || viaje.choferId === choferId)
  })
  const pageItems = paginate(filtrados, page, pageSize)
  const totalHonorarios = filtrados.reduce((total, viaje) => total + Number(viaje.honorariosChofer || 0), 0)
  const totalGastos = filtrados.reduce((total, viaje) => total + Number(viaje.viaticosGastados || 0), 0)
  const totalDepositado = filtrados.reduce((total, viaje) => total + Number(viaje.viaticosDepositados || 0), 0)

  const editarHonorarios = async (viaje) => {
    const monto = window.prompt(`Honorarios para ${viaje.chofer?.nombre}`, Number(viaje.honorariosChofer || 0))
    if (monto === null) return
    await api.patch(`/viajes/${viaje.id}/honorarios`, { honorariosChofer: Number(monto) })
    onDone()
  }

  const descargarPdf = async () => {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ])
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const logoData = await imageToDataUrl(logo)
    doc.addImage(logoData, 'PNG', 14, 10, 38, 22)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('Resumen de liquidaciones', 58, 18)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(90)
    doc.text(`Periodo: ${periodLabel(periodo)} | Chofer: ${choferes.find((chofer) => chofer.id === choferId)?.nombre || 'Todos'}`, 58, 24)
    doc.text(`Generado: ${new Date().toLocaleString('es-VE')}`, 58, 29)

    autoTable(doc, {
      startY: 38,
      theme: 'grid',
      head: [['Viaje', 'Guia', 'Chofer', 'Unidad', 'Ruta', 'Liquidado', 'Viaticos', 'Gastos', 'Honorarios']],
      body: filtrados.map((viaje) => [
        viaje.codigo,
        viaje.numeroGuia || 'Sin guia',
        viaje.chofer?.nombre || '',
        vehicleLabel(viaje.camion || {}),
        formatRoute(viaje),
        formatDate(viaje.fechaLiquidacion || viaje.fechaCierre),
        money(viaje.viaticosDepositados),
        money(viaje.viaticosGastados),
        money(viaje.honorariosChofer),
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [24, 24, 27], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    })

    const expenses = filtrados.flatMap((viaje) =>
      (viaje.gastos || []).map((gasto) => [
        viaje.codigo,
        gasto.tipo,
        gasto.origen || 'ADMIN',
        gasto.descripcion || '',
        money(gasto.monto),
      ])
    )

    if (expenses.length > 0) {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        theme: 'striped',
        head: [['Viaje', 'Tipo de gasto', 'Origen', 'Descripcion', 'Monto']],
        body: expenses,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [55, 65, 81], textColor: 255 },
      })
    }

    const y = Math.min((doc.lastAutoTable?.finalY || 40) + 10, 185)
    doc.setFillColor(245, 245, 244)
    doc.roundedRect(14, y, 269, 18, 2, 2, 'F')
    doc.setTextColor(24)
    doc.setFont('helvetica', 'bold')
    doc.text(`Viajes: ${filtrados.length}`, 20, y + 7)
    doc.text(`Viaticos: ${money(totalDepositado)}`, 65, y + 7)
    doc.text(`Gastos: ${money(totalGastos)}`, 130, y + 7)
    doc.text(`Honorarios: ${money(totalHonorarios)}`, 190, y + 7)
    doc.text(`Total egresos: ${money(totalGastos + totalHonorarios)}`, 20, y + 14)
    doc.save(`liquidaciones-${periodo}-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3">
        <Metric title="Viajes liquidados" value={filtrados.length} icon={FileCheck} />
        <Metric title="Honorarios choferes" value={money(totalHonorarios)} icon={User} tone="blue" />
        <Metric title="Gastos liquidados" value={money(totalGastos)} icon={Wallet} tone="emerald" />
      </section>

      <section className="rounded-md border border-neutral-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-neutral-100 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <SectionTitle title="Liquidaciones" subtitle="Honorarios por viaje y chofer" />
          <div className="flex flex-wrap gap-2">
            <button onClick={descargarPdf} disabled={filtrados.length === 0} className="btn-primary">
              <Download size={16} />
              Descargar PDF
            </button>
            <select value={periodo} onChange={(event) => { setPeriodo(event.target.value); setPage(1) }} className="input w-auto">
              <option value="dia">Diario</option>
              <option value="semana">Semanal</option>
              <option value="mes">Mensual</option>
              <option value="todo">Todo</option>
            </select>
            <select value={choferId} onChange={(event) => { setChoferId(event.target.value); setPage(1) }} className="input w-auto">
              <option value="">Todos los choferes</option>
              {choferes.map((chofer) => <option key={chofer.id} value={chofer.id}>{chofer.nombre}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-3">Viaje</th>
                <th className="px-4 py-3">Chofer</th>
                <th className="px-4 py-3">Guia</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Gastos</th>
                <th className="px-4 py-3">Honorarios</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((viaje) => (
                <tr key={viaje.id} className="border-t border-neutral-100">
                  <td className="px-4 py-3 font-semibold">{viaje.codigo}</td>
                  <td className="px-4 py-3">{viaje.chofer?.nombre}</td>
                  <td className="px-4 py-3">{viaje.numeroGuia || 'Sin guia'}</td>
                  <td className="px-4 py-3 text-neutral-500">{formatDate(viaje.fechaLiquidacion || viaje.fechaCierre)}</td>
                  <td className="px-4 py-3">{money(viaje.viaticosGastados)}</td>
                  <td className="px-4 py-3 font-semibold">{money(viaje.honorariosChofer)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => editarHonorarios(viaje)} className="btn-secondary">
                      <Edit3 size={14} />
                      Honorarios
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtrados.length === 0 && <Empty text="Sin liquidaciones para este periodo." />}
        </div>
        <div className="px-4 py-3">
          <Pagination page={page} total={filtrados.length} pageSize={pageSize} onChange={setPage} />
        </div>
      </section>
    </div>
  )
}

function ViajeDrawer({ viaje, onClose, onDone }) {
  const [saving, setSaving] = useState('')
  const [gastoForm, setGastoForm] = useState({ tipo: 'PEAJE', monto: '', descripcion: '' })
  const [showGastoForm, setShowGastoForm] = useState(false)
  const [reportPage, setReportPage] = useState(1)
  const [expensePage, setExpensePage] = useState(1)
  const [showLiquidarModal, setShowLiquidarModal] = useState(false)
  const [numeroGuia, setNumeroGuia] = useState(viaje.numeroGuia || '')
  const detailPageSize = 8
  const tramos = groupByTramo(viaje.paradas || [])
  const totalGastado = (viaje.gastos || []).reduce((total, gasto) => total + Number(gasto.monto), 0)
  const ultimaUbicacion = viaje.chofer?.ubicacionActual || viaje.reportes?.find((reporte) => reporte.ubicacion)?.ubicacion || 'Sin ubicacion'

  const recargar = async () => {
    const monto = window.prompt('Monto de viaticos')
    if (!monto) return
    setSaving('recarga')
    try {
      await api.patch(`/viajes/${viaje.id}/recarga`, { monto: Number(monto) })
      onDone()
    } finally {
      setSaving('')
    }
  }

  const ejecutarCierre = async (soloLogistica, guia = viaje.numeroGuia) => {
    setSaving(soloLogistica ? 'cerrar' : 'liquidar')
    try {
      await api.post(`/viajes/${viaje.id}/cerrar`, { soloLogistica, numeroGuia: guia?.trim() || null })
      setShowLiquidarModal(false)
      onDone()
      onClose()
    } finally {
      setSaving('')
    }
  }

  const cerrar = async (soloLogistica) => {
    if (!soloLogistica) {
      setShowLiquidarModal(true)
      return
    }
    await ejecutarCierre(true)
  }

  const cambiarEstadoParada = async (paradaId, estado) => {
    setSaving(paradaId)
    try {
      await api.patch(`/viajes/${viaje.id}/paradas/${paradaId}`, { estado })
      onDone()
    } finally {
      setSaving('')
    }
  }

  const registrarGasto = async (event) => {
    event.preventDefault()
    setSaving('gasto')
    try {
      await api.post('/gastos', {
        viajeId: viaje.id,
        tipo: gastoForm.tipo,
        monto: Number(gastoForm.monto),
        descripcion: gastoForm.descripcion,
      })
      setGastoForm({ tipo: 'PEAJE', monto: '', descripcion: '' })
      setShowGastoForm(false)
      onDone()
    } finally {
      setSaving('')
    }
  }

  const eliminarGasto = async (gastoId) => {
    setSaving(gastoId)
    try {
      await api.delete(`/gastos/${gastoId}`)
      onDone()
    } finally {
      setSaving('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button className="absolute inset-0 bg-neutral-950/30" onClick={onClose} />
      <aside className="relative h-full w-full max-w-3xl overflow-y-auto bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium text-neutral-500">{viaje.estadoLogistico} · {viaje.estadoFinanciero}</p>
            <h2 className="truncate text-xl font-semibold">{viaje.codigo}</h2>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-md hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 px-4 py-5 sm:px-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Fact icon={User} label="Chofer" value={viaje.chofer?.nombre || 'Sin chofer'} />
            <Fact icon={Truck} label="Camion" value={viaje.camion?.placa || 'Sin camion'} />
            <Fact icon={MapPin} label="Ultima ubicacion" value={ultimaUbicacion} />
            <Fact icon={Banknote} label="Disponible" value={money(balance(viaje))} />
          </section>
          {viaje.numeroGuia && <Banner tone="neutral" icon={FileCheck} text={`Guia entregada: ${viaje.numeroGuia}`} />}

          <section className="space-y-3">
            <SectionTitle title="Ruta" subtitle={formatRoute(viaje)} />
            <div className="space-y-3">
              {tramos.map(([tramo, paradas]) => (
                <div key={tramo} className="overflow-hidden rounded-md border border-neutral-200">
                  <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-600">
                    Tramo {tramo}: {formatParadasRoute(paradas)}
                  </div>
                  {paradas.map((parada) => (
                    <div key={parada.id} className="grid gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0 lg:grid-cols-[48px_110px_1fr_auto]">
                      <span className="text-sm font-semibold text-neutral-500">#{parada.orden}</span>
                      <span className="text-sm font-medium">{parada.tipo}</span>
                      <div>
                        <p className="text-sm font-semibold">{parada.lugar}</p>
                        <p className="text-xs text-neutral-500">{parada.ciudad}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {['PENDIENTE', 'EN_CURSO', 'COMPLETADA'].map((estado) => (
                          <button
                            key={estado}
                            onClick={() => cambiarEstadoParada(parada.id, estado)}
                            disabled={Boolean(saving) || parada.estado === estado}
                            className={`rounded-md border px-2 py-1 text-xs font-medium ${parada.estado === estado ? paradaStyles[estado] : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50'}`}
                          >
                            {estado}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <Fact icon={Wallet} label="Viaticos depositados" value={money(viaje.viaticosDepositados)} />
            <Fact icon={Banknote} label="Gastos acumulados" value={money(totalGastado)} />
            <Fact icon={Check} label="Disponible" value={money(balance(viaje))} />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="space-y-3">
              <SectionTitle title="Reportes" subtitle={`${viaje.reportes?.length || 0} mensajes`} />
              <div className="rounded-md border border-neutral-200">
                {paginate(viaje.reportes || [], reportPage, detailPageSize).map((reporte) => <ReportRow key={reporte.id} reporte={reporte} />)}
                {(viaje.reportes?.length || 0) === 0 && <Empty text="Sin reportes." />}
              </div>
              <Pagination page={reportPage} total={viaje.reportes?.length || 0} pageSize={detailPageSize} onChange={setReportPage} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <SectionTitle title="Gastos" subtitle={`${viaje.gastos?.length || 0} registros · ${money(totalGastado)}`} />
                <button onClick={() => setShowGastoForm((value) => !value)} className="btn-secondary">
                  <Plus size={16} />
                  Registrar
                </button>
              </div>
              {showGastoForm && (
                <form onSubmit={registrarGasto} className="grid gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                  <select value={gastoForm.tipo} onChange={(event) => setGastoForm({ ...gastoForm, tipo: event.target.value })} className="input">
                    <option value="COMBUSTIBLE">Combustible</option>
                    <option value="PEAJE">Peaje</option>
                    <option value="COMIDA">Comida</option>
                    <option value="HOSPEDAJE">Hospedaje</option>
                    <option value="REPARACION">Reparacion</option>
                    <option value="OTRO">Otro</option>
                  </select>
                  <input required type="number" min="0.01" step="0.01" value={gastoForm.monto} onChange={(event) => setGastoForm({ ...gastoForm, monto: event.target.value })} className="input" placeholder="Monto" />
                  <input value={gastoForm.descripcion} onChange={(event) => setGastoForm({ ...gastoForm, descripcion: event.target.value })} className="input" placeholder="Descripcion" />
                  <button disabled={Boolean(saving)} className="btn-primary">
                    <Check size={16} />
                    Guardar gasto
                  </button>
                </form>
              )}
              <div className="rounded-md border border-neutral-200">
                {paginate(viaje.gastos || [], expensePage, detailPageSize).map((gasto) => (
                  <div key={gasto.id} className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{gasto.tipo} · {gasto.origen || 'ADMIN'}</p>
                      <p className="truncate text-xs text-neutral-500">{gasto.descripcion || 'Gasto'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-red-600">-{money(gasto.monto)}</span>
                      <button onClick={() => eliminarGasto(gasto.id)} disabled={Boolean(saving)} className="grid h-8 w-8 place-items-center rounded-md text-neutral-400 hover:bg-red-50 hover:text-red-600">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {(viaje.gastos?.length || 0) === 0 && <Empty text="Sin gastos." />}
              </div>
              <Pagination page={expensePage} total={viaje.gastos?.length || 0} pageSize={detailPageSize} onChange={setExpensePage} />
            </div>
          </section>

          <section className="flex flex-col gap-2 border-t border-neutral-200 pt-5 sm:flex-row sm:justify-end">
            <button onClick={recargar} disabled={Boolean(saving)} className="btn-secondary">
              <Wallet size={16} />
              Recargar viaticos
            </button>
            {viaje.estadoLogistico !== 'COMPLETADO' && (
              <button onClick={() => cerrar(true)} disabled={Boolean(saving)} className="btn-secondary">
                <FileCheck size={16} />
                Completar logistica
              </button>
            )}
            {viaje.estadoFinanciero !== 'LIQUIDADO' && (
              <button onClick={() => cerrar(false)} disabled={Boolean(saving)} className="btn-primary">
                <Check size={16} />
                Liquidar
              </button>
            )}
          </section>
        </div>
      </aside>

      {showLiquidarModal && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-neutral-950/40 px-4">
          <div className="w-full max-w-md rounded-md border border-neutral-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Liquidar viaje</h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Registra el numero de guia entregado por el chofer, si esta disponible.
                </p>
              </div>
              <button onClick={() => setShowLiquidarModal(false)} className="grid h-9 w-9 place-items-center rounded-md hover:bg-neutral-100">
                <X size={16} />
              </button>
            </div>
            <Field label="Numero de guia (opcional)">
              <input
                autoFocus
                value={numeroGuia}
                onChange={(event) => setNumeroGuia(event.target.value)}
                className="input"
                placeholder="Ej. GUIA-2026-001"
              />
            </Field>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button onClick={() => ejecutarCierre(false, numeroGuia)} disabled={Boolean(saving)} className="btn-primary">
                <Check size={16} />
                Liquidar
              </button>
              <button onClick={() => ejecutarCierre(false, null)} disabled={Boolean(saving)} className="btn-secondary">
                Liquidar sin guia
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@sanroman.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/login', { email, password })
      const token = res.data?.data?.token
      if (!token) throw new Error('Token no recibido')
      localStorage.setItem('token', token)
      onLogin()
    } catch {
      setError('Credenciales invalidas.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-stone-50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-md border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-neutral-950 text-white">
            <img src={logo} alt="Transporte San Roman" className="h-11 w-16 rounded-md object-cover" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">San Roman</h1>
            <p className="text-sm text-neutral-500">Panel operativo</p>
          </div>
        </div>
        <div className="space-y-3">
          <Field label="Correo">
            <input value={email} onChange={(event) => setEmail(event.target.value)} className="input" autoComplete="email" />
          </Field>
          <Field label="Clave">
            <input value={password} onChange={(event) => setPassword(event.target.value)} className="input" type="password" autoComplete="current-password" />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={loading} className="btn-primary w-full">
            <LockIcon />
            {loading ? 'Entrando' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Metric({ title, value, icon: Icon, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-neutral-950 text-white',
    amber: 'bg-amber-100 text-amber-800',
    blue: 'bg-blue-100 text-blue-800',
    emerald: 'bg-emerald-100 text-emerald-800',
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">{title}</p>
        <div className={`grid h-9 w-9 place-items-center rounded-md ${tones[tone]}`}>
          <Icon size={17} />
        </div>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

function ReportRow({ reporte, compact = false }) {
  return (
    <div className="border-b border-neutral-100 px-4 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{reporte.mensajeOriginal || reporte.resumen || 'Reporte'}</p>
          {!compact && <p className="mt-1 text-xs text-neutral-500">{reporte.ubicacion || 'Sin ubicacion'}</p>}
        </div>
        <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${reporteStyles[reporte.tipoReporte] || reporteStyles.OTRO}`}>
          {labelReporte(reporte.tipoReporte)}
        </span>
      </div>
      <p className="mt-2 text-xs text-neutral-400">{formatDate(reporte.createdAt)}</p>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </label>
  )
}

function Fact({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
        <Icon size={15} />
        {label}
      </div>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  )
}

function SectionTitle({ title, subtitle }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-neutral-950">{title}</h2>
      {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
    </div>
  )
}

function Banner({ icon: Icon, text, tone }) {
  const className = tone === 'danger'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-neutral-200 bg-white text-neutral-600'

  return (
    <div className={`mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${className}`}>
      <Icon size={16} />
      {text}
    </div>
  )
}

function Empty({ text }) {
  return <div className="px-4 py-8 text-center text-sm text-neutral-500">{text}</div>
}

function ParadaPill({ parada }) {
  return (
    <div className={`rounded-md border px-2 py-1 text-xs ${paradaStyles[parada.estado] || paradaStyles.PENDIENTE}`}>
      <span className="font-medium">{parada.tipo}</span> · {parada.ciudad}
    </div>
  )
}

function StatusDot({ estado }) {
  const color = estado === 'COMPLETADO' ? 'bg-emerald-500' : estado === 'EN_CURSO' ? 'bg-blue-500' : 'bg-neutral-400'
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
}

function LockIcon() {
  return <ClipboardList size={16} />
}

function buildOperationalData({ viajes, choferes, camiones, query }) {
  const q = normalize(query)
  const filteredViajes = viajes.filter((viaje) => {
    if (!q) return true
    return [
      viaje.codigo,
      viaje.numeroGuia,
      viaje.chofer?.nombre,
      viaje.camion?.placa,
      viaje.camion?.placaFurgon,
      viaje.camion?.placaChuto,
      formatRoute(viaje),
      ...(viaje.reportes || []).map((reporte) => reporte.mensajeOriginal),
    ]
      .some((value) => normalize(value).includes(q))
  })

  const activos = filteredViajes.filter((viaje) => viaje.estadoLogistico === 'EN_CURSO')
  const pendientesLiquidacion = filteredViajes.filter((viaje) => viaje.estadoLogistico === 'COMPLETADO' && viaje.estadoFinanciero === 'PENDIENTE')
  const completados = filteredViajes.filter((viaje) => viaje.estadoLogistico === 'COMPLETADO')
  const liquidados = filteredViajes.filter((viaje) => viaje.estadoFinanciero === 'LIQUIDADO')
  const esperando = activos.filter((viaje) => viaje.reportes?.some((reporte) => reporte.tipoReporte === 'ESPERANDO_INSTRUCCIONES'))

  const choferesOcupados = new Set(activos.map((viaje) => viaje.choferId))
  const camionesOcupados = new Set(activos.map((viaje) => viaje.camionId))

  const choferesOperativos = choferes.map((chofer) => ({
    ...chofer,
    estadoCalculado: chofer.estado,
  })).filter((chofer) =>
    !q || [chofer.nombre, chofer.cedula, chofer.telefono, chofer.estado, chofer.ubicacionActual]
      .some((value) => normalize(value).includes(q))
  )

  const camionesOperativos = camiones.map((camion) => ({
    ...camion,
    estadoCalculado: camion.estado,
    ubicacionActual:
      activos.find((viaje) => viaje.camionId === camion.id)?.chofer?.ubicacionActual ||
      camion.ubicacionActual,
  })).filter((camion) =>
    !q || [
      camion.placa,
      camion.placaFurgon,
      camion.placaChuto,
      camion.tipoVehiculo,
      camion.marcaModelo,
      camion.estado,
      camion.ubicacionActual,
    ].some((value) => normalize(value).includes(q))
  )

  return {
    activos,
    pendientesLiquidacion,
    completados,
    liquidados,
    esperando,
    choferesOperativos,
    camionesOperativos,
    choferesDisponibles: choferes.filter((chofer) => chofer.estado === 'DISPONIBLE' && !choferesOcupados.has(chofer.id)),
    camionesDisponibles: camiones.filter((camion) => camion.estado === 'DISPONIBLE' && !camionesOcupados.has(camion.id)),
    camionesTaller: camiones.filter((camion) => camion.estado === 'EN_TALLER'),
    reportes: filteredViajes
      .flatMap((viaje) => (viaje.reportes || []).map((reporte) => ({ ...reporte, viaje })))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  }
}

function getProgress(viaje) {
  const total = viaje.paradas?.length || 0
  const completadas = viaje.paradas?.filter((parada) => parada.estado === 'COMPLETADA').length || 0
  return { total, completadas, percent: total ? Math.round((completadas / total) * 100) : 0 }
}

function formatRoute(viaje) {
  const paradas = viaje.paradas || []
  if (paradas.length === 0) return 'Sin ruta'
  const first = paradas[0]?.ciudad || paradas[0]?.lugar
  const last = paradas[paradas.length - 1]?.ciudad || paradas[paradas.length - 1]?.lugar
  return `${first} -> ${last}`
}

function vehicleLabel(camion) {
  if (camion.tipoVehiculo === 'FURGON') return `Furgon ${camion.placaFurgon} / Chuto ${camion.placaChuto}`
  return `${camion.tipoVehiculo || 'NPR'} ${camion.placa}`
}

function groupByTramo(paradas) {
  const groups = paradas.reduce((acc, parada) => {
    const tramo = parada.tramo || 1
    if (!acc[tramo]) acc[tramo] = []
    acc[tramo].push(parada)
    return acc
  }, {})

  return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b))
}

function formatParadasRoute(paradas) {
  if (paradas.length === 0) return 'Sin ruta'
  return `${paradas[0].ciudad} -> ${paradas[paradas.length - 1].ciudad}`
}

function balance(viaje) {
  const depositado = Number(viaje.viaticosDepositados) || 0
  const gastado = (viaje.gastos || []).reduce((acc, gasto) => acc + Number(gasto.monto), 0)
  return depositado - gastado
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`
}

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })
}

function labelReporte(tipo) {
  const labels = {
    ESPERANDO_INSTRUCCIONES: 'Esperando',
    EN_PERNOCTA: 'Pernocta',
    EN_RUTA: 'En ruta',
  }
  return labels[tipo] || tipo
}

function pageTitle(tab) {
  const titles = {
    monitor: 'Resumen',
    viajes: 'Viajes',
    despacho: 'Agendamiento',
    recursos: 'Recursos',
    liquidaciones: 'Liquidaciones',
  }
  return titles[tab] || 'Panel'
}

function Pagination({ page, total, pageSize, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null

  return (
    <div className="flex items-center justify-between gap-3 text-xs text-neutral-500">
      <span>Pagina {page} de {pages}</span>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="btn-secondary h-8 px-3">Anterior</button>
        <button disabled={page >= pages} onClick={() => onChange(page + 1)} className="btn-secondary h-8 px-3">Siguiente</button>
      </div>
    </div>
  )
}

function paginate(items, page, pageSize) {
  const safePage = Math.min(page, Math.max(1, Math.ceil(items.length / pageSize)))
  return items.slice((safePage - 1) * pageSize, safePage * pageSize)
}

function periodStart(periodo) {
  const now = new Date()
  if (periodo === 'todo') return new Date(0)
  if (periodo === 'dia') return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (periodo === 'semana') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    return start
  }
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function periodLabel(periodo) {
  return {
    dia: 'Diario',
    semana: 'Semanal',
    mes: 'Mensual',
    todo: 'Historico',
  }[periodo] || periodo
}

async function imageToDataUrl(src) {
  const response = await fetch(src)
  const blob = await response.blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function playAlertSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.12, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.onended = () => context.close()
    oscillator.start()
    oscillator.stop(context.currentTime + 0.35)
  } catch {
    // El navegador puede bloquear audio hasta la primera interaccion.
  }
}

function normalize(value = '') {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}
