# Design

Visual system of the Orion Flare site as built (Nov 2026). Product truth lives in PRODUCT.md.

## World

Manga print shop at night: sumi-ink black ground, newsprint white, one hanko-vermilion accent. The 3D shirt is the hero of every view; text panels sit beside it like manga panels with a hairline border.

## Tokens (`src/index.css`)

| Token | Value | Use |
|---|---|---|
| `--tinta` | `#0b0b0c` | page ground |
| `--tinta-2` / `--tinta-3` | `#141416` / `#1d1d20` | configurator panel, tool tiles |
| `--linea` | `#2c2c30` | hairline borders, dividers |
| `--papel` | `#f2f0ea` | primary text, light sections |
| `--gris` | `#a8a49a` | secondary text on ink (7.6:1) |
| `--gris-oscuro` | `#55524b` | secondary text on paper (7:1) |
| `--bermellon` | `#e5381e` | primary action, price stamp, rulers, focus ring; text on it is `--tinta` |
| `--ok` / `--aviso` | `#7fd18b` / `#f2c14e` | DPI quality chips only |
| `--radio` | `2px` | all controls |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | UI transitions |

## Type

- Display: **Dela Gothic One** (self-hosted via Fontsource), headings, prices, legends, katakana/kanji ornaments.
- Text: **Zen Kaku Gothic New** 400/700.
- Vertical katakana (`writing-mode: vertical-rl`) as a brand ornament; never as the only label.

## Components

- `.boton` vermilion, `.boton--fantasma` hairline, `.boton--papel` paper. Press: `scale(0.97)`.
- `.opcion` / `.segmento`: hairline chips; selected = inverted (paper on ink, ink on paper).
- `.cap__panel`: translucent ink panel with blur, hairline border, a vermilion kanji in the corner.
- Rulers: vermilion lines + vermilion tag with ink text, tabular numerals.
- Screentone texture: `.trama` (radial dots 7px) on the closing section and thumbnails.

## Motion

- One signature: scroll drives the camera around the shirt (Lenis + GSAP ScrollTrigger, damped in `useFrame`). Panels reveal once with blur → sharp, expo ease-out.
- `prefers-reduced-motion`: no Lenis, no idle spin, instant camera moves, no reveals.
