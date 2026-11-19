import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { INDICE_ZONA, type Zona } from '../lib/prenda3d'
import { useModeloCamisa } from '../lib/prendaBlender'
import { crearMaterialTela, MAX_DISENOS } from './materialTela'
import type { ColorPrenda, Prenda, Talla } from '../data/prendas'
import { urlPublica } from '../lib/rutas'

export interface DisenoEnPrenda {
  id: string
  zona: Zona
  imagen: HTMLCanvasElement
  anchoCm: number
  altoCm: number
  /** centro horizontal en cm desde el centro de la zona */
  x: number
  /** borde superior en cm desde el hombro (en las mangas, desde la costura del hombro) */
  y: number
}

export interface Camisa3DProps {
  prenda: Prenda
  talla: Talla
  color: ColorPrenda
  disenos: DisenoEnPrenda[]
  /** id del diseño seleccionado: se marca con su contorno y cotas */
  activo?: string | null
  /** muestra las medidas del diseño seleccionado */
  medidas?: boolean
}

const ETIQUETAS = ['S', 'M', 'L', 'XL']
function urlEtiqueta(talla: string, clara: boolean) {
  const tinta = clara ? 'negro' : 'blanco'
  if (!ETIQUETAS.includes(talla)) return urlPublica(`brand/logo-${tinta}.png`)
  if (talla === 'XL') return urlPublica('brand/etiqueta-XL-blanco.png')
  return urlPublica(`brand/etiqueta-${talla}-${tinta}.png`)
}

// Textura de vista previa por lienzo (máx. 1024 px): la imagen original completa solo se usa al exportar.
const texturas = new WeakMap<HTMLCanvasElement, THREE.CanvasTexture>()
export function texturaDe(c: HTMLCanvasElement) {
  let t = texturas.get(c)
  if (!t) {
    const escala = Math.min(1, 1024 / Math.max(c.width, c.height))
    let fuente = c
    if (escala < 1) {
      fuente = document.createElement('canvas')
      fuente.width = Math.max(1, Math.round(c.width * escala))
      fuente.height = Math.max(1, Math.round(c.height * escala))
      const ctx = fuente.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(c, 0, 0, fuente.width, fuente.height)
    }
    t = new THREE.CanvasTexture(fuente)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    texturas.set(c, t)
  }
  return t
}

const cargador = new THREE.TextureLoader()
const etiquetas = new Map<string, Promise<THREE.Texture>>()
function texturaEtiqueta(url: string) {
  if (!etiquetas.has(url)) {
    etiquetas.set(url, cargador.loadAsync(url).then((t) => {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      return t
    }))
  }
  return etiquetas.get(url)!
}

