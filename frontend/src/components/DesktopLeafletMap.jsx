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

export default function DesktopLeafletMap({ position, truckId }) {
  const center = position ? [position.latitude, position.longitude] : defaultCenter

  return (
    <div className="h-[320px] min-h-[320px]">
      <MapContainer key={`${truckId}-${position?.updatedAt || 'empty'}`} center={center} zoom={position ? 14 : 7} scrollWheelZoom={false} className="h-full w-full">
        <ResizeMap position={position} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {position && (
          <>
            <FlyToPosition position={position} />
            <Marker position={[position.latitude, position.longitude]} icon={truckIcon}>
              <Popup>
                <div>
                  <strong>Ultima posicion</strong>
                  <br />
                  Velocidad: {position.speed.toFixed(1)}
                  <br />
                  Motor: {position.engineStatus || 'Sin dato'}
                </div>
              </Popup>
            </Marker>
          </>
        )}
      </MapContainer>
    </div>
  )
}
