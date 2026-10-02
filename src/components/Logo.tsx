/** Isotipo de Ahorria: una moneda dorada con el ₳ (la A con doble barra del austral). Mismo dibujo que public/favicon.svg. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Ahorria">
      <circle cx="32" cy="32" r="30" fill="#f5b82e" />
      <circle cx="32" cy="32" r="25.5" fill="none" stroke="#8a5a00" strokeOpacity=".4" strokeWidth="1.6" />
      <path d="M21.5 45 L32 17 L42.5 45" fill="none" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.5 32.5 H44.5 M17.5 39 H46.5" stroke="#1a1a1a" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}
