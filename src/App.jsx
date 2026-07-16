import { useState, useEffect, useMemo } from "react";
import { supabase } from "./supabase.js";
import { C, PROJECTS } from "./lib/constants.js";
import { getMondayStr, exportarJSON, puedeGestionar } from "./lib/helpers.js";
import { loadReports, saveReport, deleteReport, loadDestinatarios, saveDestinatarios, loadUsuarios, loadAllPresupuestoProyecto, cambiarMiPin } from "./lib/api.js";
import { enviarADrive } from "./lib/pdf.js";
import { SydLogo, ConfirmModal, DestinatariosManager, CambiarPinModal } from "./components/ui.jsx";
import { CoordForm } from "./components/CoordForm.jsx";
import { IngForm } from "./components/IngForm.jsx";
import { ReportDetail } from "./components/ReportDetail.jsx";
import { ReportsTable } from "./components/ReportsTable.jsx";
import { Dashboard } from "./components/Dashboard.jsx";
import { ConsultasPanel } from "./components/ConsultasPanel.jsx";
import { LoginScreen } from "./components/LoginScreen.jsx";
import { PanelAdmin } from "./components/PanelAdmin.jsx";

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App(){
  const [usuario,setUsuario]=useState(null);
  const [usuarios,setUsuarios]=useState([]);
  const [tab,setTab]=useState("dashboard");
  const [directivoForm,setDirectivoForm]=useState("coord");
  const [reports,setReports]=useState([]);
  const [selected,setSelected]=useState(null);
  const [editingReport,setEditingReport]=useState(null);
  const [deletingReport,setDeletingReport]=useState(null);
  const [success,setSuccess]=useState(null);
  const [loading,setLoading]=useState(true);
  const [destinatarios,setDestinatarios]=useState({});
  const [showDest,setShowDest]=useState(false);
  const [destProject,setDestProject]=useState(PROJECTS[0]);
  const [localOrfanos,setLocalOrfanos]=useState([]);
  const [importando,setImportando]=useState(false);
  const [loadError,setLoadError]=useState(false);
  const [presupuestos,setPresupuestos]=useState([]);
  const [showCambiarPin,setShowCambiarPin]=useState(false);

  const borradorSemana=useMemo(()=>{
    if(!usuario||usuario.rol!=="Coordinador") return null;
    const semana=getMondayStr();
    return reports.find(r=>
      r.role==="Coordinador"&&
      r.coordinadorId===usuario.id&&
      r.semana===semana&&
      r.estado==="borrador"
    )||null;
  },[reports,usuario]);

  const cargarTodo=async()=>{
    setLoading(true);
    setLoadError(false);
    const [r,d,u,pres] = await Promise.all([loadReports(), loadDestinatarios(), loadUsuarios(), loadAllPresupuestoProyecto()]);
    // Siempre restaurar usuarios y sesión aunque los informes fallen
    setDestinatarios(d); setUsuarios(u); setPresupuestos(pres||[]);
    const { data:{ session } } = await supabase.auth.getSession();
    if(session){
      const v=u.find(x=>x.id===session.user.id&&x.activo);
      if(v) setUsuario(v);
    }
    if(r===null){
      setLoadError(true);
      setLoading(false);
      return;
    }
    setReports(r);
    // Detectar informes locales (pre-Supabase) que no están en la BD
    try{
      const local = JSON.parse(localStorage.getItem("syd-reports")||"[]");
      if(local.length>0){
        const enBD = new Set(r.map(x=>String(x.id)));
        const huerfanos = local.filter(x=>!enBD.has(String(x.id)));
        if(huerfanos.length>0) setLocalOrfanos(huerfanos);
      }
    }catch(e){}
    setLoading(false);
  };

  useEffect(()=>{ cargarTodo(); },[]);

  const recuperarLocales=async()=>{
    setImportando(true);
    const recuperados=[];
    for(const r of localOrfanos){
      const ok = await saveReport(r, false);
      if(ok) recuperados.push(r);
    }
    if(recuperados.length>0){
      setReports(prev=>[...prev,...recuperados].sort((a,b)=>a.id-b.id));
      setLocalOrfanos([]);
    }
    setImportando(false);
  };

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
    if(!puedeGestionar(r,usuario)) return;
    setEditingReport(r);
    setTab("nuevo");
    setSelected(null);
    if(usuario.rol==="Directivo") setDirectivoForm(r.role==="Ingeniero"?"ing":"coord");
  };
  const cancelEdit=()=>setEditingReport(null);

  const confirmDelete=async()=>{
    if(!puedeGestionar(deletingReport,usuario)){ setDeletingReport(null); return; }
    const updated = reports.filter(r=>r.id!==deletingReport.id);
    setReports(updated);
    await deleteReport(deletingReport.id);
    if(selected?.id===deletingReport.id) setSelected(null);
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
      setTab(u.rol==="Directivo"?"dashboard":"nuevo");
    }}/>
  );

  const tabs = usuario.rol==="Directivo"
    ? [{id:"dashboard",label:"📊 Dashboard"},{id:"nuevo",label:"📝 Nuevo Informe"},{id:"informes",label:"📁 Informes"},{id:"consultas",label:"🔍 Consultas"},{id:"destinatarios",label:"📧 Destinatarios"},{id:"equipo",label:"👥 Equipo"}]
    : usuario.rol==="Ingeniero"
    ? [{id:"nuevo",label:"📝 Nuevo Informe"},{id:"informes",label:"📁 Ver Informes"},{id:"consultas",label:"🔍 Consultas"}]
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
          <button onClick={()=>setShowCambiarPin(true)} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:8,padding:"4px 12px",cursor:"pointer",fontSize:12}}>🔑 Cambiar mi código</button>
          <button onClick={async()=>{await supabase.auth.signOut();setUsuario(null);}} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:8,padding:"4px 12px",cursor:"pointer",fontSize:12}}>Salir</button>
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
        {tab==="dashboard"&&<Dashboard reports={reports} presupuestos={presupuestos}/>}
      {tab==="informes"&&(
        <div>
          {loadError&&(
            <div style={{background:C.danger+"12",border:`1px solid ${C.danger}`,borderRadius:12,padding:14,marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <div>
                <div style={{color:C.danger,fontWeight:700,fontSize:14}}>⚠️ Error al cargar los informes</div>
                <div style={{color:C.text,fontSize:13,marginTop:2}}>No se pudo conectar con la base de datos. Verifica tu internet e intenta de nuevo.</div>
              </div>
              <button onClick={cargarTodo} style={{background:C.danger,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",cursor:"pointer",fontWeight:700,fontSize:13,whiteSpace:"nowrap"}}>
                🔄 Reintentar
              </button>
            </div>
          )}
          {localOrfanos.length>0&&(
            <div style={{background:C.warn+"18",border:`1px solid ${C.warn}`,borderRadius:12,padding:16,marginBottom:20}}>
              <div style={{color:C.warn,fontWeight:700,fontSize:14,marginBottom:6}}>
                ⚠️ Se encontraron {localOrfanos.length} informe{localOrfanos.length!==1?"s":""} guardado{localOrfanos.length!==1?"s":""} en este dispositivo que no están en la base de datos compartida.
              </div>
              <div style={{color:C.text,fontSize:13,marginBottom:12}}>
                Estos informes fueron creados antes de la migración a Supabase. Haz clic en "Recuperar" para subirlos al sistema y que todos puedan verlos.
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                {localOrfanos.map(r=>(
                  <span key={r.id} style={{background:C.warn+"22",color:C.text,borderRadius:8,padding:"4px 10px",fontSize:12}}>
                    {r.project} · {r.date} · {r.author}
                  </span>
                ))}
              </div>
              <button onClick={recuperarLocales} disabled={importando}
                style={{background:importando?C.border:C.warn,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",cursor:importando?"default":"pointer",fontWeight:700,fontSize:14}}>
                {importando?"Recuperando...":"📤 Recuperar informes en este dispositivo"}
              </button>
            </div>
          )}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <h2 style={{color:C.blue,margin:0,fontWeight:800}}>Informes</h2>
            {reports.length>0&&(
              <button onClick={()=>exportarJSON(reports)}
                style={{background:C.blue,color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",cursor:"pointer",fontWeight:600,fontSize:13,display:"flex",alignItems:"center",gap:8,boxShadow:`0 2px 8px ${C.blue}44`}}>
                📥 Exportar respaldo completo
              </button>
            )}
          </div>
          <ReportsTable reports={reports} onSelect={setSelected} onEdit={startEdit} onDelete={setDeletingReport} usuario={usuario}/>
        </div>
      )}
        {tab==="nuevo"&&usuario.rol==="Coordinador"&&<CoordForm onSubmit={submit} editingReport={editingReport||borradorSemana} onCancelEdit={editingReport?cancelEdit:null} usuario={usuario}/>}
        {tab==="nuevo"&&usuario.rol==="Ingeniero"&&<IngForm onSubmit={submit} editingReport={editingReport} onCancelEdit={cancelEdit} usuario={usuario} reports={reports}/>}
        {tab==="nuevo"&&usuario.rol==="Directivo"&&(
          <div>
            {!editingReport&&(
              <div style={{display:"flex",gap:10,marginBottom:20}}>
                <button onClick={()=>setDirectivoForm("coord")}
                  style={{flex:1,background:directivoForm==="coord"?C.green:C.bgCard2,color:directivoForm==="coord"?"#fff":C.muted,border:`2px solid ${directivoForm==="coord"?C.green:C.border}`,borderRadius:10,padding:"11px 0",cursor:"pointer",fontWeight:700,fontSize:14,transition:"all .15s"}}>
                  📋 Informe Coordinador
                </button>
                <button onClick={()=>setDirectivoForm("ing")}
                  style={{flex:1,background:directivoForm==="ing"?C.blue:C.bgCard2,color:directivoForm==="ing"?"#fff":C.muted,border:`2px solid ${directivoForm==="ing"?C.blue:C.border}`,borderRadius:10,padding:"11px 0",cursor:"pointer",fontWeight:700,fontSize:14,transition:"all .15s"}}>
                  🏗️ Informe Ingeniero
                </button>
              </div>
            )}
            {directivoForm==="coord"&&<CoordForm onSubmit={submit} editingReport={editingReport} onCancelEdit={cancelEdit} usuario={usuario}/>}
            {directivoForm==="ing"&&<IngForm onSubmit={submit} editingReport={editingReport} onCancelEdit={cancelEdit} usuario={usuario} reports={reports}/>}
          </div>
        )}
        {tab==="consultas"&&(usuario.rol==="Directivo"||usuario.rol==="Ingeniero")&&<ConsultasPanel reports={reports} usuario={usuario} presupuestos={presupuestos}/>}
        {tab==="equipo"&&usuario.rol==="Directivo"&&<PanelAdmin usuarios={usuarios} onUsuariosChange={setUsuarios} usuario={usuario}/>}
        {tab==="destinatarios"&&usuario.rol==="Directivo"&&(
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
      {selected&&(
        <>
          <div onClick={()=>setSelected(null)} style={{position:"fixed",inset:0,background:"#0007",zIndex:1000}}/>
          <div style={{position:"fixed",top:0,right:0,bottom:0,width:460,maxWidth:"92vw",background:C.bgCard,boxShadow:"-12px 0 32px #0003",zIndex:1001,overflowY:"auto",padding:20}}>
            <ReportDetail report={selected} onBack={()=>setSelected(null)} usuario={usuario} onEdit={startEdit} onDelete={setDeletingReport}/>
          </div>
        </>
      )}
      {showDest&&(
        <DestinatariosManager key={destProject} project={destProject} destinatarios={destinatarios} onSave={saveDest} onClose={()=>setShowDest(false)}/>
      )}
      {showCambiarPin&&(
        <CambiarPinModal onClose={()=>setShowCambiarPin(false)}/>
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
