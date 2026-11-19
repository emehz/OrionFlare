import { useEffect, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { NEGOCIO } from '../data/negocio'
import NoEncontrada from './NoEncontrada'
import './Legal.css'

const ACTUALIZADO = '19 de noviembre de 2026'

const Contacto = () => (
  <>
    {NEGOCIO.responsable}, {NEGOCIO.ciudad}. WhatsApp {NEGOCIO.whatsappLegible}, correo <a href={`mailto:${NEGOCIO.correo}`}>{NEGOCIO.correo}</a>.
  </>
)

const PAGINAS: Record<string, { titulo: string; contenido: ReactNode }> = {
  aviso: {
    titulo: 'Aviso legal',
    contenido: (
      <>
        <p><strong>Orion Flare</strong> es un emprendimiento de confección y estampado de camisas operado por <Contacto /></p>
        <p>Este sitio permite configurar camisas personalizadas y enviar solicitudes de pedido. Ningún pedido se considera aceptado hasta que lo confirmamos por WhatsApp junto con el precio final con envío y la forma de pago.</p>
        <p>El nombre Orion Flare, su logotipo y los diseños de ejemplo de este sitio pertenecen a Orion Flare. Los diseños que suben los clientes pertenecen a sus autores.</p>
        <p>Los modelos de inteligencia artificial que usa el configurador son de código abierto: BiRefNet (licencia MIT) para quitar fondos y ESRGAN de UpscalerJS (licencia MIT) para mejorar la resolución.</p>
      </>
    ),
  },
  terminos: {
    titulo: 'Términos y condiciones',
    contenido: (
      <>
        <h2>1. Quiénes somos</h2>
        <p>Orion Flare, operado por <Contacto /></p>
        <h2>2. Cómo funciona un pedido</h2>
        <ol>
          <li>Configuras tu camisa y envías la solicitud desde el sitio. Recibes un código de pedido.</li>
          <li>Revisamos el diseño, las medidas y la calidad de impresión. Si algo no se puede imprimir bien, te lo decimos antes de cobrar.</li>
          <li>Te confirmamos por WhatsApp el precio final con envío y la forma de pago. El pedido queda aceptado cuando ambas partes lo confirman y se registra el pago acordado.</li>
          <li>Producimos y enviamos la camisa a la dirección que indicaste dentro de El Salvador.</li>
        </ol>
        <h2>3. Precios</h2>
        <p>El precio que muestra el configurador es el precio final de la camisa estampada. El envío se cotiza aparte según el municipio y se informa antes del pago. No hay cargos adicionales que no te hayamos informado.</p>
        <h2>4. Tu diseño y los derechos de autor</h2>
        <p>Al enviar un pedido declaras que el diseño es tuyo o que tienes autorización para reproducirlo, y que no infringe derechos de autor, marcas ni derechos de imagen de terceros. Orion Flare puede rechazar o cancelar, con devolución de lo pagado, pedidos con contenido protegido sin autorización, ofensivo, discriminatorio o ilegal.</p>
        <p>Usamos tu diseño solo para producir tu pedido. No lo publicamos ni lo vendemos a otras personas sin tu permiso.</p>
        <h2>5. Colores y medidas</h2>
        <p>La vista 3D es una representación fiel de las medidas, pero los colores en pantalla pueden variar ligeramente respecto a la tela y la tinta reales. Las medidas de las prendas tienen la tolerancia normal de fabricación (alrededor de 1 a 2 cm).</p>
        <h2>6. Cambios y devoluciones</h2>
        <p>Consulta la <Link to="/legal/cambios">política de cambios y devoluciones</Link>.</p>
        <h2>7. Menores de edad</h2>
        <p>Si eres menor de 18 años, haz el pedido con el permiso y acompañamiento de tu madre, padre o responsable.</p>
        <h2>8. Ley aplicable</h2>
        <p>Estos términos se rigen por las leyes de la República de El Salvador, incluida la Ley de Protección al Consumidor. Nada de lo aquí escrito limita los derechos que esa ley te reconoce.</p>
      </>
    ),
  },
  privacidad: {
    titulo: 'Política de privacidad',
    contenido: (
      <>
        <h2>Responsable</h2>
        <p><Contacto /></p>
        <h2>Qué datos pedimos y para qué</h2>
        <ul>
          <li><strong>Nombre, WhatsApp, departamento, municipio y dirección</strong>: para confirmar y entregar tu pedido.</li>
          <li><strong>Las imágenes de tu diseño</strong>: para imprimirlo.</li>
          <li><strong>Notas</strong> que quieras agregar: para atender tu pedido.</li>
        </ul>
        <p>No pedimos más datos de los necesarios, no hacemos perfiles, no enviamos publicidad y no vendemos ni cedemos tus datos.</p>
        <h2>Tu imagen se procesa en tu dispositivo</h2>
        <p>Quitar el fondo y mejorar la calidad ocurre dentro de tu navegador. Tu imagen solo sale de tu dispositivo cuando envías el pedido.</p>
        <h2>Con quién se comparten</h2>
        <ul>
          <li><strong>Supabase</strong>: guarda los pedidos y los archivos de diseño en sus servidores, como proveedor de base de datos de Orion Flare.</li>
          <li><strong>GitHub Pages</strong>: aloja este sitio y puede registrar datos técnicos de conexión (como la dirección IP) para su funcionamiento y seguridad.</li>
          <li><strong>Hugging Face</strong>: si usas "Quitar fondo con IA", tu navegador descarga el modelo desde sus servidores. Tu imagen no se les envía.</li>
          <li><strong>WhatsApp (Meta)</strong>: si eliges escribirnos por WhatsApp, la conversación se rige por las políticas de WhatsApp.</li>
        </ul>
        <h2>Cuánto tiempo los guardamos</h2>
        <p>Conservamos los datos y archivos del pedido mientras dure su producción, entrega y el plazo para atender reclamos, y como máximo 12 meses después de la entrega, salvo que la ley exija guardarlos más tiempo.</p>
        <h2>Tus derechos</h2>
        <p>Puedes pedir acceso, corrección o eliminación de tus datos, u oponerte a su uso, escribiendo a <a href={`mailto:${NEGOCIO.correo}`}>{NEGOCIO.correo}</a> o por WhatsApp al {NEGOCIO.whatsappLegible}. Respondemos conforme a la normativa salvadoreña de protección de datos personales.</p>
        <h2>Seguridad</h2>
        <p>La conexión al sitio es cifrada (HTTPS). Los archivos de los pedidos se guardan en un almacenamiento privado al que solo accede Orion Flare.</p>
      </>
    ),
  },
  cambios: {
    titulo: 'Cambios y devoluciones',
    contenido: (
      <>
        <p>Cada camisa se fabrica a pedido con el diseño, la talla y el color que elegiste. Por eso:</p>
        <h2>Reponemos sin costo</h2>
        <ul>
          <li>Defectos de impresión: manchas, desprendimiento, colores muy distintos del archivo aprobado.</li>
          <li>Defectos de la prenda: costuras abiertas, agujeros o fallas de tela.</li>
          <li>Errores nuestros: talla, color o posición distintos a lo que confirmaste.</li>
        </ul>
        <p>Escríbenos dentro de los 7 días siguientes a recibir el pedido, con fotos del problema y tu código de pedido. Te reponemos la camisa o te devolvemos lo pagado, como prefieras.</p>
        <h2>No aceptamos devoluciones por</h2>
        <ul>
          <li>Cambio de opinión sobre el diseño o la talla ya confirmados (te recomendamos revisar la <a href={`${import.meta.env.BASE_URL}#tallas`}>tabla de tallas</a>).</li>
          <li>Baja calidad de un diseño cuando el configurador mostró la advertencia de resolución y decidiste continuar.</li>
          <li>Desgaste por lavado o uso inadecuado. Lava la camisa al revés, con agua fría, y no planches sobre el estampado.</li>
        </ul>
        <h2>Cancelaciones</h2>
        <p>Puedes cancelar sin costo antes de que confirmemos el pago. Después, si la camisa todavía no se ha producido, te devolvemos el total.</p>
      </>
    ),
  },
  cookies: {
    titulo: 'Cookies y almacenamiento',
    contenido: (
      <>
        <p>Este sitio <strong>no usa cookies de publicidad ni de analítica</strong>, ni rastrea tu navegación. Por eso no te mostramos un aviso para aceptarlas.</p>
        <h2>Lo único que se guarda en tu navegador</h2>
        <ul>
          <li><strong>Modelos de IA</strong>: si usas "Quitar fondo con IA", el navegador guarda el modelo descargado en su caché para no volver a descargarlo. Puedes borrarlo desde la configuración de tu navegador.</li>
          <li><strong>Ruta de navegación</strong>: un dato temporal de sesión que permite abrir enlaces directos dentro del sitio. Se borra al cerrar la pestaña.</li>
        </ul>
        <p>Si en el futuro agregamos analítica, lo haremos solo con tu consentimiento previo y actualizaremos esta página.</p>
      </>
    ),
  },
}

export default function Legal() {
  const { pagina = '' } = useParams()
  const datos = PAGINAS[pagina]
  useEffect(() => {
    if (datos) document.title = `${datos.titulo} — Orion Flare`
  }, [datos])
  if (!datos) return <NoEncontrada />
  return (
    <article className="legal">
      <h1>{datos.titulo}</h1>
      <p className="legal__fecha">Última actualización: {ACTUALIZADO}</p>
      <div className="legal__cuerpo">{datos.contenido}</div>
    </article>
  )
}
