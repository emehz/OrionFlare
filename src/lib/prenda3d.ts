import * as THREE from 'three'
import { type Prenda, type Talla, medidasCm } from '../data/prendas'

/*
 * Modelo 3D de la camisa, generado con las medidas reales de la tabla de tallas.
 * Unidad: 1 = 1 cm. Eje y hacia arriba, z hacia quien mira el frente.
 *
 * La camisa es una pieza cerrada: un cuerpo tubular (frente y espalda unidos por las costuras
 * laterales y de hombro), dos mangas tubulares y un cuello acanalado. Cada vértice guarda:
 *   aZona: 0 frente, 1 espalda, 2 manga izquierda (de quien la usa, +x), 3 manga derecha (−x), −1 sin estampado
 *   aCm:   coordenadas "de patrón" en cm dentro de su zona (x a lo ancho, y hacia abajo desde el hombro)
 *   aPeso: cuánto se mueve con la física (0 en los hombros, 1 en el ruedo y los puños)
 */

export type Zona = 'frente' | 'espalda' | 'mangaIzq' | 'mangaDer'
export const ZONAS: Zona[] = ['frente', 'espalda', 'mangaIzq', 'mangaDer']
export const INDICE_ZONA: Record<Zona, number> = { frente: 0, espalda: 1, mangaIzq: 2, mangaDer: 3 }

export interface ModeloCamisa {
  cuerpo: THREE.BufferGeometry
  mangas: THREE.BufferGeometry | null
  cuello: THREE.BufferGeometry | null
  /** escala (ancho, alto) que se aplica al objeto y a las coordenadas de patrón; 1 si la geometría ya está a tamaño real */
  escala?: [number, number]
  arriba: number
  abajo: number
  ancho: number
  largo: number
  largoManga: number
  /** contorno de la manga en la boca del hombro (cm) */
  contornoManga: number
  profCuelloEspalda: number
  /** busca el punto 3D y la normal de una coordenada de patrón (para colocar etiquetas de medidas) */
  punto: (zona: Zona, xCm: number, yCm: number) => { pos: THREE.Vector3; normal: THREE.Vector3 } | null
}

const rad = (g: number) => (g * Math.PI) / 180
const suave = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Ruido suave determinista para las arrugas de la tela
function ruido(x: number, y: number) {
  return (
    Math.sin(x * 1.7 + y * 0.9) * 0.5 +
    Math.sin(x * 3.1 - y * 1.3 + 1.7) * 0.3 +
    Math.sin(x * 5.3 + y * 2.1 + 4.1) * 0.2
  )
}

export interface Parametros {
  W: number
  L: number
  arriba: number
  abajo: number
  caida: number
  pendiente: number
  sisa: number
  largoManga: number
  angulo: number
  boca: number
  conMangas: boolean
  cintura: number
  anchoCuello: number
  profFrente: number
  profEspalda: number
  cuelloV: boolean
}

export function parametros(prenda: Prenda, talla: Talla): Parametros {
  const { ancho: W, largo: L } = medidasCm(talla)
  const over = prenda.corte === 'oversize'
  const dama = prenda.corte === 'dama' || prenda.corte === 'crop'
  let largoManga = W * (over ? 0.38 : dama ? 0.28 : 0.36)
  let angulo = over ? 40 : 52
  let boca = W * (over ? 0.42 : dama ? 0.3 : 0.33)
  if (prenda.manga === 'larga') {
    largoManga = L * 0.8
    angulo = 62
    boca = W * 0.2
  }
  return {
    W, L,
    arriba: L / 2,
    abajo: -L / 2,
    // hombro caído de la oversize: más ancho y con más pendiente, sin "hombreras"
    caida: over ? W * 0.05 : dama ? -W * 0.03 : 0,
    pendiente: over ? 5.2 : 4.2,
    sisa: Math.min(L * 0.42, W * (over ? 0.5 : dama ? 0.38 : 0.43)),
    largoManga,
    angulo,
    boca,
    conMangas: prenda.manga !== 'sin',
    cintura: prenda.corte === 'dama' ? 0.07 : 0,
    anchoCuello: Math.max(6.5, W * 0.165),
    profFrente: prenda.cuello === 'v' ? Math.max(9, W * 0.3) : Math.max(5, W * 0.15),
    profEspalda: 2.2,
    cuelloV: prenda.cuello === 'v',
  }
}

