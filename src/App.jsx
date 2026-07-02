import { useState, useRef, useEffect } from "react";
import { supabase } from "./supabase.js";

// ── PALETA ────────────────────────────────────────────────────────────────────
const C = {
  blue:    "#1b3a6b",
  yellow:  "#f5c400",
  green:   "#3aaa6e",
  blueMid: "#2d5fa6",
  bg:      "#f4f6f9",
  bgCard:  "#ffffff",
  bgCard2: "#f0f3f8",
  border:  "#dde3ee",
  text:    "#1a2540",
  muted:   "#7a90b0",
  danger:  "#e05252",
  warn:    "#f5a623",
};

const INP = {background:C.bgCard2,border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:"8px 10px",width:"100%",fontSize:13,boxSizing:"border-box"};
const BTN_SM = {background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12};
const SEM_COLOR = {verde:C.green,amarillo:C.warn,rojo:C.danger};
const SEM_LABEL = {verde:"✅ En control",amarillo:"⚠️ Alerta",rojo:"🔴 Crítico"};


// ── LOGO ──────────────────────────────────────────────────────────────────────
function SydLogo({size=44}){
  const vw = 300, vh = 64;
  const scale = size / vh;
  const w = vw * scale, h = vh * scale;
  const cx = 32, cy = 32, r = 26, sw = 7;
  function arc(cx,cy,r,startDeg,endDeg){
    const s = startDeg*Math.PI/180, e = endDeg*Math.PI/180;
    const x1=cx+r*Math.cos(s), y1=cy+r*Math.sin(s);
    const x2=cx+r*Math.cos(e), y2=cy+r*Math.sin(e);
    const large = (endDeg-startDeg+360)%360 > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${vw} ${vh}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d={arc(cx,cy,r,210,330)} stroke="#2445a0" strokeWidth={sw} strokeLinecap="round" fill="none"/>
      <path d={arc(cx,cy,r,330,90)}  stroke="#f5c400" strokeWidth={sw} strokeLinecap="round" fill="none"/>
      <path d={arc(cx,cy,r,90,210)}  stroke="#4bb86a" strokeWidth={sw} strokeLinecap="round" fill="none"/>
      <text x="72" y="38" fontFamily="'Arial Black','Helvetica Neue',Arial,sans-serif" fontWeight="900" fontSize="30" fill="#2d3142" letterSpacing="-0.5">SYD</text>
      <text x="72" y="58" fontFamily="'Arial Black','Helvetica Neue',Arial,sans-serif" fontWeight="700" fontSize="18" fill="#2d3142" letterSpacing="1.5">INVERSIONES</text>
    </svg>
  );
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const PROJECTS = ["Citrino","Vivante Parque Residencial","Aqqua Club","Aqqua 4","Atalí Conjunto Campestre","Brisas del Lago 1","Brisas del Lago 2","Brisas de Baranoa","Parque Residencial Nona Happy"];
const TEAM = {
  "Citrino":["Ósmar Álvarez","Ivan Pérez"],
  "Vivante Parque Residencial":["Felipe Zuluaga"],
  "Aqqua Club":["Rafael Espinosa","Ivan Pérez"],
  "Aqqua 4":["Rafael Espinosa","Ivan Pérez","Oscar Solano"],
  "Atalí Conjunto Campestre":["Mary Sierra"],
  "Brisas del Lago 1":["Jorge Cañate","Camilo","Jorge Torres"],
  "Brisas del Lago 2":["Jorge Cañate","Camilo","Jorge Torres"],
  "Brisas de Baranoa":["Germán Mercado"],
  "Parque Residencial Nona Happy":["Carmelo","Rafael Espinosa","Ivan Pérez"],
};
const MACHINES = ["Minicargador","Guadaña","Tractor","Retroexcavadora","Cargador","Pajarita","Motobomba","Motoniveladora","Marmara","Motocarro","Volqueta Sencilla","Volqueta Doble Troque","Grúa","Bulldozer","Motosierra","Planta Eléctrica"];
const CLIMA_OPTS = ["Soleado","Nublado","Lluvia","Parcialmente Nublado"];
const ACTIVIDADES_CATALOGO = ["Limpieza de vías","Limpieza zona puente","Limpieza general","Movimiento de tierra","Conformación de subrasante","Excavación mecánica","Relleno y compactación","Corte y nivelación","Reemplazo de material","Adecuación zona puente","Compactación de vía principal","Recepción de zahorra","Construcción de bordillos","Estabilización química","Riego y corte de terreno","Transporte de material interno","Otro"];
const UNIDADES = ["m³","m²","ml","horas","viajes","días","und","Otro"];
const OPERADORES_OPTS = ["1 Operador","2 Operadores","3 Operadores","4 Operadores","5 Operadores","Otro"];
const ETAPAS = ["Etapa 1","Etapa 2","Etapa 3","Etapa 4","General"];
const ROLES = ["Coordinador","Ingeniero","Directivo"];
const ESTADO_OPTS = ["Aprobado","Pendiente","Rechazado"];
const ITEMS_FIN = ["Sistema Vial","Estructuras Hidráulicas","Red de Distribución de Agua","Red Eléctrica","Zonas Sociales"];
const TRAMITES = ["Ocupación de Cauce","RCD","Prospección y Exploración de Aguas Subterráneas","Concesión de Aguas Subterráneas"];

const FRENTES_MASTER = [
  "Sistema Vial","Vías Externas","Movimiento de Tierras / Relleno y Corte","Limpieza y Descapote / Mantenimiento",
  "Redes de Agua","Red Eléctrica / Acometidas","Red de Gas Natural","Estructuras Hidráulicas / Bordillos",
  "Drenaje de Aguas Fluviales","Puente / Box Culvert","Portería / Garita","Zonas Sociales","Casa Modelo",
  "Casa Amatista","Entrega de Lotes","Estabilización Química","Levantamiento Topográfico","Estudios Ambientales",
  "Estudio Hidrológico y Diseño Hidráulico","Diseño Arquitectónico","Diseño Eléctrico","Diseño de Vías","Pre-lanzamiento","Otro"
];

const FRENTES_POR_PROYECTO = {
  "Citrino": [
    "Sistema Vial","Movimiento de Tierras / Relleno y Corte","Limpieza y Descapote / Mantenimiento",
    "Red Eléctrica / Acometidas","Estructuras Hidráulicas / Bordillos","Drenaje de Aguas Fluviales",
    "Zonas Sociales","Portería / Garita","Entrega de Lotes","Levantamiento Topográfico","Estudios Ambientales",
    "Estudio Hidrológico y Diseño Hidráulico","Diseño Arquitectónico","Diseño Eléctrico","Diseño de Vías","Pre-lanzamiento"
  ],
  "Vivante Parque Residencial": [
    "Sistema Vial","Vías Externas","Limpieza y Descapote / Mantenimiento",
    "Redes de Agua","Red Eléctrica / Acometidas","Red de Gas Natural",
    "Estructuras Hidráulicas / Bordillos","Portería / Garita","Zonas Sociales",
    "Casa Modelo","Casa Amatista","Entrega de Lotes","Estudios Ambientales"
  ],
  "Aqqua Club": [
    "Sistema Vial","Movimiento de Tierras / Relleno y Corte","Limpieza y Descapote / Mantenimiento",
    "Redes de Agua","Red Eléctrica / Acometidas","Estructuras Hidráulicas / Bordillos",
    "Drenaje de Aguas Fluviales","Puente / Box Culvert","Portería / Garita","Zonas Sociales","Entrega de Lotes",
    "Levantamiento Topográfico","Estudios Ambientales","Estudio Hidrológico y Diseño Hidráulico",
    "Diseño Arquitectónico","Diseño Eléctrico","Diseño de Vías"
  ],
  "Atalí Conjunto Campestre": [
    "Sistema Vial","Movimiento de Tierras / Relleno y Corte","Limpieza y Descapote / Mantenimiento",
    "Redes de Agua","Red Eléctrica / Acometidas","Estructuras Hidráulicas / Bordillos",
    "Zonas Sociales","Portería / Garita","Entrega de Lotes","Levantamiento Topográfico"
  ],
  "Brisas del Lago 1": [
    "Sistema Vial","Limpieza y Descapote / Mantenimiento","Estructuras Hidráulicas / Bordillos",
    "Zonas Sociales","Entrega de Lotes","Estabilización Química","Levantamiento Topográfico"
  ],
  "Brisas del Lago 2": [
    "Sistema Vial","Limpieza y Descapote / Mantenimiento","Estructuras Hidráulicas / Bordillos",
    "Zonas Sociales","Entrega de Lotes","Estabilización Química","Levantamiento Topográfico"
  ],
  "Brisas de Baranoa": [
    "Sistema Vial","Movimiento de Tierras / Relleno y Corte","Limpieza y Descapote / Mantenimiento",
    "Redes de Agua","Red Eléctrica / Acometidas","Estructuras Hidráulicas / Bordillos","Entrega de Lotes",
    "Levantamiento Topográfico"
  ],
  "Aqqua 4": [
    "Sistema Vial","Movimiento de Tierras / Relleno y Corte","Limpieza y Descapote / Mantenimiento",
    "Redes de Agua","Red Eléctrica / Acometidas","Estructuras Hidráulicas / Bordillos",
    "Drenaje de Aguas Fluviales","Puente / Box Culvert","Portería / Garita","Zonas Sociales","Entrega de Lotes",
    "Levantamiento Topográfico","Estudios Ambientales","Estudio Hidrológico y Diseño Hidráulico",
    "Diseño Arquitectónico","Diseño Eléctrico","Diseño de Vías"
  ],
  "Parque Residencial Nona Happy": [
    "Sistema Vial","Vías Externas","Limpieza y Descapote / Mantenimiento",
    "Redes de Agua","Red Eléctrica / Acometidas","Red de Gas Natural",
    "Estructuras Hidráulicas / Bordillos","Portería / Garita","Zonas Sociales",
    "Casa Modelo","Entrega de Lotes","Estudios Ambientales"
  ],
};

const fmt = n => n ? new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(+n) : "-";

function semaforo(avObra,avRec,actP,actE,presup,ejec){
  let f=[];
  if(presup&&ejec){const r=ejec/presup;f.push(r>1.05?"rojo":r>0.95?"verde":"amarillo");}
  if(actP&&actE!==undefined){const c=actE/actP;f.push(c>=0.9?"verde":c>=0.7?"amarillo":"rojo");}
  const ef=(avObra||0)-(avRec||0);
  if(ef>5)f.push("verde");else if(ef<-5)f.push("rojo");
  if(f.includes("rojo"))return"rojo";if(f.includes("amarillo"))return"amarillo";return"verde";
}

function Bar({value,color}){
  return <div style={{background:C.border,borderRadius:6,height:8,width:"100%",overflow:"hidden"}}>
    <div style={{width:`${Math.min(value||0,100)}%`,background:color||C.yellow,height:"100%",borderRadius:6,transition:"width .5s"}}/>
  </div>;
}
function Badge({status}){
  return <span style={{background:SEM_COLOR[status]+"18",color:SEM_COLOR[status],fontWeight:700,borderRadius:20,padding:"3px 12px",fontSize:11,border:`1px solid ${SEM_COLOR[status]}55`}}>{SEM_LABEL[status]}</span>;
}
function SectionTitle({children,color}){
  return <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
    <div style={{width:3,height:16,background:color||C.blue,borderRadius:2}}/>
    <span style={{color:color||C.blue,fontWeight:700,fontSize:12,letterSpacing:1,textTransform:"uppercase"}}>{children}</span>
  </div>;
}
function Card({children,style={},borderColor}){
  return <div style={{background:C.bgCard,borderRadius:12,padding:16,border:`1px solid ${borderColor||C.border}`,boxShadow:"0 1px 4px #0001",...style}}>{children}</div>;
}


// ── GOOGLE APPS SCRIPT URL ────────────────────────────────────────────────────
const GAS_URL = "https://script.google.com/macros/s/AKfycbw1y7NpivZ5fRbbMtXapUq8msY63OM8knVsxsIF1_8fm_307mcqFDQt-jYwGmPYopfN/exec";

// ── GENERADOR HTML PARA DRIVE ─────────────────────────────────────────────────
function generarHTMLInforme(report, soloContenido=false){
  const logoSVG=`<svg width="220" height="47" viewBox="0 0 300 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M 9.48 19.00 A 26 26 0 0 1 54.52 19.00" stroke="#2445a0" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M 54.52 19.00 A 26 26 0 0 1 32.00 58.00" stroke="#f5c400" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M 32.00 58.00 A 26 26 0 0 1 9.48 19.00" stroke="#4bb86a" stroke-width="7" stroke-linecap="round" fill="none"/><text x="72" y="38" font-family="Arial Black,Helvetica Neue,Arial,sans-serif" font-weight="900" font-size="30" fill="#ffffff" letter-spacing="-0.5">SYD</text><text x="72" y="58" font-family="Arial Black,Helvetica Neue,Arial,sans-serif" font-weight="700" font-size="18" fill="#ffffff" letter-spacing="1.5">INVERSIONES</text></svg>`;
  const tipoLabel={semanal:"Informe Semanal",mensual:"Informe Mensual",trimestral:"Informe Trimestral"}[report.type]||report.type;
  const fmtN=n=>n?new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(+n):"-";
  const estC={Aprobado:"#3aaa6e",Pendiente:"#f5a623",Rechazado:"#e05252"};
  const avO=report.avanceObra||0, avR=report.avanceRecursos||0;
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
  const finRows=(report.financiero||[]).filter(f=>f.presupuesto).map(f=>`<tr><td style="font-weight:600;color:#1b3a6b;font-size:11px">${f.item}</td>${["presupuesto","ejec2124","ejec2526","totalEjec"].map(k=>`<td style="text-align:right">${fmtN(f[k])}</td>`).join("")}<td style="text-align:center;color:${+f.pct>=90?"#3aaa6e":+f.pct>=60?"#f5a623":"#e05252"};font-weight:700">${f.pct||"-"}%</td><td style="text-align:right">${fmtN(f.porEjecutar)}</td></tr>`).join("");
  const financieroHTML=finRows?`${sec("Resumen Financiero Global")}<div style="background:#fff;border-radius:10px;border:1px solid #dde3ee;padding:14px;overflow-x:auto">${tableWrap(["Ítem","Presupuestado","Ejec. 21-24","Ejec. 25-26","Total Ejec.","% Ejec.","Por Ejecutar"],finRows)}</div>`:"";

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

async function enviarADrive(report){
  try{
    const sinFotos = JSON.parse(JSON.stringify(report));
    if(sinFotos.days)    sinFotos.days    = sinFotos.days.map(d=>({...d,photos:[]}));
    if(sinFotos.frentes) sinFotos.frentes = sinFotos.frentes.map(f=>({...f,photos:[]}));

    // Contenedor oculto para renderizar el HTML antes de convertir a PDF
    const contenedor = document.createElement('div');
    contenedor.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#f4f6f9';
    contenedor.innerHTML = generarHTMLInforme(sinFotos, true);
    document.body.appendChild(contenedor);

    const html2pdf = (await import('html2pdf.js')).default;
    const pdfBlob = await html2pdf()
      .set({
        margin:0,
        image:{type:'jpeg',quality:0.92},
        html2canvas:{scale:2,useCORS:true,logging:false,backgroundColor:'#f4f6f9'},
        jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
      })
      .from(contenedor)
      .outputPdf('blob');

    document.body.removeChild(contenedor);

    const pdfBase64 = await new Promise((res,rej)=>{
      const reader = new FileReader();
      reader.onload = ()=>res(reader.result.split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(pdfBlob);
    });

    const proy = (report.project||'').replace(/[\s/]/g,'_');
    const aut  = (report.author||'').replace(/\s/g,'_');
    const fileName = `Informe_${proy}_${report.type}_${report.date}_${aut}.pdf`;

    await fetch(GAS_URL, {
      method:'POST',
      mode:'no-cors',
      headers:{'Content-Type':'text/plain'},
      body: JSON.stringify({pdfBase64, fileName, project:report.project, type:report.type})
    });
    return true;
  }catch(e){
    console.error("Error enviando a Drive:", e);
    return false;
  }
}
function exportarJSON(reports){
  const fecha = new Date().toISOString().slice(0,10);
  const data = {
    exportado: new Date().toISOString(),
    totalInformes: reports.length,
    informes: reports
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SYD_Informes_${fecha}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
function ConfirmModal({title, message, onConfirm, onCancel}){
  return (
    <div style={{position:"fixed",inset:0,background:"#0008",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:20}}>
      <div style={{background:C.bgCard,borderRadius:16,padding:24,maxWidth:380,width:"100%",boxShadow:"0 10px 40px #0003"}}>
        <h3 style={{color:C.danger,margin:"0 0 8px"}}>{title}</h3>
        <p style={{color:C.text,fontSize:14,marginBottom:20}}>{message}</p>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{...BTN_SM,flex:1,padding:10}}>Cancelar</button>
          <button onClick={onConfirm} style={{background:C.danger,color:"#fff",border:"none",borderRadius:8,padding:10,flex:1,cursor:"pointer",fontWeight:600}}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}


// ── DESTINATARIOS MODAL ───────────────────────────────────────────────────────
function DestinatariosManager({project, destinatarios, onSave, onClose}){
  const [emails,setEmails]=useState(destinatarios[project]||[]);
  const [nuevo,setNuevo]=useState("");
  const add=()=>{
    const v=nuevo.trim();
    if(v && v.includes("@") && !emails.includes(v)){ setEmails([...emails,v]); setNuevo(""); }
  };
  const remove=(e)=>setEmails(emails.filter(x=>x!==e));
  const save=()=>{ onSave(project,emails); onClose(); };
  return (
    <div style={{position:"fixed",inset:0,background:"#0008",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
      <div style={{background:C.bgCard,borderRadius:16,padding:24,maxWidth:420,width:"100%",boxShadow:"0 10px 40px #0003"}}>
        <h3 style={{color:C.blue,margin:"0 0 4px"}}>📧 Destinatarios</h3>
        <div style={{color:C.muted,fontSize:13,marginBottom:16}}>Para: <b style={{color:C.blue}}>{project}</b></div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <input style={INP} placeholder="correo@ejemplo.com" value={nuevo}
            onChange={e=>setNuevo(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&add()}/>
          <button onClick={add} style={{background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:"0 16px",cursor:"pointer",fontWeight:600}}>+</button>
        </div>
        <div style={{maxHeight:200,overflowY:"auto",marginBottom:16}}>
          {emails.length===0&&<div style={{color:C.muted,fontSize:13,textAlign:"center",padding:12}}>Sin destinatarios aún</div>}
          {emails.map(e=>(
            <div key={e} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.bgCard2,borderRadius:8,padding:"8px 12px",marginBottom:6}}>
              <span style={{color:C.text,fontSize:13}}>{e}</span>
              <button onClick={()=>remove(e)} style={{background:"none",border:"none",color:C.danger,cursor:"pointer",fontSize:14}}>✕</button>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{...BTN_SM,flex:1,padding:10}}>Cancelar</button>
          <button onClick={save} style={{background:C.green,color:"#fff",border:"none",borderRadius:8,padding:10,flex:1,cursor:"pointer",fontWeight:600}}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ── STORAGE HELPERS (Supabase) ────────────────────────────────────────────────
async function loadReports(){
  const { data, error } = await supabase
    .from('reports')
    .select('data')
    .order('id', { ascending: true });
  if(error){ console.error('Error cargando informes:', error); return []; }
  return (data || []).map(row => row.data);
}
async function saveReport(report, isEdit = false){
  const { error } = isEdit
    ? await supabase.from('reports').update({ data: report }).eq('id', report.id)
    : await supabase.from('reports').insert({ id: report.id, data: report });
  if(error){ console.error('Error guardando informe:', error); return false; }
  return true;
}
async function deleteReport(id){
  const { error } = await supabase.from('reports').delete().eq('id', id);
  if(error){ console.error('Error eliminando informe:', error); return false; }
  return true;
}
async function loadDestinatarios(){
  const { data, error } = await supabase.from('destinatarios').select('project, emails');
  if(error){ console.error('Error cargando destinatarios:', error); return {}; }
  return Object.fromEntries((data || []).map(row => [row.project, row.emails]));
}
async function saveDestinatarios(project, emails){
  const { error } = await supabase
    .from('destinatarios')
    .upsert({ project, emails }, { onConflict: 'project' });
  if(error){ console.error('Error guardando destinatarios:', error); return false; }
  return true;
}
async function loadUsuarios(){
  const { data, error } = await supabase.from('usuarios').select('*').order('nombre');
  if(error){ console.error('Error cargando usuarios:', error); return []; }
  return data || [];
}
async function saveUsuario(usuario){
  const { error } = await supabase.from('usuarios').insert(usuario);
  if(error){ console.error('Error guardando usuario:', error); return false; }
  return true;
}
async function updateUsuario(id, changes){
  const { error } = await supabase.from('usuarios').update(changes).eq('id', id);
  if(error){ console.error('Error actualizando usuario:', error); return false; }
  return true;
}

// ── EMPTY HELPERS ─────────────────────────────────────────────────────────────
const emptyAct = () => ({id:Date.now()+Math.random(),actividad:"",actividadOtro:"",equipo:"",equipoOtro:"",personal:"",personalOtro:"",cantidad:"",unidad:"m³",unidadOtro:"",etapa:"Etapa 1",observaciones:""});
const emptyDay=()=>({id:Date.now()+Math.random(),date:"",climaPrincipal:"Soleado",inicioJornada:"7:30",finJornada:"16:30",activities:[emptyAct()],novelties:"",photos:[]});
const emptyGasto=()=>({id:Date.now()+Math.random(),proveedor:"",estado:"Aprobado",descripcion:"",valor:"",centroCosto:""});
const emptyFrente=(nombre)=>({id:Date.now()+Math.random(),nombre:nombre||"Otro",descripcion:"",gastos:[emptyGasto()],photos:[],lotesData:null});
const emptyFinanciero=()=>ITEMS_FIN.map(item=>({item,presupuesto:"",ejec2124:"",ejec2526:"",totalEjec:"",pct:"",porEjecutar:""}));
const emptyTramite=()=>TRAMITES.map(t=>({tramite:t,pct:""}));

function PhotoUpload({photos,onAdd,onRemove}){
  const ref=useRef();
  const handle=e=>{
    const arr=Array.from(e.target.files).slice(0,6-photos.length);
    Promise.all(arr.map(f=>new Promise(res=>{const r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(f);}))).then(urls=>onAdd(urls));
    e.target.value="";
  };
  return <div>
    <input ref={ref} type="file" accept="image/*" multiple style={{display:"none"}} onChange={handle}/>
    {photos.length<6&&<button style={{...BTN_SM,color:C.blueMid,borderColor:C.blueMid,marginBottom:8}} onClick={()=>ref.current?.click()}>📷 Agregar fotos</button>}
    {photos.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
      {photos.map((p,pi)=><div key={pi} style={{position:"relative"}}>
        <img src={p} alt="" style={{width:"100%",height:90,objectFit:"cover",borderRadius:8,border:`1px solid ${C.border}`}}/>
        <button onClick={()=>onRemove(pi)} style={{position:"absolute",top:3,right:3,background:"#000b",border:"none",color:"#fff",borderRadius:"50%",width:20,height:20,cursor:"pointer",fontSize:11}}>✕</button>
      </div>)}
    </div>}
  </div>;
}

// ── ACTIVITY ROW (shared) ─────────────────────────────────────────────────────
function ActivityRow({act, onChange, onRemove}){
  const cols = "1.5fr 1.1fr 1.1fr 0.8fr 0.6fr 0.9fr 1.4fr auto";
  const showOtro = act.actividad==="Otro"||act.equipo==="Otro"||act.personal==="Otro"||act.unidad==="Otro";
  return (
    <div style={{marginBottom:8}}>
      <div style={{display:"grid",gridTemplateColumns:cols,gap:6,alignItems:"center"}}>
        <select style={INP} value={act.actividad} onChange={e=>onChange("actividad",e.target.value)}>
          <option value="">Selecciona actividad...</option>
          {ACTIVIDADES_CATALOGO.map(a=><option key={a} value={a}>{a}</option>)}
        </select>
        <select style={INP} value={act.equipo} onChange={e=>onChange("equipo",e.target.value)}>
          <option value="">Selecciona equipo...</option>
          {MACHINES.map(m=><option key={m} value={m}>{m}</option>)}
          <option value="Otro">Otro (escribir)...</option>
        </select>
        <select style={INP} value={act.personal} onChange={e=>onChange("personal",e.target.value)}>
          <option value="">Operadores</option>
          {OPERADORES_OPTS.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
        <input style={INP} placeholder="0" value={act.cantidad} onChange={e=>onChange("cantidad",e.target.value)}/>
        <select style={INP} value={act.unidad} onChange={e=>onChange("unidad",e.target.value)}>
          {UNIDADES.map(u=><option key={u} value={u}>{u}</option>)}
        </select>
        <select style={INP} value={act.etapa} onChange={e=>onChange("etapa",e.target.value)}>
          {ETAPAS.map(et=><option key={et}>{et}</option>)}
        </select>
        <input style={INP} placeholder="Observaciones..." value={act.observaciones} onChange={e=>onChange("observaciones",e.target.value)}/>
        <button style={{...BTN_SM,padding:"4px 8px"}} onClick={onRemove}>✕</button>
      </div>
      {showOtro&&(
        <div style={{display:"grid",gridTemplateColumns:cols,gap:6,marginTop:4}}>
          {act.actividad==="Otro"?<input style={INP} placeholder="Escribe la actividad..." value={act.actividadOtro} onChange={e=>onChange("actividadOtro",e.target.value)}/>:<div/>}
          {act.equipo==="Otro"?<input style={INP} placeholder="Escribe el equipo..." value={act.equipoOtro} onChange={e=>onChange("equipoOtro",e.target.value)}/>:<div/>}
          {act.personal==="Otro"?<input style={INP} placeholder="Ej: 4 contratistas" value={act.personalOtro} onChange={e=>onChange("personalOtro",e.target.value)}/>:<div/>}
          <div/>
          {act.unidad==="Otro"?<input style={INP} placeholder="Unidad" value={act.unidadOtro} onChange={e=>onChange("unidadOtro",e.target.value)}/>:<div/>}
          <div/><div/><div/>
        </div>
      )}
    </div>
  );
}

// ── COORDINADOR FORM ──────────────────────────────────────────────────────────
function CoordForm({onSubmit, editingReport, onCancelEdit, usuario}){
  const initial = editingReport;
  const [project,setProject]=useState(initial?.project||PROJECTS[0]);
  const author = initial?.author || usuario.nombre;
  const [avObra,setAvObra]=useState(initial?.avanceObra||0);
  const [days,setDays]=useState(initial?.days||[emptyDay()]);
  const [resumen,setResumen]=useState(initial?.resumen||"");
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);

  const chgProj=p=>{setProject(p);};
  const setDay=(i,k,v)=>setDays(ds=>ds.map((d,j)=>j===i?{...d,[k]:v}:d));
  const addDay=()=>setDays(ds=>[...ds,emptyDay()]);
  const rmDay=i=>setDays(ds=>ds.filter((_,j)=>j!==i));
  const setAct=(di,ai,k,v)=>setDays(ds=>ds.map((d,j)=>j!==di?d:{...d,activities:d.activities.map((a,k2)=>k2!==ai?a:{...a,[k]:v})}));
  const addAct=di=>setDays(ds=>ds.map((d,j)=>j!==di?d:{...d,activities:[...d.activities,emptyAct()]}));
  const rmAct=(di,ai)=>setDays(ds=>ds.map((d,j)=>j!==di?d:{...d,activities:d.activities.filter((_,k2)=>k2!==ai)}));
  const addPh=(di,urls)=>setDays(ds=>ds.map((d,j)=>j!==di?d:{...d,photos:[...d.photos,...urls].slice(0,6)}));
  const rmPh=(di,pi)=>setDays(ds=>ds.map((d,j)=>j!==di?d:{...d,photos:d.photos.filter((_,k)=>k!==pi)}));

  const doSubmit=async()=>{
    setSending(true);
    const now=new Date().toISOString();
    const baseReport={
      id: initial?.id || Date.now(),
      type:"semanal",role:"Coordinador",project,author,avanceObra:+avObra,avanceRecursos:0,
      date:days[0]?.date||new Date().toISOString().slice(0,10),days,resumen,
      activities:days.map(d=>d.activities.map(a=>a.actividad==="Otro"?a.actividadOtro:a.actividad).filter(Boolean).join(", ")).join(" | "),
      novelties:days.map(d=>d.novelties).filter(Boolean).join(" | ")||"Sin novedades",
    };
    let history = initial?.history || [{accion:"Creado",por:author,uid:usuario.id,fecha:initial?.createdAt||now}];
    if(editingReport){
      history=[...history,{accion:"Editado",por:usuario.nombre,uid:usuario.id,fecha:now}];
    }
    const report={...baseReport, createdAt: initial?.createdAt||now, history};
    await onSubmit(report, !!editingReport);
    setSending(false);
    setSent(true);
    setTimeout(()=>setSent(false),3000);
  };

  const handleClick=()=>{ doSubmit(); };

  return (
    <div>
      {editingReport&&(
        <div style={{background:C.warn+"18",border:`1px solid ${C.warn}`,borderRadius:10,padding:"10px 14px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:C.warn,fontWeight:600,fontSize:13}}>✏️ Editando informe del {editingReport.date} — {editingReport.project}</span>
          <button onClick={onCancelEdit} style={{...BTN_SM,padding:"4px 10px"}}>Cancelar edición</button>
        </div>
      )}
      <h2 style={{color:C.blue,marginBottom:20,fontWeight:800}}>{editingReport?"Editar Informe":"Informe Semanal"} <span style={{color:C.green,fontWeight:400,fontSize:15}}>Coordinador</span></h2>
      <Card style={{marginBottom:16}}>
        <SectionTitle>Datos del informe</SectionTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <div>
            <label style={{color:C.muted,fontSize:12}}>Proyecto</label>
            <select style={INP} value={project} onChange={e=>chgProj(e.target.value)}>{PROJECTS.map(p=><option key={p}>{p}</option>)}</select>
          </div>
          <div>
            <label style={{color:C.muted,fontSize:12}}>Elaborado por</label>
            <div style={{...INP,background:C.bgCard,color:C.text,display:"flex",alignItems:"center",gap:6,cursor:"default"}}>👤 {author}</div>
          </div>
          <div>
            <label style={{color:C.muted,fontSize:12}}>% Avance de Obra</label>
            <input type="number" min={0} max={100} style={INP} value={avObra} onChange={e=>setAvObra(e.target.value)}/>
          </div>
        </div>
      </Card>

      {days.map((day,di)=>(
        <Card key={day.id} style={{marginBottom:12}} borderColor={C.green+"55"}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:3,height:14,background:C.green,borderRadius:2}}/>
              <span style={{color:C.green,fontWeight:700}}>Día {di+1}</span>
            </div>
            {days.length>1&&<button style={BTN_SM} onClick={()=>rmDay(di)}>✕ Quitar</button>}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:12}}>
            <div>
              <label style={{color:C.muted,fontSize:12}}>Fecha</label>
              <input type="date" style={INP} value={day.date} onChange={e=>setDay(di,"date",e.target.value)}/>
            </div>
            <div>
              <label style={{color:C.muted,fontSize:12}}>Clima</label>
              <select style={INP} value={day.climaPrincipal} onChange={e=>setDay(di,"climaPrincipal",e.target.value)}>{CLIMA_OPTS.map(c=><option key={c}>{c}</option>)}</select>
            </div>
            <div>
              <label style={{color:C.muted,fontSize:12}}>Inicio</label>
              <input type="time" style={INP} value={day.inicioJornada} onChange={e=>setDay(di,"inicioJornada",e.target.value)}/>
            </div>
            <div>
              <label style={{color:C.muted,fontSize:12}}>Fin</label>
              <input type="time" style={INP} value={day.finJornada} onChange={e=>setDay(di,"finJornada",e.target.value)}/>
            </div>
          </div>

          <div style={{marginBottom:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1.5fr 1.1fr 1.1fr 0.8fr 0.6fr 0.9fr 1.4fr auto",gap:6,marginBottom:4}}>
              {["Actividad","Equipo","Personal","Cant.","Unidad","Etapa","Observaciones",""].map((h,i)=><span key={i} style={{color:C.muted,fontSize:11}}>{h}</span>)}
            </div>
            {day.activities.map((act,ai)=>(
              <ActivityRow key={act.id} act={act} onChange={(k,v)=>setAct(di,ai,k,v)} onRemove={()=>rmAct(di,ai)}/>
            ))}
            <button style={{...BTN_SM,color:C.green,borderColor:C.green}} onClick={()=>addAct(di)}>+ Actividad</button>
          </div>

          <div style={{marginBottom:12}}>
            <label style={{color:C.muted,fontSize:12}}>Novedades del día</label>
            <textarea style={{...INP,minHeight:50}} value={day.novelties} onChange={e=>setDay(di,"novelties",e.target.value)} placeholder="Retrasos, incidentes..."/>
          </div>

          <div>
            <div style={{color:C.muted,fontSize:11,marginBottom:6,letterSpacing:1,textTransform:"uppercase"}}>Registro Fotográfico</div>
            <PhotoUpload photos={day.photos} onAdd={urls=>addPh(di,urls)} onRemove={pi=>rmPh(di,pi)}/>
          </div>
        </Card>
      ))}

      <button style={{...BTN_SM,width:"100%",padding:10,marginBottom:16,color:C.blueMid,borderColor:C.blueMid}} onClick={addDay}>+ Agregar día</button>

      <Card style={{marginBottom:16}}>
        <SectionTitle>Resumen de la semana</SectionTitle>
        <textarea style={{...INP,minHeight:80}} value={resumen} onChange={e=>setResumen(e.target.value)} placeholder="Actividades principales, horas máquina totales, conclusiones..."/>
      </Card>

      {sent&&(
        <div style={{background:C.green+"18",border:`1px solid ${C.green}`,borderRadius:10,padding:14,marginBottom:14,color:C.green,fontWeight:700,textAlign:"center"}}>
          ✅ {editingReport?"Cambios guardados":"Informe enviado"} correctamente
        </div>
      )}
      <button onClick={handleClick} disabled={sending||sent}
        style={{background:sending||sent?C.border:C.green,color:"#fff",fontWeight:700,border:"none",borderRadius:10,padding:13,fontSize:15,cursor:sending||sent?"default":"pointer",width:"100%",boxShadow:sending||sent?"none":`0 3px 12px ${C.green}55`}}>
        {sending?"Guardando...":sent?"✅ Enviado":editingReport?"Guardar Cambios":"Enviar Informe"}
      </button>

    </div>
  );
}

// ── INGENIERO FORM ────────────────────────────────────────────────────────────
function IngForm({onSubmit, editingReport, onCancelEdit, usuario}){
  const initial = editingReport;
  const initFrentes = (proj) => (FRENTES_POR_PROYECTO[proj]||FRENTES_MASTER).map(nombre=>emptyFrente(nombre));

  const [project,setProject]=useState(initial?.project||PROJECTS[0]);
  const author = initial?.author || usuario.nombre;
  const [type,setType]=useState(initial?.type||"mensual");
  const [mes,setMes]=useState(initial?.mes||"");
  const [avObra,setAvObra]=useState(initial?.avanceObra||0);
  const [avRec,setAvRec]=useState(initial?.avanceRecursos||0);
  const [frentes,setFrentes]=useState(()=>initial?.frentes||initFrentes(initial?.project||PROJECTS[0]));
  const [financiero,setFinanciero]=useState(initial?.financiero||emptyFinanciero());
  const [tramites,setTramites]=useState(initial?.tramites||emptyTramite());
  const [resumen,setResumen]=useState(initial?.resumen||"");
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);

  const chgProj=p=>{setProject(p);setFrentes(initFrentes(p));};
  const setFr=(fi,k,v)=>setFrentes(fs=>fs.map((f,j)=>j===fi?{...f,[k]:v}:f));
  const addFr=()=>setFrentes(fs=>[...fs,emptyFrente()]);
  const rmFr=fi=>setFrentes(fs=>fs.filter((_,j)=>j!==fi));
  const setGasto=(fi,gi,k,v)=>setFrentes(fs=>fs.map((f,j)=>j!==fi?f:{...f,gastos:f.gastos.map((g,k2)=>k2!==gi?g:{...g,[k]:v})}));
  const addGasto=fi=>setFrentes(fs=>fs.map((f,j)=>j!==fi?f:{...f,gastos:[...f.gastos,emptyGasto()]}));
  const rmGasto=(fi,gi)=>setFrentes(fs=>fs.map((f,j)=>j!==fi?f:{...f,gastos:f.gastos.filter((_,k2)=>k2!==gi)}));
  const addFrPh=(fi,urls)=>setFrentes(fs=>fs.map((f,j)=>j!==fi?f:{...f,photos:[...f.photos,...urls].slice(0,6)}));
  const rmFrPh=(fi,pi)=>setFrentes(fs=>fs.map((f,j)=>j!==fi?f:{...f,photos:f.photos.filter((_,k)=>k!==pi)}));
  const setFin=(ii,k,v)=>setFinanciero(fs=>fs.map((f,j)=>j!==ii?f:{...f,[k]:v}));
  const setTram=(ti,v)=>setTramites(ts=>ts.map((t,j)=>j!==ti?t:{...t,pct:v}));
  const totalGastos=frentes.reduce((s,f)=>s+f.gastos.reduce((ss,g)=>ss+(+g.valor||0),0),0);
  const estColor={Aprobado:C.green,Pendiente:C.warn,Rechazado:C.danger};

  const doSubmit=async()=>{
    setSending(true);
    const now=new Date().toISOString();
    const baseReport={
      id: initial?.id || Date.now(),
      type,role:"Ingeniero",project,author,mes,avanceObra:+avObra,avanceRecursos:+avRec,
      date:new Date().toISOString().slice(0,10),frentes,financiero,tramites,resumen,totalGastos,
      activities:frentes.map(f=>f.nombre).join(", "),
      novelties:frentes.map(f=>f.descripcion).filter(Boolean).slice(0,1).join(" ")||"Sin novedades",
    };
    let history = initial?.history || [{accion:"Creado",por:author,uid:usuario.id,fecha:initial?.createdAt||now}];
    if(editingReport){
      history=[...history,{accion:"Editado",por:usuario.nombre,uid:usuario.id,fecha:now}];
    }
    const report={...baseReport, createdAt: initial?.createdAt||now, history};
    await onSubmit(report, !!editingReport);
    setSending(false);
    setSent(true);
    setTimeout(()=>setSent(false),3000);
  };

  const handleClick=()=>{ doSubmit(); };

  return (
    <div>
      {editingReport&&(
        <div style={{background:C.warn+"18",border:`1px solid ${C.warn}`,borderRadius:10,padding:"10px 14px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:C.warn,fontWeight:600,fontSize:13}}>✏️ Editando informe — {editingReport.project} ({editingReport.mes||editingReport.date})</span>
          <button onClick={onCancelEdit} style={{...BTN_SM,padding:"4px 10px"}}>Cancelar edición</button>
        </div>
      )}
      <h2 style={{color:C.blue,marginBottom:20,fontWeight:800}}>{editingReport?"Editar Informe":"Informe Técnico"} <span style={{color:C.blueMid,fontWeight:400,fontSize:15}}>Ingeniero</span></h2>

      <Card style={{marginBottom:16}}>
        <SectionTitle>Datos del informe</SectionTitle>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
          <div>
            <label style={{color:C.muted,fontSize:12}}>Proyecto</label>
            <select style={INP} value={project} onChange={e=>chgProj(e.target.value)}>{PROJECTS.map(p=><option key={p}>{p}</option>)}</select>
          </div>
          <div>
            <label style={{color:C.muted,fontSize:12}}>Elaborado por</label>
            <div style={{...INP,background:C.bgCard,color:C.text,display:"flex",alignItems:"center",gap:6,cursor:"default"}}>👤 {author}</div>
          </div>
          <div>
            <label style={{color:C.muted,fontSize:12}}>Tipo</label>
            <select style={INP} value={type} onChange={e=>setType(e.target.value)}>
              <option value="mensual">Mensual</option><option value="trimestral">Trimestral</option><option value="semanal">Semanal</option>
            </select>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <div>
            <label style={{color:C.muted,fontSize:12}}>Mes / Período</label>
            <input style={INP} value={mes} onChange={e=>setMes(e.target.value)} placeholder="Ej: Mayo 2026"/>
          </div>
          <div>
            <label style={{color:C.muted,fontSize:12}}>% Avance de Obra</label>
            <input type="number" min={0} max={100} style={INP} value={avObra} onChange={e=>setAvObra(e.target.value)}/>
          </div>
          <div>
            <label style={{color:C.muted,fontSize:12}}>% Recursos Ejecutados</label>
            <input type="number" min={0} max={100} style={INP} value={avRec} onChange={e=>setAvRec(e.target.value)}/>
          </div>
        </div>
      </Card>

      <SectionTitle color={C.blue}>Frentes de Trabajo</SectionTitle>
      {frentes.map((fr,fi)=>(
        <Card key={fr.id} style={{marginBottom:12,borderLeft:`4px solid ${C.yellow}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{color:C.blue,fontWeight:700}}>{fi+1}. Frente de Trabajo</span>
            {frentes.length>1&&<button style={BTN_SM} onClick={()=>rmFr(fi)}>✕ Quitar</button>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:12,marginBottom:12}}>
            <div>
              <label style={{color:C.muted,fontSize:12}}>Área / Frente</label>
              <select style={INP} value={fr.nombre} onChange={e=>setFr(fi,"nombre",e.target.value)}>{FRENTES_MASTER.map(f=><option key={f}>{f}</option>)}</select>
            </div>
            <div>
              <label style={{color:C.muted,fontSize:12}}>Descripción de actividades</label>
              <textarea style={{...INP,minHeight:65}} value={fr.descripcion} onChange={e=>setFr(fi,"descripcion",e.target.value)} placeholder="Detalle de lo ejecutado en este frente..."/>
            </div>
          </div>

          {fr.nombre==="Entrega de Lotes"&&(
            <div style={{marginBottom:12}}>
              <div style={{color:C.muted,fontSize:11,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Estado de Lotes</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10}}>
                {[["entregados","✅ Entregados",C.green],["programados","📅 Programados",C.blueMid],["reagendados","🔄 Reagendados",C.warn],["porEntregar","⏳ Por Entregar",C.danger]].map(([k,label,color])=>(
                  <div key={k}>
                    <label style={{color,fontSize:12}}>{label}</label>
                    <input type="number" min={0} style={INP} placeholder="0"
                      value={fr.lotesData?.[k]||""}
                      onChange={e=>setFr(fi,"lotesData",{...fr.lotesData,[k]:+e.target.value})}/>
                  </div>
                ))}
              </div>
              <div style={{marginTop:8,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={{color:C.muted,fontSize:12}}>Total lotes</label>
                  <input type="number" min={0} style={INP} placeholder="0"
                    value={fr.lotesData?.total||""}
                    onChange={e=>setFr(fi,"lotesData",{...fr.lotesData,total:+e.target.value})}/>
                </div>
                <div>
                  <label style={{color:C.muted,fontSize:12}}>Total a recaudar pre-adm. (COP)</label>
                  <input type="number" style={INP} placeholder="$"
                    value={fr.lotesData?.totalRecaudar||""}
                    onChange={e=>setFr(fi,"lotesData",{...fr.lotesData,totalRecaudar:+e.target.value})}/>
                </div>
              </div>
            </div>
          )}

          <div style={{marginBottom:12}}>
            <div style={{color:C.muted,fontSize:11,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Gastos — Detallado</div>
            <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 1.5fr 1fr 1.2fr auto",gap:6,marginBottom:4}}>
              {["Proveedor","Estado","Descripción","Valor Factura","Centro de Costo",""].map((h,i)=><span key={i} style={{color:C.muted,fontSize:11}}>{h}</span>)}
            </div>
            {fr.gastos.map((g,gi)=>(
              <div key={g.id} style={{display:"grid",gridTemplateColumns:"1.2fr 1fr 1.5fr 1fr 1.2fr auto",gap:6,marginBottom:6,alignItems:"center"}}>
                <input style={INP} placeholder="Proveedor" value={g.proveedor} onChange={e=>setGasto(fi,gi,"proveedor",e.target.value)}/>
                <select style={{...INP,color:estColor[g.estado]}} value={g.estado} onChange={e=>setGasto(fi,gi,"estado",e.target.value)}>{ESTADO_OPTS.map(s=><option key={s}>{s}</option>)}</select>
                <input style={INP} placeholder="Descripción" value={g.descripcion} onChange={e=>setGasto(fi,gi,"descripcion",e.target.value)}/>
                <input type="number" style={INP} placeholder="$ Valor" value={g.valor} onChange={e=>setGasto(fi,gi,"valor",e.target.value)}/>
                <input style={INP} placeholder="Centro costo" value={g.centroCosto} onChange={e=>setGasto(fi,gi,"centroCosto",e.target.value)}/>
                <button style={{...BTN_SM,padding:"4px 8px"}} onClick={()=>rmGasto(fi,gi)}>✕</button>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
              <button style={{...BTN_SM,color:C.blueMid,borderColor:C.blueMid}} onClick={()=>addGasto(fi)}>+ Gasto</button>
              <span style={{color:C.blue,fontSize:13,fontWeight:700}}>Total: {fmt(fr.gastos.reduce((s,g)=>s+(+g.valor||0),0))}</span>
            </div>
          </div>

          <div>
            <div style={{color:C.muted,fontSize:11,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>Registro Fotográfico</div>
            <PhotoUpload photos={fr.photos} onAdd={urls=>addFrPh(fi,urls)} onRemove={pi=>rmFrPh(fi,pi)}/>
          </div>
        </Card>
      ))}
      <button style={{...BTN_SM,width:"100%",padding:10,marginBottom:20,color:C.blueMid,borderColor:C.blueMid}} onClick={addFr}>+ Agregar frente de trabajo</button>

      <Card style={{marginBottom:16}}>
        <SectionTitle color={C.blue}>Resumen Financiero Global del Proyecto</SectionTitle>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:C.blue+"12"}}>
              {["Ítem","Presupuestado","Ejec. 2021-2024","Ejec. 2025-2026","Total Ejecutado","% Ejec.","Por Ejecutar"].map(h=>(
                <th key={h} style={{padding:"8px 10px",color:C.blue,textAlign:"left",borderBottom:`2px solid ${C.blue}22`,whiteSpace:"nowrap",fontWeight:700}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{financiero.map((f,ii)=>(
              <tr key={f.item} style={{borderBottom:`1px solid ${C.border}`}}>
                <td style={{padding:"6px 8px",color:C.blue,fontWeight:600,whiteSpace:"nowrap",fontSize:11}}>{f.item}</td>
                {["presupuesto","ejec2124","ejec2526","totalEjec"].map(k=>(
                  <td key={k} style={{padding:"4px 6px"}}><input type="number" style={{...INP,padding:"4px 8px",fontSize:12}} value={f[k]} placeholder="$" onChange={e=>setFin(ii,k,e.target.value)}/></td>
                ))}
                <td style={{padding:"4px 6px"}}><input style={{...INP,padding:"4px 8px",fontSize:12,width:60}} value={f.pct} placeholder="%" onChange={e=>setFin(ii,"pct",e.target.value)}/></td>
                <td style={{padding:"4px 6px"}}><input type="number" style={{...INP,padding:"4px 8px",fontSize:12}} value={f.porEjecutar} placeholder="$" onChange={e=>setFin(ii,"porEjecutar",e.target.value)}/></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div style={{textAlign:"right",marginTop:10,color:C.blue,fontWeight:700}}>Total período: {fmt(totalGastos)}</div>
      </Card>

      <Card style={{marginBottom:16}}>
        <SectionTitle color={C.green}>Trámites Ambientales</SectionTitle>
        {tramites.map((t,ti)=>(
          <div key={t.tramite} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.bgCard2,borderRadius:8,padding:"10px 14px",marginBottom:8,border:`1px solid ${C.border}`}}>
            <span style={{color:C.text,fontSize:13,flex:1}}>{t.tramite}</span>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <input type="number" min={0} max={100} style={{...INP,width:70,padding:"4px 8px"}} value={t.pct} placeholder="%" onChange={e=>setTram(ti,e.target.value)}/>
              {t.pct&&<div style={{width:90}}>
                <Bar value={+t.pct} color={+t.pct>=100?C.green:+t.pct>=50?C.warn:C.danger}/>
                <span style={{color:+t.pct>=100?C.green:+t.pct>=50?C.warn:C.danger,fontSize:11,fontWeight:700}}>{t.pct}%</span>
              </div>}
            </div>
          </div>
        ))}
      </Card>

      <Card style={{marginBottom:16}}>
        <SectionTitle>Conclusiones</SectionTitle>
        <textarea style={{...INP,minHeight:80}} value={resumen} onChange={e=>setResumen(e.target.value)} placeholder="Resumen del período, logros, pendientes..."/>
      </Card>

      {sent&&(
        <div style={{background:C.green+"18",border:`1px solid ${C.green}`,borderRadius:10,padding:14,marginBottom:14,color:C.green,fontWeight:700,textAlign:"center"}}>
          ✅ {editingReport?"Cambios guardados":"Informe enviado"} correctamente
        </div>
      )}
      <button onClick={handleClick} disabled={sending||sent}
        style={{background:sending||sent?C.border:C.blue,color:"#fff",fontWeight:700,border:"none",borderRadius:10,padding:13,fontSize:15,cursor:sending||sent?"default":"pointer",width:"100%",boxShadow:sending||sent?"none":`0 3px 12px ${C.blue}44`}}>
        {sending?"Guardando...":sent?"✅ Enviado":editingReport?"Guardar Cambios":"Enviar Informe"}
      </button>

    </div>
  );
}

// ── DETAIL ────────────────────────────────────────────────────────────────────
function verImprimirInforme(report){
  const html = generarHTMLInforme(report);
  const w = window.open("","_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(()=>w.print(), 800);
}

function ReportDetail({report,onBack}){
  const efic=(report.avanceObra||0)-(report.avanceRecursos||0);
  const st=semaforo(report.avanceObra,report.avanceRecursos,null,null,null,null);
  const estColor={Aprobado:C.green,Pendiente:C.warn,Rechazado:C.danger};
  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:20}}>
        <button onClick={onBack} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:8,padding:"6px 14px",cursor:"pointer"}}>← Volver</button>
        <button onClick={()=>verImprimirInforme(report)} style={{background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:"6px 16px",cursor:"pointer",fontWeight:600,fontSize:13}}>🖨️ Ver / Exportar PDF</button>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <h2 style={{color:C.blue,margin:0}}>{report.project}</h2>
          <div style={{color:C.muted,fontSize:13,marginTop:4}}>{report.author} · {report.date} · {report.type}{report.mes?` — ${report.mes}`:""}</div>
        </div>
        <Badge status={st}/>
      </div>

      <Card style={{marginBottom:12}}>
        <SectionTitle>Indicadores</SectionTitle>
        <div style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.muted,fontSize:13}}>Avance de Obra</span><b style={{color:C.blue}}>{report.avanceObra||0}%</b></div>
          <Bar value={report.avanceObra} color={C.yellow}/>
        </div>
        {report.avanceRecursos>0&&<div style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.muted,fontSize:13}}>Recursos Ejecutados</span><b style={{color:C.blueMid}}>{report.avanceRecursos}%</b></div>
          <Bar value={report.avanceRecursos} color={C.blueMid}/>
        </div>}
        <div style={{background:C.bgCard2,borderRadius:8,padding:10,fontSize:13,border:`1px solid ${C.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{color:C.muted}}>Eficiencia de Costo</span>
            <span style={{color:efic>=0?C.green:C.danger,fontWeight:700}}>{efic>=0?"+":""}{efic}% {efic>0?"👍":efic<0?"⚠️":""}</span>
          </div>
          {report.totalGastos>0&&<div style={{display:"flex",justifyContent:"space-between",marginTop:6}}><span style={{color:C.muted}}>Total gastos período</span><span style={{color:C.text}}>{fmt(report.totalGastos)}</span></div>}
        </div>
      </Card>

      {report.frentes&&report.frentes.map((fr,fi)=>(
        <Card key={fi} style={{marginBottom:10,borderLeft:`4px solid ${C.yellow}`}}>
          <div style={{color:C.blue,fontWeight:700,marginBottom:8}}>{fi+1}. {fr.nombre}</div>
          <div style={{color:C.text,fontSize:13,marginBottom:10}}>{fr.descripcion}</div>
          {fr.nombre==="Entrega de Lotes"&&fr.lotesData&&(
            <div style={{background:C.bgCard2,borderRadius:8,padding:"8px 10px",fontSize:12,border:`1px solid ${C.border}`,marginBottom:10}}>
              <div style={{color:C.blue,fontWeight:700,marginBottom:4}}>📦 Entrega de Lotes</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                <span style={{color:C.green}}>✅ Entregados: {fr.lotesData.entregados||0}</span>
                <span style={{color:C.blueMid}}>📅 Programados: {fr.lotesData.programados||0}</span>
                <span style={{color:C.warn}}>🔄 Reagendados: {fr.lotesData.reagendados||0}</span>
                <span style={{color:C.danger}}>⏳ Por entregar: {fr.lotesData.porEntregar||0}</span>
              </div>
              {fr.lotesData.total&&<div style={{color:C.blue,fontWeight:700,marginTop:4}}>Total: {fr.lotesData.total} lotes</div>}
            </div>
          )}
          {fr.gastos.filter(g=>g.proveedor).length>0&&<div style={{marginBottom:10}}>
            {fr.gastos.filter(g=>g.proveedor).map((g,gi)=>(
              <div key={gi} style={{background:C.bgCard2,borderRadius:6,padding:"6px 10px",marginBottom:4,display:"grid",gridTemplateColumns:"1.2fr 0.8fr 1.5fr 1fr 1.2fr",gap:8,fontSize:12}}>
                <span style={{color:C.text}}>{g.proveedor}</span>
                <span style={{color:estColor[g.estado],fontWeight:700}}>{g.estado}</span>
                <span style={{color:C.muted}}>{g.descripcion}</span>
                <span style={{color:C.yellow}}>{fmt(g.valor)}</span>
                <span style={{color:C.muted,fontSize:11}}>{g.centroCosto}</span>
              </div>
            ))}
            <div style={{textAlign:"right",color:C.yellow,fontSize:13,fontWeight:700,marginTop:4}}>Total: {fmt(fr.gastos.reduce((s,g)=>s+(+g.valor||0),0))}</div>
          </div>}
          {fr.photos?.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
            {fr.photos.slice(0,3).map((p,pi)=><img key={pi} src={p} alt="" style={{width:"100%",height:90,objectFit:"cover",borderRadius:8,border:`1px solid ${C.border}`}}/>)}
          </div>}
        </Card>
      ))}

      {report.days&&report.days.map((day,di)=>(
        <Card key={di} style={{marginBottom:10,borderLeft:`4px solid ${C.green}`}}>
          <div style={{color:C.green,fontWeight:600,marginBottom:8}}>📅 {day.date} — {day.climaPrincipal} · {day.inicioJornada}–{day.finJornada}</div>
          {day.activities?.filter(a=>a.actividad).map((a,ai)=>{
            const actLabel = a.actividad==="Otro"?(a.actividadOtro||"Otro"):a.actividad;
            const equipLabel = a.equipo==="Otro"?(a.equipoOtro||"Otro"):a.equipo;
            const persLabel = a.personal==="Otro"?(a.personalOtro||"Otro"):a.personal;
            const unidLabel = a.unidad==="Otro"?(a.unidadOtro||""):a.unidad;
            return (
              <div key={ai} style={{background:C.bgCard2,borderRadius:6,padding:"6px 10px",marginBottom:4}}>
                <div style={{display:"grid",gridTemplateColumns:"1.8fr 1.3fr 1.1fr 1fr 0.8fr",gap:8,fontSize:12}}>
                  <span style={{color:C.text,fontWeight:600}}>{actLabel}</span><span style={{color:C.muted}}>{equipLabel}</span>
                  <span style={{color:C.muted}}>{persLabel}</span><span style={{color:C.muted}}>{a.cantidad} {unidLabel}</span>
                  <span style={{color:C.blue,fontSize:11,fontWeight:600}}>{a.etapa}</span>
                </div>
                {a.observaciones&&<div style={{color:C.muted,fontSize:11,marginTop:4,fontStyle:"italic"}}>📝 {a.observaciones}</div>}
              </div>
            );
          })}
          {day.novelties&&<div style={{color:C.warn,fontSize:12,marginTop:6}}>⚠️ {day.novelties}</div>}
          {day.photos?.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginTop:8}}>
            {day.photos.slice(0,3).map((p,pi)=><img key={pi} src={p} alt="" style={{width:"100%",height:85,objectFit:"cover",borderRadius:8,border:`1px solid ${C.border}`}}/>)}
          </div>}
        </Card>
      ))}

      {report.financiero&&report.financiero.some(f=>f.presupuesto)&&(
        <Card style={{marginBottom:10,overflowX:"auto"}}>
          <SectionTitle>Resumen Financiero Global</SectionTitle>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:C.blue+"10"}}>
              {["Ítem","Presup.","Ejec. 21-24","Ejec. 25-26","Total Ejec.","% Ejec.","Por Ejecutar"].map(h=>(
                <th key={h} style={{padding:"6px 8px",color:C.blue,textAlign:"left",borderBottom:`2px solid ${C.blue}22`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{report.financiero.map((f,i)=>(
              <tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
                <td style={{padding:"5px 8px",color:C.blue,fontSize:11}}>{f.item}</td>
                {["presupuesto","ejec2124","ejec2526","totalEjec"].map(k=>(
                  <td key={k} style={{padding:"5px 8px",color:C.text}}>{fmt(f[k])}</td>
                ))}
                <td style={{padding:"5px 8px",color:+f.pct>=90?C.green:+f.pct>=60?C.warn:C.danger,fontWeight:700}}>{f.pct||"-"}%</td>
                <td style={{padding:"5px 8px",color:C.text}}>{fmt(f.porEjecutar)}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}

      {report.tramites&&report.tramites.some(t=>t.pct)&&(
        <Card style={{marginBottom:10}}>
          <SectionTitle color={C.green}>Trámites Ambientales</SectionTitle>
          {report.tramites.map((t,ti)=>(
            <div key={ti} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <span style={{color:C.text,fontSize:13,flex:1}}>{t.tramite}</span>
              <div style={{width:120}}>
                <Bar value={+t.pct} color={+t.pct>=100?C.green:+t.pct>=50?C.warn:C.danger}/>
                <span style={{color:+t.pct>=100?C.green:+t.pct>=50?C.warn:C.danger,fontSize:12,fontWeight:700}}>{t.pct}%</span>
              </div>
            </div>
          ))}
        </Card>
      )}

      {report.resumen&&<Card>
        <SectionTitle>Conclusiones</SectionTitle>
        <div style={{color:C.text,fontSize:13}}>{report.resumen}</div>
      </Card>}

      {report.history&&report.history.length>0&&(
        <Card style={{marginTop:10,background:C.bgCard2}}>
          <SectionTitle color={C.muted}>Historial del Informe</SectionTitle>
          {report.history.map((h,hi)=>(
            <div key={hi} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0",borderBottom:hi<report.history.length-1?`1px solid ${C.border}`:"none"}}>
              <span style={{color:h.accion==="Creado"?C.green:C.warn,fontWeight:600}}>{h.accion==="Creado"?"🆕":"✏️"} {h.accion} por {h.por}{h.uid&&<span title="Identidad verificada por login" style={{marginLeft:4,fontSize:10}}>🔒</span>}</span>
              <span style={{color:C.muted}}>{new Date(h.fecha).toLocaleString("es-CO")}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── LIST ──────────────────────────────────────────────────────────────────────
function ReportList({reports,onSelect,onEdit,onDelete}){
  const TC={semanal:C.green,mensual:C.blueMid,trimestral:C.yellow};
  return (
    <div>
      {!reports.length&&<Card><div style={{color:C.muted,textAlign:"center",padding:16}}>No hay informes registrados aún.</div></Card>}
      {[...reports].reverse().map(r=>(
        <div key={r.id} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderLeft:`4px solid ${TC[r.type]||C.muted}`,borderRadius:12,padding:14,marginBottom:10,boxShadow:"0 1px 4px #0001"}}>
          <div onClick={()=>onSelect(r)} style={{cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:C.blue,fontWeight:700}}>{r.project}</span>
              <span style={{background:(TC[r.type]||C.muted)+"18",color:TC[r.type]||C.muted,borderRadius:20,padding:"2px 12px",fontSize:11,fontWeight:700,textTransform:"capitalize",border:`1px solid ${(TC[r.type]||C.muted)}44`}}>{r.type}</span>
            </div>
            <div style={{color:C.muted,fontSize:13,marginTop:4}}>{r.author}{r.mes?` — ${r.mes}`:""} · {r.date}</div>
            <div style={{color:C.muted,fontSize:12,marginTop:4}}>{r.activities?.slice(0,80)}</div>
            {r.totalGastos>0&&<div style={{color:C.green,fontSize:12,marginTop:4,fontWeight:600}}>💰 {fmt(r.totalGastos)}</div>}
            {r.history&&r.history.length>1&&<div style={{color:C.warn,fontSize:11,marginTop:4}}>✏️ Editado {r.history.length-1} {r.history.length-1===1?"vez":"veces"}</div>}
          </div>
          <div style={{display:"flex",gap:8,marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
            <button onClick={()=>verImprimirInforme(r)} style={{...BTN_SM,color:C.blue,borderColor:C.blue,flex:1}}>🖨️ Ver / PDF</button>
            <button onClick={()=>onEdit(r)} style={{...BTN_SM,color:C.blueMid,borderColor:C.blueMid,flex:1}}>✏️ Editar</button>
            <button onClick={()=>onDelete(r)} style={{...BTN_SM,color:C.danger,borderColor:C.danger,flex:1}}>🗑️ Eliminar</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({reports}){
  const byProj={};
  PROJECTS.forEach(p=>{byProj[p]=reports.filter(r=>r.project===p);});
  return (
    <div>
      <h2 style={{color:C.blue,marginBottom:20,fontWeight:800}}>Dashboard Directivo</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
        {PROJECTS.map(proj=>{
          const reps=byProj[proj];
          if(!reps.length)return (
            <div key={proj} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
              <div style={{color:C.blue,fontWeight:600,marginBottom:4}}>{proj}</div>
              <div style={{color:C.muted,fontSize:13}}>Sin reportes aún</div>
            </div>
          );
          const last=reps[reps.length-1];
          const st=semaforo(last.avanceObra,last.avanceRecursos,null,null,null,null);
          const efic=(last.avanceObra||0)-(last.avanceRecursos||0);
          const photos=[...(last.frentes||[]).flatMap(f=>f.photos||[]),...(last.days||[]).flatMap(d=>d.photos||[])].slice(0,2);
          const aplicables = FRENTES_POR_PROYECTO[proj]||[];
          const reportados = (last.frentes||[]).map(f=>f.nombre);
          const noAplica = FRENTES_MASTER.filter(f=>!aplicables.includes(f));
          const faltantes = aplicables.filter(f=>!reportados.includes(f));
          return (
            <div key={proj} style={{background:C.bgCard,border:`1px solid ${SEM_COLOR[st]}44`,borderTop:`3px solid ${SEM_COLOR[st]}`,borderRadius:12,padding:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <span style={{color:C.blue,fontWeight:700,fontSize:14,lineHeight:1.3,flex:1,marginRight:8}}>{proj}</span>
                <Badge status={st}/>
              </div>
              <div style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{color:C.muted,fontSize:12}}>Avance Obra</span><span style={{color:C.blue,fontWeight:700,fontSize:12}}>{last.avanceObra||0}%</span></div>
                <Bar value={last.avanceObra} color={C.yellow}/>
              </div>
              {last.avanceRecursos>0&&<div style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{color:C.muted,fontSize:12}}>Recursos</span><span style={{color:C.blueMid,fontWeight:700,fontSize:12}}>{last.avanceRecursos}%</span></div>
                <Bar value={last.avanceRecursos} color={C.blueMid}/>
              </div>}
              <div style={{background:C.bgCard2,borderRadius:8,padding:"8px 10px",fontSize:12,border:`1px solid ${C.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:C.muted}}>Eficiencia</span>
                  <span style={{color:efic>=0?C.green:C.danger,fontWeight:700}}>{efic>=0?"+":""}{efic}%</span>
                </div>
                {last.totalGastos>0&&<div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                  <span style={{color:C.muted}}>Gastos período</span><span style={{color:C.text,fontSize:11}}>{fmt(last.totalGastos)}</span>
                </div>}
              </div>
              {photos.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:10}}>
                {photos.map((p,pi)=><img key={pi} src={p} alt="" style={{width:"100%",height:70,objectFit:"cover",borderRadius:8,border:`1px solid ${C.border}`}}/>)}
              </div>}
              {(noAplica.length>0||faltantes.length>0) && (
                <div style={{marginTop:8,fontSize:11}}>
                  {faltantes.length>0&&<div style={{color:C.warn,marginBottom:2}}>⚠️ Sin reporte: {faltantes.slice(0,2).join(", ")}{faltantes.length>2?` +${faltantes.length-2}`:""}</div>}
                  {noAplica.length>0&&<div style={{color:C.muted}}>N/A: {noAplica.slice(0,2).join(", ")}{noAplica.length>2?` +${noAplica.length-2}`:""}</div>}
                </div>
              )}
              <div style={{color:C.muted,fontSize:11,marginTop:10}}>{last.date} · {last.author}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginScreen({usuarios, onLogin}){
  const activos = usuarios.filter(u=>u.activo);
  const nombreCount = {};
  activos.forEach(u=>{ const p=u.nombre.split(" ")[0]; nombreCount[p]=(nombreCount[p]||0)+1; });
  const label = u => nombreCount[u.nombre.split(" ")[0]]>1 ? `${u.nombre} — ${u.rol}` : u.nombre;
  const sorted = [...activos].sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
  const [selId,setSelId]=useState(sorted[0]?.id||"");
  const [pin,setPin]=useState("");
  const [error,setError]=useState(false);
  const check=()=>{
    const u=activos.find(u=>u.id===+selId);
    if(u&&pin===u.pin){ onLogin(u); }
    else{ setError(true); setPin(""); }
  };
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',Arial,sans-serif",padding:20}}>
      <div style={{background:C.bgCard,borderRadius:20,padding:"40px 48px",boxShadow:"0 8px 32px #1b3a6b18",maxWidth:400,width:"100%"}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:6}}><SydLogo size={34}/></div>
        <div style={{color:C.muted,fontSize:12,letterSpacing:2,textTransform:"uppercase",textAlign:"center",marginBottom:6}}>Sistema de Gestión de Proyectos</div>
        <div style={{width:50,height:3,background:`linear-gradient(90deg,${C.blue},${C.yellow},${C.green})`,borderRadius:2,margin:"0 auto 28px"}}/>
        <div style={{marginBottom:14}}>
          <label style={{color:C.muted,fontSize:12,display:"block",marginBottom:6}}>¿Quién eres?</label>
          <select style={{...INP,fontSize:14}} value={selId} onChange={e=>{setSelId(e.target.value);setError(false);setPin("");}}>
            {sorted.map(u=><option key={u.id} value={u.id}>{label(u)}</option>)}
          </select>
        </div>
        <div style={{marginBottom:error?8:20}}>
          <label style={{color:C.muted,fontSize:12,display:"block",marginBottom:6}}>Código personal (4 dígitos)</label>
          <input type="password" inputMode="numeric" maxLength={4} autoFocus
            style={{...INP,textAlign:"center",fontSize:22,letterSpacing:6}}
            placeholder="••••" value={pin}
            onChange={e=>{setPin(e.target.value.replace(/[^0-9]/g,"").slice(0,4));setError(false);}}
            onKeyDown={e=>e.key==="Enter"&&check()}/>
        </div>
        {error&&<div style={{color:C.danger,fontSize:13,textAlign:"center",marginBottom:16}}>Código incorrecto. Intenta de nuevo.</div>}
        <button onClick={check} disabled={pin.length!==4}
          style={{background:pin.length===4?C.blue:C.border,color:"#fff",fontWeight:700,border:"none",borderRadius:10,padding:13,fontSize:15,cursor:pin.length===4?"pointer":"not-allowed",width:"100%"}}>
          Entrar
        </button>
      </div>
    </div>
  );
}

// ── PANEL ADMIN ───────────────────────────────────────────────────────────────
function PanelAdmin({usuarios, onUsuariosChange}){
  const [editando,setEditando]=useState(null);
  const [editNombre,setEditNombre]=useState("");
  const [editRol,setEditRol]=useState("");
  const [nuevoPin,setNuevoPin]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [addNombre,setAddNombre]=useState("");
  const [addRol,setAddRol]=useState("Coordinador");

  const genPin=()=>{
    const usados=usuarios.map(u=>u.pin);
    let p; do{ p=String(Math.floor(1000+Math.random()*9000)); }while(usados.includes(p));
    return p;
  };
  const startEdit=u=>{setEditando(u.id);setEditNombre(u.nombre);setEditRol(u.rol);};
  const saveEdit=async u=>{
    const ok=await updateUsuario(u.id,{nombre:editNombre,rol:editRol});
    if(ok) onUsuariosChange(usuarios.map(x=>x.id===u.id?{...x,nombre:editNombre,rol:editRol}:x));
    setEditando(null);
  };
  const toggleActivo=async u=>{
    const ok=await updateUsuario(u.id,{activo:!u.activo});
    if(ok) onUsuariosChange(usuarios.map(x=>x.id===u.id?{...x,activo:!u.activo}:x));
  };
  const regenPin=async u=>{
    const pin=genPin();
    const ok=await updateUsuario(u.id,{pin});
    if(ok){ onUsuariosChange(usuarios.map(x=>x.id===u.id?{...x,pin}:x)); setNuevoPin({nombre:u.nombre,pin}); }
  };
  const addUser=async()=>{
    if(!addNombre.trim()) return;
    const pin=genPin();
    await saveUsuario({nombre:addNombre.trim(),rol:addRol,pin,activo:true});
    const updated=await loadUsuarios();
    onUsuariosChange(updated);
    setNuevoPin({nombre:addNombre.trim(),pin});
    setShowAdd(false); setAddNombre(""); setAddRol("Coordinador");
  };

  const sorted=[...usuarios].sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
  const ROL_C={Directivo:C.blue,Ingeniero:C.yellow,Coordinador:C.green};

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h2 style={{color:C.blue,margin:0,fontWeight:800}}>👥 Equipo</h2>
        <button onClick={()=>setShowAdd(true)} style={{background:C.blue,color:"#fff",border:"none",borderRadius:10,padding:"8px 18px",cursor:"pointer",fontWeight:600,fontSize:13}}>+ Agregar persona</button>
      </div>
      {nuevoPin&&(
        <div style={{background:C.green+"18",border:`1px solid ${C.green}`,borderRadius:10,padding:16,marginBottom:16}}>
          <div style={{color:C.green,fontWeight:700,marginBottom:4}}>✅ Código para <b>{nuevoPin.nombre}</b></div>
          <div style={{fontSize:14}}>Código: <b style={{fontSize:22,letterSpacing:6,color:C.blue}}>{nuevoPin.pin}</b></div>
          <div style={{color:C.muted,fontSize:12,marginTop:4}}>Anota este código — no se vuelve a mostrar igual.</div>
          <button onClick={()=>setNuevoPin(null)} style={{...BTN_SM,marginTop:8}}>Entendido</button>
        </div>
      )}
      {showAdd&&(
        <Card style={{marginBottom:16,border:`1px solid ${C.blue}44`}}>
          <SectionTitle>Nueva persona</SectionTitle>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <label style={{color:C.muted,fontSize:12}}>Nombre completo</label>
              <input style={INP} value={addNombre} onChange={e=>setAddNombre(e.target.value)} placeholder="Ej: Juan Pérez"/>
            </div>
            <div>
              <label style={{color:C.muted,fontSize:12}}>Rol</label>
              <select style={INP} value={addRol} onChange={e=>setAddRol(e.target.value)}>
                {["Coordinador","Ingeniero","Directivo"].map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div style={{color:C.muted,fontSize:12,marginBottom:12}}>El código se genera automáticamente y se muestra una sola vez.</div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>{setShowAdd(false);setAddNombre("");}} style={{...BTN_SM,flex:1,padding:10}}>Cancelar</button>
            <button onClick={addUser} disabled={!addNombre.trim()}
              style={{background:addNombre.trim()?C.blue:C.border,color:"#fff",border:"none",borderRadius:8,padding:10,flex:1,cursor:addNombre.trim()?"pointer":"not-allowed",fontWeight:600}}>Agregar</button>
          </div>
        </Card>
      )}
      <div style={{display:"grid",gap:8}}>
        {sorted.map(u=>(
          <div key={u.id} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:14,opacity:u.activo?1:0.55}}>
            {editando===u.id?(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <input style={INP} value={editNombre} onChange={e=>setEditNombre(e.target.value)}/>
                  <select style={INP} value={editRol} onChange={e=>setEditRol(e.target.value)}>
                    {["Coordinador","Ingeniero","Directivo"].map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setEditando(null)} style={{...BTN_SM,flex:1,padding:8}}>Cancelar</button>
                  <button onClick={()=>saveEdit(u)} style={{background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:8,flex:1,cursor:"pointer",fontWeight:600}}>Guardar</button>
                </div>
              </div>
            ):(
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                <div>
                  <span style={{color:C.text,fontWeight:600,fontSize:14}}>{u.nombre}</span>
                  {!u.activo&&<span style={{color:C.muted,fontSize:12,marginLeft:8}}>(inactivo)</span>}
                  <div style={{marginTop:4}}>
                    <span style={{background:ROL_C[u.rol]+"18",color:ROL_C[u.rol],borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{u.rol}</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button onClick={()=>startEdit(u)} style={{...BTN_SM,color:C.blueMid,borderColor:C.blueMid}}>✏️ Editar</button>
                  <button onClick={()=>regenPin(u)} style={{...BTN_SM,color:C.warn,borderColor:C.warn}}>🔑 Código</button>
                  <button onClick={()=>toggleActivo(u)} style={{...BTN_SM,color:u.activo?C.danger:C.green,borderColor:u.activo?C.danger:C.green}}>{u.activo?"Desactivar":"Activar"}</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App(){
  const [usuario,setUsuario]=useState(null);
  const [usuarios,setUsuarios]=useState([]);
  const [tab,setTab]=useState("dashboard");
  const [reports,setReports]=useState([]);
  const [selected,setSelected]=useState(null);
  const [editingReport,setEditingReport]=useState(null);
  const [deletingReport,setDeletingReport]=useState(null);
  const [success,setSuccess]=useState(null);
  const [loading,setLoading]=useState(true);
  const [destinatarios,setDestinatarios]=useState({});
  const [showDest,setShowDest]=useState(false);
  const [destProject,setDestProject]=useState(PROJECTS[0]);

  useEffect(()=>{
    (async()=>{
      const [r,d,u] = await Promise.all([loadReports(), loadDestinatarios(), loadUsuarios()]);
      setReports(r); setDestinatarios(d); setUsuarios(u);
      const saved = sessionStorage.getItem("syd_usuario");
      if(saved){ try{ const p=JSON.parse(saved); const v=u.find(x=>x.id===p.id&&x.activo); if(v) setUsuario(v); }catch(e){} }
      setLoading(false);
    })();
  },[]);

  const submit=async(r, wasEditing)=>{
    const updated = wasEditing
      ? reports.map(x=>x.id===r.id?r:x)
      : [...reports,r];
    setReports(updated);
    const [ok, driveOk] = await Promise.all([
      saveReport(r, wasEditing),
      enviarADrive(r)
    ]);
    const dest = destinatarios[r.project]||[];
    setSuccess({report:r, dest, saveError: !ok, driveOk, wasEditing});
    setEditingReport(null);
    setTimeout(()=>{ setSuccess(null); setTab("informes"); },6000);
  };

  const saveDest=async(project,emails)=>{
    const updated={...destinatarios,[project]:emails};
    setDestinatarios(updated);
    const ok = await saveDestinatarios(project, emails);
    if(!ok){ alert("⚠️ No se pudieron guardar los destinatarios. Intenta de nuevo."); }
  };

  const startEdit=(r)=>{
    setEditingReport(r);
    setTab("nuevo");
  };
  const cancelEdit=()=>setEditingReport(null);

  const confirmDelete=async()=>{
    const updated = reports.filter(r=>r.id!==deletingReport.id);
    setReports(updated);
    await deleteReport(deletingReport.id);
    setDeletingReport(null);
  };

  if(loading) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:C.muted,fontFamily:"'Segoe UI',Arial,sans-serif"}}>Cargando...</div>
    </div>
  );

  if(!usuario) return (
    <LoginScreen usuarios={usuarios} onLogin={u=>{
      setUsuario(u);
      sessionStorage.setItem("syd_usuario",JSON.stringify(u));
      setTab(u.rol==="Directivo"?"dashboard":"nuevo");
    }}/>
  );

  const tabs = usuario.rol==="Directivo"
    ? [{id:"dashboard",label:"📊 Dashboard"},{id:"informes",label:"📁 Informes"},{id:"destinatarios",label:"📧 Destinatarios"},{id:"equipo",label:"👥 Equipo"}]
    : [{id:"nuevo",label:"📝 Nuevo Informe"},{id:"informes",label:"📁 Ver Informes"}];

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Segoe UI',Arial,sans-serif",color:C.text}}>
      <div style={{background:C.bgCard,borderBottom:`1px solid ${C.border}`,padding:"10px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 1px 6px #1b3a6b0e"}}>
        <SydLogo size={30}/>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{textAlign:"right"}}>
            <div style={{color:C.text,fontSize:13,fontWeight:600}}>{usuario.nombre}</div>
            <div style={{color:C.muted,fontSize:11}}>{usuario.rol}</div>
          </div>
          <button onClick={()=>{setUsuario(null);sessionStorage.removeItem("syd_usuario");}} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:8,padding:"4px 12px",cursor:"pointer",fontSize:12}}>Salir</button>
        </div>
      </div>
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,padding:"0 24px",background:C.bgCard}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setSelected(null);if(t.id!=="nuevo")setEditingReport(null);}}
            style={{background:"none",border:"none",color:tab===t.id?C.blue:C.muted,borderBottom:tab===t.id?`2.5px solid ${C.blue}`:"2.5px solid transparent",padding:"12px 16px",cursor:"pointer",fontSize:14,fontWeight:tab===t.id?700:400}}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{padding:24,maxWidth:980,margin:"0 auto"}}>
        {success&&(
          <div style={{background:success.saveError?C.danger+"18":C.green+"18",border:`1px solid ${success.saveError?C.danger:C.green}`,borderRadius:10,padding:14,marginBottom:20}}>
            {success.saveError ? (
              <div style={{color:C.danger,fontWeight:600}}>
                ⚠️ El informe se está mostrando aquí, pero <b>no se pudo guardar de forma permanente</b>.
                Usa el botón "Publicar" arriba para que el guardado funcione de forma estable.
              </div>
            ) : (
              <>
                <div style={{color:C.green,fontWeight:600,marginBottom:6}}>
                  ✅ {success.wasEditing?"Cambios guardados":"Informe guardado"} correctamente
                </div>
                <div style={{color:C.text,fontSize:13,marginBottom:4}}>
                  ☁️ Google Drive: {success.driveOk
                    ? <span style={{color:C.green,fontWeight:600}}>✅ Copia guardada en Drive (SYD - Sistema de Gestión de Proyectos)</span>
                    : <span style={{color:C.warn}}>⚠️ No se pudo guardar en Drive ahora — usa el botón de exportar JSON como respaldo</span>
                  }
                </div>
                {success.dest.length>0?(
                  <div style={{color:C.text,fontSize:13,marginTop:6}}>
                    📧 Para enviarlo por correo: <i>"envía el informe de {success.report.project}"</i><br/>
                    <span style={{color:C.muted,fontSize:12}}>Destinatarios: {success.dest.join(", ")}</span>
                  </div>
                ):(
                  <div style={{color:C.warn,fontSize:13,marginTop:6}}>⚠️ Sin destinatarios configurados para {success.report.project}.</div>
                )}
              </>
            )}
          </div>
        )}
        {tab==="dashboard"&&<Dashboard reports={reports}/>}
      {tab==="informes"&&!selected&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <h2 style={{color:C.blue,margin:0,fontWeight:800}}>Informes</h2>
            {reports.length>0&&(
              <button onClick={()=>exportarJSON(reports)}
                style={{background:C.blue,color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",cursor:"pointer",fontWeight:600,fontSize:13,display:"flex",alignItems:"center",gap:8,boxShadow:`0 2px 8px ${C.blue}44`}}>
                📥 Exportar respaldo completo
              </button>
            )}
          </div>
          <ReportList reports={reports} onSelect={setSelected} onEdit={startEdit} onDelete={setDeletingReport}/>
        </div>
      )}
        {tab==="informes"&&selected&&<ReportDetail report={selected} onBack={()=>setSelected(null)}/>}
        {tab==="nuevo"&&usuario.rol==="Coordinador"&&<CoordForm onSubmit={submit} editingReport={editingReport} onCancelEdit={cancelEdit} usuario={usuario}/>}
        {tab==="nuevo"&&usuario.rol==="Ingeniero"&&<IngForm onSubmit={submit} editingReport={editingReport} onCancelEdit={cancelEdit} usuario={usuario}/>}
        {tab==="equipo"&&usuario.rol==="Directivo"&&<PanelAdmin usuarios={usuarios} onUsuariosChange={setUsuarios}/>}
        {tab==="destinatarios"&&(
          <div>
            <h2 style={{color:C.blue,marginBottom:20,fontWeight:800}}>Destinatarios por Proyecto</h2>
            <div style={{display:"grid",gap:10}}>
              {PROJECTS.map(p=>(
                <div key={p} onClick={()=>{setDestProject(p);setShowDest(true);}}
                  style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:16,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{color:C.blue,fontWeight:700}}>{p}</div>
                    <div style={{color:C.muted,fontSize:12,marginTop:4}}>
                      {(destinatarios[p]||[]).length>0 ? (destinatarios[p]||[]).join(", ") : "Sin destinatarios"}
                    </div>
                  </div>
                  <span style={{color:C.blueMid,fontSize:13,fontWeight:600}}>Editar →</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {showDest&&(
        <DestinatariosManager key={destProject} project={destProject} destinatarios={destinatarios} onSave={saveDest} onClose={()=>setShowDest(false)}/>
      )}
      {deletingReport&&(
        <ConfirmModal
          title="🗑️ Eliminar informe"
          message={`¿Seguro que quieres eliminar el informe de ${deletingReport.project} (${deletingReport.date})? Esta acción no se puede deshacer.`}
          onConfirm={confirmDelete}
          onCancel={()=>setDeletingReport(null)}
        />
      )}
    </div>
  );
}
