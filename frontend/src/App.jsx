import { useCallback, useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import logo from './assets/logo.png'
import GpsMap from './components/GpsMap.jsx'
import { api, SOCKET_URL } from './lib/api'
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
  UserX,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react'

const socket = io(SOCKET_URL, { autoConnect: false, withCredentials: true })

const createClientId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const randomPart = Math.random().toString(36).slice(2)
  return `tmp-${Date.now().toString(36)}-${randomPart}`
}

const alertOptions = {
  customClass: {
    popup: 'sanroman-alert',
    confirmButton: 'sanroman-alert-confirm',
    cancelButton: 'sanroman-alert-cancel',
    input: 'sanroman-alert-input',
  },
  buttonsStyling: false,
}

const notifySuccess = (title, text = '') => Swal.fire({
  ...alertOptions,
  icon: 'success',
  title,
  text,
  timer: 1800,
  showConfirmButton: false,
})

const notifyError = (text) => Swal.fire({
  ...alertOptions,
  icon: 'error',
  title: 'No se pudo completar',
  text,
})

const confirmAction = (title, text, confirmButtonText = 'Confirmar') => Swal.fire({
  ...alertOptions,
  imageUrl: logo,
  imageWidth: 112,
  imageAlt: 'Transporte San Roman',
  title,
  text,
  showCancelButton: true,
  confirmButtonText,
  cancelButtonText: 'Cancelar',
  reverseButtons: true,
})

const requestNumber = (title, value = '', placeholder = '0.00') => Swal.fire({
  ...alertOptions,
  title,
  input: 'number',
  inputValue: value,
  inputPlaceholder: placeholder,
  inputAttributes: { min: '0', step: '0.01' },
  showCancelButton: true,
  confirmButtonText: 'Guardar',
  cancelButtonText: 'Cancelar',
  reverseButtons: true,
  inputValidator: (inputValue) => (inputValue === '' || Number(inputValue) < 0 ? 'Ingresa un monto valido' : undefined),
})