const reducido = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Camisa3D({ prenda, talla, color, disenos, activo = null, medidas = false }: Camisa3DProps) {
  const modelo = useModeloCamisa(prenda, talla)
  const [{ material, uniforms }] = useState(() => crearMaterialTela())
  const grupo = useRef<THREE.Group>(null)

  // Color de la tela (idéntico en todas las piezas)
  useLayoutEffect(() => {
    material.color.set(color.hex)
    // el "sheen" imita la pelusa del algodón; en telas oscuras se mantiene sutil para que el negro siga siendo negro
    const brillo = new THREE.Color(color.hex).lerp(new THREE.Color('#ffffff'), color.claro ? 0.1 : 0.16)
    material.sheenColor.copy(brillo)
    material.sheen = color.claro ? 0.6 : 0.45
  }, [color, material])

  // Diseños: solo se actualizan números y referencias a texturas
  useLayoutEffect(() => {
    const lista = disenos.slice(0, MAX_DISENOS)
    lista.forEach((d, i) => {
      uniforms.uDisTex.value[i] = texturaDe(d.imagen)
      uniforms.uDisRect.value[i].set(d.x - d.anchoCm / 2, d.y, d.anchoCm, d.altoCm)
      uniforms.uDisZona.value[i] = INDICE_ZONA[d.zona]
    })
    uniforms.uDisN.value = lista.length
    uniforms.uActivo.value = activo ? lista.findIndex((d) => d.id === activo) : -1
    uniforms.uGuia.value = activo ? 1 : 0
  }, [disenos, activo, uniforms])

  useLayoutEffect(() => {
    uniforms.uLargo.value = modelo.largo
    uniforms.uLargoManga.value = modelo.largoManga
    const ancho = Math.min(8, modelo.ancho * 0.15)
    uniforms.uEtiquetaRect.value.set(-ancho / 2, modelo.profCuelloEspalda + 1, ancho, ancho * 0.54)
  }, [modelo, uniforms])

  useEffect(() => {
    let vivo = true
    texturaEtiqueta(urlEtiqueta(talla.talla, color.claro)).then((t) => {
      if (vivo) uniforms.uEtiqueta.value = t
    })
    return () => {
      vivo = false
    }
  }, [talla.talla, color.claro, uniforms])

  // Física ligera: resorte amortiguado que responde al giro y al desplazamiento de la camisa
  const fis = useRef({ yaw: 0, lag: 0, vLag: 0, x: 0, sx: 0, vsx: 0, iniciado: false })
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dtReal) => {
    const g = grupo.current
    if (!g) return
    const dt = Math.min(dtReal, 1 / 30)
    g.getWorldQuaternion(q)
    e.setFromQuaternion(q)
    g.getWorldPosition(p)
    const f = fis.current
    if (!f.iniciado) {
      f.yaw = e.y
      f.x = p.x
      f.iniciado = true
    }
    let dYaw = e.y - f.yaw
    dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw))
    f.yaw = e.y
    const omega = dt > 0 ? dYaw / dt : 0
    const vx = dt > 0 ? (p.x - f.x) / dt : 0
    f.x = p.x
    if (reducido()) {
      uniforms.uLag.value = 0
      uniforms.uSway.value.set(0, 0)
      return
    }
    const objetivo = THREE.MathUtils.clamp(-omega * 0.07, -0.32, 0.32)
    f.vLag += (55 * (objetivo - f.lag) - 7 * f.vLag) * dt
    f.lag += f.vLag * dt
    const objX = THREE.MathUtils.clamp(-vx * 0.02, -3, 3)
    f.vsx += (40 * (objX - f.sx) - 6 * f.vsx) * dt
    f.sx += f.vsx * dt
    uniforms.uLag.value = f.lag
    uniforms.uSway.value.set(f.sx, 0)
  })

  const sel = medidas && activo ? disenos.find((d) => d.id === activo) : undefined
  const etiquetas3d = useMemo(() => {
    if (!sel) return null
    // en las mangas no hay espacio sobre el diseño (está la costura del hombro): la cota va debajo
    const enManga = sel.zona === 'mangaIzq' || sel.zona === 'mangaDer'
    const arriba = modelo.punto(sel.zona, sel.x, enManga ? sel.y + sel.altoCm + 2.6 : sel.y - 3.2)
    const lado = modelo.punto(sel.zona, sel.x + sel.anchoCm / 2 + 3.4, sel.y + sel.altoCm / 2)
    return { arriba, lado }
  }, [sel, modelo])

  return (
    <group ref={grupo}>
      <mesh geometry={modelo.cuerpo} material={material} />
      {modelo.mangas && <mesh geometry={modelo.mangas} material={material} />}
      {modelo.cuello && <mesh geometry={modelo.cuello} material={material} />}
      {sel && etiquetas3d?.arriba && (
        <Html position={etiquetas3d.arriba.pos.clone().addScaledVector(etiquetas3d.arriba.normal, 1)} center className="regla-etiqueta" zIndexRange={[5, 0]}>
          {sel.anchoCm.toFixed(1)} cm
        </Html>
      )}
      {sel && etiquetas3d?.lado && (
        <Html position={etiquetas3d.lado.pos.clone().addScaledVector(etiquetas3d.lado.normal, 1)} center className="regla-etiqueta" zIndexRange={[5, 0]}>
          {sel.altoCm.toFixed(1)} cm
        </Html>
      )}
    </group>
  )
}
