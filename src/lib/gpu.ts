/*
 * Qué tarjeta gráfica usa el navegador. Algunos navegadores dibujan el 3D con el procesador (por software)
 * cuando la aceleración por hardware está apagada o el controlador no es compatible:
 *   Edge/Chrome: "Microsoft Basic Render Driver", "SwiftShader"; Linux: "llvmpipe".
 * En ese caso la web activa un modo liviano (menos resolución, sin antialias, sin relieve de tejido).
 * Brave oculta el nombre por privacidad ("Brave"): ahí no se puede saber y se decide por los FPS.
 */
export interface InfoGpu {
  nombre: string
  software: boolean
  oculto: boolean
}

let cache: InfoGpu | null = null

export function infoGpu(): InfoGpu {
  if (cache) return cache
  let crudo = ''
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    crudo = ext ? (gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) : ((gl?.getParameter(gl.RENDERER) as string) ?? '')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    crudo = ''
  }
  // "ANGLE (NVIDIA, NVIDIA GeForce RTX 4050 Laptop GPU Direct3D11 …)" → "NVIDIA GeForce RTX 4050 Laptop GPU"
  const m = /ANGLE \([^,]*,\s*([^,(]+?)(?:\s+Direct3D|\s*\(|,|\))/.exec(crudo)
  const nombre = (m ? m[1] : crudo || 'desconocida').trim()
  cache = {
    nombre,
    software: /SwiftShader|Basic Render|llvmpipe|softpipe|Software|Mesa OffScreen/i.test(crudo),
    oculto: !crudo || /^(Brave|WebKit WebGL|Mozilla)$/i.test(nombre),
  }
  return cache
}

/** Modo liviano: por software, o cuando el medidor de rendimiento detecta que el equipo no da abasto. */
let liviano: boolean | null = null
export function modoLiviano() {
  if (liviano === null) liviano = typeof window !== 'undefined' && infoGpu().software
  return liviano
}
export function activarModoLiviano() {
  liviano = true
}
