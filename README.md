# Orion Flare

Sitio web de **Orion Flare**: camisas de algodón estampadas en DTF con el diseño del cliente, Santa Ana, El Salvador.

- **Portada** con una camisa 3D que cambia al hacer scroll y diseños de ejemplo al azar.
- **Configurador** (`/crear`): tipo de prenda, color, talla real del proveedor, diseño al frente y a la espalda, quitar fondo (rápido o con IA), mejorar calidad con IA, tamaño y posición en centímetros, aviso de resolución (DPI), precio automático y envío del pedido.
- **Páginas legales**: términos, privacidad, cambios y devoluciones, cookies y aviso legal.

Todo corre gratis: el sitio se publica en **GitHub Pages** y los pedidos se guardan en **Supabase** (capa gratis). La IA corre en el navegador del cliente: no hay servidores de pago.

## Probar en tu computadora

```bash
npm install
npm run dev
```

Abre http://localhost:5173.

## Dónde cambiar cosas

| Qué | Archivo |
|---|---|
| Nombre, WhatsApp, correo, ciudad | `src/data/negocio.ts` |
| Costos de camisas, DTF, margen y redondeo | `src/data/precios.ts` |
| Tallas y colores disponibles | `src/data/prendas.ts` |
| Textos de las políticas | `src/pages/Legal.tsx` |
| Diseños de ejemplo | `src/lib/muestras.ts` |

## Publicar en GitHub Pages (una sola vez)

1. Crea un repositorio **público** llamado `OrionFlare` en la cuenta `emehz`.
2. Sube este proyecto (`git push`).
3. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Cada vez que subas cambios a `main`, el sitio se vuelve a publicar solo en
   https://emehz.github.io/OrionFlare/

## Recibir pedidos con Supabase (una sola vez)

Sin Supabase el sitio funciona en "modo WhatsApp": el cliente descarga sus archivos y te los manda.

1. Crea una cuenta gratis en https://supabase.com y un proyecto nuevo.
2. Abre **SQL Editor**, pega el contenido de `supabase/schema.sql` y pulsa **Run**.
3. En **Project Settings → API** copia la **Project URL** y la clave **anon / publishable**.
   ⚠️ Nunca uses la clave `service_role` / `secret` en el sitio.
4. En GitHub: **Settings → Secrets and variables → Actions → Variables** crea:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Vuelve a publicar (Actions → "Publicar en GitHub Pages" → Run workflow).

Los pedidos aparecen en **Table Editor → pedidos** y los archivos en **Storage → pedidos**, en una carpeta por código (`OF-XXXXXX`). Cada pedido trae el PNG listo para DTF al tamaño real (300 DPI cuando el dispositivo lo permite) y una vista previa de la camisa.

## Seguridad

- La base de datos solo permite **crear** pedidos desde el sitio; nadie puede leerlos ni modificarlos con la clave pública (RLS).
- Los archivos se guardan en un almacenamiento **privado**, con límite de 30 MB y solo imágenes.
- No se publican mapas de código fuente (source maps).
- El formulario tiene una trampa anti‑robots.

## Licencias de terceros

- Quitar fondo con IA: [BiRefNet lite](https://huggingface.co/onnx-community/BiRefNet_lite-ONNX) (MIT), vía transformers.js (Apache‑2.0).
- Mejorar calidad: ESRGAN de [UpscalerJS](https://upscalerjs.com) (MIT), servido desde `public/modelos/`.
- 3D: three.js y React Three Fiber (MIT). Animación: GSAP (licencia estándar gratuita) y Lenis (MIT).
- Tipografías: Dela Gothic One y Zen Kaku Gothic New (SIL Open Font License).
