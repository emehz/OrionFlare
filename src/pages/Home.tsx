import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { Escena } from '../three/Escena'
import { Camisa3D } from '../three/Camisa3D'
import { COLORES, PRENDAS, areaMaxima, medidasCm, type Prenda, type Talla } from '../data/prendas'
import { MUESTRAS, muestraAlAzar, TINTA_CLARA, TINTA_OSCURA } from '../lib/muestras'
import { useMuestra, conFondo } from '../lib/useMuestra'
import type { Estampa } from '../lib/texturas'
import { Tallas } from '../components/Tallas'
import { Precios } from '../components/Precios'
import { Preguntas } from '../components/Preguntas'
import './Home.css'

gsap.registerPlugin(ScrollTrigger)

type Capitulo = 'inicio' | 'prenda' | 'diseno' | 'medidas' | 'dtf'

interface Objetivo {
  rot: number
  dist: number
  x: number
  y: number
  giro: boolean
}

const reducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const movil = () => window.matchMedia('(max-width: 900px)').matches

function objetivoDe(cap: Capitulo, progreso: number): Objetivo {
  const m = movil()
  const lado = m ? 0 : 24
  switch (cap) {
    case 'inicio':
      return { rot: 0, dist: m ? 340 : 200, x: m ? 0 : 4, y: m ? 30 : 7, giro: true }
    case 'prenda':
      // vaivén de tres cuartos: la camisa es plana de perfil, así que nunca se muestra de canto
      return { rot: Math.sin(progreso * Math.PI * 2) * 0.75, dist: m ? 340 : 200, x: lado, y: m ? 34 : 2, giro: false }
    case 'diseno':
      return { rot: -0.3 + progreso * 0.6, dist: m ? 300 : 175, x: lado, y: m ? 30 : 2, giro: false }
    case 'medidas':
      return { rot: 0, dist: m ? 400 : 235, x: m ? 0 : lado + 6, y: m ? 40 : 4, giro: false }
    case 'dtf':
      return { rot: Math.PI - 0.4 + progreso * 0.8, dist: m ? 330 : 195, x: lado, y: m ? 32 : 2, giro: false }
  }
}

function Controlador({ objetivo }: { objetivo: React.RefObject<Objetivo> }) {
  const grupo = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const extra = useRef(0)
  useFrame((_, dt) => {
    const o = objetivo.current
    const g = grupo.current
    if (!g) return
    const k = reducido() ? 1 : 1 - Math.pow(0.0025, dt) // amortiguado independiente de los FPS
    if (o.giro && !reducido()) extra.current += dt * 0.35
    else extra.current += (Math.round(extra.current / (Math.PI * 2)) * Math.PI * 2 - extra.current) * k
    g.rotation.y += (o.rot + extra.current - g.rotation.y) * k
    g.position.x += (o.x - g.position.x) * k
    g.position.y += (o.y - g.position.y) * k
    camera.position.z += (o.dist - camera.position.z) * k
    camera.lookAt(0, 0, 0)
  })
  return <group ref={grupo}><CamisaPortada /></group>
}

// Estado compartido de la portada (lo cambia el scroll; lo lee la camisa)
interface EstadoPortada {
  prenda: Prenda
  talla: Talla
  colorId: string
  muestra: string
  muestraEspalda: string
  sucio: boolean
  reglas: boolean
}
let fijarEstado: (p: Partial<EstadoPortada>) => void = () => {}
let leerEstado: EstadoPortada

function estampaPara(lienzo: HTMLCanvasElement | null, prenda: Prenda, talla: Talla, espalda: boolean): Estampa | null {
  if (!lienzo) return null
  const max = areaMaxima(prenda, talla)
  let ancho = Math.min(max.ancho * 0.82, 30)
  let alto = (ancho * lienzo.height) / lienzo.width
  if (alto > max.alto * 0.85) {
    alto = max.alto * 0.85
    ancho = (alto * lienzo.width) / lienzo.height
  }
  return { imagen: lienzo, anchoCm: ancho, altoCm: alto, x: 0, y: espalda ? 8 : 9.5 }
}

function CamisaPortada() {
  const [e, setE] = useState<EstadoPortada>(leerEstado)
  useEffect(() => {
    fijarEstado = (p) => setE((prev) => ({ ...prev, ...p }))
    if (import.meta.env.DEV) (window as unknown as { __portada: () => unknown }).__portada = () => ({ ...leerEstado })
    return () => {
      fijarEstado = () => {}
    }
  }, [])
  const color = COLORES.find((c) => c.id === e.colorId) ?? COLORES[0]
  const tinta = color.claro ? TINTA_OSCURA : TINTA_CLARA
  const frente = useMuestra(e.muestra, tinta)
  const espalda = useMuestra(e.muestraEspalda, tinta)
  const frenteFinal = useMemo(() => (e.sucio && frente ? conFondo(frente) : frente), [e.sucio, frente])
  return (
    <Camisa3D
      prenda={e.prenda}
      talla={e.talla}
      color={color}
      frente={estampaPara(frenteFinal, e.prenda, e.talla, false)}
      espalda={estampaPara(espalda, e.prenda, e.talla, true)}
      reglas={e.reglas}
    />
  )
}

