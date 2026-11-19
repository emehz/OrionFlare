import type { Prenda, Talla } from './prendas'

/*
 * CONFIGURACIÓN DE PRECIOS — edita estos números cuando tengas los costos reales.
 *
 * Costos confirmados:
 *   - Camisa regular talla L: $4.50
 *   - Camisa oversize 2XL:    $8.25
 *   - DTF 60 × 100 cm:        $16.90
 * Todo lo marcado como ESTIMADO es una suposición y hay que confirmarlo con el proveedor.
 */

// Costo de la camisa lisa por tipo y talla (USD).
const COSTO_CAMISA: Record<string, Record<string, number>> = {
  // ESTIMADO salvo L
  unisex: { XS: 4.5, S: 4.5, M: 4.5, L: 4.5, XL: 4.75, '2XL': 5.25, '3XL': 5.75, '4XL': 6.25 },
  // ESTIMADO salvo 2XL
  oversize: { S: 7.25, M: 7.25, L: 7.5, XL: 7.75, '2XL': 8.25 },
}
const RECARGO_MANGA_LARGA = 2.0 // ESTIMADO
const DESCUENTO_SIN_MANGA = 0.25 // ESTIMADO
const COSTO_DAMA = 4.75 // ESTIMADO
const COSTO_CROP = 4.5 // ESTIMADO
const COSTO_INFANTIL = 3.5 // ESTIMADO

// DTF: se cobra por área usada, asumiendo que varios diseños comparten la misma hoja de 60 cm.
export const DTF = {
  anchoRollo: 60, // cm
  costoMetro: 16.9, // USD por 60 × 100 cm
  desperdicio: 1.15, // +15 % por márgenes entre diseños
}
const COSTO_CM2 = DTF.costoMetro / (DTF.anchoRollo * 100)

const PRENSADO_POR_LADO = 0.75 // energía, tiempo y papel de la plancha por cada lado estampado
const MARGEN = 1.6 // precio = costo × 1.6 (60 % sobre costo)
const REDONDEO = 0.5 // redondear hacia arriba a $0.50

export function costoCamisa(prenda: Prenda, talla: Talla) {
  switch (prenda.corte) {
    case 'oversize':
      return COSTO_CAMISA.oversize[talla.talla] ?? 8.25
    case 'dama':
      return COSTO_DAMA
    case 'crop':
      return COSTO_CROP
    case 'infantil':
      return COSTO_INFANTIL
    default: {
      const base = COSTO_CAMISA.unisex[talla.talla] ?? 4.5
      if (prenda.manga === 'larga') return base + RECARGO_MANGA_LARGA
      if (prenda.manga === 'sin') return base - DESCUENTO_SIN_MANGA
      return base
    }
  }
}

export interface LadoEstampado {
  anchoCm: number
  altoCm: number
}

export function costoDTF(lado: LadoEstampado) {
  return lado.anchoCm * lado.altoCm * COSTO_CM2 * DTF.desperdicio
}

export function calcularPrecio(prenda: Prenda, talla: Talla, lados: LadoEstampado[], cantidad = 1) {
  const camisa = costoCamisa(prenda, talla)
  const dtf = lados.reduce((s, l) => s + costoDTF(l), 0)
  const prensado = lados.length * PRENSADO_POR_LADO
  const costo = camisa + dtf + prensado
  const unitario = Math.ceil((costo * MARGEN) / REDONDEO) * REDONDEO
  return {
    costo, // solo para el dueño
    unitario,
    total: unitario * cantidad,
    detalle: { camisa, dtf, prensado },
  }
}

export const NOTA_ENVIO = 'El envío no está incluido: te confirmamos su costo por WhatsApp antes de que pagues.'

export const formatoUSD = (n: number) =>
  new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(n)
