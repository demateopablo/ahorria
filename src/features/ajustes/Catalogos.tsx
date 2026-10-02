import { useState } from "react";
import { useHogar } from "@/app/hogar";
import { Icono, IconoCategoria } from "@/components/Icono";
import { useToast } from "@/components/Toast";
import { Aviso, Boton, Campo, Cargando, cx, Input, Interruptor, Monto, Segmentado, Select, Tarjeta } from "@/components/ui";
import { del, mensajeError, patch, post, put } from "@/lib/api";
import { useCotizaciones, useEscritura, useEventos } from "@/lib/datos";
import { formatFecha, formatMonto } from "@shared/format";
import { ICONOS } from "@shared/iconos";
import { TIPOS_CUENTA, type Ambito, type Moneda, type TipoCuenta } from "@shared/domain/tipos";
import type { CategoriaDTO, CuentaDTO, EventoDTO, PersonaDTO } from "@shared/schemas/api";
import { aTexto, HojaEditor, MESES, montoONull, NOMBRE_AMBITO, PantallaAjuste, SelectCategoria, SelectPersona, useEditor } from "./comun";

const COLORES = ["#16a34a", "#2563eb", "#d97706", "#db2777", "#7c3aed", "#0891b2", "#dc2626", "#65a30d", "#ea580c", "#4f46e5", "#0d9488", "#c026d3", "#475569"];
const NOMBRE_TIPO_CUENTA: Record<TipoCuenta, string> = {
  efectivo: "Efectivo",
  billetera: "Billetera virtual",
  banco: "Banco",
  tarjeta_credito: "Tarjeta de crédito",
  inversion: "Inversión",
};
const ICONO_CUENTA: Record<TipoCuenta, string> = { efectivo: "banknote", billetera: "wallet", banco: "landmark", tarjeta_credito: "credit-card", inversion: "trending-up" };

function Fila({ icono, titulo, detalle, derecha, onClick, apagada }: { icono: React.ReactNode; titulo: string; detalle?: string; derecha?: React.ReactNode; onClick: () => void; apagada?: boolean }) {
  return (
    <li>
      <button type="button" onClick={onClick} className={cx("flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left", apagada && "opacity-50")}>
        {icono}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{titulo}</span>
          {detalle && <span className="block truncate text-xs text-muted">{detalle}</span>}
        </span>
        {derecha}
      </button>
    </li>
  );
}

function Lista({ children }: { children: React.ReactNode }) {
  return (
    <Tarjeta padding="ninguno">
      <ul className="divide-y divide-line">{children}</ul>
    </Tarjeta>
  );
}

