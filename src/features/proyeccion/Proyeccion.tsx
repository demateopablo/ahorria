import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useHogar } from "@/app/hogar";
import { Encabezado } from "@/app/Layout";
import { ChipEstado, ESTADOS } from "@/components/Estado";
import { Aviso, Cargando, cx, Monto, Segmentado, Tarjeta } from "@/components/ui";
import { useProyeccion } from "@/lib/datos";
import { formatMes, formatMonto } from "@shared/format";
import type { MesProyeccionDTO } from "@shared/schemas/api";
import { GraficoSobra } from "./GraficoSobra";

const RUBROS: { clave: keyof MesProyeccionDTO; label: string; signo: 1 | -1 }[] = [
  { clave: "ingresos", label: "Ingresos esperados", signo: 1 },
  { clave: "fijos", label: "Fijos y recurrentes", signo: -1 },
  { clave: "cuotas", label: "Cuotas", signo: -1 },
  { clave: "eventos", label: "Eventos y regalos", signo: -1 },
  { clave: "variables", label: "Otros gastos ya hechos", signo: -1 },
];

export function Proyeccion() {
  const h = useHogar();
  const [meses, setMeses] = useState<"6" | "12">("6");
  const { data, isLoading, error } = useProyeccion(h.vista, Number(meses));
  const [abierto, setAbierto] = useState<string | null>(null);

  return (
    <>
      <Encabezado titulo="Proyección" />
      <main className="space-y-3 px-4">
        <Segmentado
          etiqueta="Horizonte"
          valor={meses}
          onChange={setMeses}
          opciones={[
            { valor: "6", label: "6 meses" },
            { valor: "12", label: "12 meses" },
          ]}
        />
        {isLoading && <Cargando />}
        {error && <Aviso tono="critical">{error.message}</Aviso>}
        {data && (
          <>
            {data.avisos.map((a) => (
              <Aviso key={a} tono="warning">
                {a}
              </Aviso>
            ))}
            <Tarjeta>
              <h2 className="text-base font-semibold">Sobra estimada por mes</h2>
              <p className="mb-3 text-sm text-ink-2">
                Ingresos esperados menos fijos, cuotas y eventos. Por debajo de {formatMonto(data.umbral, "ARS", { compacto: true })} el mes queda ajustado.
              </p>
              <GraficoSobra meses={data.meses} umbral={Number(data.umbral)} seleccionado={abierto} onSeleccionar={setAbierto} />
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Referencias">
                {(["ok", "ambar", "rojo"] as const).map((a) => {
                  const E = ESTADOS[a];
                  return (
                    <li key={a} className="flex items-center gap-1">
                      <span className="inline-block size-2.5 rounded-sm" style={{ background: E.barra }} aria-hidden />
                      <E.Icono size={13} aria-hidden /> {E.label}
                    </li>
                  );
                })}
                <li className="flex items-center gap-1">
                  <span className="inline-block h-px w-4 bg-warning-fill" aria-hidden /> Margen mínimo
                </li>
              </ul>
            </Tarjeta>

            <ul className="space-y-2">
              {data.meses.map((m) => (
                <MesFila key={m.mes} m={m} abierto={abierto === m.mes} onToggle={() => setAbierto(abierto === m.mes ? null : m.mes)} />
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  );
}

function MesFila({ m, abierto, onToggle }: { m: MesProyeccionDTO; abierto: boolean; onToggle: () => void }) {
  const transfer = Number(m.transferencias);
  return (
    <li id={`mes-${m.mes}`}>
      <Tarjeta padding="ninguno">
        <button type="button" onClick={onToggle} aria-expanded={abierto} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left">
          <span className="flex-1">
            <span className="block text-base font-semibold capitalize">{formatMes(m.mes)}</span>
            <span className="text-xs text-muted">
              Acumulado <Monto valor={m.acumulado} />
            </span>
          </span>
          <span className="text-right">
            <Monto valor={m.sobra} className={cx("block text-lg font-bold", Number(m.sobra) < 0 && "text-critical")} />
            <ChipEstado alerta={m.alerta} />
          </span>
          <ChevronDown size={20} className={cx("text-muted transition", abierto && "rotate-180")} aria-hidden />
        </button>
        {abierto && (
          <div className="border-t border-line px-4 pb-3 pt-2">
            <dl className="space-y-1 text-sm">
              {RUBROS.filter((r) => Number(m[r.clave]) !== 0).map((r) => (
                <div key={r.clave} className="flex justify-between">
                  <dt className="text-ink-2">{r.label}</dt>
                  <dd>
                    <Monto valor={String(r.signo * Number(m[r.clave]))} signo="auto" className={r.signo > 0 ? "text-ingreso" : undefined} />
                  </dd>
                </div>
              ))}
              {transfer !== 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-2">Transferencias (neto)</dt>
                  <dd>
                    <Monto valor={m.transferencias} signo="auto" />
                  </dd>
                </div>
              )}
            </dl>
            <details className="mt-2">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-accent">Ver el detalle ({m.lineas.length})</summary>
              <ul className="divide-y divide-line text-sm">
                {m.lineas.map((l, i) => (
                  <li key={`${l.refId}-${i}`} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="min-w-0 truncate">
                      {l.concepto || "Sin detalle"}
                      <span className="ml-1 text-xs text-muted">{l.origen === "estimado" ? "· estimado" : l.origen === "pendiente" ? "· pendiente" : ""}</span>
                    </span>
                    <Monto valor={l.monto} signo="auto" className={Number(l.monto) > 0 ? "text-ingreso" : undefined} />
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </Tarjeta>
    </li>
  );
}
