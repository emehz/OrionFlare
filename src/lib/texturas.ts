import type { Punto, Silueta } from './camisa'
import { trazarSilueta } from './camisa'

export interface Estampa {
  imagen: HTMLCanvasElement | HTMLImageElement | ImageBitmap
  anchoCm: number
  altoCm: number
  /** desplazamiento horizontal desde el centro (cm, positivo = derecha de quien mira el frente) */
  x: number
  /** distancia desde el punto más alto del hombro hasta el borde superior del diseño (cm) */
  y: number
}

let ruido: HTMLCanvasElement | null = null
function texturaTela() {
  if (ruido) return ruido
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(128, 128)
  for (let i = 0; i < img.data.length; i += 4) {
    const fila = Math.floor(i / 4 / 128)
    const tejido = fila % 2 === 0 ? 14 : -14 // punto de jersey: filas alternas
    const v = 128 + tejido + (Math.random() - 0.5) * 70
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  ruido = c
  return c
}

function mezclar(hex: string, factor: number) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const f = (v: number) => Math.round(Math.max(0, Math.min(255, v * factor)))
  return `rgb(${f(r)},${f(g)},${f(b)})`
}

/**
 * Pinta una cara de la camisa: color, tejido, costuras y el diseño a su tamaño real.
 * `espejo` se usa para la espalda, que se ve desde atrás.
 */
export function pintarCara(
  canvas: HTMLCanvasElement,
  s: Silueta,
  poly: Punto[],
  color: string,
  estampa: Estampa | null,
  espejo: boolean,
  pxcm: number,
) {
  const w = Math.round((s.maxX - s.minX) * pxcm)
  const h = Math.round((s.maxY - s.minY) * pxcm)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const ctx = canvas.getContext('2d')!
  ctx.save()
  ctx.clearRect(0, 0, w, h)
  trazarSilueta(ctx, s, poly, pxcm)
  ctx.fillStyle = color
  ctx.fill()
  ctx.clip()

  // Tejido
  ctx.globalAlpha = 0.07
  ctx.globalCompositeOperation = 'overlay'
  const pat = ctx.createPattern(texturaTela(), 'repeat')!
  ctx.fillStyle = pat
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'

  // Diseño a tamaño real
  if (estampa) {
    const dw = estampa.anchoCm * pxcm
    const dh = estampa.altoCm * pxcm
    const cx = (estampa.x * (espejo ? -1 : 1) - s.minX) * pxcm
    const top = (s.maxY - (s.arriba - estampa.y)) * pxcm
    ctx.save()
    if (espejo) {
      ctx.translate(cx, top)
      ctx.scale(-1, 1)
      ctx.drawImage(estampa.imagen, -dw / 2, 0, dw, dh)
    } else {
      ctx.drawImage(estampa.imagen, cx - dw / 2, top, dw, dh)
    }
    ctx.restore()
    // el tejido se nota un poco a través de la tinta
    ctx.globalAlpha = 0.05
    ctx.globalCompositeOperation = 'overlay'
    ctx.fillStyle = pat
    ctx.fillRect(cx - dw / 2, top, dw, dh)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  // Costuras y bordes
  trazarSilueta(ctx, s, poly, pxcm)
  ctx.lineWidth = 1.6 * pxcm
  ctx.strokeStyle = mezclar(color, 0.82)
  ctx.stroke()
  ctx.restore()
}
