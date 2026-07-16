import { useState } from "react";
import { C, INP, BTN_SM, PROJECTS, CLIMA_OPTS, DAY_NAMES } from "../lib/constants.js";
import { getMondayStr, emptyDay, emptyAct } from "../lib/helpers.js";
import { Card, SectionTitle, ActivityRow, PhotoUpload } from "./ui.jsx";

// ── COORDINADOR FORM ──────────────────────────────────────────────────────────
export function CoordForm({onSubmit, editingReport, onCancelEdit, usuario}){
  const initial = editingReport;
  // Informes de antes del sistema de semana única no tienen "estado" guardado;
  // como ya fueron enviados en su momento, se tratan como "enviado" al editarlos.
  const estadoActual = initial ? (initial.estado || "enviado") : undefined;
  const [project,setProject]=useState(initial?.project||PROJECTS[0]);
  const author = initial?.author || usuario.nombre;
  const [avObra,setAvObra]=useState(initial?.avanceObra||0);
  const [days,setDays]=useState(initial?.days||Array.from({length:7},emptyDay));
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

  // modo: "borrador" | "enviado" | "edicion"
  const doSubmit=async(modo="borrador")=>{
    if(modo!=="borrador"){
      const tieneActividad=days.some(d=>d.activities.some(a=>a.actividad));
      if(!tieneActividad){
        alert("⚠️ Agrega al menos una actividad en algún día antes de enviar el informe.");
        return;
      }
    }
    setSending(true);
    const now=new Date().toISOString();
    const semana=initial?.semana||getMondayStr();
    const nuevoEstado=modo==="borrador"?"borrador":"enviado";
    const baseReport={
      id: initial?.id || Date.now(),
      type:"semanal",role:"Coordinador",project,author,
      coordinadorId:usuario.id,
      avanceObra:+avObra,avanceRecursos:0,
      date:days[0]?.date||new Date().toISOString().slice(0,10),
      semana,
      estado:nuevoEstado,
      days,resumen,
      activities:days.map(d=>d.activities.map(a=>a.actividad==="Otro"?a.actividadOtro:a.actividad).filter(Boolean).join(", ")).join(" | "),
      novelties:days.map(d=>d.novelties).filter(Boolean).join(" | ")||"Sin novedades",
    };
    const accionHist=modo==="enviado"?"Enviado":modo==="edicion"?"Editado":"Guardado";
    let history = initial?.history || [{accion:"Creado",por:author,uid:usuario.id,fecha:initial?.createdAt||now}];
    if(initial){
      history=[...history,{accion:accionHist,por:usuario.nombre,uid:usuario.id,fecha:now}];
    }
    const report={...baseReport, createdAt: initial?.createdAt||now, history};
    await onSubmit(report, !!initial);
    setSending(false);
    setSent(modo);
    setTimeout(()=>setSent(false),3000);
  };

  return (
    <div>
      {initial&&(
        initial.estado==="borrador"
          ? <div style={{background:C.green+"18",border:`1px solid ${C.green}`,borderRadius:10,padding:"10px 14px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:C.green,fontWeight:600,fontSize:13}}>📝 Continuando informe de la semana del {initial.semana} — {initial.project}</span>
              {onCancelEdit&&<button onClick={onCancelEdit} style={{...BTN_SM,padding:"4px 10px"}}>Cancelar</button>}
            </div>
          : <div style={{background:C.warn+"18",border:`1px solid ${C.warn}`,borderRadius:10,padding:"10px 14px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:C.warn,fontWeight:600,fontSize:13}}>✏️ Editando informe del {initial.date} — {initial.project}</span>
              {onCancelEdit&&<button onClick={onCancelEdit} style={{...BTN_SM,padding:"4px 10px"}}>Cancelar edición</button>}
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
              <span style={{color:C.green,fontWeight:700}}>Día {di+1}{DAY_NAMES[di]?` — ${DAY_NAMES[di]}`:""}</span>
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
        {(()=>{
          const fmtH=h=>Number.isInteger(h)?`${h} h`:`${h.toFixed(1)} h`;

          // ── equipos ──
          const equipos={};
          days.forEach((day,di)=>{
            day.activities.forEach(act=>{
              const equipo=act.equipo==="Otro"?act.equipoOtro:act.equipo;
              if(!equipo) return;
              const personal=act.personal==="Otro"?act.personalOtro:act.personal;
              const cant=+act.cantidad||0;
              const unidad=act.unidad==="Otro"?act.unidadOtro:act.unidad;
              if(!equipos[equipo]) equipos[equipo]={horas:0,dias:new Set(),personal:new Set()};
              if(unidad==="horas"&&cant>0) equipos[equipo].horas+=cant;
              equipos[equipo].dias.add(di);
              if(personal) equipos[equipo].personal.add(personal);
            });
          });

          // ── actividades ──
          const actMap={};
          days.forEach(day=>{
            day.activities.forEach(act=>{
              const nombre=act.actividad==="Otro"?act.actividadOtro:act.actividad;
              const cant=+act.cantidad||0;
              if(!nombre||!cant) return;
              const unidad=act.unidad==="Otro"?act.unidadOtro:act.unidad;
              const key=`${nombre}||${act.etapa}||${unidad}`;
              if(!actMap[key]) actMap[key]={nombre,etapa:act.etapa,unidad,total:0};
              actMap[key].total+=cant;
            });
          });

          const eqList=Object.entries(equipos);
          const acList=Object.values(actMap);
          if(!eqList.length&&!acList.length) return null;

          return (
            <div style={{background:C.bgCard2,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",marginBottom:12}}>
              {eqList.length>0&&<>
                <div style={{color:C.blue,fontWeight:700,fontSize:12,marginBottom:8}}>🚜 Equipos utilizados esta semana</div>
                {eqList.map(([equipo,{horas,dias,personal}])=>(
                  <div key={equipo} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"5px 0",borderBottom:`1px solid ${C.border}`,flexWrap:"wrap",gap:4}}>
                    <span style={{color:C.text,fontWeight:600,fontSize:13}}>{equipo}</span>
                    <span style={{color:C.muted,fontSize:12,textAlign:"right"}}>
                      {horas>0&&`${fmtH(horas)} · `}{dias.size} día{dias.size!==1?"s":""}
                      {personal.size>0&&<span style={{marginLeft:8,color:C.blueMid}}>· Personal: {[...personal].join(", ")}</span>}
                    </span>
                  </div>
                ))}
              </>}
              {acList.length>0&&<>
                <div style={{color:C.blue,fontWeight:700,fontSize:12,marginBottom:8,marginTop:eqList.length?12:0}}>📋 Actividades realizadas esta semana</div>
                {acList.map(({nombre,etapa,unidad,total})=>(
                  <div key={`${nombre}${etapa}`} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"5px 0",borderBottom:`1px solid ${C.border}`,flexWrap:"wrap",gap:4}}>
                    <span style={{color:C.text,fontWeight:600,fontSize:13}}>{nombre}</span>
                    <span style={{color:C.muted,fontSize:12}}>
                      {total} {unidad}{etapa&&<span style={{color:C.blueMid,marginLeft:8}}>({etapa})</span>}
                    </span>
                  </div>
                ))}
              </>}
            </div>
          );
        })()}
        <label style={{color:C.muted,fontSize:12}}>Observaciones adicionales</label>
        <textarea style={{...INP,minHeight:70}} value={resumen} onChange={e=>setResumen(e.target.value)} placeholder="Conclusiones, pendientes, notas adicionales..."/>
      </Card>

      {sent&&(
        <div style={{background:sent==="enviado"?C.green+"18":sent==="edicion"?C.blue+"12":C.blue+"12",border:`1px solid ${sent==="enviado"?C.green:C.blue}`,borderRadius:10,padding:14,marginBottom:14,color:sent==="enviado"?C.green:C.blue,fontWeight:700,textAlign:"center"}}>
          {sent==="enviado"?"✅ Informe de la semana enviado y cerrado correctamente":sent==="edicion"?"✅ Edición guardada correctamente":"💾 Progreso guardado correctamente"}
        </div>
      )}
      {estadoActual==="enviado"&&(
        <button onClick={()=>doSubmit("edicion")} disabled={sending||!!sent}
          style={{width:"100%",background:sending||sent?C.border:C.blueMid,color:"#fff",fontWeight:700,border:"none",borderRadius:10,padding:13,fontSize:15,cursor:sending||sent?"default":"pointer",boxShadow:sending||sent?"none":`0 3px 12px ${C.blueMid}55`}}>
          {sending?"Guardando...":"✏️ Guardar Edición"}
        </button>
      )}
      {estadoActual!=="enviado"&&(
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>doSubmit("borrador")} disabled={sending||!!sent}
            style={{flex:1,background:sending||sent?C.border:C.bgCard2,color:sending||sent?C.muted:C.blueMid,fontWeight:700,border:`1px solid ${C.border}`,borderRadius:10,padding:13,fontSize:14,cursor:sending||sent?"default":"pointer"}}>
            {sending?"Guardando...":"💾 Guardar progreso"}
          </button>
          <button onClick={()=>doSubmit("enviado")} disabled={sending||!!sent}
            style={{flex:2,background:sending||sent?C.border:C.green,color:"#fff",fontWeight:700,border:"none",borderRadius:10,padding:13,fontSize:15,cursor:sending||sent?"default":"pointer",boxShadow:sending||sent?"none":`0 3px 12px ${C.green}55`}}>
            {sending?"Guardando...":"✅ Enviar Informe de la Semana"}
          </button>
        </div>
      )}

    </div>
  );
}