const UNISEX = PRENDAS[0]
const OVERSIZE = PRENDAS[1]
const tallaDe = (p: Prenda, t: string) => p.tallas.find((x) => x.talla === t) ?? p.tallas[0]

export default function Home() {
  const objetivo = useRef<Objetivo>(objetivoDe('inicio', 0))
  const raiz = useRef<HTMLDivElement>(null)
  const [muestra, setMuestra] = useState(() => muestraAlAzar().id)
  const [capitulo, setCapitulo] = useState<Capitulo>('inicio')

  // estado inicial de la camisa antes de montar el canvas
  if (!leerEstado) {
    leerEstado = {
      prenda: UNISEX,
      talla: tallaDe(UNISEX, 'L'),
      colorId: 'negro',
      muestra,
      muestraEspalda: muestraAlAzar(muestra).id,
      sucio: false,
      reglas: false,
    }
  }

  useEffect(() => {
    leerEstado = { ...leerEstado, muestra }
    fijarEstado({ muestra })
  }, [muestra])

  useEffect(() => {
    const lenis = reducido() ? null : new Lenis({ lerp: 0.12 })
    let raf = 0
    if (lenis) {
      lenis.on('scroll', ScrollTrigger.update)
      const bucle = (t: number) => {
        lenis.raf(t)
        raf = requestAnimationFrame(bucle)
      }
      raf = requestAnimationFrame(bucle)
    }

    const ctx = gsap.context(() => {
      const caps = gsap.utils.toArray<HTMLElement>('[data-cap]')
      caps.forEach((el) => {
        const cap = el.dataset.cap as Capitulo
        ScrollTrigger.create({
          trigger: el,
          start: 'top 55%',
          end: 'bottom 45%',
          onToggle: (st) => {
            if (!st.isActive) return
            setCapitulo(cap)
            objetivo.current = objetivoDe(cap, st.progress)
            const base: Partial<EstadoPortada> = { reglas: cap === 'medidas', sucio: false }
            if (cap === 'inicio') Object.assign(base, { prenda: UNISEX, talla: tallaDe(UNISEX, 'L'), colorId: 'negro' })
            if (cap === 'diseno') Object.assign(base, { prenda: UNISEX, talla: tallaDe(UNISEX, 'L'), colorId: 'arena', sucio: st.progress < 0.5 })
            if (cap === 'medidas') Object.assign(base, { prenda: OVERSIZE, talla: tallaDe(OVERSIZE, '2XL'), colorId: 'negro' })
            if (cap === 'dtf') Object.assign(base, { prenda: UNISEX, talla: tallaDe(UNISEX, 'M'), colorId: 'blanco' })
            leerEstado = { ...leerEstado, ...base }
            fijarEstado(base)
          },
          onUpdate: (st) => {
            if (!st.isActive) return
            objetivo.current = objetivoDe(cap, st.progress)
            if (cap === 'prenda') {
              const colores = ['negro', 'marino', 'blanco', 'vino']
              const colorId = colores[Math.min(colores.length - 1, Math.floor(st.progress * colores.length))]
              const prenda = st.progress < 0.5 ? UNISEX : OVERSIZE
              if (colorId !== leerEstado.colorId || prenda !== leerEstado.prenda) {
                const p = { colorId, prenda, talla: tallaDe(prenda, prenda === OVERSIZE ? 'XL' : 'L') }
                leerEstado = { ...leerEstado, ...p }
                fijarEstado(p)
              }
            }
            if (cap === 'diseno') {
              const sucio = st.progress < 0.45
              if (sucio !== leerEstado.sucio) {
                leerEstado = { ...leerEstado, sucio }
                fijarEstado({ sucio })
              }
            }
          },
        })
      })

      if (!reducido()) {
        gsap.utils.toArray<HTMLElement>('.cap__panel').forEach((el) => {
          gsap.fromTo(
            el,
            { autoAlpha: 0.001, y: 40, filter: 'blur(6px)' },
            {
              autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out',
              scrollTrigger: { trigger: el, start: 'top 82%', toggleActions: 'play none none reverse' },
            },
          )
        })
      }
    }, raiz)

    return () => {
      ctx.revert()
      cancelAnimationFrame(raf)
      lenis?.destroy()
    }
  }, [])

  const otroDiseno = () => setMuestra((m) => muestraAlAzar(m).id)
  const nombreMuestra = MUESTRAS.find((m) => m.id === muestra)?.nombre
  const tallaMedidas = medidasCm(tallaDe(OVERSIZE, '2XL'))

  return (
    <div ref={raiz} className="portada" data-capitulo={capitulo}>
      <div className="portada__lienzo" aria-hidden="true">
        <Escena camara={[0, 0, 150]} sombraY={-46}>
          <Controlador objetivo={objetivo} />
        </Escena>
      </div>

      <section className="cap cap--inicio" data-cap="inicio" aria-labelledby="titulo-inicio">
        <p className="inicio__vertical" aria-hidden="true">オリオン<br />フレア</p>
        <div className="inicio__texto">
          <h1 id="titulo-inicio">Tu diseño en una camisa, <span>a tamaño real.</span></h1>
          <p className="inicio__bajada">Camisas de algodón estampadas en DTF en Santa Ana. Subes tu imagen, la limpiamos y la ves en 3D antes de pedir.</p>
        </div>
        <div className="inicio__acciones">
          <Link to="/crear" className="boton boton--grande">Diseñar la mía</Link>
          <button type="button" className="boton boton--fantasma" onClick={otroDiseno}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7h3.5c2 0 3.2 1 4.3 2.8l2.4 4.4c1 1.8 2.3 2.8 4.3 2.8H21" /><path d="M3 17h3.5c1.3 0 2.3-.5 3.1-1.3" /><path d="M14.4 8.3c.8-.8 1.8-1.3 3.1-1.3H21" /><path d="m18 4 3 3-3 3M18 14l3 3-3 3" /></svg>
            Otro diseño
          </button>
          <p className="inicio__muestra" aria-live="polite">Diseño de ejemplo: <strong>{nombreMuestra}</strong></p>
        </div>
      </section>

      <section className="cap" data-cap="prenda" aria-labelledby="titulo-prenda">
        <div className="cap__panel">
          <p className="cap__kana" aria-hidden="true">服</p>
          <h2 id="titulo-prenda">Ocho cortes, de la talla 0 a la 4XL.</h2>
          <p>Unisex, oversize, manga larga, sin manga, dama, cuello V, crop top e infantil. La camisa que ves cambia de forma con cada corte y cada talla, porque está hecha con las medidas reales de nuestro proveedor.</p>
          <ul className="cap__lista">
            {PRENDAS.map((p) => <li key={p.id}>{p.nombre}</li>)}
          </ul>
        </div>
      </section>

      <section className="cap" data-cap="diseno" aria-labelledby="titulo-diseno">
        <div className="cap__panel">
          <p className="cap__kana" aria-hidden="true">絵</p>
          <h2 id="titulo-diseno">Sube cualquier imagen. Nosotros la dejamos lista.</h2>
          <p>¿Tu imagen trae fondo blanco? Lo quitamos con un clic. ¿Es pequeña? La mejoramos con IA para que no salga pixelada. Todo pasa en tu navegador: tu imagen no se sube a ningún lado hasta que haces el pedido.</p>
          <p className="cap__nota">Sigue bajando y mira cómo desaparece el recuadro blanco del diseño.</p>
        </div>
      </section>

      <section className="cap" data-cap="medidas" aria-labelledby="titulo-medidas">
        <div className="cap__panel">
          <p className="cap__kana" aria-hidden="true">寸</p>
          <h2 id="titulo-medidas">Lo que ves es lo que se imprime.</h2>
          <p>Cada diseño se coloca en centímetros sobre la talla que elijas. Esta oversize 2XL mide {tallaMedidas.ancho.toFixed(0)} cm de ancho por {tallaMedidas.largo.toFixed(0)} cm de largo, y las reglas marcan el tamaño exacto del estampado. Si tu imagen no tiene resolución suficiente para ese tamaño, te avisamos antes de pedir.</p>
        </div>
      </section>

      <section className="cap" data-cap="dtf" aria-labelledby="titulo-dtf">
        <div className="cap__panel">
          <p className="cap__kana" aria-hidden="true">刷</p>
          <h2 id="titulo-dtf">Frente, espalda y una etiqueta propia.</h2>
          <p>Imprimimos en película DTF de 60 cm de ancho y juntamos varios diseños en el mismo metro, así pagas por el área de tu estampado y no por la hoja entera. Cada camisa lleva la etiqueta de Orion Flare con su talla.</p>
          <Link to="/crear" className="boton">Empezar mi diseño</Link>
        </div>
      </section>

      <div className="portada__solido">
        <Tallas />
        <Precios />
        <Preguntas />
        <section className="cierre trama" aria-labelledby="titulo-cierre">
          <p className="cierre__sello" aria-hidden="true">注文</p>
          <h2 id="titulo-cierre">¿Ya tienes la imagen? Ponla en tu camisa.</h2>
          <Link to="/crear" className="boton boton--grande">Diseñar la mía</Link>
        </section>
      </div>
    </div>
  )
}
