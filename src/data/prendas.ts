// Tabla de tallas del proveedor (pulgadas).
// Ancho = de axila a axila con la camisa extendida. Largo = del punto más alto del hombro al borde.

export type Corte = 'regular' | 'oversize' | 'dama' | 'crop' | 'infantil'
export type Manga = 'corta' | 'larga' | 'sin'
export type Cuello = 'redondo' | 'v'

export interface Talla {
  talla: string
  ancho: number // pulgadas
  largo: number // pulgadas
}

export interface Prenda {
  id: string
  nombre: string
  corto: string // nombre corto para botones
  corte: Corte
  manga: Manga
  cuello: Cuello
  tallas: Talla[]
}

const t = (tallas: string[], anchos: number[], largos: number[]): Talla[] =>
  tallas.map((talla, i) => ({ talla, ancho: anchos[i], largo: largos[i] }))

const UNISEX = t(
  ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
  [16, 18, 20, 22, 24, 26, 28, 30],
  [24, 27, 28, 29, 30, 31, 32, 33],
)

export const PRENDAS: Prenda[] = [
  { id: 'unisex', nombre: 'Unisex manga corta', corto: 'Unisex', corte: 'regular', manga: 'corta', cuello: 'redondo', tallas: UNISEX },
  {
    id: 'oversize', nombre: 'Oversize', corto: 'Oversize', corte: 'oversize', manga: 'corta', cuello: 'redondo',
    tallas: t(['S', 'M', 'L', 'XL', '2XL'], [20, 22, 24, 26, 28], [26, 28, 29, 30, 31]),
  },
  { id: 'manga-larga', nombre: 'Unisex manga larga', corto: 'Manga larga', corte: 'regular', manga: 'larga', cuello: 'redondo', tallas: UNISEX },
  { id: 'sin-manga', nombre: 'Unisex sin manga', corto: 'Sin manga', corte: 'regular', manga: 'sin', cuello: 'redondo', tallas: UNISEX },
  {
    id: 'dama-redondo', nombre: 'Dama cuello redondo', corto: 'Dama', corte: 'dama', manga: 'corta', cuello: 'redondo',
    tallas: t(['XS', 'S', 'M', 'L', 'XL', '2XL'], [15.125, 17.125, 19.125, 21.125, 23.125, 25.125], [24.25, 25.25, 26.25, 27.25, 28.25, 29.25]),
  },
  {
    id: 'dama-v', nombre: 'Dama cuello V', corto: 'Dama V', corte: 'dama', manga: 'corta', cuello: 'v',
    tallas: t(['XS', 'S', 'M', 'L', 'XL', '2XL'], [15.125, 17.125, 19.125, 21.125, 23.125, 25.125], [24, 25, 26, 27, 28, 29]),
  },
  {
    id: 'crop', nombre: 'Crop top dama', corto: 'Crop top', corte: 'crop', manga: 'corta', cuello: 'redondo',
    tallas: t(['XS', 'S', 'M', 'L', 'XL'], [16, 18, 20, 22, 24], [15, 16, 17, 18, 20]),
  },
  {
    id: 'infantil', nombre: 'Infantil', corto: 'Niños', corte: 'infantil', manga: 'corta', cuello: 'redondo',
    tallas: t(['0', '2', '4', '6', '8', '10', '12'], [10.5, 12.5, 13.25, 13.75, 14.5, 15, 15.5], [14, 17, 18, 19, 20, 21, 22.5]),
  },
]

export const PULGADA = 2.54

export function medidasCm(talla: Talla) {
  // El ancho de la tabla es la mitad del contorno: el frente de la camisa mide eso.
  return { ancho: talla.ancho * PULGADA, largo: talla.largo * PULGADA }
}

/** Área máxima de estampado para una talla (cm). Basada en lo que ya se ha impreso: ~38 × 45 cm en oversize 2XL. */
export function areaMaxima(prenda: Prenda, talla: Talla) {
  const { ancho, largo } = medidasCm(talla)
  const factorAncho = prenda.corte === 'oversize' ? 0.54 : 0.6
  const factorAlto = prenda.corte === 'crop' ? 0.55 : 0.58
  return {
    ancho: Math.floor(Math.min(ancho * factorAncho, 38)),
    alto: Math.floor(Math.min(largo * factorAlto, 45)),
  }
}

export interface ColorPrenda {
  id: string
  nombre: string
  hex: string
  claro: boolean // para elegir la etiqueta blanca o negra
}

// Colores disponibles. Ajusta esta lista a lo que tenga tu proveedor.
export const COLORES: ColorPrenda[] = [
  { id: 'negro', nombre: 'Negro', hex: '#121214', claro: false },
  { id: 'blanco', nombre: 'Blanco', hex: '#f1efe9', claro: true },
  { id: 'gris', nombre: 'Gris jaspe', hex: '#9a9a98', claro: true },
  { id: 'marino', nombre: 'Azul marino', hex: '#1d2840', claro: false },
  { id: 'vino', nombre: 'Vino', hex: '#5a1a24', claro: false },
  { id: 'militar', nombre: 'Verde militar', hex: '#4a4f35', claro: false },
  { id: 'arena', nombre: 'Arena', hex: '#d8c8a8', claro: true },
  { id: 'rosa', nombre: 'Rosa pastel', hex: '#ecc3c9', claro: true },
]
