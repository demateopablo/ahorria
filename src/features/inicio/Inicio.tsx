import { ChevronLeft, ChevronRight, ChevronRight as Flecha } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { HOGAR, useHogar } from "@/app/hogar";
import { Encabezado } from "@/app/Layout";
import { ChipEstado } from "@/components/Estado";
import { IconoCategoria } from "@/components/Icono";
import { Aviso, Boton, Cargando, Monto, Tarjeta, Vacio } from "@/components/ui";
import { useDashboard } from "@/lib/datos";
import { formatMes } from "@shared/format";
import { dec } from "@shared/domain/dinero";
import { sumarMeses } from "@shared/domain/fechas";
import type { DashboardDTO } from "@shared/schemas/api";
import { useCarga } from "../carga/Carga";
import { Pendientes } from "./Pendientes";

export function Inicio() {
  const h = useHogar();
  const mesActual = h.hoy.slice(0, 7);
  const [mes, setMes] = useState(mesActual);
  const { data, isLoading, error } = useDashboard(h.vista, mes);

  return (
    <>
      <Encabezado titulo={h.vista === HOGAR ? h.config.nombreHogar : h.nombreVista} />
      <main className="space-y-3 px-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setMes(sumarMeses(mes, -1))} className="flex size-11 items-center justify-center rounded-full text-ink-2" aria-label="Mes anterior">
            <ChevronLeft size={22} />
          </button>
          <p className="text-base font-semibold capitalize">{formatMes(mes)}</p>
          <button
            type="button"
            onClick={() => setMes(sumarMeses(mes, 1))}
            disabled={mes >= mesActual}
            className="flex size-11 items-center justify-center rounded-full text-ink-2 disabled:opacity-30"
            aria-label="Mes siguiente"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        {mes === mesActual && <Pendientes />}

        {isLoading && <Cargando />}
        {error && <Aviso tono="critical">{error.message}</Aviso>}
        {data && <Resumen d={data} esActual={mes === mesActual} />}
      </main>
    </>
  );
}

