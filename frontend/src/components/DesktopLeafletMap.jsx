import { useEffect } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const defaultCenter = [10.0678, -69.3474]

const truckIcon = L.divIcon({
  className: '',
  html: '<div class="gps-marker"><div></div></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

function FlyToPosition({ position, positions = [] }) {
  const map = useMap()

  useEffect(() => {
    if (positions.length > 1) {
      const bounds = L.latLngBounds(positions.map((item) => [item.latitude, item.longitude]))
      map.fitBounds(bounds.pad(0.25), { animate: true, duration: 0.8, maxZoom: 15 })
      return
    }
    if (!position) return
    map.flyTo([position.latitude, position.longitude], Math.max(map.getZoom(), 13), {
      animate: true,
      duration: 0.8,
    })
  }, [map, position, positions])

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

export default function DesktopLeafletMap({ position, positions = [], truckId }) {
  const center = position ? [position.latitude, position.longitude] : defaultCenter
  const visiblePositions = positions.length > 0 ? positions : (position ? [position] : [])

  return (
    <div className="h-[320px] min-h-[320px]">
      <MapContainer key={`${truckId}-${position?.updatedAt || 'empty'}`} center={center} zoom={position ? 14 : 7} scrollWheelZoom={false} className="h-full w-full">
        <ResizeMap position={position} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {visiblePositions.length > 0 && (
          <>
            <FlyToPosition position={position} positions={visiblePositions} />
            {visiblePositions.map((item) => (
              <Marker key={item.truckId} position={[item.latitude, item.longitude]} icon={truckIcon}>
                <Popup>
                  <div>
                    <strong>{item.label || 'Ultima posicion'}</strong>
                    <br />
                    Velocidad: {item.speed.toFixed(1)}
                    <br />
                    Motor: {item.engineStatus || 'Sin dato'}
                  </div>
                </Popup>
              </Marker>
            ))}
          </>
        )}
      </MapContainer>
    </div>
  )
}
