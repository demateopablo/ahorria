/** Isotipo de Ahorria: una "A" cuyo travesaño es una moneda. El mismo dibujo que public/favicon.svg. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Ahorria">
      <rect width="64" height="64" rx="16" fill="#15803d" />
      <path d="M17 48 L32 15 L47 48" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="38" r="5.5" fill="#bbf7d0" />
    </svg>
  );
}