function Resumen({ d, esActual }: { d: DashboardDTO; esActual: boolean }) {
  const h = useHogar();
  const abrirCarga = useCarga();
  const navigate = useNavigate();
  const [todas, setTodas] = useState(false);
  const esPersona = h.vista !== HOGAR;
  const sinDatos = Number(d.ingresos) === 0 && Number(d.gastos) === 0 && Number(d.enviadas) === 0 && Number(d.recibidas) === 0;
  const maxCat = Math.max(...d.porCategoria.map((c) => Number(c.total)), 1);
  const categorias = todas ? d.porCategoria : d.top5;
  // Con pendientes sin confirmar (ej. el sueldo a principio de mes) el número principal es lo que
  // quedaría al confirmarlos; lo confirmado hasta hoy va abajo.
  const hayPendientes = d.pendientes.cantidad > 0;
  // En el mes en curso manda la proyección (incluye eventos y consumos con tarjeta que impactan este mes),
  // así el número coincide con la pantalla de Proyección.
  const proyectado = esActual ? d.proximos.find((m) => m.mes === d.mes) : undefined;
  const estimadoDec = proyectado ? dec(proyectado.sobra) : dec(d.ahorro).plus(d.pendientes.ingresos).minus(d.pendientes.gastos);
  const siguientes = d.proximos.filter((m) => m.mes > d.mes);
  const estimado = estimadoDec.toNumber();
  const titular = hayPendientes || proyectado
    ? estimado >= 0
      ? "Te quedaría este mes"
      : "Te faltaría este mes"
    : estimado >= 0
      ? "Te quedó este mes"
      : "Gastaste de más";

  return (
    <>
      <Tarjeta>
        <p className="text-sm text-ink-2">{titular}</p>
        <p className="mt-1 text-[clamp(2.25rem,11vw,3rem)] font-bold leading-tight tracking-tight">
          <Monto valor={estimadoDec.toString()} className={estimado < 0 ? "text-critical" : undefined} />
        </p>
        {hayPendientes || proyectado ? (
          <p className="mt-1 text-sm text-ink-2">
            Confirmado hasta hoy <Monto valor={d.ahorro} className="font-semibold text-ink" />
          </p>
        ) : (
          d.tasaAhorro !== null && (
            <p className="mt-1 text-sm text-ink-2">
              Tasa de ahorro <strong className="num font-semibold text-ink">{d.tasaAhorro.toLocaleString("es-AR")} %</strong>
            </p>
          )
        )}
        <dl className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-surface-2 p-3">
            <dt className="text-xs text-ink-2">Ingresos</dt>
            <dd className="mt-0.5 text-lg font-semibold">
              <Monto valor={d.ingresos} className="text-ingreso" />
            </dd>
          </div>
          <div className="rounded-2xl bg-surface-2 p-3">
            <dt className="text-xs text-ink-2">Gastos</dt>
            <dd className="mt-0.5 text-lg font-semibold">
              <Monto valor={d.gastos} />
            </dd>
          </div>
          {esPersona && (Number(d.recibidas) > 0 || Number(d.enviadas) > 0) && (
            <>
              <div className="rounded-2xl bg-surface-2 p-3">
                <dt className="text-xs text-ink-2">Transferencias recibidas</dt>
                <dd className="mt-0.5 text-lg font-semibold">
                  <Monto valor={d.recibidas} />
                </dd>
              </div>
              <div className="rounded-2xl bg-surface-2 p-3">
                <dt className="text-xs text-ink-2">Transferencias enviadas</dt>
                <dd className="mt-0.5 text-lg font-semibold">
                  <Monto valor={d.enviadas} />
                </dd>
              </div>
            </>
          )}
        </dl>
        {hayPendientes && (
          <p className="mt-3 text-xs text-muted">
            Ingresos y gastos confirmados. Faltan {d.pendientes.cantidad} pendiente{d.pendientes.cantidad > 1 ? "s" : ""} de este mes.
          </p>
        )}
      </Tarjeta>

      {sinDatos ? (
        <Vacio
          imagen="/img/vacio.webp"
          titulo={esActual ? "Todavía no hay movimientos" : "No hubo movimientos"}
          texto={esActual ? "Cargá tu primer gasto: monto, categoría y listo." : undefined}
          accion={esActual ? <Boton onClick={() => abrirCarga()}>Cargar un gasto</Boton> : undefined}
        />
      ) : (
        d.porCategoria.length > 0 && (
          <Tarjeta>
            <h2 className="mb-3 text-base font-semibold">En qué se fue</h2>
            <ul className="space-y-1">
              {categorias.map((c) => {
                const cat = h.categoria(c.categoriaId);
                return (
                  <li key={c.categoriaId ?? "sin"}>
                    <button
                      type="button"
                      className="flex min-h-14 w-full items-center gap-3 rounded-xl text-left"
                      onClick={() => navigate(`/movimientos?mes=${d.mes}${c.categoriaId ? `&categoria=${c.categoriaId}` : ""}`)}
                    >
                      <IconoCategoria icono={cat?.icono} color={cat?.color} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">{cat?.nombre ?? "Sin categoría"}</span>
                          <Monto valor={c.total} className="text-sm font-semibold" />
                        </span>
                        <span className="mt-1.5 flex items-center gap-2">
                          <span className="h-2 flex-1 rounded-full bg-bar-track">
                            <span className="block h-2 rounded-full bg-bar" style={{ width: `${Math.max(2, (Number(c.total) / maxCat) * 100)}%` }} />
                          </span>
                          <span className="num w-12 shrink-0 whitespace-nowrap text-right text-xs text-muted">{c.porcentaje?.toLocaleString("es-AR") ?? 0} %</span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {d.porCategoria.length > 5 && (
              <button type="button" className="mt-1 min-h-11 w-full text-sm font-semibold text-accent" onClick={() => setTodas(!todas)}>
                {todas ? "Ver menos" : `Ver las ${d.porCategoria.length} categorías`}
              </button>
            )}
          </Tarjeta>
        )
      )}

      {d.hormiga.length > 0 && (
        <Tarjeta>
          <h2 className="text-base font-semibold">Gastos hormiga</h2>
          <p className="mb-2 text-sm text-ink-2">Muchos gastos chicos que, sumados, pesan.</p>
          <ul className="divide-y divide-line">
            {d.hormiga.map((x) => {
              const cat = h.categoria(x.categoriaId);
              return (
                <li key={x.categoriaId ?? "sin"} className="flex items-center gap-3 py-2">
                  <IconoCategoria icono={cat?.icono} color={cat?.color} size={32} />
                  <span className="flex-1 text-sm">
                    {cat?.nombre ?? "Sin categoría"}
                    <span className="block text-xs text-muted">
                      {x.cantidad} veces · promedio <Monto valor={x.promedio} />
                    </span>
                  </span>
                  <Monto valor={x.total} className="text-sm font-semibold" />
                </li>
              );
            })}
          </ul>
        </Tarjeta>
      )}

      {esActual && siguientes.length > 0 && (
        <Link to="/proyeccion" className="block">
          <Tarjeta>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold">Lo que viene</h2>
              <Flecha size={20} className="text-muted" aria-hidden />
            </div>
            <ul className="grid grid-cols-3 gap-2">
              {siguientes.map((m) => (
                <li key={m.mes} className="rounded-2xl bg-surface-2 p-2.5">
                  <p className="text-xs capitalize text-ink-2">{formatMes(m.mes, true)}</p>
                  <p className="mt-0.5 text-sm font-semibold">
                    <Monto valor={m.sobra} corto className={Number(m.sobra) < 0 ? "text-critical" : undefined} />
                  </p>
                  <ChipEstado alerta={m.alerta} className="mt-1" />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">Sobra estimada por mes.</p>
          </Tarjeta>
        </Link>
      )}
    </>
  );
}