/** Superelipse un poco plana al frente y atrás, como una camisa puesta en un maniquí invisible. */
const EXP = 2.5
const PROF = 0.6
function puntoSeccion(theta: number, a: number, b: number) {
  const c = Math.cos(theta), s = Math.sin(theta)
  return [a * Math.sign(c) * Math.pow(Math.abs(c), 2 / EXP), b * Math.sign(s) * Math.pow(Math.abs(s), 2 / EXP)] as const
}
let perimetroUnidad = 0
function perimetroBase() {
  if (perimetroUnidad) return perimetroUnidad
  let p = 0
  let [px, pz] = puntoSeccion(0, 1, PROF)
  for (let i = 1; i <= 720; i++) {
    const [x, z] = puntoSeccion((i / 720) * Math.PI * 2, 1, PROF)
    p += Math.hypot(x - px, z - pz)
    px = x
    pz = z
  }
  perimetroUnidad = p
  return p
}

export function construirCamisa(prenda: Prenda, talla: Talla): ModeloCamisa {
  const P = parametros(prenda, talla)
  const { W, L, arriba, abajo } = P
  // El ancho de la tabla es la camisa extendida: el contorno real es el doble.
  const aBase = (2 * W) / perimetroBase()
  const yAxila = arriba - P.sisa

  const semiancho = (y: number) => {
    let a = aBase
    if (P.cintura) {
      const yCintura = abajo + L * 0.42
      a *= 1 - P.cintura * Math.exp(-(((y - yCintura) / (L * 0.18)) ** 2))
    }
    a *= 1 + 0.025 * (1 - suave(abajo, abajo + 10, y)) // el ruedo se abre un poco
    if (P.caida > 0) a += P.caida * suave(yAxila - 6, arriba - 2, y) // hombro caído de la oversize
    if (!P.conMangas) a = a + (P.anchoCuello + 6.5 - a) * suave(yAxila, arriba, y) // sisa de camisa sin manga
    return a
  }
  const aHombro = semiancho(arriba)
  const nw = P.anchoCuello

  // altura del borde superior de cada columna (cuello u hombro) y su profundidad final
  const bordeSuperior = (x: number, frente: boolean) => {
    const ax = Math.abs(x)
    if (ax < nw) {
      const t = ax / nw
      const prof = frente ? P.profFrente : P.profEspalda
      const caida = frente && P.cuelloV ? prof * (1 - t) : prof * Math.sqrt(Math.max(0, 1 - t * t))
      const zr = nw * 0.78 * Math.sqrt(Math.max(0, 1 - t * t))
      return { y: arriba - caida, z: (frente ? 1 : -1) * zr }
    }
    const t = Math.min(1, (ax - nw) / Math.max(1, aHombro - nw))
    return { y: arriba - P.pendiente * Math.pow(t, 1.25), z: 0 }
  }

  // ───── Cuerpo ─────
  const U = 128 // columnas alrededor
  const R = 90 // filas del ruedo al hombro
  const nCuerpo = U * (R + 1)
  const pos = new Float32Array(nCuerpo * 3)
  const zona = new Float32Array(nCuerpo)
  const cm = new Float32Array(nCuerpo * 2)
  const uv = new Float32Array(nCuerpo * 2)
  const peso = new Float32Array(nCuerpo)

  // ángulo de cada columna: 0 = costado derecho de quien mira (+x), π/2 = centro del frente
  for (let i = 0; i < U; i++) {
    const th = (i / U) * Math.PI * 2
    const frente = Math.sin(th) >= 0
    for (let j = 0; j <= R; j++) {
      const v = j / R
      // x de la columna a la altura del hombro (para saber dónde termina)
      const [xs] = puntoSeccion(th, aHombro, aHombro * PROF)
      const borde = bordeSuperior(xs, frente)
      const y = abajo + v * (borde.y - abajo)
      const a = semiancho(y)
      let [x, z] = puntoSeccion(th, a, a * PROF)
      // Hombro redondeado: en los últimos cm la tela se cierra hacia la costura del hombro o el cuello
      const tramo = 10
      const d = borde.y - y
      if (d < tramo) {
        const t = 1 - d / tramo
        const k = Math.sqrt(Math.max(0, 1 - t * t))
        z = borde.z + (z - borde.z) * k
        if (Math.abs(xs) < nw) x = xs + (x - xs) * k
      }
      // Arrugas: suaves en el cuerpo, más marcadas cerca del ruedo y bajo las axilas
      const lado = Math.pow(Math.abs(Math.cos(th)), 6)
      const cercaRuedo = 1 - suave(abajo, abajo + 16, y)
      const axila = Math.exp(-(((y - (yAxila - 5)) / 7) ** 2)) * lado
      const n = ruido(th * 6, y * 0.11) * 0.35 + Math.sin(th * 9 + y * 0.05) * 0.45 * cercaRuedo + ruido(th * 14, y * 0.4) * 0.6 * axila
      const r = Math.hypot(x, z) || 1
      x += (x / r) * n
      z += (z / r) * n * 0.8

      const idx = i * (R + 1) + j
      pos[idx * 3] = x
      pos[idx * 3 + 1] = y
      pos[idx * 3 + 2] = z
      zona[idx] = frente ? 0 : 1
      peso[idx] = Math.pow(Math.min(1, Math.max(0, (yAxila + 4 - y) / (yAxila + 4 - abajo))), 1.3)
    }
  }

  // Coordenadas de patrón: x = distancia sobre la tela desde el centro (frente o espalda)
  for (let j = 0; j <= R; j++) {
    const largoArco = new Float32Array(U + 1)
    for (let i = 1; i <= U; i++) {
      const a = (i - 1) * (R + 1) + j
      const b = (i % U) * (R + 1) + j
      largoArco[i] = largoArco[i - 1] + Math.hypot(pos[b * 3] - pos[a * 3], pos[b * 3 + 2] - pos[a * 3 + 2])
    }
    const total = largoArco[U]
    const centroF = largoArco[U / 4] // θ = π/2
    const centroE = largoArco[(3 * U) / 4] // θ = 3π/2
    for (let i = 0; i < U; i++) {
      const idx = i * (R + 1) + j
      const s = largoArco[i]
      // positivo hacia la derecha de quien mira esa cara (frente: +x; espalda vista desde atrás: −x)
      cm[idx * 2] = zona[idx] === 0 ? centroF - s : centroE - s
      cm[idx * 2 + 1] = arriba - pos[idx * 3 + 1]
      uv[idx * 2] = s / 2.2
      uv[idx * 2 + 1] = pos[idx * 3 + 1] / 2.2
      void total
    }
  }

  const indices: number[] = []
  for (let i = 0; i < U; i++) {
    const i2 = (i + 1) % U
    for (let j = 0; j < R; j++) {
      const a = i * (R + 1) + j, b = i2 * (R + 1) + j, c = i2 * (R + 1) + j + 1, d = i * (R + 1) + j + 1
      indices.push(a, d, b, b, d, c)
    }
  }
  const cuerpo = geometria(pos, zona, cm, uv, peso, indices)

  // ───── Mangas ─────
  let mangas: THREE.BufferGeometry | null = null
  // contorno de la sisa ≈ 2 × profundidad de sisa
  const r0 = P.sisa / Math.PI
  const r1 = P.boca / Math.PI
  if (P.conMangas) {
    const S = 48, T = 40
    const n = 2 * S * (T + 1)
    const mp = new Float32Array(n * 3), mz = new Float32Array(n), mc = new Float32Array(n * 2), mu = new Float32Array(n * 2), mw = new Float32Array(n)
    const mi: number[] = []
    let base = 0
    for (const signo of [1, -1]) {
      const hombro = new THREE.Vector3(signo * aHombro, arriba - P.pendiente, 0)
      const ang = rad(P.angulo)
      const dir = new THREE.Vector3(signo * Math.cos(ang), -Math.sin(ang), 0)
      const haciaAbajo = new THREE.Vector3(-signo * Math.sin(ang), -Math.cos(ang), 0) // hacia la axila
      const e1 = haciaAbajo.clone().negate() // parte de arriba de la manga
      const e2 = new THREE.Vector3(0, 0, 1)
      // la boca de la manga arranca justo en la costura del hombro y se mete en el cuerpo en horizontal
      // (si se metiera a lo largo de la manga, su borde superior asomaría por encima del hombro)
      const inicio = hombro.clone().addScaledVector(haciaAbajo, r0 * 0.97).add(new THREE.Vector3(-signo * r0 * 0.55, 0, 0))
      const largo = P.largoManga + r0 * 0.55
      for (let k = 0; k <= T; k++) {
        const t = k / T
        const radio = r0 + (r1 - r0) * Math.pow(t, 0.8) + (t > 0.94 ? (t - 0.94) * 4 : 0)
        const centro = inicio.clone().addScaledVector(dir, t * largo)
        for (let s = 0; s < S; s++) {
          const ph = (s / S) * Math.PI * 2
          // arrugas de la manga, más marcadas en el doblez de abajo
          const doblez = Math.max(0, -Math.cos(ph))
          const arr = ruido(ph * 4 + signo, t * 9) * 0.25 + Math.sin(t * 28 + ph * 2) * 0.35 * doblez * (1 - t)
          const rr = radio + arr
          const p = centro.clone().addScaledVector(e1, Math.cos(ph) * rr).addScaledVector(e2, Math.sin(ph) * rr * 0.86)
          const idx = base + k * S + s
          mp[idx * 3] = p.x
          mp[idx * 3 + 1] = p.y
          mp[idx * 3 + 2] = p.z
          mz[idx] = signo > 0 ? 2 : 3
          // x de patrón medida desde la cara exterior-frontal de la manga (45° entre arriba y el frente)
          let dph = ph - Math.PI / 4
          dph = Math.atan2(Math.sin(dph), Math.cos(dph))
          mc[idx * 2] = -dph * rr * signo
          mc[idx * 2 + 1] = Math.max(0, t * largo - r0 * 0.55)
          mu[idx * 2] = (ph * rr) / 2.2
          mu[idx * 2 + 1] = (t * largo) / 2.2
          mw[idx] = 0.25 + 0.75 * t
        }
      }
      for (let k = 0; k < T; k++) {
        for (let s = 0; s < S; s++) {
          const s2 = (s + 1) % S
          const a = base + k * S + s, b = base + k * S + s2, c = base + (k + 1) * S + s2, d = base + (k + 1) * S + s
          if (signo > 0) mi.push(a, b, d, b, c, d)
          else mi.push(a, d, b, b, d, c)
        }
      }
      base += S * (T + 1)
    }
    mangas = geometria(mp, mz, mc, mu, mw, mi)
  }

  // ───── Cuello acanalado ─────
  const puntosCuello: THREE.Vector3[] = []
  const N = 40
  for (let k = 0; k <= N; k++) {
    const x = -nw + (2 * nw * k) / N
    const b = bordeSuperior(x, true)
    puntosCuello.push(new THREE.Vector3(x, b.y + 0.3, b.z + 0.2))
  }
  for (let k = N - 1; k > 0; k--) {
    const x = -nw + (2 * nw * k) / N
    const b = bordeSuperior(x, false)
    puntosCuello.push(new THREE.Vector3(x, b.y + 0.3, b.z - 0.2))
  }
  const curva = new THREE.CatmullRomCurve3(puntosCuello, true, 'catmullrom', 0.2)
  const cuello = new THREE.TubeGeometry(curva, 160, 0.95, 10, true)
  const nc = cuello.attributes.position.count
  cuello.setAttribute('aZona', new THREE.BufferAttribute(new Float32Array(nc).fill(-1), 1))
  cuello.setAttribute('aCm', new THREE.BufferAttribute(new Float32Array(nc * 2), 2))
  cuello.setAttribute('aPeso', new THREE.BufferAttribute(new Float32Array(nc), 1))

  // búsqueda de puntos por coordenada de patrón (solo para etiquetas de medidas)
  const punto = (z: Zona, xCm: number, yCm: number) => {
    const iz = INDICE_ZONA[z]
    const geo = iz < 2 ? cuerpo : mangas
    if (!geo) return null
    const za = geo.attributes.aZona.array as Float32Array
    const ca = geo.attributes.aCm.array as Float32Array
    const pa = geo.attributes.position.array as Float32Array
    const na = geo.attributes.normal.array as Float32Array
    let mejor = -1, md = Infinity
    for (let i = 0; i < za.length; i++) {
      if (za[i] !== iz) continue
      const d = (ca[i * 2] - xCm) ** 2 + (ca[i * 2 + 1] - yCm) ** 2
      if (d < md) { md = d; mejor = i }
    }
    if (mejor < 0) return null
    return {
      pos: new THREE.Vector3(pa[mejor * 3], pa[mejor * 3 + 1], pa[mejor * 3 + 2]),
      normal: new THREE.Vector3(na[mejor * 3], na[mejor * 3 + 1], na[mejor * 3 + 2]),
    }
  }

  return {
    cuerpo, mangas, cuello,
    arriba, abajo, ancho: W, largo: L,
    largoManga: P.conMangas ? P.largoManga : 0,
    contornoManga: 2 * Math.PI * r0,
    profCuelloEspalda: P.profEspalda,
    punto,
  }
}

function geometria(pos: Float32Array, zona: Float32Array, cm: Float32Array, uv: Float32Array, peso: Float32Array, indices: number[]) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aZona', new THREE.BufferAttribute(zona, 1))
  g.setAttribute('aCm', new THREE.BufferAttribute(cm, 2))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('aPeso', new THREE.BufferAttribute(peso, 1))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

const cache = new Map<string, ModeloCamisa>()
export function modeloCamisa(prenda: Prenda, talla: Talla) {
  const clave = `${prenda.id}|${talla.talla}`
  if (!cache.has(clave)) cache.set(clave, construirCamisa(prenda, talla))
  return cache.get(clave)!
}
