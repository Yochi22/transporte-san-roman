import { ESTADOS_DOCUMENTO } from '../lib/documentos'

export function EstadoDocumentoBadge({ estado }) {
  const config = ESTADOS_DOCUMENTO[estado] || ESTADOS_DOCUMENTO.VIGENTE
  return <span className={`whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${config.clase}`}>{config.etiqueta}</span>
}

// Marca pequena junto al nombre o la placa: solo aparece si hay algo que atender.
export function MarcaVencimiento({ estado }) {
  if (!estado || !ESTADOS_DOCUMENTO[estado]) return null
  const titulo = estado === 'VENCIDO'
    ? 'Tiene documentos vencidos'
    : estado === 'POR_VENCER'
      ? 'Tiene documentos que vencen en 30 dias o menos'
      : 'Tiene documentos que vencen en 60 dias o menos'
  return <span title={titulo} aria-label={titulo} className={`inline-block h-2 w-2 shrink-0 rounded-full ${ESTADOS_DOCUMENTO[estado].punto}`} />
}
