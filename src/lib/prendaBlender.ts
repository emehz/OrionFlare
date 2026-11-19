import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { type Prenda, type Talla, PULGADA, medidasCm } from '../data/prendas'
import { modeloCamisa, parametros, INDICE_ZONA, type ModeloCamisa, type Zona } from './prenda3d'
import { urlPublica } from './rutas'

/*
 * Camisas hechas en Blender con simulación de tela real (ver blender/camisa.py).
 * Hay un modelo por corte, simulado en una talla base; aquí se escala a la talla elegida.
 * Mientras se descarga, se usa el modelo generado en código (prenda3d.ts).
 */

// talla base con la que se simuló cada corte (pulgadas) — debe coincidir con CORTES en blender/camisa.py
const BASE: Record<string, { archivo: string; ancho: number; largo: number }> = {
  unisex: { archivo: 'regular', ancho: 22, largo: 29 },
  oversize: { archivo: 'oversize', ancho: 24, largo: 29 },
  'manga-larga': { archivo: 'larga', ancho: 22, largo: 29 },
  'sin-manga': { archivo: 'sin', ancho: 22, largo: 29 },
  'dama-redondo': { archivo: 'dama', ancho: 19.125, largo: 26.25 },
  'dama-v': { archivo: 'dama-v', ancho: 19.125, largo: 26 },
  crop: { archivo: 'crop', ancho: 20, largo: 17 },
  infantil: { archivo: 'infantil', ancho: 14.5, largo: 20 },
}

const cargador = new GLTFLoader()
const archivos = new Map<string, Promise<THREE.BufferGeometry>>()

function geometriaBase(archivo: string) {
  if (!archivos.has(archivo)) {
    archivos.set(
      archivo,
      cargador.loadAsync(urlPublica(`modelos/camisas/${archivo}.glb`)).then((gltf) => {
        let geo: THREE.BufferGeometry | null = null
        gltf.scene.traverse((o) => {
          if (!geo && (o as THREE.Mesh).isMesh) geo = (o as THREE.Mesh).geometry as THREE.BufferGeometry
        })
        if (!geo) throw new Error(`El modelo ${archivo} no tiene malla`)
        return geo
      }),
    )
  }
  return archivos.get(archivo)!
}

function escalar(base: THREE.BufferGeometry, sx: number, sy: number) {
  const g = new THREE.BufferGeometry()
  const pos = base.attributes.position.array as Float32Array
  const nor = base.attributes.normal.array as Float32Array
  // glTF guarda los UV con la v invertida (1 − v): se deshace aquí
  const uv0 = base.attributes.uv.array as Float32Array
  const uv1 = (base.attributes.uv1 ?? base.attributes.uv2).array as Float32Array
  const n = pos.length / 3
  const p = new Float32Array(n * 3)
  const nn = new Float32Array(n * 3)
  const cm = new Float32Array(n * 2)
  const zona = new Float32Array(n)
  const peso = new Float32Array(n)
  const uv = new Float32Array(n * 2)
  const v = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    p[i * 3] = pos[i * 3] * sx
    p[i * 3 + 1] = pos[i * 3 + 1] * sy
    p[i * 3 + 2] = pos[i * 3 + 2] * sx
    // la normal se transforma con la inversa de la escala
    v.set(nor[i * 3] / sx, nor[i * 3 + 1] / sy, nor[i * 3 + 2] / sx).normalize()
    nn[i * 3] = v.x
    nn[i * 3 + 1] = v.y
    nn[i * 3 + 2] = v.z
    const z = Math.round(uv1[i * 2])
    zona[i] = z
    peso[i] = 1 - uv1[i * 2 + 1]
    const enManga = z >= 2
    cm[i * 2] = uv0[i * 2] * sx
    cm[i * 2 + 1] = (1 - uv0[i * 2 + 1]) * (enManga ? sx : sy)
    uv[i * 2] = cm[i * 2] / 2.2
    uv[i * 2 + 1] = cm[i * 2 + 1] / 2.2
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nn, 3))
  g.setAttribute('aCm', new THREE.BufferAttribute(cm, 2))
  g.setAttribute('aZona', new THREE.BufferAttribute(zona, 1))
  g.setAttribute('aPeso', new THREE.BufferAttribute(peso, 1))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  if (base.index) g.setIndex(base.index.clone())
  g.computeBoundingSphere()
  return g
}

function buscador(geo: THREE.BufferGeometry) {
  return (z: Zona, xCm: number, yCm: number) => {
    const iz = INDICE_ZONA[z]
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
}

const escalados = new Map<string, Promise<ModeloCamisa>>()

/** Modelo de Blender escalado a la talla (se guarda en caché). */
export function cargarModeloBlender(prenda: Prenda, talla: Talla): Promise<ModeloCamisa> {
  const clave = `${prenda.id}|${talla.talla}`
  if (!escalados.has(clave)) {
    const b = BASE[prenda.id] ?? BASE.unisex
    escalados.set(
      clave,
      geometriaBase(b.archivo).then((base) => {
        const { ancho: W, largo: L } = medidasCm(talla)
        const sx = W / (b.ancho * PULGADA)
        const sy = L / (b.largo * PULGADA)
        const geo = escalar(base, sx, sy)
        const P = parametros(prenda, talla)
        return {
          cuerpo: geo,
          mangas: null,
          cuello: null,
          arriba: L / 2,
          abajo: -L / 2,
          ancho: W,
          largo: L,
          largoManga: prenda.manga === 'sin' ? 0 : P.largoManga,
          contornoManga: 2 * P.sisa,
          profCuelloEspalda: P.profEspalda,
          punto: buscador(geo),
        }
      }),
    )
  }
  return escalados.get(clave)!
}

/** Devuelve el modelo de Blender cuando está listo; mientras tanto, el generado en código. */
export function useModeloCamisa(prenda: Prenda, talla: Talla) {
  const [modelo, setModelo] = useState<ModeloCamisa>(() => modeloCamisa(prenda, talla))
  useEffect(() => {
    let vivo = true
    cargarModeloBlender(prenda, talla)
      .then((m) => vivo && setModelo(m))
      .catch(() => vivo && setModelo(modeloCamisa(prenda, talla)))
    return () => {
      vivo = false
    }
  }, [prenda, talla])
  return modelo
}
