import { createContext, Suspense, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { Canvas, invalidate, useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { activarModoLiviano, modoLiviano } from '../lib/gpu'

/** Calidad del 3D: "liviano" cuando el navegador dibuja por software o el equipo no da abasto. */
const CalidadContexto = createContext({ liviano: false })
export const useCalidad = () => useContext(CalidadContexto)

/**
 * Sombra suave del piso: una imagen con un degradado, dibujada una sola vez.
 * (La sombra "de contacto" de drei volvía a renderizar la escena en cada cuadro.)
 */
function SombraSuave({ y }: { y: number }) {
  const textura = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64)
    g.addColorStop(0, 'rgba(0,0,0,0.55)')
    g.addColorStop(0.55, 'rgba(0,0,0,0.22)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    const t = new THREE.CanvasTexture(c)
    return t
  }, [])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, y, 0]} renderOrder={-1}>
      <planeGeometry args={[90, 34]} />
      <meshBasicMaterial map={textura} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/**
 * Con "demand" la escena solo se dibuja cuando se pide. Los controles para girar la camisa con el dedo
 * o el mouse no lo piden solos: mientras se arrastra (y un momento después, mientras frena) se piden cuadros.
 */
function DibujarAlArrastrar() {
  useEffect(() => {
    let hasta = 0
    let raf = 0
    const seguir = () => {
      invalidate()
      raf = performance.now() < hasta ? requestAnimationFrame(seguir) : 0
    }
    const mover = (e: PointerEvent) => {
      if (!e.buttons && e.pointerType === 'mouse') return
      hasta = performance.now() + 900
      if (!raf) raf = requestAnimationFrame(seguir)
    }
    window.addEventListener('pointerdown', mover, { passive: true })
    window.addEventListener('pointermove', mover, { passive: true })
    window.addEventListener('pointerup', mover, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', mover)
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', mover)
      cancelAnimationFrame(raf)
    }
  }, [])
  return null
}

/**
 * Mide la fluidez solo mientras la escena se está moviendo. (El medidor de drei contaba los cuadros por
 * segundo y, como ahora la camisa quieta no se redibuja, confundía "quieta" con "equipo lento".)
 * Solo cuenta cuadros dibujados uno tras otro, sin ningún tic del navegador vacío entre ellos: así una
 * pausa nunca se confunde con lentitud. Se comparan tandas de 30 cuadros con la frecuencia del monitor.
 */
function MonitorRendimiento({ alBajar, alSubir, alRendirse }: { alBajar: () => void; alSubir: () => void; alRendirse: () => void }) {
  const m = useRef({ previo: -1, sonda: -2, suma: 0, n: 0, hz: 0, tandas: [] as number[], cambios: 0, listo: false })
  useFrame(() => {
    const e = m.current
    if (e.listo) return
    const ahora = Number(document.timeline?.currentTime ?? performance.now())
    // la sonda marca el tic siguiente al cuadro anterior: si es este mismo, los cuadros fueron seguidos
    const seguido = e.sonda === ahora
    const dt = ahora - e.previo
    e.previo = ahora
    requestAnimationFrame((t) => {
      e.sonda = t
    })
    if (!seguido || dt <= 0) return
    e.suma += dt
    if (++e.n < 30) return
    const fps = (1000 * e.n) / e.suma
    e.suma = 0
    e.n = 0
    e.hz = Math.max(e.hz, Math.min(fps, 250))
    e.tandas.push(fps)
    if (e.tandas.length < 4) return
    const [abajo, arriba] = e.hz > 90 ? [Math.min(70, e.hz * 0.55), e.hz * 0.85] : [45, 57]
    const lentas = e.tandas.filter((f) => f < abajo).length
    const rapidas = e.tandas.filter((f) => f >= arriba).length
    e.tandas = []
    if (lentas >= 3) {
      e.cambios++
      alBajar()
    } else if (rapidas === 4) {
      e.cambios++
      alSubir()
    }
    if (e.cambios > 4) {
      e.listo = true
      alRendirse()
    }
  })
  return null
}

/** Escenario común: luz de estudio sin descargar mapas de entorno externos. */
export function Escena({ children, camara = [0, 0, 150], sombraY = -42, className, capturable = false, fondo }: { children: ReactNode; camara?: [number, number, number]; sombraY?: number; className?: string; capturable?: boolean; fondo?: string }) {
  // Resolución adaptativa. En pantallas grandes se empieza en 1.25× como máximo (la diferencia no se nota
  // en una camisa que se mueve) y si el equipo no llega a una animación fluida se baja sola, hasta 0.6×.
  const [liviano, setLiviano] = useState(() => typeof window !== 'undefined' && modoLiviano())
  const tope = () => (modoLiviano() ? 0.6 : Math.min(window.devicePixelRatio || 1, window.innerWidth > 1200 ? 1.25 : 1.5))
  const [dpr, setDpr] = useState(() => (typeof window !== 'undefined' ? tope() : 1))
  useEffect(() => {
    // lo lee el medidor de FPS (?fps)
    const w = window as unknown as { __orionDpr?: number; __orionLiviano?: boolean }
    w.__orionDpr = dpr
    w.__orionLiviano = liviano
  }, [dpr, liviano])
  const pasarALiviano = () => {
    activarModoLiviano()
    setLiviano(true)
    setDpr(0.6)
  }
  return (
    <Canvas
      className={className}
      dpr={dpr}
      // "demand": solo se dibuja cuando algo cambia (scroll, giro, una barra…). Con la camisa quieta,
      // el procesador y la gráfica quedan libres; antes se redibujaba 60+ veces por segundo siempre.
      frameloop="demand"
      camera={{ position: camara, fov: 32, near: 1, far: 2000 }}
      gl={{ antialias: !liviano, alpha: !fondo, powerPreference: 'high-performance', preserveDrawingBuffer: capturable }}
      shadows={false}
      onCreated={(estado) => {
        if (import.meta.env.DEV) (window as unknown as { __r3f: unknown }).__r3f = estado
      }}
    >
      {fondo && <color attach="background" args={[fondo]} />}
      <DibujarAlArrastrar />
      <MonitorRendimiento
        // ya en el mínimo y sigue lento: modo liviano
        alBajar={() => (dpr <= 0.6 ? pasarALiviano() : setDpr((d) => Math.max(0.6, +(d - 0.2).toFixed(2))))}
        alSubir={() => setDpr((d) => Math.min(tope(), +(d + 0.15).toFixed(2)))}
        alRendirse={pasarALiviano}
      />
      <ambientLight intensity={0.25} />
      <directionalLight position={[-60, 90, 120]} intensity={1.6} />
      <directionalLight position={[80, 20, -100]} intensity={0.9} color="#ffd9cf" />
      <Suspense fallback={null}>
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={2.2} position={[0, 60, 90]} scale={[160, 60, 1]} />
          <Lightformer form="rect" intensity={1.2} position={[-140, 0, 40]} rotation-y={Math.PI / 2} scale={[100, 120, 1]} />
          <Lightformer form="rect" intensity={1.4} color="#e5381e" position={[140, -10, -40]} rotation-y={-Math.PI / 2} scale={[60, 120, 1]} />
        </Environment>
      </Suspense>
      <CalidadContexto.Provider value={{ liviano }}>
        <Suspense fallback={null}>{children}</Suspense>
      </CalidadContexto.Provider>
      <SombraSuave y={sombraY} />
    </Canvas>
  )
}
