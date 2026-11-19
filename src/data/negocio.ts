// Datos del negocio. Se usan en el pie de página, las políticas y el botón de WhatsApp.
export const NEGOCIO = {
  marca: 'Orion Flare',
  responsable: 'Emmersson Jaco',
  ciudad: 'Santa Ana, El Salvador',
  whatsapp: '50376234617', // sin "+" ni espacios
  whatsappLegible: '+503 7623-4617',
  correo: 'emmersson.hdez@gmail.com',
  instagram: 'orion.flare',
  // Tiempo de respuesta que se promete al cliente. Pon aquí uno que puedas cumplir (ej. "Respondemos el mismo día").
  respuesta: 'Te respondemos por WhatsApp para confirmar cada pedido.',
} as const

export function enlaceWhatsApp(mensaje: string) {
  return `https://wa.me/${NEGOCIO.whatsapp}?text=${encodeURIComponent(mensaje)}`
}
