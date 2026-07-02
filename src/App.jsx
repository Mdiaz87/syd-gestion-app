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

// ── ROLE PINS ─────────────────────────────────────────────────────────────────
const ROLE_PINS = { "Ingeniero":"0219", "Directivo":"021" };

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
  "Aqqua 4":["Rafael Espinosa","Ivan Pérez"],
  "Atalí Conjunto Campestre":["Mary Sierra"],
  "Brisas del Lago 1":["Jorge Cañate","Camilo","Jorge Torres"],
  "Brisas del Lago 2":["Jorge Cañate","Camilo","Jorge Torres"],
  "Brisas de Baranoa":["Germán Mercado"],
  "Parque Residencial Nona Happy":["Rafael Espinosa","Ivan Pérez"],
};
const ALL_TEAM = [...new Set(Object.values(TEAM).flat())].sort((a,b)=>a.localeCompare(b,"es"));
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

// ── PIN MODAL ─────────────────────────────────────────────────────────────────
function PinModal({role, onConfirm, onCancel}){
  const [pin,setPin]=useState("");
  const [error,setError]=useState(false);
  const check=()=>{
    if(pin===ROLE_PINS[role]){ onConfirm(); }
    else { setError(true); setPin(""); }
  };
  return (
    <div style={{position:"fixed",inset:0,background:"#0008",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:20}}>
      <div style={{background:C.bgCard,borderRadius:16,padding:24,maxWidth:340,width:"100%",boxShadow:"0 10px 40px #0003",textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:8}}>🔒</div>
        <h3 style={{color:C.blue,margin:"0 0 4px"}}>Acceso {role}</h3>
        <p style={{color:C.muted,fontSize:13,marginBottom:16}}>Ingresa la clave para continuar</p>
        <input type="password" inputMode="numeric" style={{...INP,textAlign:"center",fontSize:20,letterSpacing:4,marginBottom:error?8:16}}
          placeholder="••••" value={pin} autoFocus
          onChange={e=>{setPin(e.target.value.replace(/[^0-9]/g,""));setError(false);}}
          onKeyDown={e=>e.key==="Enter"&&check()}/>
        {error&&<div style={{color:C.danger,fontSize:12,marginBottom:16}}>Clave incorrecta, intenta de nuevo</div>}
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{...BTN_SM,flex:1,padding:10}}>Cancelar</button>
          <button onClick={check} disabled={!pin}
            style={{background:pin?C.blue:C.border,color:"#fff",border:"none",borderRadius:8,padding:10,flex:1,cursor:pin?"pointer":"not-allowed",fontWeight:600}}>Entrar</button>
        </div>
      </div>
    </div>
  );
}

// ── GOOGLE APPS SCRIPT URL ────────────────────────────────────────────────────
const GAS_URL = "https://script.google.com/macros/s/AKfycbx1APOWNcqF1BLhV1kPBUwbygjq98xlPPbDTjOMWWsfD5yn1-9PJhAdrpYmdWozs_8B/exec";

