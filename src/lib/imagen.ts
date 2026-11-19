import { urlPublica } from './rutas'

/* Herramientas de imagen: todo corre en el navegador del cliente; la imagen no sale de su equipo hasta que envía el pedido. */

export const TIPOS_PERMITIDOS = ['image/png', 'image/jpeg', 'image/webp']
export const PESO_MAXIMO = 25 * 1024 * 1024 // 25 MB
const LADO_MAXIMO = 6000

export function aLienzo(fuente: CanvasImageSource & { width: number; height: number }, w = fuente.width, h = fuente.height) {
  const c = document.createElement('canvas')
  c.width = Math.round(w)
  c.height = Math.round(h)
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(fuente, 0, 0, c.width, c.height)
  return c
}

export async function cargarArchivo(archivo: File): Promise<HTMLCanvasElement> {
  if (!TIPOS_PERMITIDOS.includes(archivo.type)) throw new Error('Formato no admitido. Sube un PNG, JPG o WEBP.')
  if (archivo.size > PESO_MAXIMO) throw new Error('La imagen pesa más de 25 MB. Prueba con una versión más liviana.')
  const bmp = await createImageBitmap(archivo)
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bmp.width, bmp.height))
  const c = aLienzo(bmp, bmp.width * escala, bmp.height * escala)
  bmp.close()
  return c
}

/** Recorta los bordes transparentes para que el tamaño en cm sea exactamente la tinta impresa. */
export function recortarTransparente(c: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height)
  let x0 = width, y0 = height, x1 = -1, y1 = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return c
  if (x0 === 0 && y0 === 0 && x1 === width - 1 && y1 === height - 1) return c
  const out = document.createElement('canvas')
  out.width = x1 - x0 + 1
  out.height = y1 - y0 + 1
  out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

export function tieneTransparencia(c: HTMLCanvasElement) {
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const { data } = ctx.getImageData(0, 0, c.width, c.height)
  for (let i = 3; i < data.length; i += 16) if (data[i] < 250) return true
  return false
}

/**
 * Quita un fondo de color liso (por ejemplo blanco) rellenando desde los bordes.
 * Rápido y sin descargas; ideal para logos y dibujos sobre fondo plano.
 */
export function quitarFondoLiso(c: HTMLCanvasElement, tolerancia = 38, enTodo = false): HTMLCanvasElement {
  const out = aLienzo(c)
  const ctx = out.getContext('2d', { willReadFrequently: true })!
  const img = ctx.getImageData(0, 0, out.width, out.height)
  const { data, width: w, height: h } = img
  // color de fondo: promedio de las cuatro esquinas
  const esquinas = [0, w - 1, (h - 1) * w, h * w - 1]
  const ref = [0, 0, 0]
  esquinas.forEach((p) => { ref[0] += data[p * 4]; ref[1] += data[p * 4 + 1]; ref[2] += data[p * 4 + 2] })
  ref.forEach((_, i) => (ref[i] /= 4))
  const dist = (p: number) => {
    const dr = data[p * 4] - ref[0], dg = data[p * 4 + 1] - ref[1], db = data[p * 4 + 2] - ref[2]
    return Math.sqrt(dr * dr + dg * dg + db * db)
  }
  if (enTodo) {
    // quita ese color también en los huecos cerrados (el interior de letras, anillos, etc.)
    for (let p = 0; p < w * h; p++) {
      const d = dist(p)
      if (d < tolerancia * 1.6) data[p * 4 + 3] = Math.min(data[p * 4 + 3], d < tolerancia ? 0 : Math.round(((d - tolerancia) / (tolerancia * 0.6)) * 255))
    }
    ctx.putImageData(img, 0, 0)
    return recortarTransparente(out)
  }
  const visto = new Uint8Array(w * h)
  const pila: number[] = []
  for (let x = 0; x < w; x++) pila.push(x, (h - 1) * w + x)
  for (let y = 0; y < h; y++) pila.push(y * w, y * w + w - 1)
  while (pila.length) {
    const p = pila.pop()!
    if (visto[p]) continue
    visto[p] = 1
    const d = dist(p)
    if (d > tolerancia * 1.6) continue
    // borde suave: transparencia parcial cerca del límite
    const a = d < tolerancia ? 0 : Math.round(((d - tolerancia) / (tolerancia * 0.6)) * 255)
    data[p * 4 + 3] = Math.min(data[p * 4 + 3], a)
    if (d >= tolerancia) continue
    const x = p % w, y = (p / w) | 0
    if (x > 0) pila.push(p - 1)
    if (x < w - 1) pila.push(p + 1)
    if (y > 0) pila.push(p - w)
    if (y < h - 1) pila.push(p + w)
  }
  ctx.putImageData(img, 0, 0)
  return recortarTransparente(out)
}

type Progreso = (texto: string, fraccion?: number) => void

