import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Escena } from '../three/Escena'
import { Camisa3D } from '../three/Camisa3D'
import { COLORES, PRENDAS, areaMaxima, medidasCm } from '../data/prendas'
import { calcularPrecio, formatoUSD, NOTA_ENVIO } from '../data/precios'
import { NEGOCIO, enlaceWhatsApp } from '../data/negocio'
import { MUESTRAS, TINTA_CLARA, TINTA_OSCURA } from '../lib/muestras'
import { lienzoMuestra } from '../lib/useMuestra'
import {
  aBlob, calidadDPI, cargarArchivo, dpiEfectivo, exportarImpresion, mejorarCalidad,
  quitarFondoIA, quitarFondoLiso, recortarTransparente, tieneTransparencia,
} from '../lib/imagen'
import { enviarPedido, generarCodigo, supabaseActivo, type Pedido } from '../lib/pedidos'
import type { Estampa } from '../lib/texturas'
import './Crear.css'

type Lado = 'frente' | 'espalda'

interface DisenoLado {
  original: HTMLCanvasElement
  actual: HTMLCanvasElement
  nombre: string
  anchoCm: number
  x: number
  y: number
}

const DEPARTAMENTOS = ['Ahuachapán', 'Cabañas', 'Chalatenango', 'Cuscatlán', 'La Libertad', 'La Paz', 'La Unión', 'Morazán', 'San Miguel', 'San Salvador', 'San Vicente', 'Santa Ana', 'Sonsonate', 'Usulután']

function GiroCamara({ lado, controles }: { lado: Lado; controles: React.RefObject<OrbitControlsImpl | null> }) {
  const objetivo = lado === 'frente' ? 0 : Math.PI
  const anim = useRef(true)
  useEffect(() => {
    anim.current = true
  }, [lado])
  useFrame((_, dt) => {
    const c = controles.current
    if (!c || !anim.current) return
    const actual = c.getAzimuthalAngle()
    let delta = objetivo - actual
    delta = Math.atan2(Math.sin(delta), Math.cos(delta))
    if (Math.abs(delta) < 0.002) {
      anim.current = false
      return
    }
    c.setAzimuthalAngle(actual + delta * (1 - Math.pow(0.002, dt)))
    c.update()
  })
  return null
}

function Miniatura({ lienzo }: { lienzo: HTMLCanvasElement }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const escala = Math.min(1, 240 / Math.max(lienzo.width, lienzo.height))
    c.width = Math.round(lienzo.width * escala)
    c.height = Math.round(lienzo.height * escala)
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(lienzo, 0, 0, c.width, c.height)
  }, [lienzo])
  return (
    <div className="diseno__miniatura trama">
      <canvas ref={ref} role="img" aria-label="Vista previa de tu diseño" />
    </div>
  )
}

