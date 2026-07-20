import { Component, Suspense, lazy, useEffect, useState } from 'react'
import { api } from '../lib/api'

const DesktopLeafletMap = lazy(() => import('./DesktopLeafletMap.jsx'))

class MapErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

const normalizePosition = (row) => {
  if (!row) return null
  const latitude = Number(row.latitude)
  const longitude = Number(row.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return {
    truckId: row.truck_id || row.truckId,
    label: row.label || null,
    latitude,
    longitude,
    speed: Number(row.speed || 0),
    engineStatus: row.engine_status || row.engineStatus || null,
    updatedAt: row.updated_at || row.updatedAt,
  }
}

const isMobileViewport = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 767px), (pointer: coarse)').matches
}

const osmEmbedUrl = (position) => {
  const delta = 0.006
  const minLon = position.longitude - delta
  const minLat = position.latitude - delta
  const maxLon = position.longitude + delta
  const maxLat = position.latitude + delta
  const bbox = [minLon, minLat, maxLon, maxLat].map((value) => value.toFixed(6)).join('%2C')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${position.latitude.toFixed(6)}%2C${position.longitude.toFixed(6)}`
}

export default function GpsMap({ truckId, truckIds = [], initialPositions = [] }) {
  const ids = [...new Set((truckIds.length > 0 ? truckIds : [truckId]).filter(Boolean))]
  const labelsByTruck = new Map(initialPositions.map((position) => [position.truckId || position.truck_id, position.label]).filter(([id]) => Boolean(id)))
  const [positions, setPositions] = useState(() => initialPositions.map(normalizePosition).filter(Boolean))
  const [status, setStatus] = useState('idle')
  const [mobileMap, setMobileMap] = useState(() => isMobileViewport())
  const currentPositions = positions
    .filter((position) => ids.includes(position.truckId))
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
  const currentPosition = currentPositions[0] || null

  useEffect(() => {
    const updateMode = () => setMobileMap(isMobileViewport())
    updateMode()
    window.addEventListener('resize', updateMode)
    return () => window.removeEventListener('resize', updateMode)
  }, [])

  useEffect(() => {
    if (ids.length === 0) return undefined
    let active = true
    const loadPosition = () => {
      Promise.all(ids.map((id) =>
        api.get(`/gps/trucks/${id}/position`)
          .then(({ data }) => normalizePosition(data?.data || null))
          .catch(() => null)
      ))
        .then((rows) => {
          if (!active) return
          const nextPositions = rows
            .filter(Boolean)
            .map((position) => ({ ...position, label: position.label || labelsByTruck.get(position.truckId) || null }))
          setPositions(nextPositions)
          setStatus(nextPositions.length > 0 ? 'online' : 'empty')
        })
        .catch(() => {
          if (active) setStatus('error')
        })
    }

    loadPosition()
    const interval = setInterval(loadPosition, 15000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [ids.join('|')])

  if (ids.length === 0) return <MapState text="Unidad no asignada." />

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
      <div>
        <p className="text-sm font-medium">Rastreo satelital</p>
        <p className="text-xs text-neutral-500">
            {currentPosition ? `${currentPosition.latitude.toFixed(6)}, ${currentPosition.longitude.toFixed(6)}${currentPositions.length > 1 ? ` · ${currentPositions.length} unidades` : ''}` : 'Sin posicion recibida'}
        </p>
      </div>
      <span className={`rounded-md px-2 py-1 text-xs font-medium ${status === 'online' ? 'bg-emerald-50 text-emerald-700' : status === 'error' ? 'bg-red-50 text-red-700' : 'bg-neutral-100 text-neutral-600'}`}>
          {currentPosition && status === 'online' ? 'EN VIVO' : status === 'error' ? 'ERROR' : 'SIN SENAL'}
      </span>
      </div>
      {mobileMap ? (
        <MobileMap position={currentPosition} />
      ) : (
        <MapErrorBoundary fallback={<PositionFallback position={currentPosition} />}>
          <Suspense fallback={<MapState text="Cargando mapa." />}>
            <DesktopLeafletMap position={currentPosition} positions={currentPositions} truckId={ids.join('-')} />
          </Suspense>
        </MapErrorBoundary>
      )}
    </div>
  )
}

function MobileMap({ position }) {
  if (!position) return <MapState text="Sin posicion recibida." />

  return (
    <div>
      <iframe
        title="Mapa GPS"
        src={osmEmbedUrl(position)}
        className="block h-[260px] min-h-[260px] w-full border-0"
        loading="lazy"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 px-4 py-3">
        <span className="text-xs text-neutral-500">Motor: {position.engineStatus || 'Sin dato'} · Velocidad: {position.speed.toFixed(1)}</span>
        <a href={`https://maps.apple.com/?ll=${position.latitude},${position.longitude}`} target="_blank" rel="noreferrer" className="rounded-md bg-neutral-950 px-3 py-2 text-xs font-medium text-white">
          Abrir en Mapas
        </a>
      </div>
    </div>
  )
}

function PositionFallback({ position }) {
  if (!position) return <MapState text="Sin posicion recibida." />
  const mapsUrl = `https://maps.apple.com/?ll=${position.latitude},${position.longitude}`

  return (
    <div className="grid min-h-[260px] place-items-center bg-neutral-50 px-4 text-center">
      <div>
        <p className="text-sm font-medium">Ubicacion recibida</p>
        <p className="mt-1 text-xs text-neutral-500">{position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}</p>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-9 items-center rounded-md bg-neutral-950 px-3 text-[13px] font-medium text-white">
          Abrir en Mapas
        </a>
      </div>
    </div>
  )
}

function MapState({ text }) {
  return (
    <div className="grid min-h-52 place-items-center rounded-md border border-neutral-200 bg-white px-4 text-center text-[13px] text-neutral-500">
      {text}
    </div>
  )
}