const tabs = [
  { id: 'monitor', label: 'Resumen', icon: LayoutDashboard },
  { id: 'viajes', label: 'Viajes', icon: Route },
  { id: 'despacho', label: 'Agendamiento', icon: Send },
  { id: 'recursos', label: 'Recursos', icon: Users },
  { id: 'taller', label: 'Taller', icon: Wrench },
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
  NOVEDAD: 'bg-amber-100 text-amber-800',
  OTRO: 'bg-neutral-100 text-neutral-600',
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [usuario, setUsuario] = useState(null)
  const [activeTab, setActiveTab] = useState('monitor')
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedViaje, setSelectedViaje] = useState(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [alertas, setAlertas] = useState([])
  const [whatsappStatus, setWhatsappStatus] = useState({
    conectado: false,
    qrDisponible: false,
    loading: false,
  })

  const [viajes, setViajes] = useState([])
  const [choferes, setChoferes] = useState([])
  const [camiones, setCamiones] = useState([])

  const logout = useCallback(() => {
    setIsAuthenticated(false)
    setUsuario(null)
    setSelectedViaje(null)
  }, [])

  const confirmLogout = async () => {
    const result = await confirmAction('Cerrar sesion', 'Tendras que ingresar nuevamente para acceder al panel.', 'Salir')
    if (result.isConfirmed) {
      try {
        await api.post('/auth/logout', {})
      } finally {
        logout()
      }
    }
  }

  const fetchData = useCallback(async ({ refreshSelected = false } = {}) => {
    if (!isAuthenticated) return
    setLoading(true)
    setError('')

    try {
      const [viajesRes, choferesRes, camionesRes] = await Promise.all([
        api.get('/viajes'),
        api.get('/choferes', { params: { estado: 'todos' } }),
        api.get('/camiones', { params: { estado: 'todos' } }),
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
  }, [isAuthenticated, logout])

  const cargarWhatsappStatus = useCallback(async () => {
    if (!isAuthenticated || usuario?.rol !== 'ADMIN') return
    setWhatsappStatus((current) => ({ ...current, loading: true }))
    try {
      const response = await api.get('/whatsapp/status')
      setWhatsappStatus({
        conectado: Boolean(response.data?.conectado),
        qrDisponible: Boolean(response.data?.qrDisponible),
        loading: false,
      })
    } catch {
      setWhatsappStatus((current) => ({ ...current, loading: false }))
    }
  }, [isAuthenticated, usuario?.rol])

  const abrirWhatsappQr = useCallback(() => {
    window.open(new URL('/whatsapp-qr', SOCKET_URL).toString(), '_blank', 'noopener,noreferrer')
  }, [])

  const reiniciarWhatsapp = useCallback(async () => {
    const result = await confirmAction(
      'Reiniciar WhatsApp',
      'Se cerrara la sesion actual y se generara un QR nuevo para vincular el telefono.',
      'Reiniciar'
    )
    if (!result.isConfirmed) return

    setWhatsappStatus((current) => ({ ...current, loading: true }))
    try {
      const response = await api.post('/whatsapp/reiniciar', {})
      setWhatsappStatus({
        conectado: Boolean(response.data?.data?.conectado),
        qrDisponible: Boolean(response.data?.data?.qrDisponible),
        loading: false,
      })
      await notifySuccess('WhatsApp reiniciado', 'Abre el QR y vincula el telefono.')
      abrirWhatsappQr()
    } catch (err) {
      setWhatsappStatus((current) => ({ ...current, loading: false }))
      notifyError(err.response?.data?.mensaje || 'No se pudo reiniciar WhatsApp.')
    }
  }, [abrirWhatsappQr])

  useEffect(() => {
    let mounted = true
    localStorage.removeItem('token')

    api.get('/auth/perfil')
      .then((response) => {
        if (mounted) {
          setUsuario(response.data?.data || null)
          setIsAuthenticated(true)
        }
      })
      .catch(() => {
        if (mounted) setIsAuthenticated(false)
      })
      .finally(() => {
        if (mounted) setAuthChecking(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    const initialRefresh = setTimeout(() => fetchData(), 0)
    socket.connect()

    const refresh = () => fetchData({ refreshSelected: true })
    const handleReporte = (payload) => {
      playAlertSound()
      setAlertas((prev) => [{
        ...payload,
        id: createClientId(),
        at: new Date(),
        mensaje: payload?.mensaje || `Nuevo reporte de ${payload?.chofer?.nombre || 'chofer'}`,
      }, ...prev].slice(0, 8))
      refresh()
    }
    const pushAlerta = (alerta) => {
      setAlertas((prev) => [{ ...alerta, id: createClientId(), at: new Date() }, ...prev].slice(0, 5))
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
  const isAdmin = usuario?.rol === 'ADMIN'

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return

    cargarWhatsappStatus()
    const interval = setInterval(cargarWhatsappStatus, 15000)
    return () => clearInterval(interval)
  }, [cargarWhatsappStatus, isAdmin, isAuthenticated])

  const visibleTabs = useMemo(
    () => tabs.filter((tab) => tab.id !== 'liquidaciones' || isAdmin),
    [isAdmin]
  )

  if (authChecking) {
    return (
      <div className="grid min-h-screen place-items-center bg-stone-50">
        <RefreshCw className="animate-spin text-neutral-500" size={24} />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Login onLogin={(nextUsuario) => { setUsuario(nextUsuario); setIsAuthenticated(true) }} />
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
              {visibleTabs.map((tab) => {
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
              <button onClick={confirmLogout} className="flex h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50">
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
              <Monitor
                data={data}
                alertas={alertas}
                isAdmin={isAdmin}
                whatsappStatus={whatsappStatus}
                onOpenWhatsappQr={abrirWhatsappQr}
                onResetWhatsapp={reiniciarWhatsapp}
                onRefreshWhatsapp={cargarWhatsappStatus}
                onSelect={setSelectedViaje}
              />
            )}
            {activeTab === 'viajes' && (
              <ViajesView data={data} onSelect={setSelectedViaje} />
            )}
            {activeTab === 'despacho' && (
              <DespachoView choferes={data.choferesOperativos} camiones={data.camionesOperativos.filter((camion) => camion.estado !== 'EN_TALLER')} viajesActivos={data.activos} onDone={() => fetchData()} />
            )}
            {activeTab === 'recursos' && (
              <RecursosView data={data} isAdmin={isAdmin} onDone={() => fetchData()} />
            )}
            {activeTab === 'taller' && (
              <TallerView camiones={data.camionesOperativos} onDone={() => fetchData()} />
            )}
            {isAdmin && activeTab === 'liquidaciones' && (
              <LiquidacionesView viajes={data.liquidados} choferes={choferes} onDone={() => fetchData()} />
            )}
          </div>
        </main>
      </div>

      {selectedViaje && (
        <ViajeDrawer
          viaje={selectedViaje}
          isAdmin={isAdmin}
          onClose={() => setSelectedViaje(null)}
          onDone={() => fetchData({ refreshSelected: true })}
        />
      )}
    </div>
  )
}

function Monitor({
  data,
  alertas,
  isAdmin,
  whatsappStatus,
  onOpenWhatsappQr,
  onResetWhatsapp,
  onRefreshWhatsapp,
  onSelect,
}) {
  const [tripPage, setTripPage] = useState(1)
  const [reportPage, setReportPage] = useState(1)
  const tripPageSize = 6
  const reportPageSize = 6
  const activeTrips = paginate(data.activos, tripPage, tripPageSize)
  const latestReports = paginate(data.reportes, reportPage, reportPageSize)
  useClampPage(tripPage, data.activos.length, tripPageSize, setTripPage)
  useClampPage(reportPage, data.reportes.length, reportPageSize, setReportPage)

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="En curso" value={data.activos.length} icon={Route} />
        <Metric title="Esperando" value={data.esperando.length} icon={Bell} tone="amber" />
        <Metric title="Por liquidar" value={data.pendientesLiquidacion.length} icon={Wallet} tone="blue" />
        <Metric title="Fuera de servicio" value={data.camionesTaller.length} icon={Wrench} tone="amber" />
      </section>

      {isAdmin && (
        <WhatsAppStatusCard
          status={whatsappStatus}
          onOpenQr={onOpenWhatsappQr}
          onReset={onResetWhatsapp}
          onRefresh={onRefreshWhatsapp}
        />
      )}

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

function WhatsAppStatusCard({ status, onOpenQr, onReset, onRefresh }) {
  const conectado = Boolean(status?.conectado)
  const qrDisponible = Boolean(status?.qrDisponible)

  return (
    <section className="rounded-md border border-neutral-200 bg-white px-4 py-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">WhatsApp del bot</p>
            <span className={`rounded px-2 py-1 text-xs font-semibold ${conectado ? 'bg-emerald-50 text-emerald-700' : qrDisponible ? 'bg-amber-50 text-amber-700' : 'bg-neutral-100 text-neutral-600'}`}>
              {conectado ? 'Conectado' : qrDisponible ? 'QR listo' : 'Esperando QR'}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {conectado
              ? 'La sesion esta activa para recibir reportes.'
              : 'Abre el QR para vincular el telefono operativo.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={status?.loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={status?.loading ? 'animate-spin' : ''} size={16} />
            Actualizar
          </button>
          <button
            type="button"
            onClick={onOpenQr}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <Send size={16} />
            Ver QR
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={status?.loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-neutral-950 px-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} />
            Reiniciar vinculacion
          </button>
        </div>
      </div>
    </section>
  )
}

function ViajesView({ data, onSelect }) {
  return (
    <div className="space-y-6">
      <TripList title="En curso" viajes={data.activos} onSelect={onSelect} />
      <PendientesLiquidacion onSelect={onSelect} />
      <ArchivoLogistico onSelect={onSelect} />
    </div>
  )
}

function PendientesLiquidacion({ onSelect }) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, pageSize: 10 })
  const [loading, setLoading] = useState(false)
  useClampPage(page, data.total, data.pageSize, setPage)

  useEffect(() => {
    let active = true
    const cargar = async () => {
      setLoading(true)
      try {
        const response = await api.get('/viajes/pendientes-liquidacion/listado', {
          params: { page, pageSize: data.pageSize },
        })
        if (active) setData(response.data?.data || { items: [], total: 0, pageSize: 10 })
      } finally {
        if (active) setLoading(false)
      }
    }
    cargar()
    return () => {
      active = false
    }
  }, [page, data.pageSize])

  return (
    <section className="space-y-3">
      <SectionTitle title="Pendientes de liquidacion" subtitle={`${data.total} registros`} />
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
        {data.items.map((viaje) => (
          <button key={viaje.id} onClick={() => onSelect(viaje)} className="grid w-full gap-2 border-b border-neutral-100 px-4 py-3 text-left last:border-b-0 hover:bg-neutral-50 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_120px_24px] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{viaje.codigo}</p>
              <p className="truncate text-xs text-neutral-500">{formatRoute(viaje)}</p>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{viaje.chofer?.nombre || 'Sin chofer'}</p>
              <p className="truncate text-xs text-neutral-500">{formatTripUnits(viaje)}</p>
            </div>
            <div>
              <p className="text-sm font-semibold">{money(balance(viaje))}</p>
              <p className="text-xs text-neutral-500">Balance</p>
            </div>
            <div>
              <p className="text-sm font-medium">{formatDate(viaje.fechaCierre)}</p>
              <p className="text-xs text-neutral-500">Cierre logistico</p>
            </div>
            <ChevronRight className="hidden text-neutral-400 sm:block" size={18} />
          </button>
        ))}
        {!loading && data.items.length === 0 && <Empty text="Sin viajes pendientes de liquidacion." />}
        {loading && <Empty text="Cargando pendientes..." />}
      </div>
      <Pagination page={page} total={data.total} pageSize={data.pageSize} onChange={setPage} />
    </section>
  )
}

function ArchivoLogistico({ onSelect }) {
  const [periodo, setPeriodo] = useState('todos')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [page, setPage] = useState(1)
  const [archivo, setArchivo] = useState({ items: [], total: 0, pageSize: 10 })
  const [loading, setLoading] = useState(false)
  useClampPage(page, archivo.total, archivo.pageSize, setPage)

  useEffect(() => {
    let active = true
    const cargar = async () => {
      setLoading(true)
      try {
        const response = await api.get('/viajes/archivo/listado', {
          params: { periodo, fecha, page, pageSize: archivo.pageSize },
        })
        if (active) setArchivo(response.data?.data || { items: [], total: 0, pageSize: 10 })
      } finally {
        if (active) setLoading(false)
      }
    }
    cargar()
    return () => {
      active = false
    }
  }, [periodo, fecha, page, archivo.pageSize])

  const cambiarPeriodo = (value) => {
    setPeriodo(value)
    setPage(1)
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionTitle title="Archivo logistico" subtitle={`${archivo.total} registros`} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex rounded-md border border-neutral-200 bg-white p-1">
            {[
              ['todos', 'Todos'],
              ['dia', 'Dia'],
              ['semana', 'Semana'],
              ['mes', 'Mes'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => cambiarPeriodo(value)}
                className={`h-8 px-3 text-xs font-medium ${periodo === value ? 'rounded bg-neutral-950 text-white' : 'text-neutral-600'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {periodo !== 'todos' && (
            <input
              type="date"
              value={fecha}
              onChange={(event) => {
                setFecha(event.target.value)
                setPage(1)
              }}
              className="input sm:w-40"
            />
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
        {archivo.items.map((viaje) => (
          <button key={viaje.id} onClick={() => onSelect(viaje)} className="flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left last:border-b-0 hover:bg-neutral-50">
            <StatusDot estado={viaje.estadoLogistico} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{viaje.codigo}</p>
              <p className="truncate text-xs text-neutral-500">{viaje.chofer?.nombre || 'Sin chofer'} · {formatRoute(viaje)}</p>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{formatDate(viaje.fechaCierre)}</p>
              <p className="text-xs text-neutral-500">{formatStatus(viaje.estadoFinanciero)}</p>
            </div>
            <ChevronRight className="text-neutral-400" size={18} />
          </button>
        ))}
        {!loading && archivo.items.length === 0 && <Empty text="Sin registros para este periodo." />}
        {loading && <Empty text="Cargando archivo..." />}
      </div>
      <Pagination page={page} total={archivo.total} pageSize={archivo.pageSize} onChange={setPage} />
    </section>
  )
}

function TripList({ title, viajes, onSelect }) {
  const [page, setPage] = useState(1)
  const pageSize = 8
  const pageItems = paginate(viajes, page, pageSize)
  useClampPage(page, viajes.length, pageSize, setPage)

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
              <p className="text-xs text-neutral-500">{formatStatus(viaje.estadoFinanciero)}</p>
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
          <p className="text-xs font-medium text-neutral-500">{formatTripUnits(viaje) || 'Sin placa'}</p>
          <h3 className="mt-1 truncate text-lg font-semibold">{viaje.codigo}</h3>
          <p className="mt-1 truncate text-sm text-neutral-600">{viaje.chofer?.nombre || 'Sin chofer'}</p>
        </div>
        <span className="rounded-md bg-neutral-950 px-2 py-1 text-xs font-medium text-white">{formatStatus(viaje.estadoLogistico)}</span>
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
          {labelReporte(ultimoReporte.tipoReporte)}: {ultimoReporte.ubicacion || ultimoReporte.mensajeOriginal}
        </div>
      )}
    </button>
  )
}

function DespachoView({ choferes, camiones, viajesActivos, onDone }) {
  const [form, setForm] = useState({ choferId: '', camionIds: [], viaticosDepositados: '', odometroInicial: '', combustibleInicial: '' })
  const [paradas, setParadas] = useState([
    { id: createClientId(), tipo: 'CARGA', lugar: '', ciudad: '', fechaProgramada: '', programacion: 'SIN_PROGRAMAR' },
    { id: createClientId(), tipo: 'DESCARGA', lugar: '', ciudad: '', fechaProgramada: '', programacion: 'SIN_PROGRAMAR' },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selectedChofer = choferes.find((chofer) => chofer.id === form.choferId)
  const unidadesAsignadas = useMemo(
    () => (selectedChofer?.unidadesAsignadas || [])
      .map((asignacion) => asignacion.camion)
      .filter((camion) => camion?.activo !== false && camion.estado !== 'EN_TALLER'),
    [selectedChofer]
  )
  const viajeExistente = viajesActivos.find((viaje) => viaje.choferId === form.choferId && sameIdSet(tripUnitIds(viaje), form.camionIds))

  useEffect(() => {
    if (!form.choferId) {
      if (form.camionIds.length > 0) setForm((current) => ({ ...current, camionIds: [] }))
      return
    }
    if (unidadesAsignadas.length === 1 && !sameIdSet(form.camionIds, [unidadesAsignadas[0].id])) {
      setForm((current) => ({ ...current, camionIds: [unidadesAsignadas[0].id] }))
    } else if (form.camionIds.some((id) => !unidadesAsignadas.some((camion) => camion.id === id))) {
      setForm((current) => ({ ...current, camionIds: current.camionIds.filter((id) => unidadesAsignadas.some((camion) => camion.id === id)) }))
    }
  }, [form.choferId, form.camionIds, unidadesAsignadas])

  const toggleUnidadViaje = (camionId) => {
    setForm((current) => {
      const selected = new Set(current.camionIds)
      if (selected.has(camionId)) selected.delete(camionId)
      else selected.add(camionId)
      return { ...current, camionIds: Array.from(selected) }
    })
  }

  const updateParada = (id, patch) => {
    setParadas((prev) => prev.map((parada) => (parada.id === id ? { ...parada, ...patch } : parada)))
  }

  const addParada = () => {
    setParadas((prev) => [...prev, { id: createClientId(), tipo: 'DESCARGA', lugar: '', ciudad: '', fechaProgramada: '', programacion: 'SIN_PROGRAMAR' }])
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
        camionId: form.camionIds[0],
        camionIds: form.camionIds,
        choferId: form.choferId,
        viaticosDepositados: Number(form.viaticosDepositados) || 0,
        odometroInicial: form.odometroInicial || null,
        combustibleInicial: form.combustibleInicial || null,
        paradas: paradas.map(({ tipo, lugar, ciudad, fechaProgramada, programacion }) => ({
          tipo,
          lugar,
          ciudad,
          fechaProgramada: tipo === 'CARGA' && programacion === 'FECHA_HORA' ? fechaProgramada : null,
          cargarAlDescargar: tipo === 'CARGA' && programacion === 'AL_DESCARGAR',
        })),
      })
      setForm({ choferId: '', camionIds: [], viaticosDepositados: '', odometroInicial: '', combustibleInicial: '' })
      setParadas([
        { id: createClientId(), tipo: 'CARGA', lugar: '', ciudad: '', fechaProgramada: '', programacion: 'SIN_PROGRAMAR' },
        { id: createClientId(), tipo: 'DESCARGA', lugar: '', ciudad: '', fechaProgramada: '', programacion: 'SIN_PROGRAMAR' },
      ])
      await notifySuccess(viajeExistente ? 'Tramo agregado' : 'Viaje agendado', 'El chofer recibira el detalle por WhatsApp.')
      onDone()
    } catch (err) {
      const message = err.response?.data?.mensaje || 'No se pudo crear el viaje.'
      setError(message)
      await notifyError(message)
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
      {form.choferId && unidadesAsignadas.length === 0 && (
        <Banner tone="danger" icon={AlertTriangle} text="Este chofer no tiene unidades activas asignadas. Asignale una unidad en Recursos antes de agendar." />
      )}

      <section className="rounded-md border border-neutral-200 bg-white p-4 sm:p-5">
        <SectionTitle title="Nuevo despacho" subtitle="Chofer, unidad, viaticos y ruta" />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Chofer">
            <select required value={form.choferId} onChange={(event) => setForm({ ...form, choferId: event.target.value, camionIds: [] })} className="input">
              <option value="">Seleccionar</option>
              {choferes.map((chofer) => <option key={chofer.id} value={chofer.id}>{chofer.nombre} · {formatStatus(chofer.estadoCalculado)}</option>)}
            </select>
          </Field>
          <Field label="Unidades del viaje">
            <div className="min-h-10 rounded-md border border-neutral-200 bg-white">
              {!form.choferId && <p className="px-3 py-2 text-sm text-neutral-400">Selecciona un chofer primero</p>}
              {form.choferId && unidadesAsignadas.length === 0 && <p className="px-3 py-2 text-sm text-neutral-400">Sin unidades asignadas</p>}
              {unidadesAsignadas.map((camion) => (
                <label key={camion.id} className="flex items-center gap-3 border-b border-neutral-100 px-3 py-2 last:border-b-0 hover:bg-neutral-50">
                  <input type="checkbox" checked={form.camionIds.includes(camion.id)} onChange={() => toggleUnidadViaje(camion.id)} className="h-4 w-4 accent-neutral-950" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{camion.placa}</span>
                    <span className="block truncate text-xs text-neutral-500">{formatStatus(camion.tipoVehiculo)} - {formatStatus(camion.estadoCalculado || camion.estado)}</span>
                  </span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Viaticos (opcional)">
            <input type="number" min="0" step="0.01" value={form.viaticosDepositados} onChange={(event) => setForm({ ...form, viaticosDepositados: event.target.value })} className="input" placeholder="Sin viaticos" />
          </Field>
          <Field label="Km inicial (opcional)">
            <input type="number" min="0" step="1" value={form.odometroInicial} onChange={(event) => setForm({ ...form, odometroInicial: event.target.value })} className="input" placeholder="Odometro" />
          </Field>
          <Field label="Combustible inicial (opcional)">
            <input type="number" min="0" step="0.01" value={form.combustibleInicial} onChange={(event) => setForm({ ...form, combustibleInicial: event.target.value })} className="input" placeholder="Litros o nivel" />
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
            <div key={parada.id} className="grid gap-3 rounded-md border border-neutral-200 p-3 md:grid-cols-[52px_130px_1fr_1fr_220px_40px]">
              <div className="flex h-10 items-center text-sm font-semibold text-neutral-500">#{index + 1}</div>
              <select value={parada.tipo} onChange={(event) => updateParada(parada.id, { tipo: event.target.value, fechaProgramada: event.target.value === 'CARGA' ? parada.fechaProgramada : '', programacion: 'SIN_PROGRAMAR' })} className="input">
                <option value="CARGA">Carga</option>
                <option value="DESCARGA">Descarga</option>
                <option value="PERNOCTA">Pernocta</option>
              </select>
              <input required value={parada.lugar} onChange={(event) => updateParada(parada.id, { lugar: event.target.value })} className="input" placeholder="Lugar" />
              <input required value={parada.ciudad} onChange={(event) => updateParada(parada.id, { ciudad: event.target.value })} className="input" placeholder="Ciudad" />
              {parada.tipo === 'CARGA' ? (
                <div className="space-y-2">
                  <select value={parada.programacion} onChange={(event) => updateParada(parada.id, { programacion: event.target.value, fechaProgramada: event.target.value === 'FECHA_HORA' ? parada.fechaProgramada : '' })} className="input">
                    <option value="SIN_PROGRAMAR">Sin programar</option>
                    <option value="FECHA_HORA">Fecha y hora</option>
                    <option value="AL_DESCARGAR">Al descargar</option>
                  </select>
                  {parada.programacion === 'FECHA_HORA' && (
                    <input required type="datetime-local" value={parada.fechaProgramada} onChange={(event) => updateParada(parada.id, { fechaProgramada: event.target.value })} className="input" />
                  )}
                </div>
              ) : (
                <div className="flex h-10 items-center text-xs text-neutral-400">Sin hora programada</div>
              )}
              <button type="button" onClick={() => removeParada(parada.id)} className="grid h-10 w-10 place-items-center rounded-md text-neutral-400 hover:bg-red-50 hover:text-red-600">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button disabled={saving || form.camionIds.length === 0} className="btn-primary">
            <Send size={16} />
            {saving ? 'Guardando' : viajeExistente ? 'Agregar tramo' : 'Despachar'}
          </button>
        </div>
      </section>
    </form>
  )
}

function RecursosView({ data, isAdmin, onDone }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ResourcePanel title="Choferes" items={data.choferesRecursos} type="chofer" isAdmin={isAdmin} onDone={onDone} camiones={data.camionesOperativos} />
      <ResourcePanel title="Camiones" items={data.camionesRecursos} type="camion" isAdmin={isAdmin} onDone={onDone} />
    </div>
  )
}

function ResourcePanel({ title, items, type, isAdmin, onDone, camiones = [] }) {
  const [open, setOpen] = useState(false)
  const [estadoFiltro, setEstadoFiltro] = useState('activos')
  const emptyForm = () => type === 'chofer'
    ? { nombre: '', cedula: '', telefono: '', unidadIds: [] }
    : { tipoVehiculo: 'NPR', placa: '', marcaModelo: '', gpsImei: '' }
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [page, setPage] = useState(1)
  const pageSize = 8
  const visibleItems = items.filter((item) => estadoFiltro === 'inactivos' ? !item.activo : item.activo)
  const pageItems = paginate(visibleItems, page, pageSize)
  useClampPage(page, visibleItems.length, pageSize, setPage)
  const assignedUnits = type === 'chofer' ? buildAssignedUnitsMap(items) : new Map()

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
      await notifySuccess(editingId ? 'Registro actualizado' : 'Registro creado')
      onDone()
    } catch (err) {
      const message = err.response?.data?.mensaje || 'No se pudo guardar.'
      setError(message)
      await notifyError(message)
    }
  }

  const crearNuevo = () => {
    setEditingId(null)
    setForm(emptyForm())
    setError('')
    setOpen(true)
  }

  const editar = (item) => {
    setEditingId(item.id)
    setError('')
    setForm(
      type === 'chofer'
        ? { nombre: item.nombre, cedula: item.cedula, telefono: item.telefono, unidadIds: (item.unidadesAsignadas || []).map((asignacion) => asignacion.camion?.id).filter(Boolean) }
        : {
            tipoVehiculo: item.tipoVehiculo || 'NPR',
            placa: item.placa,
            marcaModelo: item.marcaModelo,
            gpsImei: item.gpsImei || '',
          }
    )
    setOpen(true)
  }

  const cerrarModal = () => {
    setOpen(false)
    setEditingId(null)
    setForm(emptyForm())
    setError('')
  }

  const toggleUnidad = (camionId) => {
    setForm((current) => {
      const selected = new Set(current.unidadIds || [])
      if (selected.has(camionId)) selected.delete(camionId)
      else selected.add(camionId)
      return { ...current, unidadIds: Array.from(selected) }
    })
  }

  const eliminar = async (item) => {
    const name = type === 'chofer' ? item.nombre : item.placa
    const result = await confirmAction(
      `Eliminar ${name}`,
      type === 'chofer'
        ? 'Se borrara permanentemente el chofer y toda su data operativa relacionada.'
        : 'Se borrara permanentemente la unidad y toda su data operativa relacionada.',
      'Eliminar'
    )
    if (!result.isConfirmed) return
    try {
      await api.delete(`/${type === 'chofer' ? 'choferes' : 'camiones'}/${item.id}`)
      await notifySuccess('Registro eliminado')
      onDone()
    } catch (err) {
      const message = err.response?.data?.mensaje || 'No se pudo eliminar.'
      setError(message)
      await notifyError(message)
    }
  }

  const inactivar = async (item) => {
    const name = type === 'chofer' ? item.nombre : item.placa
    const result = await confirmAction(
      `Inactivar ${name}`,
      type === 'chofer'
        ? 'Dejara de aparecer para agendar viajes, se conservara su historial y se liberaran sus unidades.'
        : 'Dejara de aparecer para operaciones, se conservara su historial y se liberara de choferes.',
      'Inactivar'
    )
    if (!result.isConfirmed) return
    try {
      await api.patch(`/${type === 'chofer' ? 'choferes' : 'camiones'}/${item.id}/inactivar`, {})
      await notifySuccess('Registro inactivado')
      onDone()
    } catch (err) {
      const message = err.response?.data?.mensaje || 'No se pudo inactivar.'
      setError(message)
      await notifyError(message)
    }
  }

  return (
    <section className="rounded-md border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <div className="space-y-2">
          <SectionTitle title={title} subtitle={`${visibleItems.length} registros`} />
          <div className="flex rounded-md border border-neutral-200 bg-white p-1">
            {[
              ['activos', 'Activos'],
              ['inactivos', 'Inactivos'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => { setEstadoFiltro(value); setPage(1) }}
                className={`h-8 px-3 text-xs font-medium ${estadoFiltro === value ? 'rounded bg-neutral-950 text-white' : 'text-neutral-600'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {isAdmin && (
          <button onClick={crearNuevo} className="btn-secondary">
            <Plus size={16} />
            Nuevo
          </button>
        )}
      </div>

      {false && (
        <form onSubmit={submit} className="grid gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-4 md:grid-cols-3">
          {type === 'chofer' ? (
            <>
              <input required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} className="input" placeholder="Nombre" />
              <input required value={form.cedula} onChange={(event) => setForm({ ...form, cedula: event.target.value })} className="input" placeholder="Cedula" />
              <input required value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} className="input" placeholder="Telefono" />
              <select multiple value={form.unidadIds} onChange={(event) => setForm({ ...form, unidadIds: Array.from(event.target.selectedOptions).map((option) => option.value) })} className="input md:col-span-3 min-h-28">
                {camiones.map((camion) => <option key={camion.id} value={camion.id}>{vehicleLabel(camion)} · {formatStatus(camion.estadoCalculado)}</option>)}
              </select>
            </>
          ) : (
            <>
              <select value={form.tipoVehiculo} onChange={(event) => setForm({ ...form, tipoVehiculo: event.target.value })} className="input">
                <option value="NPR">NPR</option>
                <option value="TORONTO">Toronto</option>
                <option value="FURGON">Furgon</option>
                <option value="CHUTO">Chuto</option>
                <option value="CORTINERO">Cortinero</option>
                <option value="BATEA">Batea</option>
              </select>
              <input required value={form.placa} onChange={(event) => setForm({ ...form, placa: event.target.value })} className="input md:col-span-2" placeholder="Placa" />
              <input value={form.marcaModelo} onChange={(event) => setForm({ ...form, marcaModelo: event.target.value })} className="input md:col-span-3" placeholder="Marca / modelo (opcional)" />
              <input value={form.gpsImei} onChange={(event) => setForm({ ...form, gpsImei: event.target.value })} className="input md:col-span-3" placeholder="IMEI GPS Baanool / Coban (opcional)" />
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
                  : `${formatStatus(item.tipoVehiculo || 'NPR')} - ${item.marcaModelo || item.placa}`}
              </p>
              {type === 'chofer' && (
                <p className="mt-1 truncate text-xs text-neutral-400">A cargo: {formatAssignedUnits(item)}</p>
              )}
              {type === 'camion' && (
                <p className="mt-1 truncate text-xs text-neutral-400">A cargo: {formatUnitDrivers(item)}</p>
              )}
              <p className="mt-1 flex items-center gap-1 truncate text-xs text-neutral-400">
                <MapPin size={12} />
                {item.ubicacionActual || 'Sin ubicacion reportada'}
              </p>
              {type === 'camion' && item.gpsImei && (
                <p className="mt-1 truncate text-xs text-neutral-400">GPS {item.gpsImei}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className={`rounded-md px-2 py-1 text-xs font-medium ${item.estadoCalculado === 'DISPONIBLE' ? 'bg-emerald-50 text-emerald-700' : item.estadoCalculado === 'EN_TALLER' ? 'bg-red-50 text-red-700' : 'bg-neutral-100 text-neutral-700'}`}>
                {item.activo ? formatStatus(item.estadoCalculado) : 'INACTIVO'}
              </span>
              {isAdmin && (
                <button onClick={() => editar(item)} title="Editar" className="grid h-8 w-8 place-items-center rounded-md text-neutral-500 hover:bg-neutral-100">
                  <Edit3 size={14} />
                </button>
              )}
              {isAdmin && item.activo && (
                <button onClick={() => inactivar(item)} title="Inactivar" className="grid h-8 w-8 place-items-center rounded-md text-neutral-500 hover:bg-amber-50 hover:text-amber-700">
                  <UserX size={14} />
                </button>
              )}
              {isAdmin && (
                <button onClick={() => eliminar(item)} title="Eliminar permanentemente" className="grid h-8 w-8 place-items-center rounded-md text-neutral-500 hover:bg-red-50 hover:text-red-700">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
        {visibleItems.length === 0 && <Empty text={estadoFiltro === 'inactivos' ? 'Sin registros inactivos.' : 'Sin registros activos.'} />}
      </div>
      <div className="px-4 py-3">
        <Pagination page={page} total={visibleItems.length} pageSize={pageSize} onChange={setPage} />
      </div>

      {open && (
        <ResourceModal
          title={type === 'chofer' ? (editingId ? 'Editar chofer' : 'Nuevo chofer') : (editingId ? 'Editar unidad' : 'Nueva unidad')}
          type={type}
          form={form}
          setForm={setForm}
          error={error}
          editingId={editingId}
          camiones={camiones}
          assignedUnits={assignedUnits}
          onSubmit={submit}
          onClose={cerrarModal}
          onToggleUnidad={toggleUnidad}
        />
      )}
    </section>
  )
}

function ResourceModal({ title, type, form, setForm, error, editingId, camiones, assignedUnits, onSubmit, onClose, onToggleUnidad }) {
  return (
    <div className="fixed inset-0 z-50 grid min-h-[100svh] place-items-center bg-neutral-950/40 p-4">
      <form onSubmit={onSubmit} className="max-h-[92svh] w-full max-w-2xl overflow-y-auto rounded-md border border-neutral-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <SectionTitle title={title} subtitle={type === 'chofer' ? 'Datos y unidades a cargo' : 'Datos de la unidad'} />
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md text-neutral-500 hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-3">
          {type === 'chofer' ? (
            <>
              <Field label="Nombre">
                <input required value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} className="input" placeholder="Nombre" />
              </Field>
              <Field label="Cedula">
                <input required value={form.cedula} onChange={(event) => setForm({ ...form, cedula: event.target.value })} className="input" placeholder="Cedula" />
              </Field>
              <Field label="Telefono">
                <input required value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} className="input" placeholder="Telefono" />
              </Field>
              <div className="md:col-span-3">
                <Field label="Unidades asignadas">
                  <div className="max-h-72 overflow-y-auto rounded-md border border-neutral-200 bg-white">
                    {camiones.map((camion) => {
                      const owner = assignedUnits.get(camion.id)
                      const assignedToOther = owner && owner.choferId !== editingId
                      const checked = (form.unidadIds || []).includes(camion.id)
                      return (
                        <label key={camion.id} className={`flex items-start gap-3 border-b border-neutral-100 px-3 py-3 last:border-b-0 ${assignedToOther ? 'bg-neutral-50 text-neutral-400' : 'hover:bg-neutral-50'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={assignedToOther}
                            onChange={() => onToggleUnidad(camion.id)}
                            className="mt-1 h-4 w-4 accent-neutral-950"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-neutral-900">{vehicleLabel(camion)}</span>
                            <span className="block truncate text-xs text-neutral-500">
                              {assignedToOther ? `Asignada a ${owner.nombre}. Primero liberala para reasignarla.` : formatStatus(camion.estadoCalculado || camion.estado)}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                    {camiones.length === 0 && <Empty text="No hay unidades registradas." />}
                  </div>
                </Field>
              </div>
            </>
          ) : (
            <>
              <Field label="Tipo de vehiculo">
                <select value={form.tipoVehiculo} onChange={(event) => setForm({ ...form, tipoVehiculo: event.target.value })} className="input">
                  <option value="NPR">NPR</option>
                  <option value="TORONTO">Toronto</option>
                  <option value="FURGON">Furgon</option>
                  <option value="CHUTO">Chuto</option>
                  <option value="CORTINERO">Cortinero</option>
                  <option value="BATEA">Batea</option>
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Placa">
                  <input required value={form.placa} onChange={(event) => setForm({ ...form, placa: event.target.value })} className="input" placeholder="Placa" />
                </Field>
              </div>
              <div className="md:col-span-3">
                <Field label="Marca / modelo">
                  <input value={form.marcaModelo} onChange={(event) => setForm({ ...form, marcaModelo: event.target.value })} className="input" placeholder="Opcional" />
                </Field>
              </div>
              <div className="md:col-span-3">
                <Field label="IMEI GPS">
                  <input value={form.gpsImei} onChange={(event) => setForm({ ...form, gpsImei: event.target.value })} className="input" placeholder="Opcional" />
                </Field>
              </div>
            </>
          )}
          {error && <p className="text-sm text-red-600 md:col-span-3">{error}</p>}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-neutral-100 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-secondary justify-center">Cancelar</button>
          <button className="btn-primary justify-center">
            <Check size={16} />
            {editingId ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}

function TallerView({ camiones, onDone }) {
  const emptyForm = {
    camionId: '',
    tipo: 'REPARACION',
    falla: '',
    descripcion: '',
    kilometraje: '',
    costo: '',
    fechaIngreso: new Date().toISOString().slice(0, 10),
  }
  const [form, setForm] = useState(emptyForm)
  const [open, setOpen] = useState(false)
  const [estado, setEstado] = useState('TODOS')
  const [camionId, setCamionId] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, activos: 0, pageSize: 10 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  useClampPage(page, data.total, data.pageSize, setPage)

  useEffect(() => {
    let active = true
    const cargar = async () => {
      setLoading(true)
      try {
        const response = await api.get('/taller', { params: { estado, camionId, page, pageSize: data.pageSize } })
        if (active) setData(response.data?.data || { items: [], total: 0, activos: 0, pageSize: 10 })
      } finally {
        if (active) setLoading(false)
      }
    }
    cargar()
    return () => {
      active = false
    }
  }, [estado, camionId, page, data.pageSize, refreshKey])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    try {
      await api.post('/taller', form)
      setForm(emptyForm)
      setOpen(false)
      setPage(1)
      setRefreshKey((value) => value + 1)
      await notifySuccess('Ingreso registrado', 'La unidad ahora aparece fuera de servicio.')
      onDone()
    } catch (err) {
      const message = err.response?.data?.mensaje || 'No se pudo registrar el ingreso al taller.'
      setError(message)
      await notifyError(message)
    }
  }

  const completar = async (item) => {
    const result = await Swal.fire({
      ...alertOptions,
      title: 'Completar trabajo de taller',
      html: `
        <label class="sanroman-alert-label">Costo final</label>
        <input id="taller-costo" class="swal2-input sanroman-alert-field" type="number" min="0" step="0.01">
        <label class="sanroman-alert-label">Trabajo realizado u observaciones</label>
        <textarea id="taller-descripcion" class="swal2-textarea sanroman-alert-field"></textarea>
      `,
      showCancelButton: true,
      confirmButtonText: 'Completar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      didOpen: () => {
        document.getElementById('taller-costo').value = Number(item.costo || 0)
        document.getElementById('taller-descripcion').value = item.descripcion || ''
      },
      preConfirm: () => ({
        costo: document.getElementById('taller-costo').value,
        descripcion: document.getElementById('taller-descripcion').value,
      }),
    })
    if (!result.isConfirmed) return
    try {
      await api.patch(`/taller/${item.id}/completar`, result.value)
      setRefreshKey((value) => value + 1)
      await notifySuccess('Trabajo completado', 'La unidad fue actualizada correctamente.')
      onDone()
    } catch (err) {
      await notifyError(err.response?.data?.mensaje || 'No se pudo completar el trabajo.')
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <Metric title="Trabajos activos" value={data.activos} icon={Wrench} tone="amber" />
        <Metric title="Unidades fuera de servicio" value={camiones.filter((camion) => camion.estado === 'EN_TALLER').length} icon={Truck} tone="neutral" />
        <Metric title="Registros encontrados" value={data.total} icon={ClipboardList} tone="blue" />
      </section>

      <section className="rounded-md border border-neutral-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-neutral-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <SectionTitle title="Control de taller" subtitle="Reparaciones y mantenimientos de la flota" />
          <button onClick={() => setOpen((value) => !value)} className="btn-primary">
            <Plus size={16} />
            Registrar ingreso
          </button>
        </div>

        {open && (
          <form onSubmit={submit} className="grid gap-3 border-b border-neutral-100 bg-neutral-50 p-4 md:grid-cols-3">
            <Field label="Unidad">
              <select required value={form.camionId} onChange={(event) => setForm({ ...form, camionId: event.target.value })} className="input">
                <option value="">Seleccionar</option>
                {camiones.map((camion) => <option key={camion.id} value={camion.id}>{vehicleLabel(camion)}</option>)}
              </select>
            </Field>
            <Field label="Tipo de trabajo">
              <select value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value })} className="input">
                <option value="REPARACION">Reparacion</option>
                <option value="CAMBIO_ACEITE">Cambio de aceite</option>
                <option value="CAUCHOS">Cauchos</option>
                <option value="FRENOS">Frenos</option>
                <option value="BATERIA">Bateria</option>
                <option value="REVISION">Revision</option>
                <option value="OTRO">Otro</option>
              </select>
            </Field>
            <Field label="Fecha de ingreso">
              <input required type="date" value={form.fechaIngreso} onChange={(event) => setForm({ ...form, fechaIngreso: event.target.value })} className="input" />
            </Field>
            <Field label="Falla o trabajo">
              <input required value={form.falla} onChange={(event) => setForm({ ...form, falla: event.target.value })} className="input" placeholder="Ej. fuga de aceite" />
            </Field>
            <Field label="Kilometraje">
              <input type="number" min="0" value={form.kilometraje} onChange={(event) => setForm({ ...form, kilometraje: event.target.value })} className="input" placeholder="Opcional" />
            </Field>
            <Field label="Costo estimado">
              <input type="number" min="0" step="0.01" value={form.costo} onChange={(event) => setForm({ ...form, costo: event.target.value })} className="input" placeholder="0.00" />
            </Field>
            <div className="md:col-span-3">
              <Field label="Descripcion">
                <input value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} className="input" placeholder="Detalles, repuestos o diagnostico" />
              </Field>
            </div>
            {error && <p className="text-sm text-red-600 md:col-span-3">{error}</p>}
            <button className="btn-primary md:col-span-3">
              <Check size={16} />
              Guardar ingreso
            </button>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle title="Historial de unidades" subtitle={`${data.total} registros`} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <select value={estado} onChange={(event) => { setEstado(event.target.value); setPage(1) }} className="input sm:w-44">
              <option value="TODOS">Todos los estados</option>
              <option value="EN_PROCESO">En proceso</option>
              <option value="COMPLETADO">Completados</option>
            </select>
            <select value={camionId} onChange={(event) => { setCamionId(event.target.value); setPage(1) }} className="input sm:w-56">
              <option value="">Toda la flota</option>
              {camiones.map((camion) => <option key={camion.id} value={camion.id}>{vehicleLabel(camion)}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          {data.items.map((item) => (
            <div key={item.id} className="grid gap-3 border-b border-neutral-100 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_150px_150px_130px_auto] md:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{vehicleLabel(item.camion)}</p>
                <p className="truncate text-sm text-neutral-700">{labelMantenimiento(item.tipo)}: {item.falla}</p>
                <p className="mt-1 truncate text-xs text-neutral-500">{item.descripcion || 'Sin detalles adicionales'}</p>
              </div>
              <div>
                <p className="text-sm font-medium">{formatDate(item.fechaIngreso)}</p>
                <p className="text-xs text-neutral-500">Ingreso</p>
              </div>
              <div>
                <p className="text-sm font-medium">{item.kilometraje ? `${item.kilometraje.toLocaleString()} km` : 'Sin registro'}</p>
                <p className="text-xs text-neutral-500">Kilometraje</p>
              </div>
              <div>
                <p className="text-sm font-semibold">{money(item.costo)}</p>
                <p className="text-xs text-neutral-500">{item.estado === 'EN_PROCESO' ? 'Estimado' : 'Costo final'}</p>
              </div>
              {item.estado === 'EN_PROCESO' ? (
                <button onClick={() => completar(item)} className="btn-secondary">
                  <Check size={16} />
                  Completar
                </button>
              ) : (
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-center text-xs font-medium text-emerald-700">COMPLETADO</span>
              )}
            </div>
          ))}
          {!loading && data.items.length === 0 && <Empty text="Sin registros de taller." />}
          {loading && <Empty text="Cargando historial..." />}
        </div>
        <Pagination page={page} total={data.total} pageSize={data.pageSize} onChange={setPage} />
      </section>
    </div>
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
  useClampPage(page, filtrados.length, pageSize, setPage)

  const editarHonorarios = async (viaje) => {
    const result = await requestNumber(`Honorarios para ${viaje.chofer?.nombre}`, Number(viaje.honorariosChofer || 0))
    if (!result.isConfirmed) return
    try {
      await api.patch(`/viajes/${viaje.id}/honorarios`, { honorariosChofer: Number(result.value) })
      await notifySuccess('Honorarios actualizados')
      onDone()
    } catch (err) {
      await notifyError(err.response?.data?.mensaje || 'No se pudieron actualizar los honorarios.')
    }
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
        formatTripUnits(viaje),
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
    await notifySuccess('PDF generado', 'El resumen de liquidaciones fue descargado.')
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

function ViajeDrawer({ viaje, isAdmin, onClose, onDone }) {
  const [saving, setSaving] = useState('')
  const [gastoForm, setGastoForm] = useState({ tipo: 'PEAJE', monto: '', descripcion: '' })
  const [showGastoForm, setShowGastoForm] = useState(false)
  const [reportPage, setReportPage] = useState(1)
  const [noveltyPage, setNoveltyPage] = useState(1)
  const [expensePage, setExpensePage] = useState(1)
  const [showLiquidarModal, setShowLiquidarModal] = useState(false)
  const [numeroGuia, setNumeroGuia] = useState(viaje.numeroGuia || '')
  const [cierreForm, setCierreForm] = useState({ odometroFinal: viaje.odometroFinal || '', combustibleFinal: viaje.combustibleFinal || '' })
  const detailPageSize = 8
  const tramos = groupByTramo(viaje.paradas || [])
  const totalGastado = (viaje.gastos || []).reduce((total, gasto) => total + Number(gasto.monto), 0)
  const ultimaUbicacion = getCurrentLocationDetails(viaje)
  const novedades = (viaje.reportes || []).filter((reporte) => reporte.tipoReporte === 'NOVEDAD')
  const reportesOperativos = (viaje.reportes || []).filter((reporte) => reporte.tipoReporte !== 'NOVEDAD')
  useClampPage(reportPage, reportesOperativos.length, detailPageSize, setReportPage)
  useClampPage(noveltyPage, novedades.length, detailPageSize, setNoveltyPage)
  useClampPage(expensePage, viaje.gastos?.length || 0, detailPageSize, setExpensePage)

  const recargar = async () => {
    const result = await requestNumber('Recargar viaticos')
    if (!result.isConfirmed) return
    setSaving('recarga')
    try {
      await api.patch(`/viajes/${viaje.id}/recarga`, { monto: Number(result.value) })
      await notifySuccess('Viaticos recargados')
      onDone()
    } catch (err) {
      await notifyError(err.response?.data?.mensaje || 'No se pudieron recargar los viaticos.')
    } finally {
      setSaving('')
    }
  }

  const ejecutarCierre = async (soloLogistica, guia = viaje.numeroGuia) => {
    setSaving(soloLogistica ? 'cerrar' : 'liquidar')
    try {
      const response = await api.post(`/viajes/${viaje.id}/cerrar`, {
        soloLogistica,
        numeroGuia: guia?.trim() || null,
        odometroFinal: cierreForm.odometroFinal || null,
        combustibleFinal: cierreForm.combustibleFinal || null,
      })
      const actualizado = response.data?.data
      if (!soloLogistica && actualizado?.estadoFinanciero !== 'LIQUIDADO') {
        throw new Error('El viaje no cambio a estado liquidado.')
      }
      setShowLiquidarModal(false)
      await notifySuccess(soloLogistica ? 'Logistica completada' : 'Viaje liquidado')
      onDone()
      onClose()
    } catch (err) {
      await notifyError(err.response?.data?.mensaje || err.message || 'No se pudo cerrar el viaje.')
    } finally {
      setSaving('')
    }
  }

  const cerrar = async (soloLogistica) => {
    if (!soloLogistica) {
      setShowLiquidarModal(true)
      return
    }
    const result = await confirmAction(
      'Completar solo la logistica',
      'El viaje seguira apareciendo como pendiente de liquidacion hasta registrar su cierre financiero.',
      'Completar logistica'
    )
    if (!result.isConfirmed) return
    await ejecutarCierre(true)
  }

  const cambiarEstadoParada = async (paradaId, estado) => {
    setSaving(paradaId)
    try {
      await api.patch(`/viajes/${viaje.id}/paradas/${paradaId}`, { estado })
      await notifySuccess('Parada actualizada')
      onDone()
    } catch (err) {
      await notifyError(err.response?.data?.mensaje || 'No se pudo actualizar la parada.')
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
      await notifySuccess('Gasto registrado')
      onDone()
    } catch (err) {
      await notifyError(err.response?.data?.mensaje || 'No se pudo registrar el gasto.')
    } finally {
      setSaving('')
    }
  }

  const eliminarGasto = async (gastoId) => {
    const result = await confirmAction('Eliminar gasto', 'Esta accion retirara el gasto del balance del viaje.', 'Eliminar')
    if (!result.isConfirmed) return
    setSaving(gastoId)
    try {
      await api.delete(`/gastos/${gastoId}`)
      await notifySuccess('Gasto eliminado')
      onDone()
    } catch (err) {
      await notifyError(err.response?.data?.mensaje || 'No se pudo eliminar el gasto.')
    } finally {
      setSaving('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex h-screen min-h-[100svh] justify-end">
      <button className="absolute inset-0 bg-neutral-950/30" onClick={onClose} />
      <aside className="relative h-screen min-h-[100svh] w-full max-w-3xl overflow-y-auto bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium text-neutral-500">{formatStatus(viaje.estadoLogistico)} · {formatStatus(viaje.estadoFinanciero)}</p>
            <h2 className="truncate text-xl font-semibold">{viaje.codigo}</h2>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-md hover:bg-neutral-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 px-4 py-5 sm:px-6">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Fact icon={User} label="Chofer" value={viaje.chofer?.nombre || 'Sin chofer'} />
            <Fact icon={Truck} label="Unidades" value={formatTripUnits(viaje) || 'Sin unidades'} />
            <Fact icon={MapPin} label="Ultima ubicacion" value={<LocationValue data={ultimaUbicacion} />} />
            <Fact icon={Banknote} label="Disponible" value={money(balance(viaje))} />
          </section>
          {viaje.numeroGuia && <Banner tone="neutral" icon={FileCheck} text={`Guia entregada: ${viaje.numeroGuia}`} />}

          <GpsMap truckId={viaje.camionId} />

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
                        {parada.fechaProgramada && (
                          <p className="mt-1 text-xs font-medium text-blue-700">Carga programada: {formatDate(parada.fechaProgramada)}</p>
                        )}
                        {parada.cargarAlDescargar && (
                          <p className="mt-1 text-xs font-medium text-amber-700">Carga: al descargar el viaje anterior</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {['PENDIENTE', 'EN_CURSO', 'COMPLETADA'].map((estado) => (
                          <button
                            key={estado}
                            onClick={() => cambiarEstadoParada(parada.id, estado)}
                            disabled={Boolean(saving) || parada.estado === estado}
                            className={`rounded-md border px-2 py-1 text-xs font-medium ${parada.estado === estado ? paradaStyles[estado] : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50'}`}
                          >
                            {formatStatus(estado)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>

          {isAdmin && (
            <section className="grid gap-3 sm:grid-cols-3">
              <Fact icon={Wallet} label="Viaticos depositados" value={money(viaje.viaticosDepositados)} />
              <Fact icon={Banknote} label="Gastos acumulados" value={money(totalGastado)} />
              <Fact icon={Check} label="Disponible" value={money(balance(viaje))} />
              <Fact icon={Truck} label="Km inicial" value={viaje.odometroInicial ?? 'Sin registro'} />
              <Fact icon={Truck} label="Km final" value={viaje.odometroFinal ?? 'Sin registro'} />
              <Fact icon={Wallet} label="Combustible" value={`${viaje.combustibleInicial ?? 'S/R'} -> ${viaje.combustibleFinal ?? 'S/R'}`} />
            </section>
          )}

          <section className={`grid gap-5 ${isAdmin ? 'xl:grid-cols-2' : ''}`}>
            {isAdmin && <div className="space-y-3">
              <SectionTitle title="Novedades" subtitle={`${novedades.length} registros`} />
              <div className="rounded-md border border-amber-200 bg-amber-50/40">
                {paginate(novedades, noveltyPage, detailPageSize).map((reporte) => <ReportRow key={reporte.id} reporte={reporte} />)}
                {novedades.length === 0 && <Empty text="Sin novedades registradas." />}
              </div>
              <Pagination page={noveltyPage} total={novedades.length} pageSize={detailPageSize} onChange={setNoveltyPage} />

              <SectionTitle title="Reportes" subtitle={`${reportesOperativos.length} mensajes`} />
              <div className="rounded-md border border-neutral-200">
                {paginate(reportesOperativos, reportPage, detailPageSize).map((reporte) => <ReportRow key={reporte.id} reporte={reporte} />)}
                {reportesOperativos.length === 0 && <Empty text="Sin reportes." />}
              </div>
              <Pagination page={reportPage} total={reportesOperativos.length} pageSize={detailPageSize} onChange={setReportPage} />
            </div>}

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
            {isAdmin && (
              <button onClick={recargar} disabled={Boolean(saving)} className="btn-secondary">
                <Wallet size={16} />
                Recargar viaticos
              </button>
            )}
            {viaje.estadoLogistico !== 'COMPLETADO' && (
              <button onClick={() => cerrar(true)} disabled={Boolean(saving)} className="btn-secondary">
                <FileCheck size={16} />
                Solo completar logistica
              </button>
            )}
            {isAdmin && viaje.estadoFinanciero !== 'LIQUIDADO' && (
              <button onClick={() => cerrar(false)} disabled={Boolean(saving)} className="btn-primary">
                <Check size={16} />
                Liquidar
              </button>
            )}
          </section>
        </div>
      </aside>

      {isAdmin && showLiquidarModal && (
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
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Km final (opcional)">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={cierreForm.odometroFinal}
                  onChange={(event) => setCierreForm({ ...cierreForm, odometroFinal: event.target.value })}
                  className="input"
                  placeholder="Odometro final"
                />
              </Field>
              <Field label="Combustible final (opcional)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cierreForm.combustibleFinal}
                  onChange={(event) => setCierreForm({ ...cierreForm, combustibleFinal: event.target.value })}
                  className="input"
                  placeholder="Litros o nivel"
                />
              </Field>
            </div>
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
      const usuario = res.data?.data?.usuario
      if (!usuario) throw new Error('Usuario no recibido')
      await notifySuccess('Bienvenido', 'Sesion iniciada correctamente.')
      onLogin(usuario)
    } catch {
      setError('Credenciales invalidas.')
      await notifyError('Correo o clave incorrectos.')
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
  const titulo = formatReportTitle(reporte)
  const chofer = reporte.chofer?.nombre || reporte.viaje?.chofer?.nombre || ''
  const viaje = reporte.viaje?.codigo || ''
  const contexto = [chofer, viaje].filter(Boolean).join(' · ')

  return (
    <div className="border-b border-neutral-100 px-4 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{titulo}</p>
          {contexto && <p className="mt-1 truncate text-xs text-neutral-500">{contexto}</p>}
          {reporte.ubicacion && <p className="mt-1 truncate text-xs text-neutral-400">{reporte.ubicacion}</p>}
          {!compact && !reporte.ubicacion && <p className="mt-1 text-xs text-neutral-500">Sin ubicacion</p>}
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
      <div className="min-w-0 text-sm font-semibold">{value}</div>
    </div>
  )
}

function LocationValue({ data }) {
  const gps = data?.gps || ''
  const reporte = data?.reporte || ''
  const fallback = data?.fallback || 'Sin ubicacion'

  return (
    <div className="space-y-1">
      <p className="truncate">{gps || fallback}</p>
      {reporte && <p className="truncate text-xs font-medium text-neutral-500">{reporte}</p>}
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
      ...(viaje.unidades || []).flatMap((unidad) => [unidad.camion?.placa, unidad.camion?.tipoVehiculo, unidad.camion?.marcaModelo]),
      viaje.camion?.ubicacionActual,
      formatGpsLocation(viaje.camion?.posicionGps),
      formatRoute(viaje),
      ...(viaje.reportes || []).flatMap((reporte) => [reporte.mensajeOriginal, formatReportTitle(reporte), reporte.chofer?.nombre]),
    ]
      .some((value) => normalize(value).includes(q))
  })

  const activos = filteredViajes.filter((viaje) => viaje.estadoLogistico === 'EN_CURSO')
  const pendientesLiquidacion = filteredViajes.filter((viaje) => viaje.estadoLogistico === 'COMPLETADO' && viaje.estadoFinanciero === 'PENDIENTE')
  const completados = filteredViajes.filter((viaje) => viaje.estadoLogistico === 'COMPLETADO')
  const liquidados = filteredViajes.filter((viaje) => viaje.estadoFinanciero === 'LIQUIDADO')
  const esperando = activos.filter((viaje) => viaje.reportes?.some((reporte) => reporte.tipoReporte === 'ESPERANDO_INSTRUCCIONES'))

  const choferesOcupados = new Set(activos.map((viaje) => viaje.choferId))
  const camionesOcupados = new Set(activos.flatMap((viaje) => tripUnitIds(viaje)))

  const choferesRecursos = choferes.map((chofer) => ({
    ...chofer,
    estadoCalculado: chofer.estado,
  })).filter((chofer) =>
    !q || [chofer.nombre, chofer.cedula, chofer.telefono, chofer.estado, chofer.ubicacionActual]
      .some((value) => normalize(value).includes(q))
  )

  const camionesRecursos = camiones.map((camion) => ({
    ...camion,
    estadoCalculado: camion.estado,
    ubicacionActual:
      formatGpsLocation(camion.posicionGps) ||
      activos.find((viaje) => tripUnitIds(viaje).includes(camion.id))?.chofer?.ubicacionActual ||
      camion.ubicacionActual,
  })).filter((camion) =>
    !q || [
      camion.placa,
      camion.placaFurgon,
      camion.placaChuto,
      camion.gpsImei,
      camion.tipoVehiculo,
      camion.marcaModelo,
      camion.estado,
      camion.ubicacionActual,
    ].some((value) => normalize(value).includes(q))
  )
  const choferesOperativos = choferesRecursos.filter((chofer) => chofer.activo)
  const camionesOperativos = camionesRecursos.filter((camion) => camion.activo)

  return {
    activos,
    pendientesLiquidacion,
    completados,
    liquidados,
    esperando,
    choferesRecursos,
    camionesRecursos,
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

function getCurrentLocationDetails(viaje) {
  const ultimoReporte = viaje.reportes?.[0] || null
  return {
    gps: formatGpsLocation(viaje.camion?.posicionGps) || coordsFromText(viaje.camion?.ubicacionActual),
    reporte: ultimoReporte ? formatLastReportLocation(ultimoReporte) : '',
    fallback: viaje.chofer?.ubicacionActual || viaje.camion?.ubicacionActual || 'Sin ubicacion',
  }
}

const quickReportLabels = {
  '1': 'Cargando',
  '2': 'Lista la carga',
  '3': 'Descargando',
  '4': 'Lista la descarga',
  '5': 'En pernocta',
  '6': 'Esperando instrucciones',
  '7': 'Novedad',
}

function formatReportTitle(reporte) {
  const mensaje = String(reporte.mensajeOriginal || '').trim()
  if (quickReportLabels[mensaje]) return quickReportLabels[mensaje]
  if (mensaje) return mensaje
  return labelReporte(reporte.tipoReporte) || 'Reporte'
}

function formatLastReportLocation(reporte) {
  const ubicacion = reporte.ubicacion || ''
  const texto = formatReportTitle(reporte)
  if (ubicacion) return `${labelReporte(reporte.tipoReporte)} · ${ubicacion}`
  return `${labelReporte(reporte.tipoReporte)} · ${texto || 'Sin detalle'}`
}

function coordsFromText(value = '') {
  const match = String(value).match(/-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?/)
  return match ? match[0] : ''
}

function formatGpsLocation(position) {
  if (position?.latitude === undefined || position?.latitude === null || position?.longitude === undefined || position?.longitude === null) return ''
  return `${Number(position.latitude).toFixed(6)}, ${Number(position.longitude).toFixed(6)}`
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
  return `${formatStatus(camion.tipoVehiculo || 'NPR')} ${camion.placa || ''}`.trim()
}

function tripUnitIds(viaje) {
  const ids = (viaje.unidades || []).map((unidad) => unidad.camion?.id || unidad.camionId).filter(Boolean)
  return ids.length > 0 ? ids : [viaje.camionId].filter(Boolean)
}

function sameIdSet(a = [], b = []) {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}

function formatTripUnits(viaje) {
  const unidades = (viaje.unidades || []).map((unidad) => vehicleLabel(unidad.camion)).filter(Boolean)
  return unidades.length > 0 ? unidades.join(' + ') : vehicleLabel(viaje.camion || {})
}

function formatAssignedUnits(chofer) {
  const unidades = (chofer.unidadesAsignadas || []).map((asignacion) => vehicleLabel(asignacion.camion)).filter(Boolean)
  return unidades.length > 0 ? unidades.join(' / ') : 'Sin unidades asignadas'
}

function buildAssignedUnitsMap(choferes) {
  const map = new Map()
  choferes.forEach((chofer) => {
    ;(chofer.unidadesAsignadas || []).forEach((asignacion) => {
      if (asignacion.camion?.id) {
        map.set(asignacion.camion.id, { choferId: chofer.id, nombre: chofer.nombre })
      }
    })
  })
  return map
}

function formatUnitDrivers(camion) {
  const choferes = (camion.choferesAsignados || []).map((asignacion) => asignacion.chofer?.nombre).filter(Boolean)
  return choferes.length > 0 ? choferes.join(' / ') : 'Sin chofer asignado'
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

function formatStatus(value) {
  return value ? String(value).replace(/_/g, ' ') : ''
}

function labelReporte(tipo) {
  const labels = {
    ESPERANDO_INSTRUCCIONES: 'Esperando',
    EN_PERNOCTA: 'Pernocta',
    EN_RUTA: 'En ruta',
    NOVEDAD: 'Novedad',
  }
  return labels[tipo] || formatStatus(tipo)
}

function pageTitle(tab) {
  const titles = {
    monitor: 'Resumen',
    viajes: 'Viajes',
    despacho: 'Agendamiento',
    recursos: 'Recursos',
    taller: 'Taller',
    liquidaciones: 'Liquidaciones',
  }
  return titles[tab] || 'Panel'
}

function labelMantenimiento(tipo) {
  const labels = {
    REPARACION: 'Reparacion',
    CAMBIO_ACEITE: 'Cambio de aceite',
    CAUCHOS: 'Cauchos',
    FRENOS: 'Frenos',
    BATERIA: 'Bateria',
    REVISION: 'Revision',
    OTRO: 'Otro',
  }
  return labels[tipo] || tipo
}

function Pagination({ page, total, pageSize, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const safePage = Math.min(Math.max(1, page), pages)
  const from = (safePage - 1) * pageSize + 1
  const to = Math.min(total, safePage * pageSize)

  return (
    <div className="flex flex-col gap-3 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
      <span>Mostrando {from}-{to} de {total} registros · Pagina {safePage} de {pages}</span>
      <div className="flex flex-wrap gap-2">
        <button disabled={safePage <= 1} onClick={() => onChange(1)} className="btn-secondary h-8 px-3">Primera</button>
        <button disabled={safePage <= 1} onClick={() => onChange(safePage - 1)} className="btn-secondary h-8 px-3">Anterior</button>
        <button disabled={safePage >= pages} onClick={() => onChange(safePage + 1)} className="btn-secondary h-8 px-3">Siguiente</button>
        <button disabled={safePage >= pages} onClick={() => onChange(pages)} className="btn-secondary h-8 px-3">Ultima</button>
      </div>
    </div>
  )
}

function useClampPage(page, total, pageSize, setPage) {
  useEffect(() => {
    const pages = Math.max(1, Math.ceil(total / pageSize))
    if (page > pages) setPage(pages)
    if (page < 1) setPage(1)
  }, [page, total, pageSize, setPage])
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
    return
  }
}

function normalize(value = '') {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}
