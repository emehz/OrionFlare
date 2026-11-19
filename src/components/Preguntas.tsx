import { Link } from 'react-router-dom'
import { NEGOCIO } from '../data/negocio'

export function Preguntas() {
  return (
    <section id="preguntas" className="seccion seccion--papel" aria-labelledby="titulo-preguntas">
      <div className="seccion__cabeza">
        <h2 id="titulo-preguntas">Preguntas frecuentes</h2>
      </div>
      <div className="preguntas">
        <details>
          <summary>¿Qué es el estampado DTF?</summary>
          <p>DTF significa "Direct To Film": tu diseño se imprime en una película especial y luego se transfiere a la camisa con calor. Permite colores intensos, degradados y detalles finos sobre algodón de cualquier color, incluso negro.</p>
        </details>
        <details>
          <summary>¿Cómo hago un pedido?</summary>
          <p>Entra a <Link to="/crear">Diseñar la mía</Link>, elige la prenda, el color y la talla, sube tu imagen y colócala. Al enviar el pedido recibes un código. Revisamos que todo esté bien y te escribimos por WhatsApp al {NEGOCIO.whatsappLegible} para confirmar el total con envío y la forma de pago.</p>
        </details>
        <details>
          <summary>¿Cuánto tarda y cómo llega?</summary>
          <p>Hacemos envíos a todo El Salvador. El tiempo de producción y el costo del envío dependen de tu municipio y de cuántos pedidos tengamos en cola; te los confirmamos por WhatsApp antes de que pagues.</p>
        </details>
        <details>
          <summary>¿Puedo imprimir personajes de anime o logos de marcas?</summary>
          <p>Solo imprimimos diseños sobre los que tengas derecho de uso: creaciones propias, imágenes con licencia o diseños que te autorizaron. Podemos rechazar pedidos con marcas, logos o personajes protegidos. Lee los <Link to="/legal/terminos">términos</Link> para más detalle.</p>
        </details>
        <details>
          <summary>Mi imagen es pequeña o tiene fondo, ¿sirve?</summary>
          <p>Probablemente sí. El configurador quita fondos lisos al instante, tiene una opción de IA para fondos complicados y puede mejorar la resolución. También te indica si la calidad alcanza para el tamaño que elegiste.</p>
        </details>
        <details>
          <summary>¿Aceptan cambios o devoluciones?</summary>
          <p>Como cada camisa se hace a la medida con tu diseño, no aceptamos devoluciones por arrepentimiento. Sí reponemos la prenda si llega con un defecto de impresión o de fabricación. Detalles en <Link to="/legal/cambios">cambios y devoluciones</Link>.</p>
        </details>
      </div>
    </section>
  )
}