let segmentador: Promise<(img: unknown) => Promise<{ toCanvas: () => HTMLCanvasElement | OffscreenCanvas }>> | null = null

/** Quita el fondo con IA (modelo BiRefNet lite, licencia MIT). Descarga el modelo una sola vez (~110 MB). */
export async function quitarFondoIA(c: HTMLCanvasElement, progreso: Progreso): Promise<HTMLCanvasElement> {
  const tf = await import('@huggingface/transformers')
  tf.env.allowLocalModels = false
  if (!segmentador) {
    const gpu = 'gpu' in navigator
    segmentador = tf.pipeline('background-removal', 'onnx-community/BiRefNet_lite-ONNX', {
      device: gpu ? 'webgpu' : 'wasm',
      dtype: gpu ? 'fp16' : 'fp32',
      progress_callback: (p: { status: string; progress?: number }) => {
        if (p.status === 'progress' && typeof p.progress === 'number') progreso('Descargando el modelo de IA (solo la primera vez)…', p.progress / 100)
      },
    }) as unknown as typeof segmentador
  }
  try {
    const ejecutar = await segmentador!
    progreso('Separando el diseño del fondo…')
    const entrada = tf.RawImage.fromCanvas(c)
    const salida = await ejecutar(entrada)
    const lienzo = salida.toCanvas()
    return recortarTransparente(aLienzo(lienzo as HTMLCanvasElement))
  } catch (e) {
    segmentador = null
    throw e
  }
}

/**
 * Mejora la resolución con ESRGAN (UpscalerJS, licencia MIT). El modelo se sirve desde este mismo sitio.
 * Escala ×2 o ×4. Para no colgar el teléfono, la imagen de entrada se limita a 1400 px de lado.
 */
export async function mejorarCalidad(c: HTMLCanvasElement, escala: 2 | 4, progreso: Progreso): Promise<HTMLCanvasElement> {
  progreso('Preparando el modelo de mejora…')
  const [{ default: Upscaler }, modelo] = await Promise.all([
    import('upscaler'),
    escala === 2 ? import('@upscalerjs/esrgan-slim/2x') : import('@upscalerjs/esrgan-slim/4x'),
  ])
  const def = modelo.default as Record<string, unknown>
  const upscaler = new Upscaler({
    model: { ...def, path: new URL(urlPublica(`modelos/esrgan-slim/x${escala}/model.json`), location.href).href } as never,
  })
  const lado = Math.max(c.width, c.height)
  const limite = escala === 4 ? 700 : 1400
  const entrada = lado > limite ? aLienzo(c, (c.width * limite) / lado, (c.height * limite) / lado) : c
  // el modelo trabaja con RGB: guardamos la transparencia y la escalamos aparte
  const alfa = tieneTransparencia(entrada) ? entrada : null
  const fondo = aLienzo(entrada)
  const src: string = await upscaler.upscale(fondo, {
    patchSize: 64,
    padding: 4,
    progress: (p: number) => progreso('Mejorando la calidad…', p),
  })
  await upscaler.dispose()
  const img = new Image()
  img.src = src
  await img.decode()
  const out = aLienzo(img)
  if (alfa) {
    const ctx = out.getContext('2d')!
    ctx.globalCompositeOperation = 'destination-in'
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(alfa, 0, 0, out.width, out.height)
  }
  return out
}

/** Resolución efectiva (DPI) de la imagen al tamaño de impresión elegido. */
export function dpiEfectivo(pxAncho: number, anchoCm: number) {
  return pxAncho / (anchoCm / 2.54)
}

export function calidadDPI(dpi: number) {
  if (dpi >= 240) return { nivel: 'buena', texto: 'Calidad de impresión buena' } as const
  if (dpi >= 150) return { nivel: 'aceptable', texto: 'Aceptable: puede verse algo suave de cerca' } as const
  return { nivel: 'baja', texto: 'Baja: se verá pixelada. Usa "Mejorar calidad" o una imagen más grande' } as const
}

/**
 * Genera el PNG listo para DTF al tamaño real. 300 DPI cuando el navegador lo permite;
 * los iPhone limitan los lienzos a ~16 millones de píxeles, así que ahí se baja lo justo.
 */
export async function exportarImpresion(c: HTMLCanvasElement, anchoCm: number, altoCm: number) {
  const pulgW = anchoCm / 2.54
  const pulgH = altoCm / 2.54
  const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const limitePx = esIOS ? 16_000_000 : 60_000_000
  const dpi = Math.min(300, Math.floor(Math.sqrt(limitePx / (pulgW * pulgH))))
  const out = aLienzo(c, pulgW * dpi, pulgH * dpi)
  const blob = await new Promise<Blob>((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo generar el archivo'))), 'image/png'))
  return { blob, dpi, ancho: out.width, alto: out.height }
}

export async function aBlob(c: HTMLCanvasElement, tipo = 'image/png', calidad?: number) {
  return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo generar la imagen'))), tipo, calidad))
}
