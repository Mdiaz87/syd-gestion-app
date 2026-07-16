const GAS_URL = "https://script.google.com/macros/s/AKfycbw1y7NpivZ5fRbbMtXapUq8msY63OM8knVsxsIF1_8fm_307mcqFDQt-jYwGmPYopfN/exec";

// ── GENERADOR HTML PARA DRIVE / IMPRESIÓN ─────────────────────────────────────
export function generarHTMLInforme(report, soloContenido=false){
  const logoSVG=`<svg width="220" height="47" viewBox="0 0 300 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M 9.48 19.00 A 26 26 0 0 1 54.52 19.00" stroke="#2445a0" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M 54.52 19.00 A 26 26 0 0 1 32.00 58.00" stroke="#f5c400" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M 32.00 58.00 A 26 26 0 0 1 9.48 19.00" stroke="#4bb86a" stroke-width="7" stroke-linecap="round" fill="none"/><text x="72" y="38" font-family="Arial Black,Helvetica Neue,Arial,sans-serif" font-weight="900" font-size="30" fill="#ffffff" letter-spacing="-0.5">SYD</text><text x="72" y="58" font-family="Arial Black,Helvetica Neue,Arial,sans-serif" font-weight="700" font-size="18" fill="#ffffff" letter-spacing="1.5">INVERSIONES</text></svg>`;
  const tipoLabel={semanal:"Informe Semanal",mensual:"Informe Mensual",trimestral:"Informe Trimestral"}[report.type]||report.type;
  const fmtN=n=>n?new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(+n):"-";
  const estC={Aprobado:"#3aaa6e",Pendiente:"#f5a623",Rechazado:"#e05252"};
  const avO=report.avanceObra||0, avR=Math.max(0,Math.min(100,+report.avanceRecursos||0));
  const sec=(t,c="#1b3a6b")=>`<h2 style="color:${c};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:20px 0 10px;padding-left:10px;border-left:3px solid ${c}">${t}</h2>`;
  const thStyle=`padding:7px 8px;color:#1b3a6b;text-align:left;border-bottom:2px solid #dde3ee;font-size:11px;white-space:nowrap`;
  const tableWrap=(heads,rows)=>`<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f0f3f8">${heads.map(h=>`<th style="${thStyle}">${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;

  // Días (Coordinador)
  const daysHTML=(report.days||[]).map((day,di)=>{
    const rows=(day.activities||[]).filter(a=>a.actividad).map(a=>{
      const act=a.actividad==="Otro"?(a.actividadOtro||"Otro"):a.actividad;
      const eq=a.equipo==="Otro"?(a.equipoOtro||"Otro"):a.equipo;
      const per=a.personal==="Otro"?(a.personalOtro||"Otro"):a.personal;
      const uni=a.unidad==="Otro"?(a.unidadOtro||""):a.unidad;
      return `<tr><td>${act}</td><td>${eq}</td><td>${per}</td><td style="text-align:center">${a.cantidad||""}</td><td style="text-align:center">${uni}</td><td style="text-align:center">${a.etapa||""}</td><td>${a.observaciones||""}</td></tr>`;
    }).join("");
    const photos=(day.photos||[]).map(p=>`<img src="${p}" style="width:100%;height:90px;object-fit:cover;border-radius:6px;border:1px solid #dde3ee"/>`).join("");
    return `<div style="background:#fff;border-radius:10px;border:1px solid #dde3ee;border-left:4px solid #3aaa6e;padding:14px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;color:#3aaa6e;font-weight:700;margin-bottom:12px">
        <span>📅 Día ${di+1} — ${day.date}</span><span>${day.climaPrincipal} · ${day.inicioJornada}–${day.finJornada}</span></div>
      ${rows?tableWrap(["Actividad","Equipo","Personal","Cant.","Unidad","Etapa","Observaciones"],rows):""}
      ${day.novelties?`<div style="background:#fff8ec;border:1px solid #f5a623;border-radius:6px;padding:8px 12px;margin-top:10px;color:#c47a00;font-size:12px">⚠️ Novedades: ${day.novelties}</div>`:""}
      ${photos?`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px">${photos}</div>`:""}
    </div>`;
  }).join("");

  // Frentes (Ingeniero)
  const frentesHTML=(report.frentes||[]).map((fr,fi)=>{
    const gRows=(fr.gastos||[]).filter(g=>g.proveedor).map(g=>`<tr><td>${g.proveedor}</td><td style="color:${estC[g.estado]||"#1a2540"};font-weight:700">${g.estado}</td><td>${g.descripcion}</td><td style="text-align:right">${fmtN(g.valor)}</td><td>${g.centroCosto}</td></tr>`).join("");
    const totalFr=(fr.gastos||[]).reduce((s,g)=>s+(+g.valor||0),0);
    const lotes=fr.nombre==="Entrega de Lotes"&&fr.lotesData?`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">${[["#3aaa6e","✅ Entregados",fr.lotesData.entregados||0],["#2d5fa6","📅 Programados",fr.lotesData.programados||0],["#f5a623","🔄 Reagendados",fr.lotesData.reagendados||0],["#e05252","⏳ Por entregar",fr.lotesData.porEntregar||0]].map(([c,l,v])=>`<div style="text-align:center;background:${c}18;color:${c};border-radius:8px;padding:8px;font-size:12px">${l}<br/><b>${v}</b></div>`).join("")}</div>`:"";
    const photos=(fr.photos||[]).map(p=>`<img src="${p}" style="width:100%;height:90px;object-fit:cover;border-radius:6px;border:1px solid #dde3ee"/>`).join("");
    return `<div style="background:#fff;border-radius:10px;border:1px solid #dde3ee;border-left:4px solid #f5c400;padding:14px;margin-bottom:12px">
      <div style="color:#1b3a6b;font-weight:700;font-size:14px;margin-bottom:8px">${fi+1}. ${fr.nombre}</div>
      ${fr.descripcion?`<p style="color:#1a2540;font-size:13px;margin-bottom:10px;line-height:1.5">${fr.descripcion}</p>`:""}
      ${lotes}
      ${gRows?tableWrap(["Proveedor","Estado","Descripción","Valor","Centro Costo"],gRows)+"<div style=\"text-align:right;font-weight:700;color:#1b3a6b;margin-top:6px\">Total: "+fmtN(totalFr)+"</div>":""}
      ${photos?`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px">${photos}</div>`:""}
    </div>`;
  }).join("");

  // Financiero
  const finItems=(report.financiero||[]).filter(f=>f.presupuesto||(f.ejecutado!==undefined?f.ejecutado:f.totalEjec));
  const finTotalPres=finItems.reduce((s,f)=>s+(+f.presupuesto||0),0);
  const finTotalEjec=finItems.reduce((s,f)=>s+(f.ejecutado!==undefined?+f.ejecutado||0:+f.totalEjec||0),0);
  const finTotalPct=finTotalPres>0?finTotalEjec/finTotalPres*100:0;
  const finTotalBarColor=finTotalPct>100?"#e05252":finTotalPct>=90?"#3aaa6e":finTotalPct>=60?"#f5a623":"#e05252";
  const finRows=finItems.map(f=>{
    const pres=+f.presupuesto||0;
    const ejec=f.ejecutado!==undefined?+f.ejecutado||0:+f.totalEjec||0;
    const pct=pres>0?ejec/pres*100:0;
    const balance=pres-ejec;
    const barColor=pct>100?"#e05252":pct>=90?"#3aaa6e":pct>=60?"#f5a623":"#e05252";
    const balHtml=pres&&ejec?(balance<0?`<span style="color:#e05252;font-weight:700">🔴 Sobrecosto: ${fmtN(Math.abs(balance))}</span>`:balance>0?(f.finalizado?`<span style="color:#3aaa6e;font-weight:700">💚 Ahorro: ${fmtN(balance)}</span>`:`<span style="color:#2d5fa6;font-weight:700">🔷 Saldo disponible: ${fmtN(balance)}</span>`):`<span style="color:#7a90b0">En punto</span>`):"-";
    return `<tr style="border-bottom:1px solid #dde3ee"><td style="font-weight:600;color:#1b3a6b;font-size:11px;padding:10px 8px">${f.item}</td><td style="text-align:right;padding:10px 8px">${fmtN(pres)}</td><td style="text-align:right;padding:10px 8px">${fmtN(ejec)}</td><td style="padding:10px 8px;min-width:140px">${pres?`<div style="display:flex;align-items:center;gap:6px"><div style="flex:1;background:#dde3ee;border-radius:3px;height:5px;overflow:hidden"><div style="width:${Math.min(pct,100).toFixed(1)}%;height:100%;background:${barColor};border-radius:3px"></div></div><span style="color:${barColor};font-weight:700;font-size:10px;white-space:nowrap">Ejec: ${pct.toFixed(1)}%</span></div>${pct<=100&&ejec?`<div style="color:#7a90b0;font-size:10px;margin-top:3px">Por ejec: ${(100-pct).toFixed(1)}%</div>`:""}`:"−"}</td><td style="padding:10px 8px">${balHtml}</td></tr>`;
  }).join("");
  const finTotalBalance=finTotalPres-finTotalEjec;
  const finTodoFinalizado=finItems.length>0&&finItems.every(f=>f.finalizado);
  const finTotalBalHtml=finTotalEjec>0?(finTotalBalance<0?`<span style="color:#e05252;font-weight:700">🔴 Sobrecosto: ${fmtN(Math.abs(finTotalBalance))}</span>`:finTotalBalance>0?(finTodoFinalizado?`<span style="color:#3aaa6e;font-weight:700">💚 Ahorro: ${fmtN(finTotalBalance)}</span>`:`<span style="color:#2d5fa6;font-weight:700">🔷 Saldo disponible: ${fmtN(finTotalBalance)}</span>`):`<span style="color:#7a90b0">En punto</span>`):"";
  const finTotalRow=finTotalPres?`<tr style="background:#f0f3f8;font-weight:700"><td style="color:#1b3a6b;padding:10px 8px;font-size:11px">TOTAL GENERAL</td><td style="text-align:right;padding:10px 8px;color:#1b3a6b">${fmtN(finTotalPres)}</td><td style="text-align:right;padding:10px 8px;color:#1b3a6b">${fmtN(finTotalEjec)}</td><td style="padding:10px 8px;min-width:140px"><div style="display:flex;align-items:center;gap:6px"><div style="flex:1;background:#dde3ee;border-radius:3px;height:5px;overflow:hidden"><div style="width:${Math.min(finTotalPct,100).toFixed(1)}%;height:100%;background:${finTotalBarColor};border-radius:3px"></div></div><span style="color:${finTotalBarColor};font-weight:700;font-size:10px;white-space:nowrap">Ejec: ${finTotalPct.toFixed(1)}%</span></div>${finTotalPct<=100&&finTotalEjec?`<div style="color:#7a90b0;font-size:10px;margin-top:3px">Por ejec: ${(100-finTotalPct).toFixed(1)}%</div>`:""}</td><td style="padding:10px 8px">${finTotalBalHtml}</td></tr>`:"";
  const financieroHTML=finRows?`${sec("Resumen Financiero Global")}<div style="background:#fff;border-radius:10px;border:1px solid #dde3ee;padding:14px;overflow-x:auto">${tableWrap(["Ítem","Presupuesto","Ejecutado","Progreso","Balance"],finRows+finTotalRow)}</div>`:"";

  // Trámites
  const tramHTML=(report.tramites||[]).filter(t=>t.pct).map(t=>`<div style="display:flex;align-items:center;gap:12px;background:#f0f3f8;border-radius:6px;padding:8px 12px;margin-bottom:6px"><span style="flex:1;font-size:12px">${t.tramite}</span><div style="width:120px;background:#dde3ee;border-radius:4px;height:6px;overflow:hidden"><div style="width:${Math.min(+t.pct,100)}%;height:100%;border-radius:4px;background:${+t.pct>=100?"#3aaa6e":+t.pct>=50?"#f5a623":"#e05252"}"></div></div><span style="color:${+t.pct>=100?"#3aaa6e":+t.pct>=50?"#f5a623":"#e05252"};font-weight:700;font-size:12px;min-width:36px">${t.pct}%</span></div>`).join("");
  const tramitesHTML=tramHTML?`${sec("Trámites Ambientales","#3aaa6e")}${tramHTML}`:"";

  // Historial
  const histHTML=(report.history||[]).map(h=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #dde3ee;font-size:12px"><span style="color:${h.accion==="Creado"?"#3aaa6e":"#f5a623"};font-weight:600">${h.accion==="Creado"?"🆕":"✏️"} ${h.accion} por ${h.por}</span><span style="color:#7a90b0">${new Date(h.fecha).toLocaleString("es-CO")}</span></div>`).join("");

  const css=`*{box-sizing:border-box;margin:0;padding:0}table td{padding:6px 8px;border-bottom:1px solid #dde3ee;vertical-align:top}`;
  const cuerpo = `<div style="background:#1b3a6b;padding:24px 32px;display:flex;justify-content:space-between;align-items:center">${logoSVG}
  <div style="text-align:right;color:#fff">
    <div style="font-size:20px;font-weight:800;margin-bottom:4px">${report.project}</div>
    <div style="color:#a8c4e8;font-size:12px;margin-bottom:2px">${tipoLabel}${report.mes?" — "+report.mes:""}</div>
    <div style="color:#a8c4e8;font-size:12px;margin-bottom:2px">Elaborado por: <b style="color:#fff">${report.author}</b> · ${report.date}</div>
    <div style="color:#a8c4e8;font-size:12px">Rol: ${report.role}</div>
    <div style="margin-top:8px"><span style="background:#f5c400;color:#1b3a6b;border-radius:20px;padding:3px 14px;font-size:11px;font-weight:700">${(report.type||"").toUpperCase()}</span></div>
  </div>
</div>
<div style="max-width:900px;margin:0 auto;padding:24px">
  <div style="background:#fff;border-radius:10px;padding:16px;border:1px solid #dde3ee;margin-bottom:14px">
    ${sec("Indicadores")}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div><div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px"><span>Avance de Obra</span><b style="color:#1b3a6b">${avO}%</b></div><div style="background:#dde3ee;border-radius:6px;height:8px;overflow:hidden"><div style="width:${avO}%;background:#f5c400;height:100%;border-radius:6px"></div></div></div>
      ${avR>0?`<div><div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px"><span>Recursos Ejecutados</span><b style="color:#2d5fa6">${avR}%</b></div><div style="background:#dde3ee;border-radius:6px;height:8px;overflow:hidden"><div style="width:${avR}%;background:#2d5fa6;height:100%;border-radius:6px"></div></div></div>`:"<div></div>"}
    </div>
    <div style="background:#f0f3f8;border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;font-size:13px"><span style="color:#7a90b0">Eficiencia de Costo</span><span style="color:${(avO-avR)>=0?"#3aaa6e":"#e05252"};font-weight:700">${(avO-avR)>=0?"+":""}${avO-avR}%</span></div>
    ${report.totalGastos>0?`<div style="background:#f0f3f8;border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;font-size:13px;margin-top:8px"><span style="color:#7a90b0">Total gastos período</span><span style="font-weight:700">${fmtN(report.totalGastos)}</span></div>`:""}
  </div>
  ${daysHTML?`${sec("Registro Diario","#3aaa6e")}${daysHTML}`:""}
  ${frentesHTML?`${sec("Frentes de Trabajo")}${frentesHTML}`:""}
  ${financieroHTML}${tramitesHTML}
  ${report.resumen?`${sec("Conclusiones")}<div style="background:#fff;border-radius:10px;border:1px solid #dde3ee;padding:16px"><div style="background:#f0f3f8;border-radius:8px;padding:12px;line-height:1.6">${report.resumen}</div></div>`:""}
  ${histHTML?`${sec("Historial","#7a90b0")}<div style="background:#fff;border-radius:10px;border:1px solid #dde3ee;padding:16px">${histHTML}</div>`:""}
  <div style="text-align:center;color:#7a90b0;font-size:11px;margin-top:20px;padding-bottom:16px">SYD Inversiones — Sistema de Gestión de Proyectos · Generado el ${new Date().toLocaleString("es-CO")}</div>
</div>`;
  if(soloContenido) return `<style>${css}</style><div style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;color:#1a2540;font-size:13px">${cuerpo}</div>`;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>${report.project} — ${tipoLabel}</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;color:#1a2540;font-size:13px}${css}@media print{body{background:#fff}}</style>
</head><body>${cuerpo}</body></html>`;
}

export async function enviarADrive(report){
  try{
    const sinFotos = JSON.parse(JSON.stringify(report));
    if(sinFotos.days)    sinFotos.days    = sinFotos.days.map(d=>({...d,photos:[]}));
    if(sinFotos.frentes) sinFotos.frentes = sinFotos.frentes.map(f=>({...f,photos:[]}));

    // Importar primero para que el bundle esté listo antes de tocar el DOM
    const html2pdf = (await import('html2pdf.js')).default;

    // Wrapper en (0,0) con overflow:hidden — visible para html2canvas, invisible al usuario
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;';
    const contenedor = document.createElement('div');
    contenedor.style.cssText = 'width:794px;background:#f4f6f9;';
    contenedor.innerHTML = generarHTMLInforme(sinFotos, true);
    wrapper.appendChild(contenedor);
    document.body.appendChild(wrapper);

    // Espera para que el navegador pinte los estilos antes de que html2canvas capture
    await new Promise(r => setTimeout(r, 300));

    const pdfBlob = await html2pdf()
      .set({
        margin:0,
        image:{type:'jpeg',quality:0.92},
        html2canvas:{scale:2,useCORS:true,logging:false,backgroundColor:'#f4f6f9'},
        jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
      })
      .from(contenedor)
      .outputPdf('blob');

    document.body.removeChild(wrapper);

    const pdfBase64 = await new Promise((res,rej)=>{
      const reader = new FileReader();
      reader.onload = ()=>res(reader.result.split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(pdfBlob);
    });

    const proy = (report.project||'').replace(/[\s/]/g,'_');
    const aut  = (report.author||'').replace(/\s/g,'_');
    // Informe semanal de Coordinador: nombre fijo por semana para que la edición reemplace el archivo en Drive
    const fileName = (report.role==="Coordinador"&&report.semana)
      ? `Informe_Semanal_${proy}_${report.semana}_${aut}.pdf`
      : `Informe_${proy}_${report.type}_${report.date}_${aut}.pdf`;
    const isEdit = report.estado==="enviado" && (report.history||[]).some(h=>h.accion==="Editado");

    await fetch(GAS_URL, {
      method:'POST',
      mode:'no-cors',
      headers:{'Content-Type':'text/plain'},
      body: JSON.stringify({pdfBase64, fileName, project:report.project, type:report.type, isEdit})
    });
    return true;
  }catch(e){
    console.error("Error enviando a Drive:", e);
    return false;
  }
}

export function verImprimirInforme(report){
  const html = generarHTMLInforme(report);
  const w = window.open("","_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(()=>w.print(), 800);
}
