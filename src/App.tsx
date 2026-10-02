import { useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { Route, Routes } from "react-router";
import { HogarProvider } from "./app/hogar";
import { Layout } from "./app/Layout";
import { NuevaVersion } from "./components/NuevaVersion";
import { ToastProvider } from "./components/Toast";
import { Aviso, Boton, Cargando } from "./components/ui";
import { CargaProvider } from "./features/carga/Carga";
import { Inicio } from "./features/inicio/Inicio";
import { Login } from "./features/login/Login";
import { Movimientos } from "./features/movimientos/Movimientos";
import { ApiError, onSesionPerdida } from "./lib/api";
import { useBootstrap, useSesion } from "./lib/datos";

const Proyeccion = lazy(() => import("./features/proyeccion/Proyeccion").then((m) => ({ default: m.Proyeccion })));
const Mas = lazy(() => import("./features/ajustes/Mas").then((m) => ({ default: m.Mas })));
const Recurrencias = lazy(() => import("./features/ajustes/Recurrencias").then((m) => ({ default: m.Recurrencias })));
const Cuotas = lazy(() => import("./features/ajustes/Cuotas").then((m) => ({ default: m.Cuotas })));
const catalogos = () => import("./features/ajustes/Catalogos");
const Cuentas = lazy(() => catalogos().then((m) => ({ default: m.Cuentas })));
const Categorias = lazy(() => catalogos().then((m) => ({ default: m.Categorias })));
const Personas = lazy(() => catalogos().then((m) => ({ default: m.Personas })));
const Eventos = lazy(() => catalogos().then((m) => ({ default: m.Eventos })));
const Cotizaciones = lazy(() => catalogos().then((m) => ({ default: m.Cotizaciones })));
const HogarAjustes = lazy(() => catalogos().then((m) => ({ default: m.HogarAjustes })));

export function App() {
  const qc = useQueryClient();
  const sesion = useSesion();

  useEffect(() => {
    onSesionPerdida(() => qc.setQueryData(["sesion"], null));
  }, [qc]);

  return (
    <ToastProvider>
      <NuevaVersion />
      {sesion.isLoading ? <Cargando /> : sesion.data ? <AppConSesion /> : <Login />}
    </ToastProvider>
  );
}

function AppConSesion() {
  const { data, error, refetch, isFetching } = useBootstrap();
  if (error) {
    const sinConfigurar = error instanceof ApiError && error.status === 503;
    return (
      <main className="mx-auto max-w-md space-y-4 p-6 pt-16">
        <Aviso tono="critical">{error.message}</Aviso>
        {!sinConfigurar && (
          <Boton variante="secundario" className="w-full" cargando={isFetching} onClick={() => refetch()}>
            Reintentar
          </Boton>
        )}
      </main>
    );
  }
  if (!data) return <Cargando />;
  return (
    <HogarProvider datos={data}>
      <CargaProvider>
        <Suspense fallback={<Cargando />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Inicio />} />
              <Route path="movimientos" element={<Movimientos />} />
              <Route path="proyeccion" element={<Proyeccion />} />
              <Route path="mas">
                <Route index element={<Mas />} />
                <Route path="recurrencias" element={<Recurrencias />} />
                <Route path="cuotas" element={<Cuotas />} />
                <Route path="cuentas" element={<Cuentas />} />
                <Route path="categorias" element={<Categorias />} />
                <Route path="personas" element={<Personas />} />
                <Route path="eventos" element={<Eventos />} />
                <Route path="cotizaciones" element={<Cotizaciones />} />
                <Route path="hogar" element={<HogarAjustes />} />
              </Route>
              <Route path="*" element={<Inicio />} />
            </Route>
          </Routes>
        </Suspense>
      </CargaProvider>
    </HogarProvider>
  );
}
