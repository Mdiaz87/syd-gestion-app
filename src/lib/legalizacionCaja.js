// Legalización de caja menor para imprimir o guardar en PDF (pedido de Kelly,
// 2026-11-19: "exportar en PDF la información al momento de la legalización
// de la caja, para entregar junto con los soportes que tengo en físico").
// Mismo mecanismo que los desprendibles de nómina: se abre una ventana con la
// hoja y el diálogo de imprimir, donde se escoge "Guardar como PDF".

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pesos = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(+n || 0);
const fecha = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('es-CO') : '');
const ESTADO = { enviado: 'En revisión', aprobado: 'Aprobado', devuelto: 'Devuelto', borrador: 'Borrador', rechazado: 'En aclaración' };

export function legalizacionHtml({ caja, gastos, desde, hasta }) {
  const lista = [...gastos].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.created_at).localeCompare(String(b.created_at)));
  const total = lista.reduce((t, g) => t + (+g.valor || 0), 0);
  // Pedido de Kelly (2026-11-19): "Efectivo disponible hoy" confundía (salía
  // negativo cuando el desembolso del fondo no estaba registrado). Ahora la
  // hoja separa lo ya aprobado de lo que falta por revisar.
  const aprobado = lista.filter((g) => g.estado === 'aprobado').reduce((t, g) => t + (+g.valor || 0), 0);
  const porRevisar = total - aprobado;
  const nPorRevisar = lista.filter((g) => g.estado !== 'aprobado').length;
  const r = caja.resumen || {};
  // Pedido de Kelly (2026-11-20): el saldo con que queda la caja al momento de
  // la legalización, para que coincida con los libros de Contabilidad. Fondo
  // fijo: fondo autorizado menos todos los gastos que aún no se han repuesto
  // (los de esta hoja y los anteriores sin reponer).
  // El resumen no trae "sin reponer" directo; sale del cuadre del fondo:
  // diferencia_fondo = fondo − (saldo_operativo + sin_reponer + por_recibir).
  const sinReponer = r.sin_reponer != null ? +r.sin_reponer
    : (+r.fondo_autorizado || 0) - (+r.diferencia_fondo || 0) - (+r.saldo_operativo || 0) - (+r.por_recibir || 0);
  const saldoCaja = (+r.fondo_autorizado || 0) - sinReponer;
  const periodo = desde || hasta ? `${desde ? fecha(desde) : 'inicio'} a ${hasta ? fecha(hasta) : 'hoy'}` : 'Todos los gastos enviados';
  const porCategoria = [...lista.reduce((m, g) => m.set(g.categoria || 'Sin categoría', (m.get(g.categoria || 'Sin categoría') || 0) + (+g.valor || 0)), new Map())]
    .sort((a, b) => b[1] - a[1]);
  const th = 'text-align:left;padding:5px 6px;font-size:10.5px;color:#5b6b85;border-bottom:1.5px solid #0f2d61';
  const td = 'padding:5px 6px;font-size:10.5px;border-bottom:1px solid #e3e8f0;vertical-align:top';

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a2233">
  <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0f2d61;padding-bottom:8px;margin-bottom:12px">
    <div><div style="font-size:18px;font-weight:700;color:#0f2d61">Legalización de caja menor</div>
    <div style="font-size:12px;margin-top:2px">${esc(caja.nombre)} · ${esc(caja.proyecto)}</div></div>
    <div style="font-size:11px;text-align:right;color:#5b6b85">Periodo: ${esc(periodo)}<br>Generado: ${new Date().toLocaleDateString('es-CO')}</div>
  </div>
  <table style="width:100%;font-size:11.5px;margin-bottom:12px;border-collapse:collapse"><tr>
    <td>Fondo de la caja<br><b>${pesos(r.fondo_autorizado)}</b></td>
    <td>Gastos en esta legalización<br><b>${lista.length}</b></td>
    <td>Legalizado aprobado<br><b>${pesos(aprobado)}</b></td>
    <td>Por revisar${nPorRevisar ? ` (${nPorRevisar})` : ''}<br><b>${pesos(porRevisar)}</b></td>
    <td>Total de la legalización<br><b>${pesos(total)}</b></td>
    <td>Saldo de la caja al legalizar<br><b>${pesos(saldoCaja)}</b></td>
  </tr></table>
  <div style="font-size:10px;color:#5b6b85;margin:-6px 0 12px">Saldo de la caja = fondo ${pesos(r.fondo_autorizado)} − gastos sin reponer ${pesos(sinReponer)}${sinReponer !== total ? ' (incluye gastos de legalizaciones anteriores que aún no se han repuesto)' : ''}.</div>
  <table style="width:100%;border-collapse:collapse;table-layout:fixed">
    <tr><th style="${th};width:4%">#</th><th style="${th};width:9%">Fecha</th><th style="${th};width:18%">Proveedor / NIT</th><th style="${th};width:9%">Factura</th>
    <th style="${th};width:24%">Concepto</th><th style="${th};width:15%">Categoría</th><th style="${th};width:10%">Estado</th><th style="${th};width:11%;text-align:right">Valor</th></tr>
    ${lista.map((g, i) => `<tr><td style="${td}">${i + 1}</td><td style="${td}">${fecha(g.fecha)}</td>
      <td style="${td}">${esc(g.proveedor)}${g.nit ? `<br><span style="color:#5b6b85">${esc(g.nit)}</span>` : ''}</td>
      <td style="${td}">${esc(g.numero_factura || '—')}</td>
      <td style="${td}">${esc(g.concepto)}${g.centro_costo ? `<br><span style="color:#5b6b85">${esc(g.centro_costo)}</span>` : ''}${(g.soportes || []).length ? '' : '<br><span style="color:#c0392b">Sin soporte en la app</span>'}</td>
      <td style="${td}">${esc(g.categoria || '')}${g.subcategoria ? `<br><span style="color:#5b6b85">${esc(g.subcategoria)}</span>` : ''}</td>
      <td style="${td}">${esc(ESTADO[g.estado] || g.estado)}</td>
      <td style="${td};text-align:right;white-space:nowrap">${pesos(g.valor)}</td></tr>`).join('')}
    <tr><td colspan="7" style="padding:7px 6px;font-size:12px;font-weight:700;text-align:right">Total</td>
      <td style="padding:7px 6px;font-size:12px;font-weight:700;text-align:right;white-space:nowrap">${pesos(total)}</td></tr>
  </table>
  ${porCategoria.length > 1 ? `<div style="font-size:11px;margin-top:10px"><b>Por categoría:</b> ${porCategoria.map(([c, v]) => `${esc(c)} ${pesos(v)}`).join(' · ')}</div>` : ''}
  <table style="width:100%;margin-top:46px;font-size:11px;border-collapse:collapse"><tr>
    <td style="width:33%;padding-right:20px"><div style="border-top:1px solid #1a2233;padding-top:4px">Entrega (responsable de la caja)</div></td>
    <td style="width:33%;padding-right:20px"><div style="border-top:1px solid #1a2233;padding-top:4px">Recibe y revisa (Contabilidad)</div></td>
    <td style="width:33%"><div style="border-top:1px solid #1a2233;padding-top:4px">Aprueba</div></td>
  </tr></table>
</div>`;
}

export function imprimirLegalizacion(datos) {
  const w = window.open('', '_blank');
  if (!w) throw new Error('El navegador bloqueó la ventana. Permite ventanas emergentes para esta página.');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Legalización ${esc(datos.caja.nombre)}</title>
<style>@page{size:letter;margin:12mm}body{margin:0;background:#fff}tr{page-break-inside:avoid}
@media screen{body{background:#f2f4f8}.hoja{background:#fff;max-width:820px;margin:16px auto;padding:24px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.08)}}</style>
</head><body><div class="hoja">${legalizacionHtml(datos)}</div><script>setTimeout(function(){window.print()},400)</script></body></html>`);
  w.document.close();
}
