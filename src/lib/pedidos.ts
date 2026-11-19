import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/*
 * Envío de pedidos a Supabase (capa gratis).
 * Solo se usa la clave pública ("anon/publishable"): las reglas de seguridad (RLS) de la base
 * permiten INSERTAR pedidos pero no leerlos, así que nadie puede ver pedidos ajenos desde el sitio.
 * Si las variables no están configuradas, el sitio funciona en "modo WhatsApp".
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let cliente: SupabaseClient | null = null
export const supabaseActivo = Boolean(url && clave)

function sb() {
  if (!supabaseActivo) throw new Error('Supabase no está configurado')
  if (!cliente) cliente = createClient(url!, clave!, { auth: { persistSession: false, autoRefreshToken: false } })
  return cliente
}

export function generarCodigo() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin 0/O ni 1/I para dictarlo sin errores
  const azar = crypto.getRandomValues(new Uint8Array(6))
  return 'OF-' + [...azar].map((n) => letras[n % letras.length]).join('')
}

export interface ArchivoPedido {
  nombre: string
  blob: Blob
}

export interface Pedido {
  codigo: string
  cliente: { nombre: string; whatsapp: string; departamento: string; municipio: string; direccion: string; notas: string }
  prenda: { tipo: string; color: string; talla: string; cantidad: number }
  /** un elemento por diseño; `lado` es la zona: frente, espalda, mangaIzq o mangaDer */
  lados: { lado: 'frente' | 'espalda' | 'mangaIzq' | 'mangaDer'; anchoCm: number; altoCm: number; xCm: number; yCm: number; dpi: number; archivo: string }[]
  total: number
  aceptoTerminos: boolean
  declaroDerechos: boolean
}

export async function enviarPedido(p: Pedido, archivos: ArchivoPedido[], progreso: (t: string) => void) {
  const db = sb()
  for (const [i, a] of archivos.entries()) {
    progreso(`Subiendo archivo ${i + 1} de ${archivos.length}…`)
    const { error } = await db.storage.from('pedidos').upload(`${p.codigo}/${a.nombre}`, a.blob, {
      contentType: a.blob.type || 'image/png',
      upsert: false,
    })
    if (error) throw new Error('No se pudo subir el diseño. Revisa tu conexión e inténtalo de nuevo.')
  }
  progreso('Registrando el pedido…')
  const { error } = await db.from('pedidos').insert({
    codigo: p.codigo,
    cliente: p.cliente,
    prenda: p.prenda,
    lados: p.lados,
    total: p.total,
    acepto_terminos: p.aceptoTerminos,
    declaro_derechos: p.declaroDerechos,
  })
  if (error) throw new Error('No se pudo registrar el pedido. Inténtalo de nuevo o escríbenos por WhatsApp.')
}
