import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { PresentationControls } from '@react-three/drei'
import { Escena } from '../three/Escena'
import { Camisa3D, type DisenoEnPrenda } from '../three/Camisa3D'
import { MAX_DISENOS } from '../three/materialTela'
import { COLORES, PRENDAS, areaMaxima, medidasCm } from '../data/prendas'
import { calcularPrecio, formatoUSD, NOTA_ENVIO } from '../data/precios'
import { NEGOCIO, enlaceWhatsApp } from '../data/negocio'
import { MUESTRAS, TINTA_CLARA, TINTA_OSCURA } from '../lib/muestras'
import { lienzoMuestra } from '../lib/useMuestra'
import { modeloCamisa, type Zona } from '../lib/prenda3d'
import {
  aBlob, calidadDPI, cargarArchivo, dpiEfectivo, exportarImpresion, mejorarCalidad,
  quitarFondoIA, quitarFondoLiso, recortarTransparente, tieneTransparencia,
} from '../lib/imagen'
import { enviarPedido, generarCodigo, supabaseActivo, type Pedido } from '../lib/pedidos'
import './Crear.css'

interface Capa {
  id: string
  zona: Zona
  original: HTMLCanvasElement
  actual: HTMLCanvasElement
  nombre: string
  anchoCm: number
  x: number
  y: number
}

const NOMBRE_ZONA: Record<Zona, string> = {
  frente: 'Frente',
  espalda: 'Espalda',
  mangaIzq: 'Manga izquierda',
  mangaDer: 'Manga derecha',
}
const CORTO_ZONA: Record<Zona, string> = { frente: 'Frente', espalda: 'Espalda', mangaIzq: 'Manga izq.', mangaDer: 'Manga der.' }

// Cómo se gira la camisa para mostrar cada zona (la manga izquierda de quien la usa queda a la derecha de quien mira)
const VISTA_ZONA: Record<Zona, { giro: number; x: number; distancia: number }> = {
  frente: { giro: 0, x: 0, distancia: 205 },
  espalda: { giro: Math.PI, x: 0, distancia: 205 },
  mangaIzq: { giro: -0.95, x: -19, distancia: 135 },
  mangaDer: { giro: 0.95, x: 19, distancia: 135 },
}

const DEPARTAMENTOS = ['Ahuachapán', 'Cabañas', 'Chalatenango', 'Cuscatlán', 'La Libertad', 'La Paz', 'La Unión', 'Morazán', 'San Miguel', 'San Salvador', 'San Vicente', 'Santa Ana', 'Sonsonate', 'Usulután']

let contador = 0
const nuevoId = () => `d${Date.now().toString(36)}${(contador++).toString(36)}`

/** Gira y acerca la camisa a la zona que se está editando; el usuario la puede seguir girando con el dedo o el mouse. */
function Visor({ zona, children }: { zona: Zona; children: ReactNode }) {
  const grupo = useRef<THREE.Group>(null)
  const { camera, size } = useThree()
  useFrame((_, dt) => {
    const g = grupo.current
    if (!g) return
    const v = VISTA_ZONA[zona]
    // en pantallas angostas (celular) la cámara se aleja para que quepa la camisa completa
    const aspecto = size.width / Math.max(1, size.height)
    const lejos = Math.min(1.9, Math.max(1, 1.05 / aspecto))
    const k = 1 - Math.pow(0.003, Math.min(dt, 0.05))
    let d = v.giro - g.rotation.y
    d = Math.atan2(Math.sin(d), Math.cos(d))
    g.rotation.y += d * k
    g.position.x += (v.x - g.position.x) * k
    camera.position.z += (v.distancia * lejos - camera.position.z) * k
  })
  return <group ref={grupo}>{children}</group>
}

