import React, { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip as RcTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { C, SEM_COLOR, PROJECTS, FRENTES_MASTER, FRENTES_POR_PROYECTO, ITEMS_PREOP } from "../lib/constants.js";
import { fmt, semaforo, getMondayStr } from "../lib/helpers.js";
import { Badge, Bar } from "./ui.jsx";

const DIAS_ALERTA_INGENIERO = 30;

export function Dashboard({reports,presupuestos}){
  const byProj={};
  PROJECTS.forEach(p=>{byProj[p]=reports.filter(r=>r.project===p);});

  const recordatorios=useMemo(()=>{
    const semanaActual=getMondayStr();
    const hoy=new Date();
    const diasDesde=fecha=>fecha?Math.floor((hoy-new Date(fecha))/86400000):null;
    return PROJECTS.map(proj=>{
      const coordEnviado=reports.some(r=>r.role==="Coordinador"&&r.project===proj&&r.semana===semanaActual&&r.estado==="enviado");
      const ultimoIng=reports.filter(r=>r.role==="Ingeniero"&&r.project===proj&&r.date).sort((a,b)=>b.date.localeCompare(a.date))[0];
      const diasIng=diasDesde(ultimoIng?.date);
      return {
        proj,
        coordPendiente:!coordEnviado,
        ingAtrasado: diasIng===null||diasIng>DIAS_ALERTA_INGENIERO,
        diasIng,
      };
    }).filter(r=>r.coordPendiente||r.ingAtrasado);
  },[reports]);

  const presByProject=useMemo(()=>{
    const acc={};
    presupuestos.forEach(row=>{
      if(!acc[row.project]) acc[row.project]=[];
      acc[row.project].push(row);
    });
    return acc;
  },[presupuestos]);

  const cumByProject=useMemo(()=>{
    const acc={};
    reports.filter(r=>r.role==="Ingeniero").forEach(r=>{
      if(!acc[r.project]) acc[r.project]={};
      (r.financiero||[]).forEach(f=>{
        if(!acc[r.project][f.item]) acc[r.project][f.item]=0;
        acc[r.project][f.item]+=(+f.ejecutado||0);
      });
    });
    return acc;
  },[reports]);

  const alertasSobrecosto=useMemo(()=>{
    const alerts=[];
    Object.entries(presByProject).forEach(([proj,cats])=>{
      const acum=cumByProject[proj]||{};
      cats.forEach(c=>{
        const ejec=acum[c.categoria]||0;
        if(c.presupuesto>0&&ejec>c.presupuesto){
          alerts.push({proj,categoria:c.categoria,presupuesto:c.presupuesto,ejecutado:ejec,exceso:ejec-c.presupuesto,pct:ejec/c.presupuesto*100});
        }
      });
    });
    return alerts.sort((a,b)=>b.pct-a.pct);
  },[presByProject,cumByProject]);

  const ranking=useMemo(()=>{
    return PROJECTS.map(proj=>{
      const reps=byProj[proj];
      const last=reps[reps.length-1];
      const cats=presByProject[proj]||[];
      const acum=cumByProject[proj]||{};
      const totalPres=cats.reduce((s,c)=>s+c.presupuesto,0);
      const totalAcum=cats.reduce((s,c)=>s+(acum[c.categoria]||0),0);
      const pctEjec=totalPres>0?totalAcum/totalPres*100:0;
      const avanceObra=last?.avanceObra||0;
      const avanceRecursos=last?.avanceRecursos||0;
      const eficiencia=avanceObra-avanceRecursos;
      const st=reps.length>0?semaforo(avanceObra,avanceRecursos,null,null,null,null):null;
      return {proj,avanceObra,pctEjec,eficiencia,st,tieneReportes:reps.length>0};
    }).sort((a,b)=>b.avanceObra-a.avanceObra);
  },[byProj,presByProject,cumByProject]);

  const mensualByProject=useMemo(()=>{
    const acc={};
    reports.filter(r=>r.role==="Ingeniero"&&r.date).forEach(r=>{
      const mes=r.date.substring(0,7);
      if(!acc[r.project]) acc[r.project]={};
      if(!acc[r.project][mes]) acc[r.project][mes]={};
      (r.financiero||[]).forEach(f=>{
        if(!f.item) return;
        if(!acc[r.project][mes][f.item]) acc[r.project][mes][f.item]=0;
        acc[r.project][mes][f.item]+=(+f.ejecutado||0);
      });
    });
    return acc;
  },[reports]);

  const [mesTabProj,setMesTabProj]=useState(PROJECTS[0]);

  return (
    <div>
      <h2 style={{color:C.blue,marginBottom:20,fontWeight:800}}>Dashboard Directivo</h2>

      {recordatorios.length>0&&(
        <div style={{background:C.warn+"12",border:`1px solid ${C.warn}55`,borderRadius:12,padding:16,marginBottom:24}}>
          <div style={{color:C.warn,fontWeight:800,fontSize:14,marginBottom:10}}>📋 Recordatorios — Informes Pendientes</div>
          <div style={{display:"grid",gap:6}}>
            {recordatorios.map(r=>(
              <div key={r.proj} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.bgCard,borderRadius:8,padding:"8px 12px",fontSize:12,flexWrap:"wrap",gap:6}}>
                <span style={{color:C.text,fontWeight:600}}>{r.proj}</span>
                <span style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  {r.coordPendiente&&<span style={{color:C.warn}}>⚠️ Sin informe semanal de Coordinador esta semana</span>}
                  {r.ingAtrasado&&<span style={{color:C.danger}}>🔴 Ingeniero: {r.diasIng===null?"nunca ha enviado un informe":`sin informe hace ${r.diasIng} días`}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {alertasSobrecosto.length>0&&(
        <div style={{background:C.danger+"12",border:`1px solid ${C.danger}55`,borderRadius:12,padding:16,marginBottom:24}}>
          <div style={{color:C.danger,fontWeight:800,fontSize:14,marginBottom:10}}>🚨 Alertas de Sobrecosto</div>
          <div style={{display:"grid",gap:6}}>
            {alertasSobrecosto.map((a,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.bgCard,borderRadius:8,padding:"8px 12px",fontSize:12,flexWrap:"wrap",gap:6}}>
                <span style={{color:C.text,fontWeight:600}}>{a.proj} <span style={{color:C.muted,fontWeight:400}}>· {a.categoria}</span></span>
                <span style={{color:C.danger,fontWeight:700}}>{a.pct.toFixed(0)}% ejecutado — excedido en {fmt(a.exceso)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:24}}>
        <div style={{color:C.blue,fontWeight:800,fontSize:14,marginBottom:12}}>🏆 Ranking de Proyectos — Avance de Obra</div>
        <div style={{display:"grid",gap:6}}>
          {ranking.map((r,i)=>(
            <div key={r.proj} style={{display:"grid",gridTemplateColumns:"28px 1.4fr 1fr 90px 90px 90px",alignItems:"center",gap:10,background:C.bgCard2,borderRadius:8,padding:"8px 12px",fontSize:12,opacity:r.tieneReportes?1:0.5}}>
              <span style={{color:i<3&&r.tieneReportes?C.yellow:C.muted,fontWeight:800,fontSize:13}}>#{i+1}</span>
              <span style={{color:C.text,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.proj}</span>
              <div style={{background:C.border,borderRadius:4,height:7,overflow:"hidden"}}>
                <div style={{width:`${Math.min(r.avanceObra,100)}%`,height:"100%",background:C.yellow,borderRadius:4}}/>
              </div>
              <span style={{color:C.text,fontWeight:700,textAlign:"right"}}>{r.tieneReportes?`${r.avanceObra}% obra`:"sin datos"}</span>
              <span style={{color:C.blueMid,fontWeight:700,textAlign:"right"}}>{r.pctEjec>0?`${r.pctEjec.toFixed(0)}% ejec.`:"—"}</span>
              {r.st?<Badge status={r.st}/>:<span style={{color:C.muted,textAlign:"right"}}>—</span>}
            </div>
          ))}
        </div>
      </div>

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

      {Object.keys(presByProject).length>0&&(
        <div style={{marginTop:32}}>
          <h3 style={{color:C.blue,fontWeight:800,marginBottom:16,fontSize:16}}>💰 Ejecución Financiera Acumulada por Proyecto</h3>
          {Object.entries(presByProject).map(([proj,cats])=>{
            const acum=cumByProject[proj]||{};
            const totalPres=cats.reduce((s,c)=>s+c.presupuesto,0);
            const totalAcum=cats.reduce((s,c)=>s+(acum[c.categoria]||0),0);
            const totalPct=totalPres>0?totalAcum/totalPres*100:0;
            const barColor=totalPct>100?C.danger:totalPct>=90?C.green:totalPct>=60?C.warn:C.danger;
            if(!totalPres&&!totalAcum) return null;
            const fases=[{key:"pre_operativa",label:"PRE OPERATIVA",icon:"📋"},{key:"operativa",label:"OPERATIVA",icon:"⚙️"}];
            return (
              <div key={proj} style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:16,boxShadow:"0 1px 4px #0001"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{color:C.blue,fontWeight:700,fontSize:14}}>{proj}</span>
                  <span style={{color:barColor,fontWeight:800,fontSize:14}}>{totalPct.toFixed(1)}% ejecutado{totalPct>100?" ⚠️":""}</span>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{flex:1,background:C.border,borderRadius:4,height:9,overflow:"hidden",marginBottom:4}}>
                    <div style={{width:`${Math.min(totalPct,100)}%`,height:"100%",background:barColor,borderRadius:4,transition:"width 0.3s"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted}}>
                    <span>Acumulado: {fmt(totalAcum)}</span>
                    <span>Presupuesto total: {fmt(totalPres)}</span>
                  </div>
                </div>
                {fases.map(({key:fk,label:fl,icon:fi})=>{
                  const faseCats=cats.filter(c=>(c.fase||"operativa")===fk);
                  if(!faseCats.length) return null;
                  const faseHasPres=faseCats.some(c=>c.presupuesto>0);
                  return (
                    <div key={fk} style={{marginBottom:8}}>
                      <div style={{fontSize:10,color:C.muted,fontWeight:700,letterSpacing:0.5,padding:"4px 0 2px",borderBottom:`1px solid ${C.border}`}}>{fi} {fl}</div>
                      {faseCats.filter(c=>c.presupuesto>0||acum[c.categoria]>0).map(c=>{
                        const ejec=acum[c.categoria]||0;
                        const pct=c.presupuesto>0?ejec/c.presupuesto*100:0;
                        const barC=pct>100?C.danger:pct>=90?C.green:pct>=60?C.warn:C.danger;
                        return (
                          <div key={c.categoria} style={{padding:"5px 0",borderBottom:`1px solid ${C.border}44`}}>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:2}}>
                              <span style={{color:C.text,fontWeight:600}}>{c.categoria}</span>
                              <span style={{color:barC,fontWeight:700}}>{pct.toFixed(1)}%{pct>100?" ⚠️":""}</span>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{flex:1,background:C.border,borderRadius:3,height:5,overflow:"hidden"}}>
                                <div style={{width:`${Math.min(pct,100)}%`,height:"100%",background:barC,borderRadius:3}}/>
                              </div>
                              <span style={{color:C.muted,fontSize:10,whiteSpace:"nowrap",minWidth:130,textAlign:"right"}}>{fmt(ejec)} / {fmt(c.presupuesto)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {(()=>{
        const projMes=mensualByProject[mesTabProj]||{};
        const meses=Object.keys(projMes).sort();
        const allItems=[...new Set(meses.flatMap(m=>Object.keys(projMes[m]||{})))];
        const preOp=allItems.filter(it=>ITEMS_PREOP.includes(it));
        const op=allItems.filter(it=>!ITEMS_PREOP.includes(it));
        const faseGroups=[{label:"PRE OPERATIVA",icon:"📋",items:preOp},{label:"OPERATIVA",icon:"⚙️",items:op}].filter(g=>g.items.length>0);
        if(!meses.length) return null;
        const cellStyle={padding:"6px 10px",fontSize:11,borderBottom:`1px solid ${C.border}44`,textAlign:"right",whiteSpace:"nowrap"};
        const hStyle={padding:"6px 10px",fontSize:10,color:C.muted,fontWeight:700,textAlign:"right",whiteSpace:"nowrap",background:C.bgCard2};
        const fmtMes=m=>{const [y,mo]=m.split("-");const n=["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][+mo];return `${n}-${y.slice(2)}`;};
        const curvaS=(()=>{
          const byMes={};
          reports.filter(r=>r.role==="Ingeniero"&&r.project===mesTabProj&&r.date).forEach(r=>{
            const m=r.date.slice(0,7);
            if(!byMes[m]) byMes[m]=[];
            byMes[m].push(+r.avanceObra||0);
          });
          return Object.entries(byMes).map(([m,vals])=>({mes:m,mesLabel:fmtMes(m),avance:Math.max(...vals)})).sort((a,b)=>a.mes.localeCompare(b.mes));
        })();
        return (
          <div style={{marginTop:32}}>
            <h3 style={{color:C.blue,fontWeight:800,marginBottom:12,fontSize:16}}>📅 Seguimiento Mensual de Ejecución</h3>
            <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
              {PROJECTS.map(p=>(
                <button key={p} onClick={()=>setMesTabProj(p)} style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${mesTabProj===p?C.blue:C.border}`,background:mesTabProj===p?C.blue:"transparent",color:mesTabProj===p?"#fff":C.muted,fontWeight:mesTabProj===p?700:400,fontSize:12,cursor:"pointer"}}>{p}</button>
              ))}
            </div>
            {curvaS.length>1&&(
              <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:24}}>
                <div style={{color:C.blue,fontWeight:700,fontSize:13,marginBottom:12}}>📈 Curva S — Avance de Obra Acumulado ({mesTabProj})</div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={curvaS} margin={{top:5,right:10,left:-10,bottom:0}}>
                    <defs>
                      <linearGradient id="curvaSFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.blue} stopOpacity={0.35}/>
                        <stop offset="95%" stopColor={C.blue} stopOpacity={0.02}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                    <XAxis dataKey="mesLabel" tick={{fontSize:11,fill:C.muted}}/>
                    <YAxis domain={[0,100]} tick={{fontSize:11,fill:C.muted}} unit="%"/>
                    <RcTooltip formatter={v=>[`${v}%`,"Avance acumulado"]}/>
                    <Area type="monotone" dataKey="avance" stroke={C.blue} strokeWidth={2.5} fill="url(#curvaSFill)" dot={{r:3,fill:C.blue}}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            <div style={{overflowX:"auto",borderRadius:10,border:`1px solid ${C.border}`}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{background:C.bgCard2}}>
                    <th style={{...hStyle,textAlign:"left",minWidth:170}}>Ítem</th>
                    {meses.map(m=><th key={m} style={hStyle}>{fmtMes(m)}</th>)}
                    <th style={{...hStyle,color:C.blue}}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {faseGroups.map(({label,icon,items})=>(
                    <React.Fragment key={label}>
                      <tr style={{background:C.bgCard2}}>
                        <td colSpan={meses.length+2} style={{padding:"5px 10px",fontSize:10,color:C.blue,fontWeight:800,letterSpacing:0.5}}>{icon} {label}</td>
                      </tr>
                      {items.map(it=>{
                        const total=meses.reduce((s,m)=>s+(projMes[m]?.[it]||0),0);
                        if(!total) return null;
                        return (
                          <tr key={it} style={{background:C.bgCard}}>
                            <td style={{...cellStyle,textAlign:"left",color:C.text,fontWeight:600,paddingLeft:18}}>{it}</td>
                            {meses.map(m=><td key={m} style={{...cellStyle,color:projMes[m]?.[it]?C.text:C.muted}}>{projMes[m]?.[it]?fmt(projMes[m][it]):"—"}</td>)}
                            <td style={{...cellStyle,color:C.blue,fontWeight:700}}>{fmt(total)}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                  {meses.length>0&&(()=>{
                    const totPorMes=meses.map(m=>Object.values(projMes[m]||{}).reduce((s,v)=>s+v,0));
                    const gran=totPorMes.reduce((s,v)=>s+v,0);
                    if(!gran) return null;
                    return (
                      <tr style={{background:C.bgCard2,fontWeight:700}}>
                        <td style={{...cellStyle,textAlign:"left",color:C.blue,fontWeight:800}}>TOTAL GENERAL</td>
                        {totPorMes.map((v,i)=><td key={i} style={{...cellStyle,color:C.blue,fontWeight:700}}>{v?fmt(v):"—"}</td>)}
                        <td style={{...cellStyle,color:C.blue,fontWeight:800}}>{fmt(gran)}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