export default function Crear() {
  const [prendaId, setPrendaId] = useState('unisex')
  const prenda = PRENDAS.find((p) => p.id === prendaId)!
  const [tallaId, setTallaId] = useState('L')
  const talla = prenda.tallas.find((t) => t.talla === tallaId) ?? prenda.tallas[Math.floor(prenda.tallas.length / 2)]
  const [colorId, setColorId] = useState('negro')
  const color = COLORES.find((c) => c.id === colorId)!
  const [cantidad, setCantidad] = useState(1)
  const [lado, setLado] = useState<Lado>('frente')
  const [lados, setLados] = useState<Record<Lado, DisenoLado | null>>({ frente: null, espalda: null })
  const [ocupado, setOcupado] = useState<{ texto: string; fraccion?: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const controles = useRef<OrbitControlsImpl>(null)
  const entrada = useRef<HTMLInputElement>(null)

  const medidas = medidasCm(talla)
  const max = areaMaxima(prenda, talla)
  const actual = lados[lado]

  // Ajusta los diseños si la talla nueva es más pequeña
  useEffect(() => {
    setLados((prev) => {
      const sig = { ...prev }
      ;(['frente', 'espalda'] as Lado[]).forEach((l) => {
        const d = prev[l]
        if (d) sig[l] = limitar(d)
      })
      return sig
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prendaId, tallaId])

  function altoDe(d: DisenoLado, ancho = d.anchoCm) {
    return (ancho * d.actual.height) / d.actual.width
  }

  function limitar(d: DisenoLado): DisenoLado {
    let ancho = Math.min(Math.max(d.anchoCm, 4), max.ancho)
    if (altoDe(d, ancho) > max.alto) ancho = (max.alto * d.actual.width) / d.actual.height
    const alto = altoDe(d, ancho)
    const limX = Math.max(0, medidas.ancho / 2 - ancho / 2 - 2)
    const x = Math.min(Math.max(d.x, -limX), limX)
    const y = Math.min(Math.max(d.y, 3), Math.max(3, medidas.largo - alto - 4))
    return { ...d, anchoCm: Math.round(ancho * 10) / 10, x, y }
  }

  function actualizar(cambios: Partial<DisenoLado>) {
    setLados((prev) => {
      const d = prev[lado]
      if (!d) return prev
      return { ...prev, [lado]: limitar({ ...d, ...cambios }) }
    })
  }

  function colocar(lienzo: HTMLCanvasElement, nombre: string) {
    const recortado = tieneTransparencia(lienzo) ? recortarTransparente(lienzo) : lienzo
    const base: DisenoLado = { original: recortado, actual: recortado, nombre, anchoCm: Math.min(28, max.ancho * 0.8), x: 0, y: lado === 'frente' ? 9 : 7 }
    setLados((prev) => ({ ...prev, [lado]: limitar(base) }))
    setError(null)
  }

  async function subir(archivo: File | undefined) {
    if (!archivo) return
    setError(null)
    setOcupado({ texto: 'Cargando tu imagen…' })
    try {
      const c = await cargarArchivo(archivo)
      colocar(c, archivo.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'diseño')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  async function usarMuestra(id: string) {
    setOcupado({ texto: 'Preparando el diseño…' })
    const c = await lienzoMuestra(id, color.claro ? TINTA_OSCURA : TINTA_CLARA)
    colocar(c, MUESTRAS.find((m) => m.id === id)!.nombre)
    setOcupado(null)
  }

  async function herramienta(fn: (c: HTMLCanvasElement) => Promise<HTMLCanvasElement> | HTMLCanvasElement, textoInicial: string) {
    if (!actual) return
    setError(null)
    setOcupado({ texto: textoInicial })
    // deja pintar el aviso antes de bloquear con cálculos pesados
    await new Promise((r) => setTimeout(r, 30))
    try {
      const nuevo = await fn(actual.actual)
      setLados((prev) => {
        const d = prev[lado]
        if (!d) return prev
        // conserva el ancho físico; el alto se recalcula con la nueva proporción
        return { ...prev, [lado]: limitar({ ...d, actual: nuevo }) }
      })
    } catch (e) {
      console.error(e)
      setError('No se pudo completar. Si tu teléfono tiene poca memoria, prueba desde una computadora o con una imagen más pequeña.')
    } finally {
      setOcupado(null)
    }
  }

  const estampas = useMemo(() => {
    const aEstampa = (d: DisenoLado | null): Estampa | null =>
      d ? { imagen: d.actual, anchoCm: d.anchoCm, altoCm: altoDe(d), x: d.x, y: d.y } : null
    return { frente: aEstampa(lados.frente), espalda: aEstampa(lados.espalda) }
  }, [lados])

  const ladosConDiseno = (['frente', 'espalda'] as Lado[]).filter((l) => lados[l])
  const precio = calcularPrecio(prenda, talla, ladosConDiseno.map((l) => ({ anchoCm: lados[l]!.anchoCm, altoCm: altoDe(lados[l]!) })), cantidad)

  const dpi = actual ? dpiEfectivo(actual.actual.width, actual.anchoCm) : 0
  const calidad = calidadDPI(dpi)

  // ───── Formulario ─────
  const [datos, setDatos] = useState({ nombre: '', whatsapp: '', departamento: '', municipio: '', direccion: '', notas: '', web: '' })
  const [terminos, setTerminos] = useState(false)
  const [derechos, setDerechos] = useState(false)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [hecho, setHecho] = useState<{ codigo: string; modo: 'supabase' | 'whatsapp'; mensaje: string } | null>(null)
  const inicioForm = useRef(Date.now())

  const campo = (k: keyof typeof datos) => ({
    value: datos[k],
    onChange: (e: { target: { value: string } }) => setDatos((d) => ({ ...d, [k]: e.target.value })),
  })

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (datos.web || Date.now() - inicioForm.current < 4000) return // trampa para robots
    if (ladosConDiseno.length === 0) return setError('Agrega un diseño al frente o a la espalda.')
    const tel = datos.whatsapp.replace(/\D/g, '').replace(/^503/, '')
    if (!/^[67]\d{7}$/.test(tel)) return setError('Escribe un número de WhatsApp salvadoreño de 8 dígitos (empieza con 6 o 7).')
    if (!terminos || !derechos) return setError('Para enviar el pedido necesitas aceptar los términos y declarar que puedes usar el diseño.')

    const codigo = generarCodigo()
    try {
      setEnviando('Generando los archivos para impresión…')
      const archivos: { nombre: string; blob: Blob }[] = []
      const detalle: Pedido['lados'] = []
      for (const l of ladosConDiseno) {
        const d = lados[l]!
        const alto = altoDe(d)
        const imp = await exportarImpresion(d.actual, d.anchoCm, alto)
        const nombre = `${codigo}-${l}-${d.anchoCm.toFixed(1)}x${alto.toFixed(1)}cm-${imp.dpi}dpi.png`
        archivos.push({ nombre, blob: imp.blob })
        detalle.push({ lado: l, anchoCm: d.anchoCm, altoCm: Math.round(alto * 10) / 10, xCm: Math.round(d.x * 10) / 10, yCm: Math.round(d.y * 10) / 10, dpi: imp.dpi, archivo: nombre })
      }
      const vista = document.querySelector<HTMLCanvasElement>('.crear__visor canvas')
      if (vista) archivos.push({ nombre: `${codigo}-vista-previa.jpg`, blob: await aBlob(vista, 'image/jpeg', 0.85) })

      const pedido: Pedido = {
        codigo,
        cliente: { nombre: datos.nombre.trim(), whatsapp: tel, departamento: datos.departamento, municipio: datos.municipio.trim(), direccion: datos.direccion.trim(), notas: datos.notas.trim() },
        prenda: { tipo: prenda.nombre, color: color.nombre, talla: talla.talla, cantidad },
        lados: detalle,
        total: precio.total,
        aceptoTerminos: terminos,
        declaroDerechos: derechos,
      }
      const resumen = [
        `Hola Orion Flare, acabo de hacer el pedido ${codigo}.`,
        `${cantidad} × ${prenda.nombre}, ${color.nombre}, talla ${talla.talla}.`,
        ...detalle.map((d) => `${d.lado === 'frente' ? 'Frente' : 'Espalda'}: ${d.anchoCm} × ${d.altoCm} cm.`),
        `Total sin envío: ${formatoUSD(precio.total)}.`,
        `Envío a ${pedido.cliente.municipio}, ${pedido.cliente.departamento}.`,
      ].join('\n')

      if (supabaseActivo) {
        await enviarPedido(pedido, archivos, setEnviando)
        setHecho({ codigo, modo: 'supabase', mensaje: resumen })
      } else {
        // Modo sin base de datos: el cliente descarga sus archivos y los envía por WhatsApp
        for (const a of archivos) {
          const url = URL.createObjectURL(a.blob)
          const enlace = document.createElement('a')
          enlace.href = url
          enlace.download = a.nombre
          enlace.click()
          setTimeout(() => URL.revokeObjectURL(url), 4000)
        }
        setHecho({ codigo, modo: 'whatsapp', mensaje: resumen + '\nTe adjunto los archivos del diseño.' })
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEnviando(null)
    }
  }

  if (hecho) {
    return (
      <section className="hecho trama" aria-labelledby="titulo-hecho">
        <p className="hecho__sello" aria-hidden="true">受付</p>
        <h1 id="titulo-hecho">Pedido {hecho.codigo}</h1>
        {hecho.modo === 'supabase' ? (
          <p>Recibimos tu diseño y tus datos. Vamos a revisar que todo esté listo para imprimir y te escribiremos al WhatsApp que dejaste para confirmar el total con envío y la forma de pago. Si quieres adelantarte, mándanos el código:</p>
        ) : (
          <p>Se descargaron los archivos de tu diseño listos para imprimir. Para completar el pedido, envíanos el mensaje por WhatsApp y <strong>adjunta esos archivos</strong>. Te confirmaremos el total con envío y la forma de pago.</p>
        )}
        <a className="boton boton--grande" href={enlaceWhatsApp(hecho.mensaje)} target="_blank" rel="noopener noreferrer">
          Enviar por WhatsApp
        </a>
        <Link to="/" className="boton boton--fantasma">Volver al inicio</Link>
      </section>
    )
  }

  return (
    <div className="crear">
      <div className="crear__visor">
        <Escena camara={[0, 6, 205]} sombraY={-medidas.largo / 2 - 6} capturable>
          <Camisa3D prenda={prenda} talla={talla} color={color} frente={estampas.frente} espalda={estampas.espalda} reglas={lado === 'frente'} pxcm={22} />
          <OrbitControls ref={controles} enablePan={false} minDistance={90} maxDistance={300} minPolarAngle={Math.PI * 0.3} maxPolarAngle={Math.PI * 0.62} />
          <GiroCamara lado={lado} controles={controles} />
        </Escena>
        <div className="visor__info" aria-hidden="true">
          <span>{prenda.nombre} · {talla.talla}</span>
          <span>{medidas.ancho.toFixed(0)} × {medidas.largo.toFixed(0)} cm</span>
        </div>
        <p className="visor__ayuda">Arrastra para girar la camisa</p>
      </div>

      <form className="crear__panel" onSubmit={enviar} noValidate>
        <h1 className="crear__titulo">Diseña tu camisa</h1>

        <fieldset className="paso">
          <legend>Prenda</legend>
          <div className="opciones">
            {PRENDAS.map((p) => (
              <button type="button" key={p.id} className="opcion" aria-pressed={p.id === prendaId} onClick={() => setPrendaId(p.id)}>
                {p.nombre}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="paso">
          <legend>Color <span className="paso__valor">{color.nombre}</span></legend>
          <div className="colores">
            {COLORES.map((c) => (
              <button type="button" key={c.id} className="color" style={{ '--c': c.hex } as React.CSSProperties} aria-pressed={c.id === colorId} aria-label={c.nombre} title={c.nombre} onClick={() => setColorId(c.id)} />
            ))}
          </div>
        </fieldset>

        <fieldset className="paso">
          <legend>Talla <span className="paso__valor">ancho {medidas.ancho.toFixed(1)} cm · largo {medidas.largo.toFixed(1)} cm</span></legend>
          <div className="opciones opciones--tallas">
            {prenda.tallas.map((t) => (
              <button type="button" key={t.talla} className="opcion" aria-pressed={t.talla === talla.talla} onClick={() => setTallaId(t.talla)}>
                {t.talla}
              </button>
            ))}
          </div>
          <a className="paso__enlace" href={`${import.meta.env.BASE_URL}#tallas`}>Ver tabla de tallas completa</a>
        </fieldset>

        <fieldset className="paso">
          <legend>Diseño</legend>
          <div className="lados" role="group" aria-label="Lado de la camisa">
            {(['frente', 'espalda'] as Lado[]).map((l) => (
              <button type="button" key={l} className="lado" aria-pressed={lado === l} onClick={() => setLado(l)}>
                {l === 'frente' ? 'Frente' : 'Espalda'}
                <span>{lados[l] ? `${lados[l]!.anchoCm} cm` : 'sin diseño'}</span>
              </button>
            ))}
          </div>

          {!actual ? (
            <>
              <div
                className="soltar"
                data-arrastrando={arrastrando}
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastrando(false); subir(e.dataTransfer.files[0]) }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
                <p><strong>Sube tu imagen</strong> para el {lado}</p>
                <p className="soltar__ayuda">PNG, JPG o WEBP de hasta 25 MB. Mientras más grande, mejor se imprime.</p>
                <button type="button" className="boton boton--papel" onClick={() => entrada.current?.click()}>Elegir archivo</button>
                <input ref={entrada} type="file" accept="image/png,image/jpeg,image/webp" className="solo-lectores" tabIndex={-1} onChange={(e) => { subir(e.target.files?.[0]); e.target.value = '' }} />
              </div>
              <p className="muestras__titulo">O empieza con un diseño de Orion Flare:</p>
              <div className="muestras">
                {MUESTRAS.map((m) => (
                  <button type="button" key={m.id} className="muestra" onClick={() => usarMuestra(m.id)}>{m.nombre}</button>
                ))}
              </div>
            </>
          ) : (
            <div className="diseno">
              <div className="diseno__cabeza">
                <Miniatura lienzo={actual.actual} />
                <div>
                  <p className="diseno__nombre">{actual.nombre}</p>
                  <p className="diseno__px">{actual.actual.width} × {actual.actual.height} px</p>
                  <p className={`calidad calidad--${calidad.nivel}`}>
                    <span>{Math.round(dpi)} DPI</span> {calidad.texto}
                  </p>
                </div>
              </div>

              <div className="herramientas">
                <button type="button" className="herramienta" disabled={!!ocupado} onClick={() => herramienta((c) => quitarFondoLiso(c), 'Quitando el fondo…')}>
                  Quitar fondo liso
                  <span>Instantáneo, para fondos de un solo color</span>
                </button>
                <button type="button" className="herramienta" disabled={!!ocupado} onClick={() => herramienta((c) => quitarFondoIA(c, (texto, fraccion) => setOcupado({ texto, fraccion })), 'Cargando la IA…')}>
                  Quitar fondo con IA
                  <span>Para fotos y fondos complicados. Descarga ~110 MB la primera vez</span>
                </button>
                <button type="button" className="herramienta" disabled={!!ocupado} onClick={() => herramienta((c) => mejorarCalidad(c, 2, (texto, fraccion) => setOcupado({ texto, fraccion })), 'Cargando la mejora…')}>
                  Mejorar calidad ×2
                  <span>Duplica la resolución con IA</span>
                </button>
                <button type="button" className="herramienta" disabled={!!ocupado} onClick={() => herramienta((c) => mejorarCalidad(c, 4, (texto, fraccion) => setOcupado({ texto, fraccion })), 'Cargando la mejora…')}>
                  Mejorar calidad ×4
                  <span>Para imágenes muy pequeñas</span>
                </button>
              </div>
              <div className="diseno__acciones">
                <button type="button" className="enlace" disabled={!!ocupado} onClick={() => herramienta((c) => quitarFondoLiso(c, 38, true), 'Quitando el color de fondo…')}>Quitar ese color también por dentro</button>
                <button type="button" className="enlace" disabled={!!ocupado || actual.actual === actual.original} onClick={() => actualizar({ actual: actual.original })}>Deshacer cambios</button>
                <button type="button" className="enlace enlace--peligro" disabled={!!ocupado} onClick={() => setLados((p) => ({ ...p, [lado]: null }))}>Quitar diseño del {lado}</button>
              </div>

              <div className="medidas">
                <label className="control">
                  <span>Ancho <output>{actual.anchoCm.toFixed(1)} cm</output></span>
                  <input type="range" min={4} max={max.ancho} step={0.5} value={actual.anchoCm} onChange={(e) => actualizar({ anchoCm: Number(e.target.value) })} />
                </label>
                <p className="control__dato">Alto: <strong>{altoDe(actual).toFixed(1)} cm</strong> · máximo para esta talla {max.ancho} × {max.alto} cm</p>
                <label className="control">
                  <span>Distancia desde el hombro <output>{actual.y.toFixed(1)} cm</output></span>
                  <input type="range" min={3} max={Math.max(3, medidas.largo - altoDe(actual) - 4)} step={0.5} value={actual.y} onChange={(e) => actualizar({ y: Number(e.target.value) })} />
                </label>
                <label className="control">
                  <span>Posición horizontal <output>{actual.x === 0 ? 'centrado' : `${Math.abs(actual.x).toFixed(1)} cm a la ${actual.x > 0 ? 'derecha' : 'izquierda'}`}</output></span>
                  <input type="range" min={-(medidas.ancho / 2)} max={medidas.ancho / 2} step={0.5} value={actual.x} onChange={(e) => actualizar({ x: Math.abs(Number(e.target.value)) < 0.6 ? 0 : Number(e.target.value) })} />
                </label>
                <div className="atajos">
                  <button type="button" className="opcion" onClick={() => actualizar({ x: 0, y: lado === 'frente' ? 9 : 7, anchoCm: Math.min(28, max.ancho) })}>Centrado grande</button>
                  {lado === 'frente' && (
                    <button type="button" className="opcion" onClick={() => actualizar({ anchoCm: 9, x: medidas.ancho * 0.22, y: 11 })}>Pecho (logo pequeño)</button>
                  )}
                  {lado === 'espalda' && (
                    <button type="button" className="opcion" onClick={() => actualizar({ anchoCm: max.ancho, x: 0, y: 7 })}>Espalda completa</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {ocupado && (
            <div className="ocupado" role="status">
              <span>{ocupado.texto}</span>
              {ocupado.fraccion !== undefined && <progress max={1} value={ocupado.fraccion} />}
            </div>
          )}
        </fieldset>

        <fieldset className="paso">
          <legend>Tus datos para el envío</legend>
          <div className="formulario">
            <label className="campo">
              <span>Nombre</span>
              <input required autoComplete="name" maxLength={80} {...campo('nombre')} />
            </label>
            <label className="campo">
              <span>WhatsApp</span>
              <input required type="tel" inputMode="tel" autoComplete="tel" placeholder="7000 0000" maxLength={16} {...campo('whatsapp')} />
            </label>
            <label className="campo">
              <span>Departamento</span>
              <select required {...campo('departamento')}>
                <option value="">Elige…</option>
                {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
            <label className="campo">
              <span>Municipio o distrito</span>
              <input required maxLength={80} {...campo('municipio')} />
            </label>
            <label className="campo campo--ancho">
              <span>Dirección de entrega</span>
              <input required autoComplete="street-address" maxLength={200} {...campo('direccion')} />
            </label>
            <label className="campo campo--ancho">
              <span>Notas <em>(opcional)</em></span>
              <textarea rows={2} maxLength={500} {...campo('notas')} />
            </label>
            <label className="trampa" aria-hidden="true">
              Sitio web <input tabIndex={-1} autoComplete="off" {...campo('web')} />
            </label>
          </div>
          <label className="check">
            <input type="checkbox" checked={derechos} onChange={(e) => setDerechos(e.target.checked)} />
            <span>Declaro que el diseño es mío o tengo permiso para imprimirlo, y que no infringe derechos de terceros.</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={terminos} onChange={(e) => setTerminos(e.target.checked)} />
            <span>Acepto los <Link to="/legal/terminos" target="_blank">términos y condiciones</Link> y la <Link to="/legal/privacidad" target="_blank">política de privacidad</Link>.</span>
          </label>
          <p className="paso__nota">Usamos tus datos solo para preparar y enviar este pedido. {NOTA_ENVIO}</p>
          {!supabaseActivo && <p className="paso__nota">Al enviar se descargan los archivos de tu diseño para que nos los mandes por WhatsApp.</p>}
        </fieldset>

        <div className="resumen">
          <div className="resumen__fila">
            <label className="cantidad">
              <span>Cantidad</span>
              <input type="number" min={1} max={50} value={cantidad} onChange={(e) => setCantidad(Math.min(50, Math.max(1, Number(e.target.value) || 1)))} />
            </label>
            <div className="resumen__total" aria-live="polite">
              <span>{ladosConDiseno.length ? `${formatoUSD(precio.unitario)} c/u` : 'Agrega un diseño'}</span>
              <strong>{formatoUSD(ladosConDiseno.length ? precio.total : 0)}</strong>
            </div>
          </div>
          <p className="resumen__nota">{NOTA_ENVIO}</p>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="boton boton--grande resumen__enviar" disabled={!!enviando || !!ocupado}>
            {enviando ?? 'Enviar pedido'}
          </button>
          {!supabaseActivo && <p className="resumen__nota">Al enviar se descargan los archivos de tu diseño para que nos los mandes por WhatsApp al {NEGOCIO.whatsappLegible}.</p>}
        </div>
      </form>
    </div>
  )
}