async function enviarADrive(report){
  try{
    await fetch(GAS_URL, {
      method:"POST",
      mode:"no-cors",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify(report)
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

// ── AUTHOR PROMPT MODAL (para edición) ───────────────────────────────────────
function AuthorPromptModal({onConfirm, onCancel, defaultName}){
  const [nombre,setNombre]=useState(defaultName||ALL_TEAM[0]);
  return (
    <div style={{position:"fixed",inset:0,background:"#0008",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:20}}>
      <div style={{background:C.bgCard,borderRadius:16,padding:24,maxWidth:380,width:"100%",boxShadow:"0 10px 40px #0003"}}>
        <h3 style={{color:C.blue,margin:"0 0 8px"}}>✏️ ¿Quién está editando?</h3>
        <p style={{color:C.muted,fontSize:13,marginBottom:14}}>Selecciona tu nombre. Quedará registrado en el historial.</p>
        <select style={{...INP,marginBottom:16}} value={nombre} onChange={e=>setNombre(e.target.value)}>
          {ALL_TEAM.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{...BTN_SM,flex:1,padding:10}}>Cancelar</button>
          <button onClick={()=>onConfirm(nombre)}
            style={{background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:10,flex:1,cursor:"pointer",fontWeight:600}}>Continuar</button>
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
function CoordForm({onSubmit, editingReport, onCancelEdit}){
  const initial = editingReport;
  const [project,setProject]=useState(initial?.project||PROJECTS[0]);
  const [author,setAuthor]=useState(initial?.author||TEAM[initial?.project||PROJECTS[0]][0]);
  const [avObra,setAvObra]=useState(initial?.avanceObra||0);
  const [days,setDays]=useState(initial?.days||[emptyDay()]);
  const [resumen,setResumen]=useState(initial?.resumen||"");
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);
  const [showAuthorPrompt,setShowAuthorPrompt]=useState(false);

  const chgProj=p=>{setProject(p);};
  const setDay=(i,k,v)=>setDays(ds=>ds.map((d,j)=>j===i?{...d,[k]:v}:d));
  const addDay=()=>setDays(ds=>[...ds,emptyDay()]);
  const rmDay=i=>setDays(ds=>ds.filter((_,j)=>j!==i));
  const setAct=(di,ai,k,v)=>setDays(ds=>ds.map((d,j)=>j!==di?d:{...d,activities:d.activities.map((a,k2)=>k2!==ai?a:{...a,[k]:v})}));
  const addAct=di=>setDays(ds=>ds.map((d,j)=>j!==di?d:{...d,activities:[...d.activities,emptyAct()]}));
  const rmAct=(di,ai)=>setDays(ds=>ds.map((d,j)=>j!==di?d:{...d,activities:d.activities.filter((_,k2)=>k2!==ai)}));
  const addPh=(di,urls)=>setDays(ds=>ds.map((d,j)=>j!==di?d:{...d,photos:[...d.photos,...urls].slice(0,6)}));
  const rmPh=(di,pi)=>setDays(ds=>ds.map((d,j)=>j!==di?d:{...d,photos:d.photos.filter((_,k)=>k!==pi)}));

  const doSubmit=async(editorName)=>{
    setSending(true);
    const now=new Date().toISOString();
    const baseReport={
      id: initial?.id || Date.now(),
      type:"semanal",role:"Coordinador",project,author,avanceObra:+avObra,avanceRecursos:0,
      date:days[0]?.date||new Date().toISOString().slice(0,10),days,resumen,
      activities:days.map(d=>d.activities.map(a=>a.actividad==="Otro"?a.actividadOtro:a.actividad).filter(Boolean).join(", ")).join(" | "),
      novelties:days.map(d=>d.novelties).filter(Boolean).join(" | ")||"Sin novedades",
    };
    let history = initial?.history || [{accion:"Creado",por:author,fecha:initial?.createdAt||now}];
    if(editingReport){
      history=[...history,{accion:"Editado",por:editorName,fecha:now}];
    }
    const report={...baseReport, createdAt: initial?.createdAt||now, history};
    await onSubmit(report, !!editingReport);
    setSending(false);
    setSent(true);
    setTimeout(()=>setSent(false),3000);
  };

  const handleClick=()=>{
    if(editingReport){ setShowAuthorPrompt(true); }
    else { doSubmit(author); }
  };

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
            <select style={INP} value={author} onChange={e=>setAuthor(e.target.value)}>{ALL_TEAM.map(p=><option key={p}>{p}</option>)}</select>
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

      {showAuthorPrompt&&(
        <AuthorPromptModal defaultName={author} onCancel={()=>setShowAuthorPrompt(false)} onConfirm={(nombre)=>{setShowAuthorPrompt(false);doSubmit(nombre);}}/>
      )}
    </div>
  );
}

// ── INGENIERO FORM ────────────────────────────────────────────────────────────
function IngForm({onSubmit, editingReport, onCancelEdit}){
  const initial = editingReport;
  const initFrentes = (proj) => (FRENTES_POR_PROYECTO[proj]||FRENTES_MASTER).map(nombre=>emptyFrente(nombre));

  const [project,setProject]=useState(initial?.project||PROJECTS[0]);
  const [author,setAuthor]=useState(initial?.author||TEAM[initial?.project||PROJECTS[0]][0]);
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
  const [showAuthorPrompt,setShowAuthorPrompt]=useState(false);

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

  const doSubmit=async(editorName)=>{
    setSending(true);
    const now=new Date().toISOString();
    const baseReport={
      id: initial?.id || Date.now(),
      type,role:"Ingeniero",project,author,mes,avanceObra:+avObra,avanceRecursos:+avRec,
      date:new Date().toISOString().slice(0,10),frentes,financiero,tramites,resumen,totalGastos,
      activities:frentes.map(f=>f.nombre).join(", "),
      novelties:frentes.map(f=>f.descripcion).filter(Boolean).slice(0,1).join(" ")||"Sin novedades",
    };
    let history = initial?.history || [{accion:"Creado",por:author,fecha:initial?.createdAt||now}];
    if(editingReport){
      history=[...history,{accion:"Editado",por:editorName,fecha:now}];
    }
    const report={...baseReport, createdAt: initial?.createdAt||now, history};
    await onSubmit(report, !!editingReport);
    setSending(false);
    setSent(true);
    setTimeout(()=>setSent(false),3000);
  };

  const handleClick=()=>{
    if(editingReport){ setShowAuthorPrompt(true); }
    else { doSubmit(author); }
  };

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
            <select style={INP} value={author} onChange={e=>setAuthor(e.target.value)}>{ALL_TEAM.map(p=><option key={p}>{p}</option>)}</select>
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

      {showAuthorPrompt&&(
        <AuthorPromptModal defaultName={author} onCancel={()=>setShowAuthorPrompt(false)} onConfirm={(nombre)=>{setShowAuthorPrompt(false);doSubmit(nombre);}}/>
      )}
    </div>
  );
}

// ── DETAIL ────────────────────────────────────────────────────────────────────
function ReportDetail({report,onBack}){
  const efic=(report.avanceObra||0)-(report.avanceRecursos||0);
  const st=semaforo(report.avanceObra,report.avanceRecursos,null,null,null,null);
  const estColor={Aprobado:C.green,Pendiente:C.warn,Rechazado:C.danger};
  return (
    <div>
      <button onClick={onBack} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:8,padding:"6px 14px",cursor:"pointer",marginBottom:20}}>← Volver</button>
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
              <span style={{color:h.accion==="Creado"?C.green:C.warn,fontWeight:600}}>{h.accion==="Creado"?"🆕":"✏️"} {h.accion} por {h.por}</span>
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

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App(){
  const [role,setRole]=useState(null);
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
  const [pendingRole,setPendingRole]=useState(null);

  useEffect(()=>{
    (async()=>{
      const [r,d] = await Promise.all([loadReports(), loadDestinatarios()]);
      setReports(r); setDestinatarios(d); setLoading(false);
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

  const ROLE_CONFIG = [
    {r:"Coordinador", icon:"📋", color:C.green,  desc:"Informes diarios y semanales"},
    {r:"Ingeniero",   icon:"🏗️", color:C.yellow, desc:"Informes técnicos mensuales"},
    {r:"Directivo",   icon:"📊", color:C.blue,   desc:"Dashboard y seguimiento"},
  ];

  if(loading) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:C.muted,fontFamily:"'Segoe UI',Arial,sans-serif"}}>Cargando...</div>
    </div>
  );

  if(!role) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',Arial,sans-serif",padding:20}}>
      <div style={{background:C.bgCard,borderRadius:20,padding:"40px 48px",boxShadow:"0 8px 32px #1b3a6b18",textAlign:"center",maxWidth:420,width:"100%"}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:6}}><SydLogo size={34}/></div>
        <div style={{color:C.muted,fontSize:12,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Sistema de Gestión de Proyectos</div>
        <div style={{width:50,height:3,background:`linear-gradient(90deg,${C.blue},${C.yellow},${C.green})`,borderRadius:2,margin:"0 auto 28px"}}/>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {ROLE_CONFIG.map(({r,icon,color,desc})=>(
            <button key={r} onClick={()=>{
                if(ROLE_PINS[r]){ setPendingRole(r); }
                else { setRole(r); setTab(r==="Directivo"?"dashboard":"nuevo"); }
              }}
              style={{background:C.bg,border:`1.5px solid ${color}55`,borderLeft:`5px solid ${color}`,borderRadius:12,padding:"14px 18px",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:14}}>
              <span style={{fontSize:22}}>{icon}</span>
              <div>
                <div style={{color,fontWeight:700,fontSize:15}}>{r}{ROLE_PINS[r]&&<span style={{marginLeft:6,fontSize:12}}>🔒</span>}</div>
                <div style={{color:C.muted,fontSize:12}}>{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
      {pendingRole&&(
        <PinModal role={pendingRole}
          onCancel={()=>setPendingRole(null)}
          onConfirm={()=>{ setRole(pendingRole); setTab(pendingRole==="Directivo"?"dashboard":"nuevo"); setPendingRole(null); }}/>
      )}
    </div>
  );

  const tabs = role==="Directivo"
    ? [{id:"dashboard",label:"📊 Dashboard"},{id:"informes",label:"📁 Informes"},{id:"destinatarios",label:"📧 Destinatarios"}]
    : [{id:"nuevo",label:"📝 Nuevo Informe"},{id:"informes",label:"📁 Ver Informes"}];

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Segoe UI',Arial,sans-serif",color:C.text}}>
      <div style={{background:C.bgCard,borderBottom:`1px solid ${C.border}`,padding:"10px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 1px 6px #1b3a6b0e"}}>
        <SydLogo size={30}/>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{color:C.muted,fontSize:13,background:C.bgCard2,padding:"3px 14px",borderRadius:20,border:`1px solid ${C.border}`}}>{role}</span>
          <button onClick={()=>setRole(null)} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:8,padding:"4px 12px",cursor:"pointer",fontSize:12}}>Salir</button>
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
        {tab==="nuevo"&&role==="Coordinador"&&<CoordForm onSubmit={submit} editingReport={editingReport} onCancelEdit={cancelEdit}/>}
        {tab==="nuevo"&&role==="Ingeniero"&&<IngForm onSubmit={submit} editingReport={editingReport} onCancelEdit={cancelEdit}/>}
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
