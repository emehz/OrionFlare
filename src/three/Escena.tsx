import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei'

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

/** Escenario común: luz de estudio sin descargar mapas de entorno externos. */
export function Escena({ children, camara = [0, 0, 150], sombraY = -42, className, capturable = false, fondo }: { children: ReactNode; camara?: [number, number, number]; sombraY?: number; className?: string; capturable?: boolean; fondo?: string }) {
  // Resolución adaptativa. En pantallas grandes se empieza en 1.25× como máximo (la diferencia no se nota
  // en una camisa que se mueve) y si el equipo no llega a una animación fluida se baja sola, hasta 0.6×.
  const tope = () => Math.min(window.devicePixelRatio || 1, window.innerWidth > 1200 ? 1.25 : 1.5)
  const [dpr, setDpr] = useState(() => (typeof window !== 'undefined' ? tope() : 1))
  useEffect(() => {
    // lo lee el medidor de FPS (?fps)
    ;(window as unknown as { __orionDpr?: number }).__orionDpr = dpr
  }, [dpr])
  return (
    <Canvas
      className={className}
      dpr={dpr}
      camera={{ position: camara, fov: 32, near: 1, far: 2000 }}
      gl={{ antialias: true, alpha: !fondo, powerPreference: 'high-performance', preserveDrawingBuffer: capturable }}
      shadows={false}
      onCreated={(estado) => {
        if (import.meta.env.DEV) (window as unknown as { __r3f: unknown }).__r3f = estado
      }}
    >
      {fondo && <color attach="background" args={[fondo]} />}
      <PerformanceMonitor
        // límites según la frecuencia del monitor (60, 120, 144 Hz…)
        bounds={(hz) => (hz > 90 ? [Math.min(70, hz * 0.55), hz * 0.85] : [45, 57])}
        onDecline={() => setDpr((d) => Math.max(0.6, +(d - 0.2).toFixed(2)))}
        onIncline={() => setDpr((d) => Math.min(tope(), +(d + 0.15).toFixed(2)))}
        flipflops={4}
        onFallback={() => setDpr(0.8)}
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
      <Suspense fallback={null}>{children}</Suspense>
      <SombraSuave y={sombraY} />
    </Canvas>
  )
}