function Colores({ valor, onChange }: { valor: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
      {COLORES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={valor === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cx("size-11 rounded-full", valor === c && "ring-2 ring-ink ring-offset-2 ring-offset-bg")}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

// ─── Cuentas ─────────────────────────────────────────────────────────────

export function Cuentas() {
  const h = useHogar();
  const editor = useEditor<CuentaDTO>();
  return (
    <PantallaAjuste titulo="Cuentas" onAgregar={() => editor.abrir()}>
      <Lista>
        {h.cuentas.map((c) => (
          <Fila
            key={c.id}
            apagada={c.archivada}
            onClick={() => editor.abrir(c)}
            icono={
              <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-ink-2">
                <Icono nombre={ICONO_CUENTA[c.tipo]} />
              </span>
            }
            titulo={c.nombre}
            detalle={`${NOMBRE_TIPO_CUENTA[c.tipo]} · ${h.persona(c.titularId)?.nombre}${c.moneda === "USD" ? " · USD" : ""}${c.archivada ? " · archivada" : ""}`}
            derecha={c.tna ? <span className="num text-xs text-muted">TNA {c.tna.replace(".", ",")} %</span> : undefined}
          />
        ))}
      </Lista>
      <EditorCuenta key={editor.key} abierto={editor.abierto} item={editor.item} onCerrar={editor.cerrar} />
    </PantallaAjuste>
  );
}

function EditorCuenta({ abierto, item, onCerrar }: { abierto: boolean; item?: CuentaDTO; onCerrar: () => void }) {
  const h = useHogar();
  const [f, setF] = useState({
    nombre: item?.nombre ?? "",
    tipo: item?.tipo ?? ("billetera" as TipoCuenta),
    moneda: item?.moneda ?? ("ARS" as Moneda),
    titularId: item?.titularId ?? h.yo.id,
    saldoInicial: aTexto(item?.saldoInicial === "0" ? "" : item?.saldoInicial),
    tna: aTexto(item?.tna),
    diaCierre: item?.diaCierre ? String(item.diaCierre) : "",
    diaVencimiento: item?.diaVencimiento ? String(item.diaVencimiento) : "",
    archivada: item?.archivada ?? false,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const body = () => ({
    nombre: f.nombre,
    tipo: f.tipo,
    moneda: f.moneda,
    titularId: f.titularId,
    saldoInicial: montoONull(f.saldoInicial) ?? "0",
    fechaSaldoInicial: item?.fechaSaldoInicial ?? h.hoy,
    tna: montoONull(f.tna),
    diaCierre: f.diaCierre ? Number(f.diaCierre) : null,
    diaVencimiento: f.diaVencimiento ? Number(f.diaVencimiento) : null,
    orden: item?.orden ?? h.cuentas.length,
    archivada: f.archivada,
  });
  const dia = (v: string) => v.replace(/\D/g, "").slice(0, 2);

  return (
    <HojaEditor
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={item ? "Editar cuenta" : "Nueva cuenta"}
      onGuardar={() => (item ? put(`/cuentas/${item.id}`, body()) : post("/cuentas", body()))}
      onBorrar={item ? () => del(`/cuentas/${item.id}`) : undefined}
    >
      <Campo label="Nombre">
        <Input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej: Mercado Pago" />
      </Campo>
      <Campo label="Tipo">
        <Select value={f.tipo} onChange={(e) => set("tipo", e.target.value as TipoCuenta)}>
          {TIPOS_CUENTA.map((t) => (
            <option key={t} value={t}>
              {NOMBRE_TIPO_CUENTA[t]}
            </option>
          ))}
        </Select>
      </Campo>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Titular">
          <SelectPersona valor={f.titularId} onChange={(v) => set("titularId", v)} />
        </Campo>
        <Campo label="Moneda">
          <Select value={f.moneda} onChange={(e) => set("moneda", e.target.value as Moneda)}>
            <option value="ARS">Pesos</option>
            <option value="USD">Dólares</option>
          </Select>
        </Campo>
      </div>
      {f.tipo === "tarjeta_credito" ? (
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Día de cierre" ayuda="Opcional">
            <Input inputMode="numeric" value={f.diaCierre} onChange={(e) => set("diaCierre", dia(e.target.value))} />
          </Campo>
          <Campo label="Día de vencimiento" ayuda="Por defecto, el 10">
            <Input inputMode="numeric" value={f.diaVencimiento} onChange={(e) => set("diaVencimiento", dia(e.target.value))} />
          </Campo>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Saldo inicial">
            <Input inputMode="decimal" value={f.saldoInicial} onChange={(e) => set("saldoInicial", e.target.value)} placeholder="0" />
          </Campo>
          <Campo label="TNA % (opcional)">
            <Input inputMode="decimal" value={f.tna} onChange={(e) => set("tna", e.target.value)} />
          </Campo>
        </div>
      )}
      {item && <Interruptor checked={f.archivada} onChange={(v) => set("archivada", v)} label="Archivada (no aparece al cargar)" />}
    </HojaEditor>
  );
}

// ─── Categorías ──────────────────────────────────────────────────────────

export function Categorias() {
  const h = useHogar();
  const editor = useEditor<CategoriaDTO>();
  const [tipo, setTipo] = useState<"gasto" | "ingreso">("gasto");
  const raices = h.categorias.filter((c) => !c.padreId && c.tipo === tipo);

  return (
    <PantallaAjuste titulo="Categorías" onAgregar={() => editor.abrir()}>
      <Segmentado
        etiqueta="Tipo"
        valor={tipo}
        onChange={setTipo}
        opciones={[
          { valor: "gasto", label: "Gastos" },
          { valor: "ingreso", label: "Ingresos" },
        ]}
      />
      <Lista>
        {raices.flatMap((r) => [
          <Fila
            key={r.id}
            apagada={r.archivada}
            onClick={() => editor.abrir(r)}
            icono={<IconoCategoria icono={r.icono} color={r.color} />}
            titulo={r.nombre}
            detalle={`${NOMBRE_AMBITO[r.ambitoDefault]}${r.archivada ? " · archivada" : ""}`}
          />,
          ...h.categorias
            .filter((c) => c.padreId === r.id)
            .map((c) => (
              <Fila
                key={c.id}
                apagada={c.archivada}
                onClick={() => editor.abrir(c)}
                icono={
                  <span className="ml-6">
                    <IconoCategoria icono={c.icono} color={c.color} size={32} />
                  </span>
                }
                titulo={c.nombre}
                detalle={`${NOMBRE_AMBITO[c.ambitoDefault]}${c.archivada ? " · archivada" : ""}`}
              />
            )),
        ])}
      </Lista>
      <EditorCategoria key={editor.key} abierto={editor.abierto} item={editor.item} tipoNuevo={tipo} onCerrar={editor.cerrar} />
    </PantallaAjuste>
  );
}

function EditorCategoria({ abierto, item, tipoNuevo, onCerrar }: { abierto: boolean; item?: CategoriaDTO; tipoNuevo: "gasto" | "ingreso"; onCerrar: () => void }) {
  const h = useHogar();
  const [f, setF] = useState({
    nombre: item?.nombre ?? "",
    tipo: item?.tipo ?? tipoNuevo,
    padreId: item?.padreId ?? "",
    icono: item?.icono ?? "circle",
    color: item?.color ?? COLORES[0],
    ambitoDefault: item?.ambitoDefault ?? ("compartido" as Ambito),
    archivada: item?.archivada ?? false,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const tieneHijas = item ? h.categorias.some((c) => c.padreId === item.id) : false;
  const body = () => ({ ...f, padreId: f.padreId || null, orden: item?.orden ?? h.categorias.length });

  return (
    <HojaEditor
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={item ? "Editar categoría" : "Nueva categoría"}
      onGuardar={() => (item ? put(`/categorias/${item.id}`, body()) : post("/categorias", body()))}
      onBorrar={item ? () => del(`/categorias/${item.id}`) : undefined}
    >
      <div className="flex items-center gap-3">
        <IconoCategoria icono={f.icono} color={f.color} size={48} />
        <div className="flex-1">
          <Campo label="Nombre">
            <Input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </Campo>
        </div>
      </div>
      {!tieneHijas && (
        <Campo label="Dentro de" ayuda="Opcional: para que sea una subcategoría.">
          <SelectCategoria valor={f.padreId} onChange={(v) => set("padreId", v)} tipo={f.tipo} vacio="Ninguna (categoría principal)" soloRaices />
        </Campo>
      )}
      <Campo label="Ámbito por defecto" ayuda="Se propone al cargar un movimiento de esta categoría.">
        <Select value={f.ambitoDefault} onChange={(e) => set("ambitoDefault", e.target.value as Ambito)}>
          {Object.entries(NOMBRE_AMBITO).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Campo>
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-2">Color</p>
        <Colores valor={f.color} onChange={(c) => set("color", c)} />
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-2">Ícono</p>
        <div className="grid grid-cols-6 gap-1" role="radiogroup" aria-label="Ícono">
          {ICONOS.map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={f.icono === i}
              aria-label={i}
              onClick={() => set("icono", i)}
              className={cx("flex size-12 items-center justify-center rounded-xl", f.icono === i ? "bg-accent-soft text-accent ring-2 ring-accent" : "text-ink-2")}
            >
              <Icono nombre={i} size={22} />
            </button>
          ))}
        </div>
      </div>
      {item && <Interruptor checked={f.archivada} onChange={(v) => set("archivada", v)} label="Archivada (no aparece al cargar)" />}
    </HojaEditor>
  );
}

// ─── Personas ────────────────────────────────────────────────────────────

export function Personas() {
  const h = useHogar();
  const editor = useEditor<PersonaDTO>();
  return (
    <PantallaAjuste titulo="Personas" onAgregar={() => editor.abrir()}>
      <p className="text-sm text-ink-2">Las personas con email de Google pueden entrar a la app. Sin email, igual se les pueden asignar gastos (ej. un hijo).</p>
      <Lista>
        {h.personas.map((p) => (
          <Fila
            key={p.id}
            onClick={() => editor.abrir(p)}
            icono={
              <span className="flex size-10 items-center justify-center rounded-full text-base font-semibold text-white" style={{ background: p.color }}>
                {p.nombre.slice(0, 1)}
              </span>
            }
            titulo={p.id === h.yo.id ? `${p.nombre} (vos)` : p.nombre}
            detalle={p.email ?? "Sin acceso a la app"}
          />
        ))}
      </Lista>
      <EditorPersona key={editor.key} abierto={editor.abierto} item={editor.item} onCerrar={editor.cerrar} />
    </PantallaAjuste>
  );
}

function EditorPersona({ abierto, item, onCerrar }: { abierto: boolean; item?: PersonaDTO; onCerrar: () => void }) {
  const h = useHogar();
  const soyYo = item?.id === h.yo.id;
  const [f, setF] = useState({ nombre: item?.nombre ?? "", email: item?.email ?? "", color: item?.color ?? COLORES[h.personas.length % COLORES.length] });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const body = () => ({ nombre: f.nombre, email: f.email.trim() || null, color: f.color, orden: item?.orden ?? h.personas.length });
  return (
    <HojaEditor
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={item ? "Editar persona" : "Nueva persona"}
      onGuardar={() => (item ? put(`/personas/${item.id}`, body()) : post("/personas", body()))}
      onBorrar={item && !soyYo ? () => del(`/personas/${item.id}`) : undefined}
    >
      <Campo label="Nombre">
        <Input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} />
      </Campo>
      <Campo label="Email de Google" ayuda={soyYo ? "Es tu acceso: no se puede cambiar desde acá." : "Con este email va a poder entrar. Dejalo vacío si no usa la app."}>
        <Input type="email" value={f.email} disabled={soyYo} onChange={(e) => set("email", e.target.value)} autoCapitalize="none" autoComplete="off" />
      </Campo>
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-2">Color</p>
        <Colores valor={f.color} onChange={(c) => set("color", c)} />
      </div>
    </HojaEditor>
  );
}

// ─── Eventos ─────────────────────────────────────────────────────────────

export function Eventos() {
  const h = useHogar();
  const { data, isLoading, error } = useEventos();
  const editor = useEditor<EventoDTO>();
  return (
    <PantallaAjuste titulo="Eventos y regalos" onAgregar={() => editor.abrir()}>
      <p className="text-sm text-ink-2">Fechas que se repiten cada año. La proyección reserva el monto en ese mes.</p>
      {isLoading && <Cargando />}
      {error && <Aviso tono="critical">{error.message}</Aviso>}
      {data && (
        <Lista>
          {data.map((e) => (
            <Fila
              key={e.id}
              apagada={!e.activo}
              onClick={() => editor.abrir(e)}
              icono={<IconoCategoria icono="gift" color={h.categoria(e.categoriaId)?.color ?? "#db2777"} />}
              titulo={e.nombre}
              detalle={`${e.dia ? `${e.dia} de ` : ""}${MESES[e.mes - 1].toLowerCase()}${e.duenoId ? ` · ${h.persona(e.duenoId)?.nombre}` : ""}`}
              derecha={<Monto valor={e.montoPresupuestado} className="text-sm font-semibold" />}
            />
          ))}
        </Lista>
      )}
      <EditorEvento key={editor.key} abierto={editor.abierto} item={editor.item} onCerrar={editor.cerrar} />
    </PantallaAjuste>
  );
}

function EditorEvento({ abierto, item, onCerrar }: { abierto: boolean; item?: EventoDTO; onCerrar: () => void }) {
  const [f, setF] = useState({
    nombre: item?.nombre ?? "",
    mes: String(item?.mes ?? 1),
    dia: item?.dia ? String(item.dia) : "",
    monto: aTexto(item?.montoPresupuestado),
    categoriaId: item?.categoriaId ?? "",
    duenoId: item?.duenoId ?? "",
    activo: item?.activo ?? true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const body = () => ({
    nombre: f.nombre,
    mes: Number(f.mes),
    dia: f.dia ? Number(f.dia) : null,
    montoPresupuestado: montoONull(f.monto) ?? "",
    categoriaId: f.categoriaId || null,
    duenoId: f.duenoId || null,
    activo: f.activo,
  });
  return (
    <HojaEditor
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={item ? "Editar evento" : "Nuevo evento"}
      onGuardar={() => (item ? put(`/eventos/${item.id}`, body()) : post("/eventos", body()))}
      onBorrar={item ? () => del(`/eventos/${item.id}`) : undefined}
    >
      <Campo label="Qué">
        <Input value={f.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej: Cumple de la abuela" />
      </Campo>
      <div className="grid grid-cols-2 gap-2">
        <Campo label="Mes">
          <Select value={f.mes} onChange={(e) => set("mes", e.target.value)}>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo label="Día (opcional)">
          <Input inputMode="numeric" value={f.dia} onChange={(e) => set("dia", e.target.value.replace(/\D/g, "").slice(0, 2))} />
        </Campo>
      </div>
      <Campo label="Presupuesto">
        <Input inputMode="decimal" value={f.monto} onChange={(e) => set("monto", e.target.value)} placeholder="0" />
      </Campo>
      <Campo label="Categoría">
        <SelectCategoria valor={f.categoriaId} onChange={(v) => set("categoriaId", v)} tipo="gasto" />
      </Campo>
      <Campo label="De quién" ayuda="Sin persona, cuenta para todo el hogar.">
        <SelectPersona valor={f.duenoId} onChange={(v) => set("duenoId", v)} vacio="Hogar" />
      </Campo>
      <Interruptor checked={f.activo} onChange={(v) => set("activo", v)} label="Activo" />
    </HojaEditor>
  );
}

// ─── Cotizaciones ────────────────────────────────────────────────────────

export function Cotizaciones() {
  const h = useHogar();
  const toast = useToast();
  const { data, isLoading } = useCotizaciones();
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState<"oficial" | "mep">("oficial");
  const [fecha, setFecha] = useState(h.hoy);
  const guardar = useEscritura(() => post("/cotizaciones", { fecha, tipo, valor: montoONull(valor) ?? "" }));
  const borrar = useEscritura((id: string) => del(`/cotizaciones/${id}`));

  return (
    <PantallaAjuste titulo="Dólar">
      <Tarjeta className="space-y-3">
        <p className="text-sm text-ink-2">Se usa para los gastos en dólares que no traen su propia cotización y para la proyección.</p>
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Pesos por dólar">
            <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ej: 1.420,50" />
          </Campo>
          <Campo label="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as "oficial" | "mep")}>
              <option value="oficial">Oficial</option>
              <option value="mep">MEP</option>
            </Select>
          </Campo>
        </div>
        <Campo label="Fecha">
          <Input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
        </Campo>
        <Boton
          className="w-full"
          cargando={guardar.isPending}
          onClick={async () => {
            try {
              await guardar.mutateAsync(undefined);
              setValor("");
              toast({ texto: "Cotización guardada" });
            } catch (e) {
              toast({ texto: mensajeError(e), error: true });
            }
          }}
        >
          Guardar cotización
        </Boton>
      </Tarjeta>
      {isLoading && <Cargando />}
      {data && data.length > 0 && (
        <Lista>
          {data.map((c) => (
            <li key={c.id} className="flex min-h-14 items-center gap-3 px-3">
              <span className="flex-1 text-sm">
                {formatFecha(c.fecha)} <span className="text-xs uppercase text-muted">{c.tipo}</span>
              </span>
              <span className="num text-sm font-semibold">{formatMonto(c.valor)}</span>
              <button type="button" className="min-h-11 px-2 text-xs text-muted" onClick={() => borrar.mutate(c.id)} aria-label={`Borrar cotización del ${formatFecha(c.fecha)}`}>
                Borrar
              </button>
            </li>
          ))}
        </Lista>
      )}
    </PantallaAjuste>
  );
}

// ─── Hogar ───────────────────────────────────────────────────────────────

export function HogarAjustes() {
  const h = useHogar();
  const toast = useToast();
  const [nombre, setNombre] = useState(h.config.nombreHogar);
  const [umbral, setUmbral] = useState(aTexto(h.config.umbralMargenBajo));
  const guardar = useEscritura(() => patch("/config", { nombreHogar: nombre, umbralMargenBajo: montoONull(umbral) ?? "0" }));
  return (
    <PantallaAjuste titulo="Hogar">
      <Tarjeta className="space-y-4">
        <Campo label="Nombre del hogar">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <Campo label="Margen mínimo por mes" ayuda="Si lo que sobra en un mes queda por debajo de esto, la proyección lo marca como «Ajustado».">
          <Input inputMode="decimal" value={umbral} onChange={(e) => setUmbral(e.target.value)} />
        </Campo>
        <Boton
          className="w-full"
          cargando={guardar.isPending}
          onClick={async () => {
            try {
              await guardar.mutateAsync(undefined);
              toast({ texto: "Guardado" });
            } catch (e) {
              toast({ texto: mensajeError(e), error: true });
            }
          }}
        >
          Guardar
        </Boton>
      </Tarjeta>
    </PantallaAjuste>
  );
}
