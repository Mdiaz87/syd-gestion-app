import { useState } from "react";
import { C, INP } from "../lib/constants.js";
import { verificarPin } from "../lib/api.js";
import { SydLogo } from "./ui.jsx";

// ── LOGIN ─────────────────────────────────────────────────────────────────────
export function LoginScreen({usuarios, onLogin}){
  const activos = usuarios.filter(u=>u.activo);
  const nombreCount = {};
  activos.forEach(u=>{ const p=u.nombre.split(" ")[0]; nombreCount[p]=(nombreCount[p]||0)+1; });
  const label = u => nombreCount[u.nombre.split(" ")[0]]>1 ? `${u.nombre} — ${u.rol}` : u.nombre;
  const sorted = [...activos].sort((a,b)=>a.nombre.localeCompare(b.nombre,"es"));
  const [selId,setSelId]=useState(()=>String(sorted[0]?.id||""));
  const [pin,setPin]=useState("");
  const [error,setError]=useState(false);
  const [verificando,setVerificando]=useState(false);
  const check=async()=>{
    setVerificando(true);
    const u=await verificarPin(+selId, pin);
    setVerificando(false);
    if(u){ onLogin(u); }
    else{ setError(true); setPin(""); }
  };

  const card = (
    <div style={{background:C.bgCard,borderRadius:20,padding:"40px 48px",boxShadow:"0 8px 32px #1b3a6b18",maxWidth:400,width:"100%"}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:6}}><SydLogo size={34}/></div>
      <div style={{color:C.muted,fontSize:12,letterSpacing:2,textTransform:"uppercase",textAlign:"center",marginBottom:6}}>Sistema de Gestión de Proyectos</div>
      <div style={{width:50,height:3,background:`linear-gradient(90deg,${C.blue},${C.yellow},${C.green})`,borderRadius:2,margin:"0 auto 28px"}}/>
      {activos.length===0?(
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:12}}>⚠️</div>
          <p style={{color:C.text,fontWeight:600,marginBottom:8}}>No hay usuarios configurados</p>
          <p style={{color:C.muted,fontSize:13,marginBottom:20}}>Ejecuta el SQL de configuración en Supabase para crear la tabla de usuarios y recarga la página.</p>
          <button onClick={()=>window.location.reload()} style={{background:C.blue,color:"#fff",border:"none",borderRadius:10,padding:"10px 24px",cursor:"pointer",fontWeight:600,fontSize:14}}>🔄 Recargar</button>
        </div>
      ):(
        <>
          <div style={{marginBottom:14}}>
            <label style={{color:C.muted,fontSize:12,display:"block",marginBottom:6}}>¿Quién eres?</label>
            <select style={{...INP,fontSize:14}} value={selId} onChange={e=>{setSelId(e.target.value);setError(false);setPin("");}}>
              {sorted.map(u=><option key={u.id} value={String(u.id)}>{label(u)}</option>)}
            </select>
          </div>
          <div style={{marginBottom:error?8:20}}>
            <label style={{color:C.muted,fontSize:12,display:"block",marginBottom:6}}>Código personal (4 dígitos)</label>
            <input type="password" inputMode="numeric" maxLength={4} autoFocus
              style={{...INP,textAlign:"center",fontSize:22,letterSpacing:6}}
              placeholder="••••" value={pin}
              onChange={e=>{setPin(e.target.value.replace(/[^0-9]/g,"").slice(0,4));setError(false);}}
              onKeyDown={e=>e.key==="Enter"&&pin.length===4&&!verificando&&check()}/>
          </div>
          {error&&<div style={{color:C.danger,fontSize:13,textAlign:"center",marginBottom:16}}>Código incorrecto. Intenta de nuevo.</div>}
          <button onClick={check} disabled={pin.length!==4||verificando}
            style={{background:pin.length===4&&!verificando?C.blue:C.border,color:"#fff",fontWeight:700,border:"none",borderRadius:10,padding:13,fontSize:15,cursor:pin.length===4&&!verificando?"pointer":"not-allowed",width:"100%"}}>
            {verificando?"Verificando...":"Entrar"}
          </button>
        </>
      )}
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',Arial,sans-serif",padding:20}}>
      {card}
    </div>
  );
}
