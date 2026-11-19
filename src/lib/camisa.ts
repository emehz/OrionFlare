import * as THREE from 'three'
import { type Prenda, type Talla, medidasCm } from '../data/prendas'

/*
 * Camisa paramétrica: la silueta se calcula con las medidas reales de la tabla de tallas.
 * Unidad: 1 = 1 cm. El centro de la camisa está en (0, 0); el hombro arriba en y = largo / 2.
 */

export type Punto = [number, number]

export interface Silueta {
  frente: Punto[]
  espalda: Punto[]
  ancho: number
  largo: number
  arriba: number
  profCuelloFrente: number
  profCuelloEspalda: number
  minX: number
  maxX: number
  minY: number
  maxY: number
}

const rad = (g: number) => (g * Math.PI) / 180

function curvaQ(a: Punto, c: Punto, b: Punto, n = 10): Punto[] {
  const out: Punto[] = []
  for (let i = 1; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]])
  }
  return out
}

function mitadDerecha(prenda: Prenda, W: number, L: number, profCuello: number, esFrente: boolean): Punto[] {
  const arriba = L / 2
  const abajo = -L / 2
  const nw = Math.max(6.5, W * 0.17)
  const over = prenda.corte === 'oversize'
  const caida = over ? W * 0.12 : 0
  const pendiente = over ? 3 : 4
  const sisa = W * (over ? 0.5 : prenda.corte === 'dama' || prenda.corte === 'crop' ? 0.38 : 0.42)

  const pts: Punto[] = [[0, arriba - profCuello]]
  // Cuello
  if (prenda.cuello === 'v' && esFrente) {
    pts.push([nw * 0.5, arriba - profCuello * 0.5], [nw, arriba])
  } else {
    for (let i = 1; i <= 10; i++) {
      const th = (i / 10) * (Math.PI / 2)
      pts.push([nw * Math.sin(th), arriba - profCuello * Math.cos(th)])
    }
  }
  // Hombro
  const hombro: Punto = [W / 2 + caida, arriba - pendiente]
  const axila: Punto = [W / 2, arriba - Math.min(sisa, L * 0.55)]

  if (prenda.manga === 'sin') {
    const h2: Punto = [W / 2 - 3.5, arriba - pendiente + 0.8]
    pts.push(h2)
    pts.push(...curvaQ(h2, [W / 2 - 5, axila[1] + 2], axila, 12))
  } else {
    pts.push(hombro)
    let largoManga: number
    let angulo: number
    let boca: number
    if (prenda.manga === 'larga') {
      largoManga = L * 0.82
      angulo = 66
      boca = W * 0.17
    } else if (over) {
      largoManga = W * 0.36
      angulo = 22
      boca = W * 0.4
    } else {
      largoManga = W * (prenda.corte === 'dama' || prenda.corte === 'crop' ? 0.26 : 0.36)
      angulo = 30
      boca = W * 0.32
    }
    const d: Punto = [Math.cos(rad(angulo)), -Math.sin(rad(angulo))]
    const perp: Punto = [-Math.sin(rad(angulo)), -Math.cos(rad(angulo))]
    const o1: Punto = [hombro[0] + d[0] * largoManga, hombro[1] + d[1] * largoManga]
    const o2: Punto = [o1[0] + perp[0] * boca, o1[1] + perp[1] * boca]
    pts.push(o1, o2)
    pts.push(...curvaQ(o2, [axila[0] + 1.2, axila[1] - 0.6], axila, 6))
  }

  // Cuerpo
  const vuelo = over ? 0.5 : 1
  const ruedo: Punto = [W / 2 + vuelo, abajo + 1.2]
  if (prenda.corte === 'dama') {
    const cintura: Punto = [W / 2 - W * 0.045, abajo + L * 0.42]
    pts.push(...curvaQ(axila, [W / 2 - W * 0.02, (axila[1] + cintura[1]) / 2], cintura, 8))
    pts.push(...curvaQ(cintura, [W / 2 - W * 0.02, (cintura[1] + ruedo[1]) / 2], ruedo, 8))
  } else {
    pts.push(...curvaQ(axila, [W / 2 + 0.2, (axila[1] + ruedo[1]) / 2], ruedo, 8))
  }
  pts.push(...curvaQ(ruedo, [W / 4, abajo - 0.4], [0, abajo], 10))
  return pts
}

function espejar(mitad: Punto[]): Punto[] {
  const izq = mitad
    .slice(1, -1)
    .reverse()
    .map(([x, y]) => [-x, y] as Punto)
  return [...mitad, ...izq]
}

export function calcularSilueta(prenda: Prenda, talla: Talla): Silueta {
  const { ancho: W, largo: L } = medidasCm(talla)
  const profFrente = prenda.cuello === 'v' ? Math.max(9, W * 0.3) : Math.max(4.5, W * 0.15)
  const profEspalda = 2.2
  const frente = espejar(mitadDerecha(prenda, W, L, profFrente, true))
  const espalda = espejar(mitadDerecha(prenda, W, L, profEspalda, false))
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of [...frente, ...espalda]) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  return {
    frente, espalda, ancho: W, largo: L, arriba: L / 2,
    profCuelloFrente: profFrente, profCuelloEspalda: profEspalda,
    minX: minX - 2, maxX: maxX + 2, minY: minY - 2, maxY: maxY + 2,
  }
}

function dentro(x: number, y: number, poly: Punto[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function distanciaBorde(x: number, y: number, poly: Punto[]) {
  let min = Infinity
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j]
    const [bx, by] = poly[i]
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy || 1
    let t = ((x - ax) * dx + (y - ay) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    const px = ax + t * dx - x, py = ay + t * dy - y
    min = Math.min(min, px * px + py * py)
  }
  return Math.sqrt(min)
}

/** Altura (z) del "relleno" de la camisa en un punto: 0 en el borde y redondeado hacia el centro. */
export function perfil(s: Silueta, poly: Punto[], x: number, y: number) {
  if (!dentro(x, y, poly)) return 0
  const B = s.ancho * 0.085
  const R = s.ancho * 0.2
  const t = Math.min(distanciaBorde(x, y, poly) / R, 1)
  return B * Math.sqrt(1 - (1 - t) * (1 - t))
}

/** Malla de una cara (frente o espalda). La silueta exacta la recorta la transparencia de la textura. */
export function geometriaCara(s: Silueta, poly: Punto[], detalle = 1): THREE.BufferGeometry {
  const w = s.maxX - s.minX
  const h = s.maxY - s.minY
  const segX = Math.round(110 * detalle)
  const segY = Math.round((110 * detalle * h) / w)
  const g = new THREE.PlaneGeometry(w, h, segX, segY)
  g.translate((s.minX + s.maxX) / 2, (s.minY + s.maxY) / 2, 0)
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, perfil(s, poly, pos.getX(i), pos.getY(i)))
  }
  g.computeVertexNormals()
  return g
}

export function trazarSilueta(ctx: CanvasRenderingContext2D, s: Silueta, poly: Punto[], pxcm: number) {
  ctx.beginPath()
  poly.forEach(([x, y], i) => {
    const px = (x - s.minX) * pxcm
    const py = (s.maxY - y) * pxcm
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.closePath()
}
