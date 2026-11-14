// Tipos de documento admitidos. Se guardan como texto (no enum) para poder
// agregar tipos nuevos sin migracion. Hay un solo documento por tipo y dueno.
const TIPOS_CHOFER = {
  CEDULA: 'Cedula',
  LICENCIA: 'Licencia',
  CERTIFICADO_MEDICO: 'Certificado medico',
  RIF: 'RIF',
  CERTIFICADO_SALUD: 'Certificado de salud',
  OTRO: 'Otro',
}

const TIPOS_CAMION = {
  RCV: 'RCV / Seguro',
  TRIMESTRE: 'Trimestre',
  PERMISO_SANITARIO: 'Permiso sanitario',
  ROTC: 'ROTC',
  FUMIGACION: 'Fumigacion',
  CGT: 'CGT',
  IAC: 'IAC',
  PUBLICIDAD: 'Publicidad',
  OTRO: 'Otro',
}

// Mismo criterio de colores que la hoja de control de la oficina:
// rojo = vencido o a 30 dias o menos, amarillo = entre 31 y 60, verde = mas de 60.
const DIAS_POR_VENCER = 30
const DIAS_PROXIMO = 60

const etiquetaTipo = (tipo) => TIPOS_CHOFER[tipo] || TIPOS_CAMION[tipo] || tipo

module.exports = { TIPOS_CHOFER, TIPOS_CAMION, DIAS_POR_VENCER, DIAS_PROXIMO, etiquetaTipo }
