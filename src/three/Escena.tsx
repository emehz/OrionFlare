import { Suspense, useMemo, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, PerformanceMonitor, Stats } from '@react-three/drei'

const mostrarFps = typeof location !== 'undefined' && new URLSearchParams(location.search).has('fps')

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
  // resolución adaptativa: si el equipo no llega a ~50 FPS, se dibuja con menos píxeles
  const [dpr, setDpr] = useState(() => Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.5))
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
        bounds={() => [45, 58]}
        onDecline={() => setDpr((d) => Math.max(0.75, +(d - 0.25).toFixed(2)))}
        onIncline={() => setDpr((d) => Math.min(Math.min(window.devicePixelRatio, 1.5), +(d + 0.25).toFixed(2)))}
        flipflops={3}
        onFallback={() => setDpr(1)}
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
      {mostrarFps && <Stats />}
    </Canvas>
  )
}