function Miniatura({ lienzo }: { lienzo: HTMLCanvasElement }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const escala = Math.min(1, 160 / Math.max(lienzo.width, lienzo.height))
    c.width = Math.max(1, Math.round(lienzo.width * escala))
    c.height = Math.max(1, Math.round(lienzo.height * escala))
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(lienzo, 0, 0, c.width, c.height)
  }, [lienzo])
  return (
    <span className="miniatura trama">
      <canvas ref={ref} aria-hidden="true" />
    </span>
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
  const [zona, setZona] = useState<Zona>('frente')
  const [capas, setCapas] = useState<Capa[]>([])
  const [activaId, setActivaId] = useState<string | null>(null)
  const [agregando, setAgregando] = useState(false)
  const [ocupado, setOcupado] = useState<{ texto: string; fraccion?: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  const medidas = medidasCm(talla)
  const modelo = useMemo(() => modeloCamisa(prenda, talla), [prenda, talla])
  const conMangas = prenda.manga !== 'sin'
  const zonas: Zona[] = conMangas ? ['frente', 'espalda', 'mangaIzq', 'mangaDer'] : ['frente', 'espalda']

  const capasZona = capas.filter((c) => c.zona === zona)
  const activa = capas.find((c) => c.id === activaId && c.zona === zona) ?? null
  const mostrarSubida = agregando || capasZona.length === 0

  // límites de tamaño y posición de cada zona
  function limites(z: Zona) {
    if (z === 'mangaIzq' || z === 'mangaDer') {
      const ancho = Math.min(10, Math.floor(modelo.contornoManga * 0.42))
      const alto = Math.max(4, Math.min(10, Math.floor(modelo.largoManga - 4)))
      return { ancho, alto, largo: modelo.largoManga, mitad: modelo.contornoManga * 0.25, minAncho: 2 }
    }
    const max = areaMaxima(prenda, talla)
    return { ancho: max.ancho, alto: max.alto, largo: medidas.largo, mitad: medidas.ancho / 2, minAncho: 3 }
  }

  const altoDe = (c: Capa, ancho = c.anchoCm) => (ancho * c.actual.height) / c.actual.width

  function limitar(c: Capa): Capa {
    const l = limites(c.zona)
    let ancho = Math.min(Math.max(c.anchoCm, l.minAncho), l.ancho)
    if (altoDe(c, ancho) > l.alto) ancho = (l.alto * c.actual.width) / c.actual.height
    const alto = altoDe(c, ancho)
    const limX = Math.max(0, l.mitad - ancho / 2 - 1.5)
    const margenAbajo = c.zona.startsWith('manga') ? 2.5 : 4
    return {
      ...c,
      anchoCm: Math.round(ancho * 10) / 10,
      x: Math.min(Math.max(c.x, -limX), limX),
      y: Math.min(Math.max(c.y, 1.5), Math.max(1.5, l.largo - alto - margenAbajo)),
    }
  }

  // Al cambiar de prenda o talla, todos los diseños se ajustan a los nuevos límites
  useEffect(() => {
    setCapas((prev) => prev.filter((c) => conMangas || !c.zona.startsWith('manga')).map(limitar))
    if (!conMangas && zona.startsWith('manga')) setZona('frente')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prendaId, tallaId])

  // Al cambiar de zona, selecciona su primer diseño
  useEffect(() => {
    setAgregando(false)
    setActivaId((id) => (capas.some((c) => c.id === id && c.zona === zona) ? id : capas.find((c) => c.zona === zona)?.id ?? null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zona])

  function actualizar(cambios: Partial<Capa>) {
    if (!activa) return
    setCapas((prev) => prev.map((c) => (c.id === activa.id ? limitar({ ...c, ...cambios }) : c)))
  }

  function posicionInicial(z: Zona) {
    const enZona = capas.filter((c) => c.zona === z).length
    if (z.startsWith('manga')) return { anchoCm: 7, y: 3 + enZona * 9, x: 0 }
    return { anchoCm: enZona ? 10 : Math.min(28, limites(z).ancho * 0.8), y: (z === 'frente' ? 9 : 7) + enZona * 12, x: 0 }
  }

  function colocar(lienzo: HTMLCanvasElement, nombre: string) {
    if (capas.length >= MAX_DISENOS) {
      setError(`Puedes poner hasta ${MAX_DISENOS} diseños por camisa.`)
      return
    }
    const recortado = tieneTransparencia(lienzo) ? recortarTransparente(lienzo) : lienzo
    const capa = limitar({ id: nuevoId(), zona, original: recortado, actual: recortado, nombre, ...posicionInicial(zona) })
    setCapas((prev) => [...prev, capa])
    setActivaId(capa.id)
    setAgregando(false)
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

  function quitar(id: string) {
    setCapas((prev) => prev.filter((c) => c.id !== id))
    if (activaId === id) setActivaId(capas.find((c) => c.zona === zona && c.id !== id)?.id ?? null)
  }

  async function herramienta(fn: (c: HTMLCanvasElement) => Promise<HTMLCanvasElement> | HTMLCanvasElement, textoInicial: string) {
    if (!activa) return
    const id = activa.id
    setError(null)
    setOcupado({ texto: textoInicial })
    await new Promise((r) => setTimeout(r, 30)) // deja pintar el aviso antes del cálculo pesado
    try {
      const nuevo = await fn(activa.actual)
      setCapas((prev) => prev.map((c) => (c.id === id ? limitar({ ...c, actual: nuevo }) : c)))
    } catch (e) {
      console.error(e)
      setError('No se pudo completar. Si tu teléfono tiene poca memoria, prueba desde una computadora o con una imagen más pequeña.')
    } finally {
      setOcupado(null)
    }
  }

  const disenos: DisenoEnPrenda[] = useMemo(
    () => capas.map((c) => ({ id: c.id, zona: c.zona, imagen: c.actual, anchoCm: c.anchoCm, altoCm: altoDe(c), x: c.x, y: c.y })),
    [capas],
  )

  const zonasUsadas = new Set(capas.map((c) => c.zona)).size
  const precio = calcularPrecio(prenda, talla, capas.map((c) => ({ anchoCm: c.anchoCm, altoCm: altoDe(c) })), cantidad, zonasUsadas)

  const dpi = activa ? dpiEfectivo(activa.actual.width, activa.anchoCm) : 0
  const calidad = calidadDPI(dpi)
  const lim = limites(zona)

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
    if (capas.length === 0) return setError('Agrega al menos un diseño.')
    const tel = datos.whatsapp.replace(/\D/g, '').replace(/^503/, '')
    if (!datos.nombre.trim() || !datos.departamento || !datos.municipio.trim() || !datos.direccion.trim()) return setError('Completa tu nombre y los datos de envío.')
    if (!/^[67]\d{7}$/.test(tel)) return setError('Escribe un número de WhatsApp salvadoreño de 8 dígitos (empieza con 6 o 7).')
    if (!terminos || !derechos) return setError('Para enviar el pedido necesitas aceptar los términos y declarar que puedes usar el diseño.')

    const codigo = generarCodigo()
    try {
      setEnviando('Generando los archivos para impresión…')
      const archivos: { nombre: string; blob: Blob }[] = []
      const detalle: Pedido['lados'] = []
      for (const [i, c] of capas.entries()) {
        const alto = altoDe(c)
        const imp = await exportarImpresion(c.actual, c.anchoCm, alto)
        const nombre = `${codigo}-${i + 1}-${c.zona}-${c.anchoCm.toFixed(1)}x${alto.toFixed(1)}cm-${imp.dpi}dpi.png`
        archivos.push({ nombre, blob: imp.blob })
        detalle.push({ lado: c.zona, anchoCm: c.anchoCm, altoCm: Math.round(alto * 10) / 10, xCm: Math.round(c.x * 10) / 10, yCm: Math.round(c.y * 10) / 10, dpi: imp.dpi, archivo: nombre })
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
        ...detalle.map((d) => `${NOMBRE_ZONA[d.lado]}: ${d.anchoCm} × ${d.altoCm} cm.`),
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
        <Escena camara={[0, 4, 205]} sombraY={-medidas.largo / 2 - 6} capturable>
          <PresentationControls global cursor polar={[-0.15, 0.25]} azimuth={[-Infinity, Infinity]} speed={1.4} damping={0.25} snap={false}>
            <Visor zona={zona}>
              <Camisa3D prenda={prenda} talla={talla} color={color} disenos={disenos} activo={activa?.id ?? null} medidas={!!activa} />
            </Visor>
          </PresentationControls>
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
          <legend>Diseños <span className="paso__valor">{capas.length} de {MAX_DISENOS}</span></legend>
          <div className="zonas" role="group" aria-label="Zona de la camisa">
            {zonas.map((z) => {
              const n = capas.filter((c) => c.zona === z).length
              return (
                <button type="button" key={z} className="zona" aria-pressed={zona === z} onClick={() => setZona(z)}>
                  {CORTO_ZONA[z]}
                  <span>{n ? `${n} diseño${n > 1 ? 's' : ''}` : 'vacía'}</span>
                </button>
              )
            })}
          </div>

          {capasZona.length > 0 && (
            <ul className="capas" aria-label={`Diseños en ${NOMBRE_ZONA[zona].toLowerCase()}`}>
              {capasZona.map((c) => (
                <li key={c.id}>
                  <button type="button" className="capa" aria-pressed={c.id === activa?.id} onClick={() => { setActivaId(c.id); setAgregando(false) }}>
                    <Miniatura lienzo={c.actual} />
                    <span className="capa__texto">
                      <strong>{c.nombre}</strong>
                      <span>{c.anchoCm.toFixed(1)} × {altoDe(c).toFixed(1)} cm</span>
                    </span>
                  </button>
                  <button type="button" className="capa__quitar" aria-label={`Quitar ${c.nombre}`} onClick={() => quitar(c.id)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </li>
              ))}
              {!agregando && capas.length < MAX_DISENOS && (
                <li>
                  <button type="button" className="capa capa--agregar" onClick={() => { setAgregando(true); setActivaId(null) }}>
                    <span className="miniatura miniatura--mas" aria-hidden="true">+</span>
                    <span className="capa__texto"><strong>Agregar otro diseño</strong><span>a {NOMBRE_ZONA[zona].toLowerCase()}</span></span>
                  </button>
                </li>
              )}
            </ul>
          )}

          {mostrarSubida && (
            <>
              <div
                className="soltar"
                data-arrastrando={arrastrando}
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastrando(false); subir(e.dataTransfer.files[0]) }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
                <p><strong>Sube una imagen</strong> para {NOMBRE_ZONA[zona].toLowerCase()}</p>
                <p className="soltar__ayuda">
                  PNG, JPG o WEBP de hasta 25 MB.{zona.startsWith('manga') ? ` En la manga cabe hasta ${lim.ancho} × ${lim.alto} cm.` : ' Mientras más grande, mejor se imprime.'}
                </p>
                <button type="button" className="boton boton--papel" onClick={() => entrada.current?.click()}>Elegir archivo</button>
                <input ref={entrada} type="file" accept="image/png,image/jpeg,image/webp" className="solo-lectores" tabIndex={-1} onChange={(e) => { subir(e.target.files?.[0]); e.target.value = '' }} />
              </div>
              <p className="muestras__titulo">O usa un diseño de Orion Flare:</p>
              <div className="muestras">
                {MUESTRAS.map((m) => (
                  <button type="button" key={m.id} className="muestra" onClick={() => usarMuestra(m.id)}>{m.nombre}</button>
                ))}
              </div>
              {agregando && capasZona.length > 0 && (
                <button type="button" className="enlace" onClick={() => { setAgregando(false); setActivaId(capasZona[0].id) }}>Cancelar</button>
              )}
            </>
          )}

          {activa && !mostrarSubida && (
            <div className="diseno">
              <p className={`calidad calidad--${calidad.nivel}`}>
                <span>{Math.round(dpi)} DPI</span> {calidad.texto} · {activa.actual.width} × {activa.actual.height} px
              </p>

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
                <button type="button" className="enlace" disabled={!!ocupado || activa.actual === activa.original} onClick={() => actualizar({ actual: activa.original })}>Deshacer cambios</button>
              </div>

              <div className="medidas">
                <label className="control">
                  <span>Ancho <output>{activa.anchoCm.toFixed(1)} cm</output></span>
                  <input type="range" min={limites(zona).minAncho} max={lim.ancho} step={0.5} value={activa.anchoCm} onChange={(e) => actualizar({ anchoCm: Number(e.target.value) })} />
                </label>
                <p className="control__dato">Alto: <strong>{altoDe(activa).toFixed(1)} cm</strong> · máximo en {NOMBRE_ZONA[zona].toLowerCase()}: {lim.ancho} × {lim.alto} cm</p>
                <label className="control">
                  <span>{zona.startsWith('manga') ? 'Distancia desde la costura del hombro' : 'Distancia desde el hombro'} <output>{activa.y.toFixed(1)} cm</output></span>
                  <input type="range" min={1.5} max={Math.max(1.5, lim.largo - altoDe(activa) - (zona.startsWith('manga') ? 2.5 : 4))} step={0.5} value={activa.y} onChange={(e) => actualizar({ y: Number(e.target.value) })} />
                </label>
                <label className="control">
                  <span>Posición horizontal <output>{activa.x === 0 ? 'centrado' : `${Math.abs(activa.x).toFixed(1)} cm a la ${activa.x > 0 ? 'derecha' : 'izquierda'}`}</output></span>
                  <input type="range" min={-lim.mitad} max={lim.mitad} step={0.5} value={activa.x} onChange={(e) => actualizar({ x: Math.abs(Number(e.target.value)) < 0.6 ? 0 : Number(e.target.value) })} />
                </label>
                {!zona.startsWith('manga') && (
                  <div className="atajos">
                    <button type="button" className="opcion" onClick={() => actualizar({ x: 0, y: zona === 'frente' ? 9 : 7, anchoCm: Math.min(28, lim.ancho) })}>Centrado grande</button>
                    {zona === 'frente' && (
                      <button type="button" className="opcion" onClick={() => actualizar({ anchoCm: 9, x: medidas.ancho * 0.22, y: 11 })}>Pecho (logo pequeño)</button>
                    )}
                    {zona === 'espalda' && (
                      <>
                        <button type="button" className="opcion" onClick={() => actualizar({ anchoCm: 8, x: 0, y: 4 })}>Nuca (pequeño)</button>
                        <button type="button" className="opcion" onClick={() => actualizar({ anchoCm: lim.ancho, x: 0, y: 7 })}>Espalda completa</button>
                      </>
                    )}
                  </div>
                )}
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
            <span>Declaro que los diseños son míos o tengo permiso para imprimirlos, y que no infringen derechos de terceros.</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={terminos} onChange={(e) => setTerminos(e.target.checked)} />
            <span>Acepto los <Link to="/legal/terminos" target="_blank">términos y condiciones</Link> y la <Link to="/legal/privacidad" target="_blank">política de privacidad</Link>.</span>
          </label>
          <p className="paso__nota">Usamos tus datos solo para preparar y enviar este pedido. {NOTA_ENVIO}</p>
          {!supabaseActivo && <p className="paso__nota">Al enviar se descargan los archivos de tus diseños para que nos los mandes por WhatsApp.</p>}
        </fieldset>

        <div className="resumen">
          <div className="resumen__fila">
            <label className="cantidad">
              <span>Cantidad</span>
              <input type="number" min={1} max={50} value={cantidad} onChange={(e) => setCantidad(Math.min(50, Math.max(1, Number(e.target.value) || 1)))} />
            </label>
            <div className="resumen__total" aria-live="polite">
              <span>{capas.length ? `${formatoUSD(precio.unitario)} c/u · ${capas.length} diseño${capas.length > 1 ? 's' : ''}` : 'Agrega un diseño'}</span>
              <strong>{formatoUSD(capas.length ? precio.total : 0)}</strong>
            </div>
          </div>
          <p className="resumen__nota">{NOTA_ENVIO}</p>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="boton boton--grande resumen__enviar" disabled={!!enviando || !!ocupado}>
            {enviando ?? 'Enviar pedido'}
          </button>
          {!supabaseActivo && <p className="resumen__nota">Al enviar se descargan los archivos de tus diseños para que nos los mandes por WhatsApp al {NEGOCIO.whatsappLegible}.</p>}
        </div>
      </form>
    </div>
  )
}
