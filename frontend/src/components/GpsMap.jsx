import { Component, useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { api } from '../lib/api'

const defaultCenter = [10.0678, -69.3474]

const truckIcon = L.divIcon({
  className: '',
  html: '<div class="gps-marker"><div></div></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

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

function FlyToPosition({ position }) {
  const map = useMap()

  useEffect(() => {
    if (!position) return
    map.flyTo([position.latitude, position.longitude], Math.max(map.getZoom(), 13), {
      animate: true,
      duration: 0.8,
    })
  }, [map, position])

  return null
}

function ResizeMap({ position }) {
  const map = useMap()

  useEffect(() => {
    const invalidate = () => map.invalidateSize()
    const timers = [120, 350, 800].map((delay) => setTimeout(invalidate, delay))
    window.addEventListener('resize', invalidate)
    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('resize', invalidate)
    }
  }, [map])

  useEffect(() => {
    map.invalidateSize()
  }, [map, position])

  return null
}

const normalizePosition = (row) => {
  if (!row) return null
  const latitude = Number(row.latitude)
  const longitude = Number(row.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return {
    truckId: row.truck_id || row.truckId,
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

export default function GpsMap({ truckId }) {
  const [position, setPosition] = useState(null)
  const [status, setStatus] = useState('idle')
  const [mobileMap, setMobileMap] = useState(() => isMobileViewport())
  const currentPosition = position?.truckId === truckId ? position : null
  const center = useMemo(
    () => (currentPosition ? [currentPosition.latitude, currentPosition.longitude] : defaultCenter),
    [currentPosition]
  )

  useEffect(() => {
    const updateMode = () => setMobileMap(isMobileViewport())
    updateMode()
    window.addEventListener('resize', updateMode)
    return () => window.removeEventListener('resize', updateMode)
  }, [])

  useEffect(() => {
    if (!truckId) return undefined
    let active = true

    api.get(`/gps/trucks/${truckId}/position`)
      .then(({ data }) => {
        if (!active) return
        const row = data?.data || null
        setPosition(normalizePosition(row))
        setStatus(row ? 'online' : 'empty')
      })
      .catch(() => {
        if (active) setStatus('error')
      })

    if (!supabaseConfigured) {
      const interval = setInterval(() => {
        api.get(`/gps/trucks/${truckId}/position`)
          .then(({ data }) => {
            if (!active) return
            const row = data?.data || null
            setPosition(normalizePosition(row))
            setStatus(row ? 'online' : 'empty')
          })
          .catch(() => {
            if (active) setStatus('error')
          })
      }, 30000)

      return () => {
        active = false
        clearInterval(interval)
      }
    }

    const channel = supabase
      .channel(`truck-position-${truckId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'truck_positions',
          filter: `truck_id=eq.${truckId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setPosition(null)
            setStatus('empty')
            return
          }
          setPosition(normalizePosition(payload.new))
          setStatus('online')
        }
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === 'CHANNEL_ERROR') setStatus('error')
      })

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [truckId])

  if (!truckId) return <MapState text="Unidad no asignada." />

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
      <div>
        <p className="text-sm font-semibold">Rastreo satelital</p>
        <p className="text-xs text-neutral-500">
            {currentPosition ? `${currentPosition.latitude.toFixed(6)}, ${currentPosition.longitude.toFixed(6)}` : 'Sin posicion recibida'}
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
          <div className="h-[320px] min-h-[320px]">
            <MapContainer key={`${truckId}-${currentPosition?.updatedAt || 'empty'}`} center={center} zoom={currentPosition ? 14 : 7} scrollWheelZoom={false} className="h-full w-full">
              <ResizeMap position={currentPosition} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {currentPosition && (
                <>
                  <FlyToPosition position={currentPosition} />
                  <Marker position={[currentPosition.latitude, currentPosition.longitude]} icon={truckIcon}>
                    <Popup>
                      <div>
                        <strong>Ultima posicion</strong>
                        <br />
                        Velocidad: {currentPosition.speed.toFixed(1)}
                        <br />
                        Motor: {currentPosition.engineStatus || 'Sin dato'}
                      </div>
                    </Popup>
                  </Marker>
                </>
              )}
            </MapContainer>
          </div>
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
        <p className="text-sm font-semibold">Ubicacion recibida</p>
        <p className="mt-1 text-xs text-neutral-500">{position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}</p>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-9 items-center rounded-md bg-neutral-950 px-3 text-sm font-medium text-white">
          Abrir en Mapas
        </a>
      </div>
    </div>
  )
}

function MapState({ text }) {
  return (
    <div className="grid min-h-52 place-items-center rounded-md border border-neutral-200 bg-white px-4 text-center text-sm text-neutral-500">
      {text}
    </div>
  )
}
