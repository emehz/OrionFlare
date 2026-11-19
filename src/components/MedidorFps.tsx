import { useEffect, useRef, useState } from 'react'
import { infoGpu } from '../lib/gpu'

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

export function MedidorFps() {
  const [visible, setVisible] = useState(activo)
  const caja = useRef<HTMLButtonElement>(null)
  const [gpu] = useState(() => {
    if (!visible) return ''
    const g = infoGpu()
    return `GPU: ${g.nombre}${g.software ? ' (sin aceleración: dibuja el procesador)' : ''}`
  })
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
          const w = window as unknown as { __orionDpr?: number; __orionLiviano?: boolean }
          const dpr = w.__orionDpr
          caja.current.firstChild!.textContent = `${fps} FPS · peor cuadro ${Math.round(peor)} ms${dpr ? ` · ${dpr}×` : ''}${w.__orionLiviano ? ' · liviano' : ''}`
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
