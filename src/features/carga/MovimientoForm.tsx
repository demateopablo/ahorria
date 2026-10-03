import { ChevronDown, CreditCard, LayoutGrid, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { HOGAR, useHogar } from "@/app/hogar";
import { IconoCategoria } from "@/components/Icono";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { Boton, Campo, cx, Input, Segmentado, Select, Textarea } from "@/components/ui";
import { del, mensajeError, patch, post } from "@/lib/api";
import { useEscritura } from "@/lib/datos";
import { formatFecha, parseMontoAR } from "@shared/format";
import { textoResumen } from "@/lib/tarjeta";
import { AMBITOS, type Ambito, type Moneda, type TipoMovimiento } from "@shared/domain/tipos";
import type { AiParseDTO, CategoriaDTO, MovimientoDTO } from "@shared/schemas/api";
import { aplicarTecla, montoATexto, mostrarMontoTipeado, Teclado } from "./Teclado";

const NOMBRE_AMBITO: Record<Ambito, string> = { personal: "Personal", compartido: "Compartido", negocio: "Negocio", familia: "Familia" };
const CLAVE_CUENTA = "ahorria:ultimaCuenta";
const VISIBLES = 7;

function leerUltimaCuenta(): string | null {
  try {
    return localStorage.getItem(CLAVE_CUENTA);
  } catch {
    return null;
  }
}

export function MovimientoForm({ inicial, onListo }: { inicial?: MovimientoDTO; onListo: () => void }) {
  const h = useHogar();
  const toast = useToast();
  const editando = Boolean(inicial);

  const cuentaInicial = useMemo(() => {
    if (inicial) return inicial.cuentaId;
    const ultima = leerUltimaCuenta();
    if (ultima && h.cuentasActivas.some((c) => c.id === ultima)) return ultima;
    const mias = h.cuentasActivas.filter((c) => c.titularId === h.yo.id);
    return (mias.find((c) => c.tipo === "billetera") ?? mias[0] ?? h.cuentasActivas[0])?.id ?? "";
  }, [inicial, h]);

  const [tipo, setTipo] = useState<TipoMovimiento>(inicial?.tipo ?? "gasto");
  const [monto, setMonto] = useState(montoATexto(inicial?.monto));
  const [categoriaId, setCategoriaId] = useState<string | null>(inicial?.categoriaId ?? null);
  const [cuentaId, setCuentaId] = useState(cuentaInicial);
  const [cuentaElegida, setCuentaElegida] = useState(editando);
  const [cuentaDestinoId, setCuentaDestinoId] = useState(inicial?.cuentaDestinoId ?? "");
  const [moneda, setMoneda] = useState<Moneda>(inicial?.moneda ?? h.cuenta(cuentaInicial)?.moneda ?? "ARS");
  const [cotizacion, setCotizacion] = useState(inicial?.cotizacion ?? h.ultimaCotizacion?.valor ?? "");
  const [fecha, setFecha] = useState(inicial?.fechaConsumo ?? h.hoy);
  const [duenoId, setDuenoId] = useState(inicial?.duenoId ?? (h.vista !== HOGAR ? h.vista : h.yo.id));
  const [ambito, setAmbito] = useState<Ambito | null>(inicial?.ambito ?? null);
  const [nota, setNota] = useState(inicial?.nota ?? "");
  const [etiquetas, setEtiquetas] = useState(inicial?.etiquetas.join(", ") ?? "");
  const [cuotas, setCuotas] = useState(1);
  const [detalles, setDetalles] = useState(false);
  const [todas, setTodas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textoIa, setTextoIa] = useState("");
  const [errorIa, setErrorIa] = useState<string | null>(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  const tipoCategoria = tipo === "ingreso" ? "ingreso" : "gasto";
  const categorias = useMemo(() => {
    const lista = h.categorias.filter((c) => c.tipo === tipoCategoria && !c.archivada);
    const pos = new Map(h.categoriasRecientes.map((id, i) => [id, i]));
    const ordenGeneral = (c: CategoriaDTO) => {
      const padre = h.categoria(c.padreId);
      return padre ? padre.orden * 1000 + 1 + c.orden : c.orden * 1000;
    };
    return [...lista].sort((a, b) => (pos.get(a.id) ?? 1e6 + ordenGeneral(a)) - (pos.get(b.id) ?? 1e6 + ordenGeneral(b)));
  }, [h, tipoCategoria]);

  const visibles = useMemo(() => {
    const base = categorias.slice(0, VISIBLES);
    // La elegida siempre a la vista
    if (categoriaId && !base.some((c) => c.id === categoriaId)) {
      const elegida = categorias.find((c) => c.id === categoriaId);
      if (elegida) return [elegida, ...base.slice(0, VISIBLES - 1)];
    }
    return base;
  }, [categorias, categoriaId]);

  const categoria = h.categoria(categoriaId);
  const ambitoEfectivo: Ambito = ambito ?? categoria?.ambitoDefault ?? "compartido";
  const cuenta = h.cuenta(cuentaId);
  const resumen = textoResumen(fecha, cuenta);

  function elegirCategoria(id: string) {
    setCategoriaId(id);
    setError(null);
    if (!cuentaElegida && h.cuentaPorCategoria[id]) {
      const c = h.cuenta(h.cuentaPorCategoria[id]);
      if (c && !c.archivada) {
        setCuentaId(c.id);
        setMoneda(c.moneda);
      }
    }
  }

  function elegirCuenta(id: string) {
    setCuentaId(id);
    setCuentaElegida(true);
    const c = h.cuenta(id);
    if (c) setMoneda(c.moneda);
  }

  function cambiarTipo(t: TipoMovimiento) {
    setTipo(t);
    if (categoria && categoria.tipo !== (t === "ingreso" ? "ingreso" : "gasto")) setCategoriaId(null);
    setError(null);
  }

  const ia = useEscritura((texto: string) => post<AiParseDTO>("/ai/parse", { texto }));
  async function interpretar() {
    if (textoIa.trim().length < 2) return;
    setErrorIa(null);
    try {
      const { borrador: b } = await ia.mutateAsync(textoIa);
      if (b.tipo) setTipo(b.tipo);
      if (b.monto) setMonto(montoATexto(b.monto));
      if (b.categoriaId) setCategoriaId(b.categoriaId);
      if (b.cuentaId) {
        setCuentaId(b.cuentaId);
        setCuentaElegida(true);
        setMoneda(b.moneda ?? h.cuenta(b.cuentaId)?.moneda ?? "ARS");
      } else if (b.moneda) setMoneda(b.moneda);
      if (b.cuentaDestinoId) setCuentaDestinoId(b.cuentaDestinoId);
      if (b.fechaConsumo) setFecha(b.fechaConsumo);
      if (b.duenoId) setDuenoId(b.duenoId);
      if (b.ambito) setAmbito(b.ambito);
      if (b.etiquetas) setEtiquetas(b.etiquetas.join(", "));
      if (b.nota) setNota(b.nota);
      if (b.cuotas) setCuotas(b.cuotas);
      setTextoIa("");
      toast({ texto: "Listo, revisá y guardá" });
    } catch (e) {
      // El texto queda escrito para reintentar; el resto del formulario sigue funcionando a mano.
      setErrorIa(mensajeError(e));
    }
  }

  const guardar = useEscritura(async () => {
    const montoApi = parseMontoAR(monto);
    if (!montoApi || Number(montoApi) <= 0) throw new Error("Ingresá un monto");
    if (tipo !== "transferencia" && !categoriaId && !editando) throw new Error("Elegí una categoría");
    if (tipo === "transferencia" && !cuentaDestinoId) throw new Error("Elegí la cuenta de destino");
    const etiquetasLista = etiquetas
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const base = {
      tipo,
      monto: montoApi,
      moneda,
      cotizacion: moneda === "ARS" ? null : cotizacion || null,
      fechaConsumo: fecha,
      categoriaId: tipo === "transferencia" ? null : categoriaId,
      duenoId,
      ambito: ambitoEfectivo,
      cuentaId,
      cuentaDestinoId: tipo === "transferencia" ? cuentaDestinoId : null,
      nota: nota.trim() || null,
      etiquetas: etiquetasLista,
    };

    if (inicial) return { mov: (await patch<{ movimiento: MovimientoDTO }>(`/movimientos/${inicial.id}`, base)).movimiento, plan: null };
    if (tipo === "gasto" && cuotas > 1) {
      const { plan } = await post<{ plan: { id: string } }>("/cuotas", {
        descripcion: nota.trim() || categoria?.nombre || "Compra en cuotas",
        montoCuota: montoApi,
        cantidadCuotas: cuotas,
        fechaCompra: fecha,
        cuentaId,
        categoriaId,
        duenoId,
        ambito: ambitoEfectivo,
      });
      return { mov: null, plan };
    }
    return { mov: (await post<{ movimiento: MovimientoDTO }>("/movimientos", base)).movimiento, plan: null };
  });

  const deshacer = useEscritura((ruta: string) => del(ruta));
  const borrar = useEscritura(() => del(`/movimientos/${inicial!.id}`));

  async function onGuardar() {
    setError(null);
    try {
      const r = await guardar.mutateAsync(undefined);
      try {
        localStorage.setItem(CLAVE_CUENTA, cuentaId);
      } catch {
        // sin almacenamiento
      }
      const etiqueta = editando ? "Cambios guardados" : r.plan ? `Compra en ${cuotas} cuotas guardada` : tipo === "ingreso" ? "Ingreso guardado" : tipo === "transferencia" ? "Transferencia guardada" : "Gasto guardado";
      const ruta = r.plan ? `/cuotas/${r.plan.id}` : r.mov && !editando ? `/movimientos/${r.mov.id}` : null;
      toast({ texto: etiqueta, accion: ruta ? { label: "Deshacer", fn: () => deshacer.mutate(ruta) } : undefined });
      onListo();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  async function onBorrar() {
    try {
      await borrar.mutateAsync(undefined);
      toast({ texto: "Movimiento borrado" });
      onListo();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  const personasOpciones = h.personas;
  const chip = "flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-surface px-3 text-sm text-ink-2";

  return (
    <div className="flex min-h-full flex-col gap-3">
      {h.ia && !editando && (
        <div className="flex gap-2">
          <Input
            value={textoIa}
            onChange={(e) => setTextoIa(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && interpretar()}
            placeholder="Contalo: «super 45 mil con MP»"
            aria-label="Cargar escribiendo"
            enterKeyHint="go"
          />
          <Boton variante="secundario" className="shrink-0 px-3.5" onClick={interpretar} cargando={ia.isPending} aria-label="Interpretar con IA">
            {!ia.isPending && <Sparkles size={20} />}
          </Boton>
        </div>
      )}
      {ia.isPending && <p className="-mt-1 text-xs text-muted">Interpretando… (los modelos gratis pueden tardar unos segundos)</p>}
      {errorIa && (
        <p role="alert" className="-mt-1 rounded-xl bg-warning-soft px-3 py-2 text-sm text-ink">
          {errorIa}
        </p>
      )}

      <Segmentado
        etiqueta="Tipo de movimiento"
        valor={tipo}
        onChange={cambiarTipo}
        opciones={[
          { valor: "gasto", label: "Gasto" },
          { valor: "ingreso", label: "Ingreso" },
          { valor: "transferencia", label: "Transferencia" },
        ]}
      />

      <div className="flex items-baseline justify-center gap-2 py-1" aria-live="polite">
        <button type="button" className="min-h-11 text-2xl font-medium text-muted" onClick={() => setMoneda(moneda === "ARS" ? "USD" : "ARS")} aria-label={`Moneda: ${moneda}. Tocá para cambiar`}>
          {moneda === "ARS" ? "$" : "US$"}
        </button>
        <span className={cx("num text-5xl font-semibold tracking-tight", !monto && "text-muted")}>{mostrarMontoTipeado(monto)}</span>
        {cuotas > 1 && <span className="text-base text-ink-2">× {cuotas} cuotas</span>}
      </div>

      <div className="scroll-x -mx-4 flex gap-2 px-4">
        <button type="button" className={chip} onClick={() => setDetalles(true)}>
          {fecha === h.hoy ? "Hoy" : formatFecha(fecha, true)}
        </button>
        <button type="button" className={chip} onClick={() => setDetalles(true)}>
          {cuenta?.nombre ?? "Cuenta"}
          {tipo === "transferencia" && ` → ${h.cuenta(cuentaDestinoId)?.nombre ?? "¿destino?"}`}
          <ChevronDown size={14} />
        </button>
        {h.personas.length > 1 && (
          <button type="button" className={chip} onClick={() => setDetalles(true)}>
            {h.persona(duenoId)?.nombre}
          </button>
        )}
        {tipo !== "transferencia" && (
          <button type="button" className={chip} onClick={() => setDetalles(true)}>
            {NOMBRE_AMBITO[ambitoEfectivo]}
          </button>
        )}
        <button type="button" className={cx(chip, "font-medium text-accent")} onClick={() => setDetalles(true)}>
          Más opciones
        </button>
      </div>
      {tipo === "gasto" && resumen && (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-2">
          <CreditCard size={14} className="shrink-0" aria-hidden /> {resumen}
        </p>
      )}

      {tipo !== "transferencia" && (
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Categoría">
          {visibles.map((c) => (
            <TileCategoria key={c.id} c={c} activa={c.id === categoriaId} onClick={() => elegirCategoria(c.id)} />
          ))}
          <button type="button" onClick={() => setTodas(true)} className="flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl text-xs text-ink-2">
            <span className="flex size-10 items-center justify-center rounded-full bg-surface-2">
              <LayoutGrid size={20} aria-hidden />
            </span>
            Todas
          </button>
        </div>
      )}

      <div className="mt-auto">
        <Teclado onTecla={(t) => setMonto((m) => aplicarTecla(m, t))} />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-critical-soft px-3 py-2 text-sm text-ink">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {editando && (
          <Boton variante="peligro" onClick={() => (confirmarBorrado ? onBorrar() : setConfirmarBorrado(true))} cargando={borrar.isPending}>
            {confirmarBorrado ? "¿Seguro?" : "Borrar"}
          </Boton>
        )}
        <Boton className="flex-1" onClick={onGuardar} cargando={guardar.isPending}>
          {editando ? "Guardar cambios" : "Guardar"}
        </Boton>
      </div>

      <Sheet abierto={todas} onCerrar={() => setTodas(false)} titulo="Categorías">
        <TodasLasCategorias
          tipo={tipoCategoria}
          elegida={categoriaId}
          onElegir={(id) => {
            elegirCategoria(id);
            setTodas(false);
          }}
        />
      </Sheet>

      <Sheet abierto={detalles} onCerrar={() => setDetalles(false)} titulo="Detalles" pie={<Boton className="w-full" onClick={() => setDetalles(false)}>Listo</Boton>}>
        <div className="space-y-4 pt-2">
          <Campo label="Fecha">
            <Input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
          </Campo>
          <Campo
            label={tipo === "transferencia" ? "Desde" : tipo === "ingreso" ? "Entra en" : "Pagado con"}
            ayuda={tipo === "gasto" ? (resumen ?? undefined) : undefined}
          >
            <Select value={cuentaId} onChange={(e) => elegirCuenta(e.target.value)}>
              {h.cuentasActivas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </Campo>
          {tipo === "transferencia" && (
            <Campo label="Hacia" ayuda="Una transferencia no es gasto: el gasto es lo que se paga con esa plata.">
              <Select value={cuentaDestinoId} onChange={(e) => setCuentaDestinoId(e.target.value)}>
                <option value="">Elegí la cuenta</option>
                {h.cuentasActivas
                  .filter((c) => c.id !== cuentaId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({h.persona(c.titularId)?.nombre})
                    </option>
                  ))}
              </Select>
            </Campo>
          )}
          {moneda === "USD" && (
            <Campo label="Cotización (pesos por dólar)" ayuda="Se guarda con el movimiento.">
              <Input inputMode="decimal" value={cotizacion} onChange={(e) => setCotizacion(e.target.value.replace(",", "."))} />
            </Campo>
          )}
          {personasOpciones.length > 1 && (
            <Campo label="De quién es">
              <Select value={duenoId} onChange={(e) => setDuenoId(e.target.value)}>
                {personasOpciones.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Select>
            </Campo>
          )}
          {tipo !== "transferencia" && (
            <Campo label="Ámbito">
              <Select value={ambitoEfectivo} onChange={(e) => setAmbito(e.target.value as Ambito)}>
                {AMBITOS.map((a) => (
                  <option key={a} value={a}>
                    {NOMBRE_AMBITO[a]}
                  </option>
                ))}
              </Select>
            </Campo>
          )}
          {tipo === "gasto" && !editando && (
            <Campo label="Cuotas" ayuda={cuotas > 1 ? "El monto que ingresaste es el de CADA cuota." : "Una compra en cuotas genera un gasto por mes."}>
              <Select value={cuotas} onChange={(e) => setCuotas(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 9, 10, 12, 18, 24].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "Sin cuotas" : `${n} cuotas`}
                  </option>
                ))}
              </Select>
            </Campo>
          )}
          <Campo label="Nota">
            <Textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional" maxLength={500} />
          </Campo>
          <Campo label="Etiquetas" ayuda="Separadas por coma. Ej: gustitos, vacaciones">
            <Input value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} placeholder="Opcional" autoCapitalize="none" />
          </Campo>
        </div>
      </Sheet>
    </div>
  );
}

function TileCategoria({ c, activa, onClick }: { c: CategoriaDTO; activa: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      onClick={onClick}
      className={cx(
        "flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center text-xs leading-tight transition",
        activa ? "bg-accent-soft font-semibold text-ink ring-2 ring-accent" : "text-ink-2",
      )}
    >
      <IconoCategoria icono={c.icono} color={c.color} />
      <span className="line-clamp-2">{c.nombre}</span>
    </button>
  );
}

function TodasLasCategorias({ tipo, elegida, onElegir }: { tipo: "gasto" | "ingreso"; elegida: string | null; onElegir: (id: string) => void }) {
  const h = useHogar();
  const activas = h.categorias.filter((c) => c.tipo === tipo && !c.archivada);
  const hijas = (id: string) => activas.filter((c) => c.padreId === id).sort((a, b) => a.orden - b.orden);
  const raices = activas.filter((c) => !c.padreId).sort((a, b) => a.orden - b.orden);
  // Las categorías sin subcategorías van juntas en una grilla; las que tienen, en su propio grupo.
  const simples = raices.filter((r) => !hijas(r.id).length);
  const grupos = raices.filter((r) => hijas(r.id).length);
  const grilla = (lista: CategoriaDTO[]) => (
    <div className="grid grid-cols-4 gap-2">
      {lista.map((c) => (
        <TileCategoria key={c.id} c={c} activa={elegida === c.id} onClick={() => onElegir(c.id)} />
      ))}
    </div>
  );
  return (
    <div className="space-y-5 pt-2">
      {simples.length > 0 && grilla(simples)}
      {grupos.map((r) => (
        <div key={r.id}>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{r.nombre}</p>
          {grilla([r, ...hijas(r.id)])}
        </div>
      ))}
    </div>
  );
}
