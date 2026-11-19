import { useEffect, useRef, useState } from 'react'

/*
 * Medidor de cuadros por segundo para revisar el rendimiento en cualquier navegador.
 * Se activa abriendo el sitio con ?fps (queda activo al navegar) y se apaga con ?fps=0 o tocándolo.
 */
function activo() {
  try {
    const p = new URLSearchParams(location.search)
    if (p.has('fps')) {
      const on = p.get('fps') !== '0'
      if (on) localStorage.setItem('orion-fps', '1')
      else localStorage.removeItem('orion-fps')
      return on
    }
    return localStorage.getItem('orion-fps') === '1'
  } catch {
    return new URLSearchParams(location.search).has('fps')
  }
}

/** Nombre de la tarjeta gráfica que usa el navegador (para saber si usa la integrada o la dedicada). */
function nombreGpu() {
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    const nombre = ext ? (gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) : (gl?.getParameter(gl.RENDERER) as string)
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    // "ANGLE (NVIDIA, NVIDIA GeForce RTX 4050 Laptop GPU Direct3D11 …)" → "NVIDIA GeForce RTX 4050 Laptop GPU"
    const m = /ANGLE \([^,]*,\s*([^,(]+?)(?:\s+Direct3D|\s*\(|,|\))/.exec(nombre ?? '')
    return (m ? m[1] : nombre ?? 'desconocida').trim()
  } catch {
    return 'desconocida'
  }
}

export function MedidorFps() {
  const [visible, setVisible] = useState(activo)
  const caja = useRef<HTMLButtonElement>(null)
  const [gpu] = useState(() => (visible ? `GPU: ${nombreGpu()}` : ''))
  useEffect(() => {
    if (!visible) return
    let cuadros = 0
    let desde = performance.now()
    let peor = 0
    let previo = desde
    let raf = 0
    const bucle = (t: number) => {
      cuadros++
      peor = Math.max(peor, t - previo)
      previo = t
      if (t - desde >= 1000) {
        const fps = Math.round((cuadros * 1000) / (t - desde))
        if (caja.current) {
          const dpr = (window as unknown as { __orionDpr?: number }).__orionDpr
          caja.current.firstChild!.textContent = `${fps} FPS · peor cuadro ${Math.round(peor)} ms${dpr ? ` · ${dpr}×` : ''}`
          caja.current.dataset.nivel = fps >= 50 ? 'bien' : fps >= 30 ? 'medio' : 'mal'
        }
        cuadros = 0
        desde = t
        peor = 0
      }
      raf = requestAnimationFrame(bucle)
    }
    raf = requestAnimationFrame(bucle)
    return () => cancelAnimationFrame(raf)
  }, [visible])
  if (!visible) return null
  return (
    <button
      ref={caja}
      type="button"
      className="medidor-fps"
      title="Ocultar medidor"
      onClick={() => {
        try { localStorage.removeItem('orion-fps') } catch { /* sin almacenamiento */ }
        setVisible(false)
      }}
    >
      <span>midiendo…</span>
      <small>{gpu}</small>
    </button>
  )
}
