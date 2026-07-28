const choferPanelSelect = {
  id: true,
  nombre: true,
  cedula: true,
  telefono: true,
  estado: true,
  ubicacionActual: true,
  ultimoReporteAt: true,
  activo: true,
  unidadesAsignadas: {
    select: {
      camion: {
        select: {
          id: true,
          placa: true,
          tipoVehiculo: true,
          marcaModelo: true,
          estado: true
        }
      }
    }
  },
  createdAt: true,
  updatedAt: true
}

const camionPanelSelect = {
  id: true,
  placa: true,
  gpsImei: true,
  tipoVehiculo: true,
  placaFurgon: true,
  placaChuto: true,
  marcaModelo: true,
  estado: true,
  ubicacionActual: true,
  posicionGps: true,
  choferesAsignados: {
    select: {
      chofer: {
        select: {
          id: true,
          nombre: true
        }
      }
    }
  },
  motivoTaller: true,
  activo: true,
  createdAt: true,
  updatedAt: true
}

const reportePanelSelect = {
  id: true,
  viajeId: true,
  choferId: true,
  paradaId: true,
  mensajeOriginal: true,
  tipoReporte: true,
  ubicacion: true,
  createdAt: true
}

module.exports = { choferPanelSelect, camionPanelSelect, reportePanelSelect }
