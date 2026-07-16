import { C } from "../lib/constants.js";
import { fmt, semaforo, puedeGestionar } from "../lib/helpers.js";
import { verImprimirInforme } from "../lib/pdf.js";
import { Card, SectionTitle, Badge, Bar } from "./ui.jsx";
import { GraficasFinanciero } from "./GraficasFinanciero.jsx";

export function ReportDetail({report,onBack,usuario,onEdit,onDelete}){
  const avanceRecursos=Math.max(0,Math.min(100,+report.avanceRecursos||0));
  const efic=(report.avanceObra||0)-avanceRecursos;
  const st=semaforo(report.avanceObra,report.avanceRecursos,null,null,null,null);
  const estColor={Aprobado:C.green,Pendiente:C.warn,Rechazado:C.danger};
  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        {onBack&&<button onClick={onBack} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:8,padding:"6px 14px",cursor:"pointer"}}>← Volver</button>}
        <button onClick={()=>verImprimirInforme(report)} style={{background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:"6px 16px",cursor:"pointer",fontWeight:600,fontSize:13}}>🖨️ Ver / Exportar PDF</button>
        {onEdit&&puedeGestionar(report,usuario)&&<button onClick={()=>onEdit(report)} style={{background:"none",border:`1px solid ${C.blueMid}`,color:C.blueMid,borderRadius:8,padding:"6px 16px",cursor:"pointer",fontWeight:600,fontSize:13}}>✏️ Editar</button>}
        {onDelete&&puedeGestionar(report,usuario)&&<button onClick={()=>onDelete(report)} style={{background:"none",border:`1px solid ${C.danger}`,color:C.danger,borderRadius:8,padding:"6px 16px",cursor:"pointer",fontWeight:600,fontSize:13}}>🗑️ Eliminar</button>}
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
        {avanceRecursos>0&&<div style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.muted,fontSize:13}}>Recursos Ejecutados</span><b style={{color:C.blueMid}}>{avanceRecursos}%</b></div>
          <Bar value={avanceRecursos} color={C.blueMid}/>
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

      {report.financiero&&report.financiero.some(f=>f.presupuesto||(f.ejecutado!==undefined?f.ejecutado:f.totalEjec))&&(
        <Card style={{marginBottom:10}}>
          <SectionTitle>Resumen Financiero Global</SectionTitle>
          {report.financiero.filter(f=>f.presupuesto||(f.ejecutado!==undefined?f.ejecutado:f.totalEjec)).map((f,i)=>{
            const pres=+f.presupuesto||0;
            const ejec=f.ejecutado!==undefined?+f.ejecutado||0:+f.totalEjec||0;
            const pct=pres>0?ejec/pres*100:(+f.pct||0);
            const balance=pres-ejec;
            const barColor=pct>100?C.danger:pct>=90?C.green:pct>=60?C.warn:C.danger;
            return (
              <div key={i} style={{borderBottom:`1px solid ${C.border}`,padding:"10px 0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                  <div style={{color:C.blue,fontWeight:700,fontSize:12,flex:1}}>{f.item}</div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:11,color:C.muted}}>Presupuesto: <span style={{color:C.text,fontWeight:600}}>{fmt(pres)}</span></div>
                    <div style={{fontSize:11,color:C.muted}}>Ejecutado: <span style={{color:C.text,fontWeight:600}}>{fmt(ejec)}</span></div>
                  </div>
                  {pres>0&&ejec>0&&(
                    <div style={{textAlign:"right",minWidth:110}}>
                      {balance<0
                        ?<div style={{color:C.danger,fontWeight:700,fontSize:11}}>🔴 Sobrecosto: {fmt(Math.abs(balance))}</div>
                        :balance>0
                          ?(f.finalizado
                              ?<div style={{color:C.green,fontWeight:700,fontSize:11}}>💚 Ahorro: {fmt(balance)}</div>
                              :<div style={{color:C.blueMid,fontWeight:700,fontSize:11}}>🔷 Saldo disponible: {fmt(balance)}</div>)
                          :<div style={{color:C.muted,fontSize:11}}>En punto</div>
                      }
                    </div>
                  )}
                </div>
                {pres>0&&(
                  <div style={{marginTop:8,display:"flex",alignItems:"center",gap:10}}>
                    <div style={{flex:1,background:C.border,borderRadius:4,height:6,overflow:"hidden"}}>
                      <div style={{width:`${Math.min(pct,100)}%`,height:"100%",background:barColor,borderRadius:4}}/>
                    </div>
                    <span style={{color:barColor,fontWeight:700,fontSize:11,minWidth:55,whiteSpace:"nowrap"}}>Ejec: {pct.toFixed(1)}%</span>
                    {pct<=100&&ejec>0&&(
                      <span style={{color:C.muted,fontSize:11,minWidth:75,whiteSpace:"nowrap"}}>Por ejec: {(100-pct).toFixed(1)}%</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {(()=>{
            const items=report.financiero.filter(f=>f.presupuesto);
            const totalPres=items.reduce((s,f)=>s+(+f.presupuesto||0),0);
            const totalEjec=items.reduce((s,f)=>s+(f.ejecutado!==undefined?+f.ejecutado||0:+f.totalEjec||0),0);
            const totalPct=totalPres>0?totalEjec/totalPres*100:0;
            const barColor=totalPct>100?C.danger:totalPct>=90?C.green:totalPct>=60?C.warn:C.danger;
            if(!totalPres) return null;
            const totalBalance=totalPres-totalEjec;
            const todoFinalizado=items.length>0&&items.every(f=>f.finalizado);
            return (
              <div style={{borderTop:`2px solid ${C.blue}33`,paddingTop:10,marginTop:4}}>
                <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                  <div style={{color:C.blue,fontWeight:800,fontSize:12}}>TOTAL GENERAL</div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:11,color:C.muted}}>Presupuesto: <span style={{color:C.blue,fontWeight:700}}>{fmt(totalPres)}</span></div>
                    <div style={{fontSize:11,color:C.muted}}>Ejecutado: <span style={{color:C.blue,fontWeight:700}}>{fmt(totalEjec)}</span></div>
                  </div>
                  {totalEjec>0&&(
                    <div style={{textAlign:"right",minWidth:110}}>
                      {totalBalance<0
                        ?<div style={{color:C.danger,fontWeight:700,fontSize:11}}>🔴 Sobrecosto: {fmt(Math.abs(totalBalance))}</div>
                        :totalBalance>0
                          ?(todoFinalizado
                              ?<div style={{color:C.green,fontWeight:700,fontSize:11}}>💚 Ahorro: {fmt(totalBalance)}</div>
                              :<div style={{color:C.blueMid,fontWeight:700,fontSize:11}}>🔷 Saldo disponible: {fmt(totalBalance)}</div>)
                          :<div style={{color:C.muted,fontSize:11}}>En punto</div>
                      }
                    </div>
                  )}
                </div>
                <div style={{marginTop:8,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1,background:C.border,borderRadius:4,height:6,overflow:"hidden"}}>
                    <div style={{width:`${Math.min(totalPct,100)}%`,height:"100%",background:barColor,borderRadius:4}}/>
                  </div>
                  <span style={{color:barColor,fontWeight:700,fontSize:11,minWidth:55,whiteSpace:"nowrap"}}>Ejec: {totalPct.toFixed(1)}%</span>
                  {totalPct<=100&&totalEjec>0&&(
                    <span style={{color:C.muted,fontSize:11,minWidth:75,whiteSpace:"nowrap"}}>Por ejec: {(100-totalPct).toFixed(1)}%</span>
                  )}
                </div>
              </div>
            );
          })()}
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

      <GraficasFinanciero financiero={report.financiero} tramites={report.tramites}/>

      {report.resumen&&<Card>
        <SectionTitle>Conclusiones</SectionTitle>
        <div style={{color:C.text,fontSize:13}}>{report.resumen}</div>
      </Card>}

      {report.history&&report.history.length>0&&(()=>{
        const ediciones=(report.history||[]).filter(h=>h.accion==="Editado");
        const ultima=ediciones[ediciones.length-1];
        const fmtFecha=f=>{try{return new Date(f).toLocaleString("es-CO",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});}catch{return f;}};
        const accionIcon=a=>a==="Creado"?"🆕":a==="Enviado"?"✅":a==="Editado"?"✏️":"💾";
        const accionColor=a=>a==="Creado"?C.green:a==="Enviado"?C.blue:a==="Editado"?C.warn:C.muted;
        if(usuario?.rol==="Directivo"){
          return (
            <Card style={{marginTop:10,background:C.bgCard2,border:`1px solid ${C.warn}44`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <SectionTitle color={C.warn}>📋 Auditoría del Informe</SectionTitle>
                {ediciones.length>0&&<span style={{background:C.warn+"22",color:C.warn,borderRadius:20,padding:"2px 12px",fontSize:11,fontWeight:700,border:`1px solid ${C.warn}55`}}>Editado {ediciones.length} {ediciones.length===1?"vez":"veces"}</span>}
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr style={{borderBottom:`2px solid ${C.border}`}}>
                      {["Acción","Quién","Fecha y hora"].map(h=><th key={h} style={{textAlign:"left",color:C.muted,fontWeight:700,padding:"4px 8px",whiteSpace:"nowrap"}}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {report.history.map((h,hi)=>(
                      <tr key={hi} style={{borderBottom:`1px solid ${C.border}`,background:h.accion==="Editado"?C.warn+"0a":"transparent"}}>
                        <td style={{padding:"6px 8px",whiteSpace:"nowrap"}}>
                          <span style={{color:accionColor(h.accion),fontWeight:600}}>{accionIcon(h.accion)} {h.accion}</span>
                        </td>
                        <td style={{padding:"6px 8px",color:C.text}}>
                          {h.por}{h.uid&&<span title="Verificado" style={{marginLeft:4,fontSize:10,color:C.muted}}>🔒</span>}
                        </td>
                        <td style={{padding:"6px 8px",color:C.muted,whiteSpace:"nowrap"}}>{fmtFecha(h.fecha)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        }
        if(ultima){
          return (
            <div style={{color:C.muted,fontSize:12,textAlign:"right",marginTop:8,paddingTop:8,borderTop:`1px solid ${C.border}`}}>
              ✏️ Editado {ediciones.length} {ediciones.length===1?"vez":"veces"} · Última edición: {fmtFecha(ultima.fecha)} por {ultima.por}
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}
