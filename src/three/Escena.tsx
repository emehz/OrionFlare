import { Suspense, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer } from '@react-three/drei'

/** Escenario común: luz de estudio sin descargar mapas de entorno externos. */
export function Escena({ children, camara = [0, 0, 150], sombraY = -42, className, capturable = false }: { children: ReactNode; camara?: [number, number, number]; sombraY?: number; className?: string; capturable?: boolean }) {
  return (
    <Canvas
      className={className}
      dpr={[1, 1.75]}
      camera={{ position: camara, fov: 32, near: 1, far: 2000 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: capturable }}
      shadows={false}
      onCreated={(estado) => {
        if (import.meta.env.DEV) (window as unknown as { __r3f: unknown }).__r3f = estado
      }}
    >
      <ambientLight intensity={0.25} />
      <directionalLight position={[-60, 90, 120]} intensity={1.6} />
      <directionalLight position={[80, 20, -100]} intensity={0.9} color="#ffd9cf" />
      <Suspense fallback={null}>
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2.2} position={[0, 60, 90]} scale={[160, 60, 1]} />
          <Lightformer form="rect" intensity={1.2} position={[-140, 0, 40]} rotation-y={Math.PI / 2} scale={[100, 120, 1]} />
          <Lightformer form="rect" intensity={1.4} color="#e5381e" position={[140, -10, -40]} rotation-y={-Math.PI / 2} scale={[60, 120, 1]} />
        </Environment>
      </Suspense>
      <Suspense fallback={null}>{children}</Suspense>
      <ContactShadows position={[0, sombraY, 0]} opacity={0.55} scale={160} blur={2.6} far={60} resolution={512} color="#000000" />
    </Canvas>
  )
}
