import { useState, useRef } from "react";
import { C, INP, BTN_SM, SEM_COLOR, SEM_LABEL, ACTIVIDADES_CATALOGO, MACHINES, OPERADORES_OPTS, UNIDADES, ETAPAS } from "../lib/constants.js";
import { fmt } from "../lib/helpers.js";

// ── LOGO ──────────────────────────────────────────────────────────────────────
export function SydLogo({size=44}){
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

export function Bar({value,color}){
  return <div style={{background:C.border,borderRadius:6,height:8,width:"100%",overflow:"hidden"}}>
    <div style={{width:`${Math.min(value||0,100)}%`,background:color||C.yellow,height:"100%",borderRadius:6,transition:"width .5s"}}/>
  </div>;
}
export function Badge({status}){
  return <span style={{background:SEM_COLOR[status]+"18",color:SEM_COLOR[status],fontWeight:700,borderRadius:20,padding:"3px 12px",fontSize:11,border:`1px solid ${SEM_COLOR[status]}55`}}>{SEM_LABEL[status]}</span>;
}
export function SectionTitle({children,color}){
  return <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
    <div style={{width:3,height:16,background:color||C.blue,borderRadius:2}}/>
    <span style={{color:color||C.blue,fontWeight:700,fontSize:12,letterSpacing:1,textTransform:"uppercase"}}>{children}</span>
  </div>;
}
export function Card({children,style={},borderColor}){
  return <div style={{background:C.bgCard,borderRadius:12,padding:16,border:`1px solid ${borderColor||C.border}`,boxShadow:"0 1px 4px #0001",...style}}>{children}</div>;
}

export function ConfirmModal({title, message, onConfirm, onCancel}){
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
export function DestinatariosManager({project, destinatarios, onSave, onClose}){
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

export function PhotoUpload({photos,onAdd,onRemove}){
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
export function ActivityRow({act, onChange, onRemove}){
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

export function CurrencyInput({value, onChange, style, placeholder}){
  const [editing,setEditing]=useState(false);
  const display=editing||(value===""||value===undefined||value===null)
    ? (value===0||value==="0"?"":String(value||""))
    : (value!==""&&+value>0 ? fmt(+value) : "");
  return (
    <input
      type="text"
      style={style}
      placeholder={placeholder||"$"}
      value={display}
      onFocus={()=>setEditing(true)}
      onBlur={()=>setEditing(false)}
      onChange={e=>{
        const raw=e.target.value.replace(/[^0-9]/g,"");
        onChange(raw);
      }}
    />
  );
}
