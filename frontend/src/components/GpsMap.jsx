import { useEffect, useMemo, useState } from 'react'
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

const normalizePosition = (row) => {
  if (!row) return null
  return {
    truckId: row.truck_id || row.truckId,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    speed: Number(row.speed || 0),
    engineStatus: row.engine_status || row.engineStatus || null,
    updatedAt: row.updated_at || row.updatedAt,
  }
}

export default function GpsMap({ truckId, height = 320 }) {
  const [position, setPosition] = useState(null)
  const [status, setStatus] = useState('idle')
  const currentPosition = position?.truckId === truckId ? position : null
  const center = useMemo(
    () => (currentPosition ? [currentPosition.latitude, currentPosition.longitude] : defaultCenter),
    [currentPosition]
  )

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
      <div style={{ height }}>
        <MapContainer center={center} zoom={currentPosition ? 14 : 7} scrollWheelZoom className="h-full w-full">
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
