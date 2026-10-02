import { ESTADOS } from "@/components/Estado";
import { formatMes, formatMonto } from "@shared/format";
import type { MesProyeccionDTO } from "@shared/schemas/api";

const ANCHO = 340;
const ALTO = 190;
const M = { arriba: 22, abajo: 22, izq: 44, der: 6 };
const compacto = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });

/** Escala "linda": 3 marcas redondas que cubren [min, max]. */
function marcas(min: number, max: number): number[] {
  const rango = max - min || 1;
  const paso0 = rango / 3;
  const mag = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((p) => p >= paso0) ?? 10 * mag;
  const desde = Math.floor(min / paso) * paso;
  const hasta = Math.ceil(max / paso) * paso;
  const res: number[] = [];
  for (let v = desde; v <= hasta + paso / 2; v += paso) res.push(Math.round(v));
  return res;
}

/** Columna con el extremo de datos redondeado (4px) y la base recta. */
function columna(x: number, ancho: number, yBase: number, yValor: number): string {
  const r = Math.min(4, ancho / 2, Math.abs(yBase - yValor));
  if (yValor <= yBase) {
    return `M${x},${yBase} V${yValor + r} Q${x},${yValor} ${x + r},${yValor} H${x + ancho - r} Q${x + ancho},${yValor} ${x + ancho},${yValor + r} V${yBase} Z`;
  }
  return `M${x},${yBase} V${yValor - r} Q${x},${yValor} ${x + r},${yValor} H${x + ancho - r} Q${x + ancho},${yValor} ${x + ancho},${yValor - r} V${yBase} Z`;
}

export function GraficoSobra({
  meses,
  umbral,
  seleccionado,
  onSeleccionar,
}: {
  meses: MesProyeccionDTO[];
  umbral: number;
  seleccionado: string | null;
  onSeleccionar: (mes: string | null) => void;
}) {
  const valores = meses.map((m) => Number(m.sobra));
  const ticks = marcas(Math.min(0, ...valores), Math.max(umbral, ...valores, 1));
  const min = ticks[0];
  const max = ticks[ticks.length - 1];
  const altoUtil = ALTO - M.arriba - M.abajo;
  const y = (v: number) => M.arriba + ((max - v) / (max - min || 1)) * altoUtil;
  const banda = (ANCHO - M.izq - M.der) / meses.length;
  const anchoCol = Math.min(24, banda * 0.6);

  return (
    <figure>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full" role="img" aria-label="Sobra estimada por mes (el detalle está en la lista de abajo)">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.izq} x2={ANCHO - M.der} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--muted)" : "var(--line)"} strokeWidth={1} />
            <text x={M.izq - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--muted)" className="num">
              {t === 0 ? "0" : compacto.format(t)}
            </text>
          </g>
        ))}
        {umbral > 0 && (
          <g>
            <line x1={M.izq} x2={ANCHO - M.der} y1={y(umbral)} y2={y(umbral)} stroke="var(--warning-fill)" strokeWidth={1} />
          </g>
        )}
        {meses.map((m, i) => {
          const v = Number(m.sobra);
          const x0 = M.izq + i * banda;
          const xc = x0 + (banda - anchoCol) / 2;
          const sel = seleccionado === m.mes;
          const etiqueta = `${formatMes(m.mes)}: ${formatMonto(m.sobra, "ARS", { compacto: true })}, ${ESTADOS[m.alerta].label}`;
          return (
            <g
              key={m.mes}
              role="button"
              tabIndex={0}
              aria-label={etiqueta}
              aria-pressed={sel}
              className="cursor-pointer outline-none"
              onClick={() => {
                onSeleccionar(sel ? null : m.mes);
                if (!sel) document.getElementById(`mes-${m.mes}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSeleccionar(sel ? null : m.mes)}
            >
              <title>{etiqueta}</title>
              {/* Zona de toque: toda la banda */}
              <rect x={x0} y={M.arriba} width={banda} height={altoUtil} fill={sel ? "var(--surface-2)" : "transparent"} rx={6} />
              {v !== 0 && <path d={columna(xc, anchoCol, y(0), y(v))} fill={ESTADOS[m.alerta].barra} />}
              {sel && (
                <text x={x0 + banda / 2} y={v >= 0 ? y(v) - 5 : y(v) + 12} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--ink)" className="num">
                  {compacto.format(v)}
                </text>
              )}
              <text x={x0 + banda / 2} y={ALTO - 6} textAnchor="middle" fontSize={10} fill={sel ? "var(--ink)" : "var(--muted)"} fontWeight={sel ? 600 : 400}>
                {formatMes(m.mes, true).slice(0, 3)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
