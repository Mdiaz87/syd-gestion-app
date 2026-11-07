import { useState, useEffect } from "react";
import { C } from "../lib/constants.js";
import { fmt } from "../lib/helpers.js";
import { loadControlVigentes, loadCuentasCobro } from "../lib/api.js";
import { controlPresupuesto, alertasPresupuesto, codigos, hojas } from "../lib/controlPresupuesto.js";

// Resumen de los presupuestos vigentes de uno o varios proyectos, con sus
// alertas (sobrecosto, pagado más de lo construido, atraso) y las cuentas
// aprobadas sin actividad. Lo usan el Dashboard y el informe mensual.
const hoyCol = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);

export function ResumenPresupuestos({ proyectos, reports, cuentas: cuentasProp, titulo = "📐 Presupuestos de obra", vacio = null }) {
  const [datos, setDatos] = useState(null);
  const [cuentas, setCuentas] = useState(cuentasProp || null);
  const clave = (proyectos || []).join("|");
  useEffect(() => { loadControlVigentes(proyectos).then(setDatos); }, [clave]);
  useEffect(() => { if (cuentasProp) setCuentas(cuentasProp); else loadCuentasCobro().then(setCuentas); }, [cuentasProp]);

  if (!datos || !cuentas) return null;
  if (!datos.length) return vacio;
  const hoy = hoyCol();
  const filas = datos.map(d => {
    const delProyecto = cuentas.filter(c => c.project === d.pres.project);
    const ctrl = controlPresupuesto(d.pres, d.partidas, delProyecto, d.manuales, hoy, { avances: d.avances, reports });
    const cod = codigos(d.partidas);
    return { ...d, ctrl, alertas: alertasPresupuesto(ctrl, p => `${cod[p.id]} ${p.nombre}`), linajes: new Set(hojas(d.partidas).map(p => p.linaje)) };
  });
  // Cuentas aprobadas sin actividad, por proyecto con presupuesto vigente.
  const sinActividad = {};
  for (const proj of new Set(filas.map(f => f.pres.project))) {
    const linajes = new Set(filas.filter(f => f.pres.project === proj).flatMap(f => [...f.linajes]));
    const n = cuentas.filter(c => c.project === proj && c.estado === "aprobado_total" && !linajes.has(c.partida_linaje)).length;
    if (n) sinActividad[proj] = n;
  }
  const totalAlertas = filas.reduce((s, f) => s + f.alertas.length, 0) + Object.keys(sinActividad).length;

  return (
    <div style={{ background: (totalAlertas ? C.danger : C.green) + "0c", border: `1px solid ${totalAlertas ? C.danger : C.green}44`, borderRadius: 12, padding: 16, marginBottom: 24 }}>
      <div style={{ color: totalAlertas ? C.danger : C.green, fontWeight: 800, fontSize: 14, marginBottom: 10 }}>{titulo}{totalAlertas ? ` — ${totalAlertas} alerta${totalAlertas === 1 ? "" : "s"}` : " — sin alertas"}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {filas.map(f => (
          <div key={f.pres.id} style={{ background: C.bgCard, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span><b style={{ color: C.text }}>{f.pres.project}</b> · {f.pres.nombre}</span>
              <span style={{ color: C.muted }}>{fmt(f.ctrl.total)} · pagado {f.ctrl.pctFinanciero.toFixed(1)}% · físico {f.ctrl.pctFisico.toFixed(1)}% · programado {f.ctrl.pctProgramado.toFixed(1)}%</span>
            </div>
            {f.alertas.slice(0, 6).map((a, i) => <div key={i} style={{ color: a.nivel === "alta" ? C.danger : C.warn, marginTop: 2 }}>{a.tipo === "brecha" ? "💸" : a.tipo === "atraso" ? "⏰" : a.tipo === "sobrecosto" ? "🔴" : "⚠️"} {a.texto}</div>)}
            {f.alertas.length > 6 && <div style={{ color: C.muted, marginTop: 2 }}>…y {f.alertas.length - 6} más (detalle en la pestaña Presupuestos)</div>}
          </div>
        ))}
        {Object.entries(sinActividad).map(([proj, n]) => (
          <div key={proj} style={{ background: C.bgCard, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: C.warn }}>
            📎 <b style={{ color: C.text }}>{proj}</b>: {n} cuenta{n === 1 ? "" : "s"} de cobro aprobada{n === 1 ? "" : "s"} sin actividad del presupuesto (no suman al ejecutado)
          </div>
        ))}
      </div>
    </div>
  );
}
