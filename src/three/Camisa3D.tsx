import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { Html, Line } from '@react-three/drei'
import { calcularSilueta, geometriaCara, perfil, type Punto, type Silueta } from '../lib/camisa'
import { pintarCara, type Estampa } from '../lib/texturas'
import type { ColorPrenda, Prenda, Talla } from '../data/prendas'
import { urlPublica } from '../lib/rutas'

export interface Camisa3DProps {
  prenda: Prenda
  talla: Talla
  color: ColorPrenda
  frente: Estampa | null
  espalda: Estampa | null
  /** muestra reglas con las medidas del diseño del frente */
  reglas?: boolean
  pxcm?: number
}

const ETIQUETAS = ['S', 'M', 'L', 'XL']

function urlEtiqueta(talla: string, clara: boolean) {
  // En camisas oscuras se usa la etiqueta de tinta blanca y viceversa.
  const tinta = clara ? 'negro' : 'blanco'
  if (!ETIQUETAS.includes(talla)) return urlPublica(`brand/logo-${tinta}.png`)
  if (talla === 'XL') return urlPublica('brand/etiqueta-XL-blanco.png')
  return urlPublica(`brand/etiqueta-${talla}-${tinta}.png`)
}

/**
 * Textura pintada en un lienzo. Three.js reserva la memoria de la textura con su tamaño inicial,
 * así que cuando cambia el tamaño (otra talla) se crea una textura nueva y se libera la anterior.
 */
function useTexturaCara(s: Silueta, poly: Punto[], color: string, estampa: Estampa | null, espejo: boolean, pxcm: number) {
  const [lienzo] = useState(() => document.createElement('canvas'))
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null)
  useEffect(() => {
    const antes = `${lienzo.width}x${lienzo.height}`
    pintarCara(lienzo, s, poly, color, estampa, espejo, pxcm)
    setTex((t) => {
      if (t && antes === `${lienzo.width}x${lienzo.height}`) {
        t.needsUpdate = true
        return t
      }
      t?.dispose()
      const nueva = new THREE.CanvasTexture(lienzo)
      nueva.colorSpace = THREE.SRGBColorSpace
      nueva.anisotropy = 8
      return nueva
    })
  }, [lienzo, s, poly, color, estampa, espejo, pxcm])
  useEffect(() => () => setTex((t) => (t?.dispose(), null)), [])
  return tex
}

function useTexturaImagen(url: string) {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let vivo = true
    new THREE.TextureLoader().load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 4
      if (vivo) setTex(t)
    })
    return () => {
      vivo = false
    }
  }, [url])
  return tex
}

export function Camisa3D({ prenda, talla, color, frente, espalda, reglas = false, pxcm = 20 }: Camisa3DProps) {
  const s = useMemo(() => calcularSilueta(prenda, talla), [prenda, talla])
  const geoFrente = useMemo(() => geometriaCara(s, s.frente), [s])
  const geoEspalda = useMemo(() => geometriaCara(s, s.espalda), [s])
  useEffect(() => () => { geoFrente.dispose(); geoEspalda.dispose() }, [geoFrente, geoEspalda])

  const texF = useTexturaCara(s, s.frente, color.hex, frente, false, pxcm)
  const texE = useTexturaCara(s, s.espalda, color.hex, espalda, true, pxcm)

  const etiqueta = useTexturaImagen(urlEtiqueta(talla.talla, color.claro))
  const anchoEtiqueta = Math.min(8, s.ancho * 0.16)
  const yEtiqueta = s.arriba - s.profCuelloEspalda - 0.8 - anchoEtiqueta * 0.27
  const zEtiqueta = -perfil(s, s.espalda, 0, yEtiqueta) + 0.15

  const zMax = s.ancho * 0.085 + 0.6

  return (
    <group position={[0, 0, 0]}>
      <mesh geometry={geoFrente} castShadow>
        {texF && <meshStandardMaterial map={texF} alphaTest={0.5} roughness={0.92} metalness={0} />}
      </mesh>
      <mesh geometry={geoEspalda} scale={[1, 1, -1]} castShadow>
        {texE && <meshStandardMaterial map={texE} alphaTest={0.5} roughness={0.92} metalness={0} side={THREE.DoubleSide} />}
      </mesh>
      {etiqueta && (
        <mesh position={[0, yEtiqueta, zEtiqueta]}>
          <planeGeometry args={[anchoEtiqueta, anchoEtiqueta * (etiqueta.image ? (etiqueta.image as HTMLImageElement).height / (etiqueta.image as HTMLImageElement).width : 0.54)]} />
          <meshBasicMaterial map={etiqueta} transparent toneMapped={false} />
        </mesh>
      )}
      {reglas && frente && <Reglas estampa={frente} arriba={s.arriba} z={zMax} />}
    </group>
  )
}

function Reglas({ estampa, arriba, z }: { estampa: Estampa; arriba: number; z: number }) {
  const x0 = estampa.x - estampa.anchoCm / 2
  const x1 = estampa.x + estampa.anchoCm / 2
  const y0 = arriba - estampa.y
  const y1 = y0 - estampa.altoCm
  const sep = 2.4
  const color = '#e5381e'
  const marca = 0.9
  return (
    <group>
      <Line points={[[x0, y0 + sep, z], [x1, y0 + sep, z]]} color={color} lineWidth={1.5} />
      <Line points={[[x0, y0 + sep - marca, z], [x0, y0 + sep + marca, z]]} color={color} lineWidth={1.5} />
      <Line points={[[x1, y0 + sep - marca, z], [x1, y0 + sep + marca, z]]} color={color} lineWidth={1.5} />
      <Line points={[[x1 + sep, y0, z], [x1 + sep, y1, z]]} color={color} lineWidth={1.5} />
      <Line points={[[x1 + sep - marca, y0, z], [x1 + sep + marca, y0, z]]} color={color} lineWidth={1.5} />
      <Line points={[[x1 + sep - marca, y1, z], [x1 + sep + marca, y1, z]]} color={color} lineWidth={1.5} />
      <Html position={[(x0 + x1) / 2, y0 + sep + 1.6, z]} center className="regla-etiqueta" zIndexRange={[5, 0]}>
        {estampa.anchoCm.toFixed(1)} cm
      </Html>
      <Html position={[x1 + sep + 1.2, (y0 + y1) / 2, z]} className="regla-etiqueta regla-etiqueta--v" zIndexRange={[5, 0]}>
        {estampa.altoCm.toFixed(1)} cm
      </Html>
    </group>
  )
}
