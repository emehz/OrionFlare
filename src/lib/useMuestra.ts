import { useEffect, useState } from 'react'
import { MUESTRAS, ACENTO } from './muestras'

const cache = new Map<string, Promise<HTMLCanvasElement>>()

export function lienzoMuestra(id: string, tinta: string) {
  const clave = `${id}|${tinta}`
  if (!cache.has(clave)) {
    const m = MUESTRAS.find((x) => x.id === id) ?? MUESTRAS[0]
    cache.set(clave, m.dibujar(tinta, ACENTO))
  }
  return cache.get(clave)!
}

export function useMuestra(id: string | null, tinta: string) {
  const [lienzo, setLienzo] = useState<HTMLCanvasElement | null>(null)
  useEffect(() => {
    if (!id) {
      setLienzo(null)
      return
    }
    let vivo = true
    lienzoMuestra(id, tinta).then((c) => vivo && setLienzo(c))
    return () => {
      vivo = false
    }
  }, [id, tinta])
  return lienzo
}

/** Versión "subida por el cliente": el mismo diseño sobre un fondo blanco, para demostrar el quitado de fondo. */
export function conFondo(c: HTMLCanvasElement) {
  const out = document.createElement('canvas')
  const m = Math.round(c.width * 0.08)
  out.width = c.width + m * 2
  out.height = c.height + m * 2
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(c, m, m)
  return out
}
