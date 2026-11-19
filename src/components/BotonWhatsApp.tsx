import { enlaceWhatsApp } from '../data/negocio'

export function IconoChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5 5.3 15.6A8 8 0 1 1 8.6 18.8Z" />
      <path d="M9 10h6M9 13.5h4" />
    </svg>
  )
}

export function BotonWhatsApp() {
  return (
    <a
      className="wa"
      href={enlaceWhatsApp('Hola Orion Flare, quiero información sobre una camisa.')}
      target="_blank"
      rel="noopener noreferrer"
    >
      <IconoChat />
      <span>WhatsApp</span>
    </a>
  )
}
