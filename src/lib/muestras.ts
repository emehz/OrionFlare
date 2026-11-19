import { urlPublica } from './rutas'

/*
 * Diseños de ejemplo originales de Orion Flare, dibujados en código (sin imágenes de terceros).
 * Se usan en la portada (cada visita muestra uno al azar) y como punto de partida en el configurador.
 */

export interface Muestra {
  id: string
  nombre: string
  /** proporción ancho / alto */
  proporcion: number
  dibujar: (tinta: string, acento: string) => Promise<HTMLCanvasElement>
}

const DISPLAY = '"Dela Gothic One", "Zen Kaku Gothic New", sans-serif'
const TEXTO = '"Zen Kaku Gothic New", sans-serif'

async function fuentes() {
  await Promise.all([
    document.fonts.load(`120px ${DISPLAY}`, 'オリオンフレア流星信号夜行ORION'),
    document.fonts.load(`700 40px ${TEXTO}`, 'SANTA ANA サンタアナ'),
  ])
}

function lienzo(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

const cacheImg = new Map<string, Promise<HTMLImageElement>>()
function imagen(url: string) {
  if (!cacheImg.has(url)) {
    cacheImg.set(
      url,
      new Promise((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = rej
        i.src = url
      }),
    )
  }
  return cacheImg.get(url)!
}

/** Trama de puntos (screentone de manga) dentro de un círculo, más densa hacia un lado. */
function trama(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, paso: number, color: string) {
  ctx.fillStyle = color
  for (let y = cy - r; y <= cy + r; y += paso) {
    for (let x = cx - r; x <= cx + r; x += paso) {
      const dx = x - cx, dy = y - cy
      if (dx * dx + dy * dy > r * r) continue
      const luz = (dx + dy) / (2 * r) + 0.5 // 0 arriba-izquierda, 1 abajo-derecha
      const rad = paso * 0.5 * Math.min(1, Math.max(0.08, luz * 1.15))
      ctx.beginPath()
      ctx.arc(x, y, rad, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function lineasVelocidad(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n: number, color: string) {
  ctx.fillStyle = color
  for (let i = 0; i < n; i++) {
    const yy = y + (h * i) / n + (Math.sin(i * 12.9898) * 0.5 + 0.5) * (h / n)
    const largo = w * (0.35 + ((Math.sin(i * 78.233) + 1) / 2) * 0.65)
    const xx = x + w - largo
    const grosor = 2 + ((Math.sin(i * 3.1) + 1) / 2) * 7
    ctx.beginPath()
    ctx.moveTo(xx, yy)
    ctx.lineTo(xx + largo, yy - grosor / 2)
    ctx.lineTo(xx + largo, yy + grosor / 2)
    ctx.closePath()
    ctx.fill()
  }
}

function vertical(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, tam: number, interlineado = 1.02) {
  ;[...texto].forEach((ch, i) => ctx.fillText(ch, x, y + i * tam * interlineado))
}

export const MUESTRAS: Muestra[] = [
  {
    id: 'orion',
    nombre: 'Orion Flare',
    proporcion: 1500 / 1700,
    async dibujar(tinta) {
      await fuentes()
      const [c, ctx] = lienzo(1500, 1700)
      const logo = await imagen(urlPublica(`brand/logo-${tinta === '#0b0b0c' ? 'negro' : 'blanco'}.png`))
      const lw = 900
      ctx.drawImage(logo, (1500 - lw) / 2, 40, lw, (lw * logo.height) / logo.width)
      ctx.fillStyle = tinta
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.font = `230px ${DISPLAY}`
      ctx.fillText('オリオン', 750, 760)
      ctx.fillText('フレア', 750, 1010)
      ctx.font = `700 64px ${TEXTO}`
      ctx.fillText('SANTA ANA — EL SALVADOR', 750, 1340)
      ctx.fillRect(250, 1460, 1000, 10)
      ctx.font = `700 48px ${TEXTO}`
      ctx.fillText('HECHO EN EL SALVADOR', 750, 1510)
      return c
    },
  },
  {
    id: 'meteoro',
    nombre: 'Meteoro',
    proporcion: 1500 / 1800,
    async dibujar(tinta, acento) {
      await fuentes()
      const [c, ctx] = lienzo(1500, 1800)
      trama(ctx, 640, 760, 520, 26, tinta)
      ctx.strokeStyle = tinta
      ctx.lineWidth = 34
      ctx.beginPath()
      ctx.ellipse(640, 800, 760, 170, -0.32, Math.PI * 0.05, Math.PI * 0.95)
      ctx.stroke()
      lineasVelocidad(ctx, 0, 120, 1200, 160, 9, acento)
      ctx.fillStyle = tinta
      ctx.font = `300px ${DISPLAY}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      vertical(ctx, '流星', 1310, 260, 300)
      ctx.font = `150px ${DISPLAY}`
      ctx.textAlign = 'left'
      ctx.fillText('METEOR', 60, 1450)
      return c
    },
  },
  {
    id: 'continue',
    nombre: 'Continue?',
    proporcion: 1500 / 1300,
    async dibujar(tinta, acento) {
      await fuentes()
      const [c, ctx] = lienzo(1500, 1300)
      const corazon = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']
      const pix = 26
      for (let k = 0; k < 3; k++) {
        corazon.forEach((fila, j) =>
          [...fila].forEach((ch, i) => {
            if (ch !== 'X') return
            ctx.fillStyle = k < 2 ? acento : tinta
            ctx.globalAlpha = k < 2 ? 1 : 0.35
            ctx.fillRect(330 + k * 300 + i * pix, 60 + j * pix, pix - 3, pix - 3)
          }),
        )
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = tinta
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.font = `250px ${DISPLAY}`
      const ancho = ctx.measureText('CONTINUE?').width
      if (ancho > 1440) ctx.font = `${Math.floor((250 * 1440) / ancho)}px ${DISPLAY}`
      ctx.fillText('CONTINUE?', 750, 300)
      ctx.font = `120px ${DISPLAY}`
      ctx.fillText('コンティニュー', 750, 650)
      ctx.font = `360px ${DISPLAY}`
      ctx.fillStyle = acento
      ctx.fillText('10', 750, 830)
      return c
    },
  },
  {
    id: 'senal',
    nombre: 'Sin señal',
    proporcion: 1500 / 1100,
    async dibujar(tinta, acento) {
      await fuentes()
      const [base, b] = lienzo(1500, 1100)
      b.textAlign = 'center'
      b.textBaseline = 'top'
      b.font = `290px ${DISPLAY}`
      b.fillStyle = tinta
      b.fillText('NO', 750, 40)
      b.fillText('SIGNAL', 750, 360)
      b.font = `130px ${DISPLAY}`
      b.fillText('信号なし', 750, 800)
      const [c, ctx] = lienzo(1500, 1100)
      // cortes de interferencia: franjas desplazadas con un eco en color
      let y = 0
      let i = 0
      while (y < 1100) {
        const h = 24 + ((i * 37) % 70)
        const desp = i % 4 === 1 ? 46 : i % 5 === 3 ? -38 : 0
        if (desp !== 0) {
          ctx.globalAlpha = 0.9
          ctx.drawImage(base, 0, y, 1500, h, desp * 1.6, y, 1500, h)
          ctx.globalCompositeOperation = 'source-atop'
          ctx.fillStyle = acento
          ctx.fillRect(0, y, 1500, h)
          ctx.globalCompositeOperation = 'source-over'
          ctx.globalAlpha = 1
        }
        ctx.drawImage(base, 0, y, 1500, h, desp, y, 1500, h)
        y += h
        i++
      }
      return c
    },
  },
  {
    id: 'nocturno',
    nombre: 'Corredor nocturno',
    proporcion: 1400 / 1800,
    async dibujar(tinta, acento) {
      await fuentes()
      const [c, ctx] = lienzo(1400, 1800)
      ctx.strokeStyle = tinta
      ctx.lineWidth = 16
      // viñetas de manga
      const paneles: [number, number, number, number][] = [
        [20, 20, 860, 640],
        [920, 20, 460, 640],
        [20, 700, 1360, 560],
      ]
      paneles.forEach(([x, y, w, h], k) => {
        ctx.strokeRect(x, y, w, h)
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, y, w, h)
        ctx.clip()
        if (k === 0) trama(ctx, x + w * 0.7, y + h * 0.55, 420, 22, tinta)
        if (k === 1) {
          ctx.fillStyle = acento
          ctx.fillRect(x, y, w, h)
          ctx.fillStyle = '#0b0b0c'
          ctx.font = `150px ${DISPLAY}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          vertical(ctx, '夜行', x + w / 2, y + 140, 170)
        }
        if (k === 2) lineasVelocidad(ctx, x, y + 40, w, h - 80, 26, tinta)
        ctx.restore()
      })
      ctx.fillStyle = tinta
      ctx.font = `200px ${DISPLAY}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText('NIGHT RUN', 20, 1330)
      ctx.font = `700 54px ${TEXTO}`
      ctx.fillText('第一話 — CAPÍTULO 01', 26, 1630)
      return c
    },
  },
  {
    id: 'santa-ana',
    nombre: 'Santa Ana 503',
    proporcion: 1,
    async dibujar(tinta, acento) {
      await fuentes()
      const [c, ctx] = lienzo(1500, 1500)
      trama(ctx, 560, 600, 470, 30, acento)
      ctx.fillStyle = tinta
      ctx.textBaseline = 'top'
      ctx.textAlign = 'left'
      ctx.font = `520px ${DISPLAY}`
      ctx.fillText('503', 40, 360)
      ctx.font = `150px ${DISPLAY}`
      ctx.textAlign = 'center'
      vertical(ctx, 'サンタアナ', 1360, 60, 165, 0.98)
      ctx.textAlign = 'left'
      ctx.font = `700 70px ${TEXTO}`
      ctx.fillText('SANTA ANA · SV', 50, 1050)
      ctx.fillRect(50, 1160, 1080, 12)
      return c
    },
  },
]

export function muestraAlAzar(excepto?: string) {
  const opciones = MUESTRAS.filter((m) => m.id !== excepto)
  return opciones[Math.floor(Math.random() * opciones.length)]
}

export const TINTA_CLARA = '#f2f0ea'
export const TINTA_OSCURA = '#0b0b0c'
export const ACENTO = '#e5381e'
