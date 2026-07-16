import { useState, useMemo } from "react";
import { C, INP, BTN_SM } from "../lib/constants.js";
import { puedeGestionar } from "../lib/helpers.js";
import { verImprimirInforme } from "../lib/pdf.js";
import { Card } from "./ui.jsx";

const TC={semanal:C.green,mensual:C.blueMid,trimestral:C.yellow};
const TIPO_LABEL={semanal:"Semanal",mensual:"Mensual",trimestral:"Trimestral"};

export function ReportsTable({reports,onSelect,onEdit,onDelete,usuario}){
  const [search,setSearch]=useState("");
  const [fProyecto,setFProyecto]=useState("");
  const [fEstado,setFEstado]=useState("");
  const [fTipo,setFTipo]=useState("");

  const proyectos=useMemo(()=>[...new Set(reports.map(r=>r.project))].sort(),[reports]);
  const tipos=useMemo(()=>[...new Set(reports.map(r=>r.type).filter(Boolean))],[reports]);
  const ediciones=r=>(r.history||[]).filter(h=>h.accion==="Editado").length;

  const filtrados=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return [...reports].reverse().filter(r=>{
      if(q && !((r.project||"").toLowerCase().includes(q) || (r.author||"").toLowerCase().includes(q))) return false;
      if(fProyecto && r.project!==fProyecto) return false;
      if(fTipo && r.type!==fTipo) return false;
      if(fEstado==="borrador" && r.estado!=="borrador") return false;
      if(fEstado==="enviado" && r.estado==="borrador") return false;
      if(fEstado==="editado" && ediciones(r)===0) return false;
      return true;
    });
  },[reports,search,fProyecto,fEstado,fTipo]);

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr 1fr",gap:10,background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:14,marginBottom:14}}>
        <input style={INP} placeholder="Buscar por proyecto, autor..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select style={INP} value={fProyecto} onChange={e=>setFProyecto(e.target.value)}>
          <option value="">Proyecto: todos</option>
          {proyectos.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select style={INP} value={fEstado} onChange={e=>setFEstado(e.target.value)}>
          <option value="">Estado: todos</option>
          <option value="borrador">En progreso</option>
          <option value="enviado">Enviado</option>
          <option value="editado">Editado</option>
        </select>
        <select style={INP} value={fTipo} onChange={e=>setFTipo(e.target.value)}>
          <option value="">Tipo: todos</option>
          {tipos.map(t=><option key={t} value={t}>{TIPO_LABEL[t]||t}</option>)}
        </select>
      </div>

      {!reports.length&&<Card><div style={{color:C.muted,textAlign:"center",padding:16}}>No hay informes registrados aún.</div></Card>}

      {reports.length>0&&(
        <>
          <div style={{color:C.muted,fontSize:12,marginBottom:8}}>{filtrados.length} de {reports.length} informe{reports.length===1?"":"s"}</div>
          <div style={{overflowX:"auto",border:`1px solid ${C.border}`,borderRadius:12,background:C.bgCard}}>
            <table style={{borderCollapse:"collapse",width:"100%",fontSize:13,minWidth:720}}>
              <thead>
                <tr style={{background:C.bgCard2,borderBottom:`2px solid ${C.border}`}}>
                  {["Proyecto","Elaborado por","Fecha","Tipo","Estado","Acciones"].map(h=>
                    <th key={h} style={{textAlign:"left",color:C.muted,fontWeight:700,fontSize:11,letterSpacing:.3,textTransform:"uppercase",padding:"10px 12px",whiteSpace:"nowrap"}}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {!filtrados.length&&(
                  <tr><td colSpan={6} style={{textAlign:"center",color:C.muted,padding:26}}>Ningún informe coincide con los filtros.</td></tr>
                )}
                {filtrados.map(r=>{
                  const n=ediciones(r);
                  const tColor=TC[r.type]||C.muted;
                  const estColor=r.estado==="borrador"?C.warn:C.green;
                  const estLabel=r.estado==="borrador"?"En progreso":"Enviado";
                  const gestionable=puedeGestionar(r,usuario);
                  return (
                    <tr key={r.id} onClick={()=>onSelect(r)} style={{cursor:"pointer",borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:"9px 12px"}}>
                        <span style={{display:"flex",alignItems:"center",gap:6,fontWeight:700,color:C.blue}}>
                          {r.project}
                          {n>0&&<span title={`Editado ${n} ${n===1?"vez":"veces"}`} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:15,height:15,borderRadius:"50%",background:C.warn+"29",color:C.warn,fontSize:10,cursor:"help"}}>✏</span>}
                        </span>
                      </td>
                      <td style={{padding:"9px 12px",color:C.muted}}>{r.author}</td>
                      <td style={{padding:"9px 12px",color:C.muted,whiteSpace:"nowrap"}}>{r.date}</td>
                      <td style={{padding:"9px 12px"}}>
                        <span style={{background:tColor+"18",color:tColor,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700,border:`1px solid ${tColor}44`,whiteSpace:"nowrap"}}>{TIPO_LABEL[r.type]||r.type}</span>
                      </td>
                      <td style={{padding:"9px 12px"}}>
                        <span style={{background:estColor+"22",color:estColor,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700,border:`1px solid ${estColor}44`,whiteSpace:"nowrap"}}>{estLabel}</span>
                      </td>
                      <td style={{padding:"9px 12px"}}>
                        <div style={{display:"flex",gap:6,whiteSpace:"nowrap"}} onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>verImprimirInforme(r)} title="Ver / PDF" style={{...BTN_SM,color:C.blue,borderColor:C.blue}}>🖨️</button>
                          {gestionable&&<button onClick={()=>onEdit(r)} title="Editar" style={{...BTN_SM,color:C.blueMid,borderColor:C.blueMid}}>✏️</button>}
                          {gestionable&&<button onClick={()=>onDelete(r)} title="Eliminar" style={{...BTN_SM,color:C.danger,borderColor:C.danger}}>🗑️</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
