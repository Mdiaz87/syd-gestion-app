import { useState } from "react";
import { C, INP, BTN_SM } from "../lib/constants.js";
import { crearUsuario, editarUsuario, setUsuarioActivo, regenerarPin } from "../lib/api.js";
import { Card, SectionTitle } from "./ui.jsx";

// ── PANEL ADMIN ───────────────────────────────────────────────────────────────
export function PanelAdmin({usuarios, onUsuariosChange}){
  const [editando,setEditando]=useState(null);
  const [editNombre,setEditNombre]=useState("");
  const [editRol,setEditRol]=useState("");
  const [nuevoPin,setNuevoPin]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [addNombre,setAddNombre]=useState("");
  const [addRol,setAddRol]=useState("Coordinador");

  const startEdit=u=>{setEditando(u.id);setEditNombre(u.nombre);setEditRol(u.rol);};
  const saveEdit=async u=>{
    const ok=await editarUsuario(u.id,editNombre,editRol);
    if(ok) onUsuariosChange(usuarios.map(x=>x.id===u.id?{...x,nombre:editNombre,rol:editRol}:x));
    setEditando(null);
  };
  const toggleActivo=async u=>{
    const ok=await setUsuarioActivo(u.id,!u.activo);
    if(ok) onUsuariosChange(usuarios.map(x=>x.id===u.id?{...x,activo:!u.activo}:x));
  };
  const regenPin=async u=>{
    const pin=await regenerarPin(u.id);
    if(pin){ setNuevoPin({nombre:u.nombre,pin}); }
  };
  const addUser=async()=>{
    if(!addNombre.trim()) return;
    const creado=await crearUsuario(addNombre.trim(),addRol);
    if(creado){
      onUsuariosChange([...usuarios,{id:creado.id,nombre:creado.nombre,rol:creado.rol,activo:true}]);
      setNuevoPin({nombre:creado.nombre,pin:creado.pin});
    }
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
