import React, { useState, useMemo } from "react";
import { BarChart, Bar as RcBar, XAxis, YAxis, Tooltip as RcTooltip, ResponsiveContainer } from "recharts";
import { C, INP, BTN_SM, PROJECTS, ITEMS_PREOP, ITEMS_OP, TRAMITES } from "../lib/constants.js";
import { fmt } from "../lib/helpers.js";
import { Card, SectionTitle, Bar } from "./ui.jsx";

function ResultadoConsulta({resultado,onExportCSV,fmtMes}){
  const exportPDF=async()=>{
    const el=document.getElementById('consulta-resultado-print');
    if(!el) return;
    const h2pdf=(await import('html2pdf.js')).default;
    h2pdf().set({margin:8,filename:`SYD_Consulta.pdf`,image:{type:'jpeg',quality:0.97},html2canvas:{scale:2},jsPDF:{unit:'mm',format:'a4'}}).from(el).save();
  };
  const cellH={padding:'7px 10px',fontSize:11,fontWeight:700,color:C.muted,background:C.bgCard2,borderBottom:`1px solid ${C.border}`};
  const cellD={padding:'7px 10px',fontSize:12,borderBottom:`1px solid ${C.border}44`};
  const MiniChart=({data})=>{
    if(!data||data.filter(d=>d.val>0).length<1) return null;
    return(
      <div style={{marginTop:10}}>
        <div style={{fontSize:10,color:C.muted,marginBottom:2}}>Tendencia mensual</div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={data} margin={{left:0,right:0,top:2,bottom:0}}>
            <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{fontSize:9,fill:C.muted}}/>
            <YAxis hide/>
            <RcTooltip formatter={v=>[fmt(v),'Ejecutado']} labelFormatter={fmtMes}/>
            <RcBar dataKey="val" fill={C.blue} radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };
  return(
    <Card>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <SectionTitle color={C.blue}>Resultado</SectionTitle>
        <div style={{display:'flex',gap:8}}>
          <button onClick={exportPDF} style={{...BTN_SM,color:C.blue,borderColor:C.blue}}>📄 PDF</button>
          <button onClick={onExportCSV} style={{...BTN_SM,color:C.green,borderColor:C.green}}>📊 CSV</button>
        </div>
      </div>
      <div id="consulta-resultado-print">

      {resultado.tipo==='Financiero'&&(
        <>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>
            Proyecto: <b style={{color:C.blue}}>{resultado.proj}</b>
            {resultado.periodo&&<> · Período: <b>{fmtMes(resultado.periodo)}</b></>}
            {resultado.cat&&<> · Categoría: <b>{resultado.cat}</b></>}
          </div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              {['Categoría','Fase','Presupuesto','Ejecutado período','Acumulado','% Ejec.'].map(h=><th key={h} style={cellH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {resultado.rows.map((r,i)=>(
                <React.Fragment key={i}>
                  <tr style={{background:r.sobrecosto?C.danger+'0a':undefined}}>
                    <td style={{...cellD,fontWeight:600,color:C.text}}>{r.categoria}</td>
                    <td style={{...cellD,fontSize:10,color:C.muted}}>{r.fase==='pre_operativa'?'Pre Op.':'Operativa'}</td>
                    <td style={{...cellD,textAlign:'right'}}>{fmt(r.presupuesto)}</td>
                    <td style={{...cellD,textAlign:'right'}}>{fmt(r.ejecutado)}</td>
                    <td style={{...cellD,textAlign:'right',fontWeight:700,color:r.sobrecosto?C.danger:C.blue}}>
                      {fmt(r.acumulado)}{r.sobrecosto&&<span style={{marginLeft:4}}>⚠️</span>}
                    </td>
                    <td style={{...cellD,textAlign:'right',fontWeight:700,color:r.pct>=90?C.green:r.pct>=60?C.warn:C.blue}}>{r.pct.toFixed(1)}%</td>
                  </tr>
                  {r.trend&&resultado.cat&&<tr><td colSpan={6} style={{padding:'0 10px 8px'}}><MiniChart data={r.trend}/></td></tr>}
                </React.Fragment>
              ))}
              {resultado.rows.length===0&&<tr><td colSpan={6} style={{...cellD,textAlign:'center',color:C.muted}}>Sin datos para los filtros seleccionados</td></tr>}
            </tbody>
          </table>
          {!resultado.cat&&resultado.rows.length>0&&(()=>{
            const hasTrend=resultado.rows[0]?.trend?.length>0;
            if(!hasTrend) return null;
            const meses=[...new Set(resultado.rows.flatMap(r=>r.trend.map(t=>t.mes)))].sort();
            const totByMes=meses.map(m=>({mes:m,val:resultado.rows.reduce((s,r)=>s+(r.trend.find(t=>t.mes===m)?.val||0),0)}));
            return <MiniChart data={totByMes}/>;
          })()}
        </>
      )}

      {resultado.tipo==='Avance de Obra'&&(
        <>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>
            Proyecto: <b style={{color:C.blue}}>{resultado.proj}</b>
            {resultado.periodo&&<> · Período: <b>{fmtMes(resultado.periodo)}</b></>}
          </div>
          {resultado.last?(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div style={{background:C.bgCard2,borderRadius:10,padding:14,textAlign:'center'}}>
                <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Avance de Obra</div>
                <div style={{fontSize:28,fontWeight:800,color:C.blue}}>{resultado.last.avanceObra||0}%</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>Último informe: {resultado.last.date}</div>
              </div>
              <div style={{background:C.bgCard2,borderRadius:10,padding:14,textAlign:'center'}}>
                <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Avance Recursos</div>
                <div style={{fontSize:28,fontWeight:800,color:C.blueMid}}>{resultado.last.avanceRecursos||0}%</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{resultado.last.author}</div>
              </div>
            </div>
          ):<div style={{color:C.muted,fontSize:13}}>Sin informes para los filtros seleccionados</div>}
          {resultado.trend&&resultado.trend.length>1&&<MiniChart data={resultado.trend}/>}
        </>
      )}

      {resultado.tipo==='Informes de Coordinador'&&(
        <>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>
            Proyecto: <b style={{color:C.blue}}>{resultado.proj}</b>
            {resultado.periodo&&<> · Período: <b>{fmtMes(resultado.periodo)}</b></>}
          </div>
          {resultado.reps.length===0&&<div style={{color:C.muted,fontSize:13}}>Sin informes de coordinador para los filtros seleccionados</div>}
          {resultado.reps.map((r,i)=>(
            <div key={i} style={{borderBottom:`1px solid ${C.border}44`,padding:'10px 0'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontWeight:700,color:C.blue,fontSize:13}}>{r.author}</span>
                <span style={{fontSize:11,color:C.muted}}>{r.date} · {r.estado||'enviado'}</span>
              </div>
              {r.resumen&&<div style={{fontSize:12,color:C.text,marginTop:4}}>{r.resumen}</div>}
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>Avance: <b style={{color:C.blue}}>{r.avanceObra||0}%</b> · Semana: {r.semana||r.date}</div>
            </div>
          ))}
        </>
      )}

      {resultado.tipo==='Trámites'&&(
        <>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>
            Proyecto: <b style={{color:C.blue}}>{resultado.proj}</b>
            {resultado.periodo&&<> · Período: <b>{fmtMes(resultado.periodo)}</b></>}
          </div>
          {resultado.items.length===0&&<div style={{color:C.muted,fontSize:13}}>Sin trámites registrados para los filtros seleccionados</div>}
          {resultado.items.map((t,i)=>(
            <div key={i} style={{padding:'8px 0',borderBottom:`1px solid ${C.border}44`}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontWeight:600,fontSize:13,color:C.text}}>{t.tramite}</span>
                <span style={{fontWeight:700,fontSize:13,color:t.pct>=100?C.green:t.pct>=50?C.warn:C.blue}}>{t.pct}%</span>
              </div>
              <Bar value={t.pct} color={t.pct>=100?C.green:t.pct>=50?C.warn:C.blue}/>
              <div style={{fontSize:10,color:C.muted,marginTop:2}}>Último registro: {t.date} · {t.author}</div>
            </div>
          ))}
        </>
      )}

      {resultado.tipo==='Comparativa'&&(
        <>
          <div style={{fontSize:12,color:C.muted,marginBottom:12}}>
            Comparativa entre proyectos · Categoría: <b style={{color:C.blue}}>{resultado.cat}</b>
          </div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>
              {['Proyecto','Presupuesto','Ejecutado acum.','% Ejecución','Estado'].map(h=><th key={h} style={cellH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {resultado.rows.map((r,i)=>(
                <tr key={i} style={{background:r.sobrecosto?C.danger+'0a':undefined}}>
                  <td style={{...cellD,fontWeight:600,color:C.blue}}>{r.proj}</td>
                  <td style={{...cellD,textAlign:'right'}}>{fmt(r.presupuesto)}</td>
                  <td style={{...cellD,textAlign:'right',fontWeight:700,color:r.sobrecosto?C.danger:C.text}}>
                    {fmt(r.ejecutado)}{r.sobrecosto&&<span style={{marginLeft:4}}>⚠️</span>}
                  </td>
                  <td style={{...cellD,textAlign:'right',fontWeight:700,color:r.pct>=90?C.green:r.pct>=60?C.warn:C.blue}}>{r.pct.toFixed(1)}%</td>
                  <td style={{...cellD}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <div style={{flex:1,background:C.border,borderRadius:3,height:5,overflow:'hidden'}}>
                        <div style={{width:`${Math.min(r.pct,100)}%`,height:'100%',background:r.pct>=90?C.green:r.pct>=60?C.warn:C.blue,borderRadius:3}}/>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {resultado.rows.length===0&&<tr><td colSpan={5} style={{...cellD,textAlign:'center',color:C.muted}}>Sin datos para esta categoría</td></tr>}
            </tbody>
          </table>
        </>
      )}

      </div>
    </Card>
  );
}

export function ConsultasPanel({reports,usuario,presupuestos}){
  const RECIENTES_KEY=`syd_consultas_${usuario.id}`;
  const lsGet=()=>{try{return JSON.parse(localStorage.getItem(RECIENTES_KEY)||'[]');}catch{return[];}};
  const lsSet=items=>localStorage.setItem(RECIENTES_KEY,JSON.stringify(items));

  const [filtProj,setFiltProj]=useState('');
  const [filtTipo,setFiltTipo]=useState('Financiero');
  const [filtPeriodo,setFiltPeriodo]=useState('');
  const [filtCat,setFiltCat]=useState('');
  const [resultado,setResultado]=useState(null);
  const [recientes,setRecientes]=useState(lsGet);

  const misProyectos=useMemo(()=>{
    if(usuario.rol==='Directivo') return PROJECTS;
    return PROJECTS.filter(p=>reports.some(r=>r.author===usuario.nombre&&r.project===p));
  },[reports,usuario]);

  const periodos=useMemo(()=>{
    if(!filtProj) return [];
    return [...new Set(reports.filter(r=>r.project===filtProj&&r.date).map(r=>r.date.substring(0,7)))].sort().reverse();
  },[reports,filtProj]);

  const categorias=useMemo(()=>{
    if(!filtProj) return [];
    if(filtTipo==='Financiero'){
      const cats=presupuestos.filter(p=>p.project===filtProj).map(p=>p.categoria);
      return cats.length?cats:[...ITEMS_PREOP,...ITEMS_OP];
    }
    if(filtTipo==='Trámites Ambientales') return TRAMITES;
    return [];
  },[filtProj,filtTipo,presupuestos]);

  const fmtMes=m=>{if(!m)return'';const[y,mo]=m.split('-');return`${['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][+mo]}-${y.slice(2)}`;};

  const guardarReciente=q=>{
    const prev=lsGet();
    const next=[q,...prev.filter(x=>!(x.proj===q.proj&&x.tipo===q.tipo&&x.periodo===q.periodo&&x.cat===q.cat))].slice(0,5);
    lsSet(next); setRecientes(next);
  };

  const consultar=()=>{
    if(!filtProj) return;
    if(!misProyectos.includes(filtProj)) return;
    guardarReciente({proj:filtProj,tipo:filtTipo,periodo:filtPeriodo,cat:filtCat});

    if(filtTipo==='Financiero'){
      const allCats=presupuestos.filter(p=>p.project===filtProj&&(!filtCat||p.categoria===filtCat));
      const cumByMes={};
      reports.filter(r=>r.role==='Ingeniero'&&r.project===filtProj&&r.date).forEach(r=>{
        const m=r.date.substring(0,7);
        if(!cumByMes[m]) cumByMes[m]={};
        (r.financiero||[]).forEach(f=>{if(!cumByMes[m][f.item])cumByMes[m][f.item]=0;cumByMes[m][f.item]+=(+f.ejecutado||0);});
      });
      const meses=Object.keys(cumByMes).sort();
      const rows=allCats.map(c=>{
        const totalAcum=meses.reduce((s,m)=>s+(cumByMes[m][c.categoria]||0),0);
        const ejec=filtPeriodo?(cumByMes[filtPeriodo]?.[c.categoria]||0):totalAcum;
        const trend=meses.map(m=>({mes:m,val:cumByMes[m][c.categoria]||0}));
        return{categoria:c.categoria,presupuesto:c.presupuesto,ejecutado:ejec,acumulado:totalAcum,pct:c.presupuesto>0?totalAcum/c.presupuesto*100:0,sobrecosto:totalAcum>c.presupuesto&&c.presupuesto>0,trend,fase:c.fase||'operativa'};
      }).filter(r=>r.presupuesto>0||r.acumulado>0);
      setResultado({tipo:'Financiero',rows,proj:filtProj,periodo:filtPeriodo,cat:filtCat});
    }

    if(filtTipo==='Avance de Obra'){
      const reps=reports.filter(r=>r.project===filtProj&&(r.role==='Ingeniero'||r.role==='Coordinador')&&(!filtPeriodo||r.date?.startsWith(filtPeriodo)));
      const byMes={};
      reps.forEach(r=>{const m=r.date?.substring(0,7);if(m){if(!byMes[m])byMes[m]=[];byMes[m].push(+r.avanceObra||0);}});
      const trend=Object.entries(byMes).map(([mes,vals])=>({mes,val:Math.max(...vals)})).sort((a,b)=>a.mes.localeCompare(b.mes));
      const last=reps.sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0]||null;
      setResultado({tipo:'Avance de Obra',proj:filtProj,periodo:filtPeriodo,last,trend});
    }

    if(filtTipo==='Informes de Coordinador'){
      const reps=reports.filter(r=>r.role==='Coordinador'&&r.project===filtProj&&(!filtPeriodo||r.date?.startsWith(filtPeriodo))).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      setResultado({tipo:'Informes de Coordinador',proj:filtProj,periodo:filtPeriodo,reps});
    }

    if(filtTipo==='Trámites Ambientales'){
      const byTramite={};
      reports.filter(r=>r.role==='Ingeniero'&&r.project===filtProj&&(!filtPeriodo||r.date?.startsWith(filtPeriodo))).forEach(r=>{
        (r.tramites||[]).filter(t=>!filtCat||t.tramite===filtCat).forEach(t=>{
          if(!byTramite[t.tramite]||r.date>byTramite[t.tramite].date) byTramite[t.tramite]={tramite:t.tramite,pct:+t.pct||0,date:r.date,author:r.author};
        });
      });
      setResultado({tipo:'Trámites',proj:filtProj,periodo:filtPeriodo,items:Object.values(byTramite)});
    }
  };

  const consultarComparativa=()=>{
    if(usuario.rol!=='Directivo') return;
    if(!filtCat) return;
    const rows=PROJECTS.map(proj=>{
      const pres=presupuestos.find(p=>p.project===proj&&p.categoria===filtCat);
      const acum=reports.filter(r=>r.role==='Ingeniero'&&r.project===proj).reduce((s,r)=>s+(+((r.financiero||[]).find(f=>f.item===filtCat)?.ejecutado)||0),0);
      const presVal=pres?.presupuesto||0;
      return{proj,presupuesto:presVal,ejecutado:acum,pct:presVal>0?acum/presVal*100:0,sobrecosto:acum>presVal&&presVal>0};
    }).filter(r=>r.presupuesto>0||r.ejecutado>0);
    setResultado({tipo:'Comparativa',cat:filtCat,rows});
    guardarReciente({proj:'[Comparativa]',tipo:'Financiero comparativa',periodo:'',cat:filtCat});
  };

  const exportCSV=()=>{
    if(!resultado) return;
    let headers='',rows=[];
    if(resultado.tipo==='Financiero'){
      headers='Categoría,Fase,Presupuesto,Ejecutado período,Acumulado,% Ejecución,Sobrecosto';
      rows=resultado.rows.map(r=>`${r.categoria},${r.fase==='pre_operativa'?'Pre Operativa':'Operativa'},${r.presupuesto},${r.ejecutado},${r.acumulado},${r.pct.toFixed(1)}%,${r.sobrecosto?'Sí':'No'}`);
    }else if(resultado.tipo==='Comparativa'){
      headers='Proyecto,Presupuesto,Ejecutado,% Ejecución,Sobrecosto';
      rows=resultado.rows.map(r=>`${r.proj},${r.presupuesto},${r.ejecutado},${r.pct.toFixed(1)}%,${r.sobrecosto?'Sí':'No'}`);
    }else if(resultado.tipo==='Trámites'){
      headers='Trámite,% Avance,Fecha,Autor';
      rows=resultado.items.map(r=>`${r.tramite},${r.pct}%,${r.date},${r.author}`);
    }else if(resultado.tipo==='Avance de Obra'&&resultado.last){
      headers='Proyecto,Avance Obra,Avance Recursos,Fecha,Autor';
      rows=[`${resultado.proj},${resultado.last.avanceObra||0}%,${resultado.last.avanceRecursos||0}%,${resultado.last.date},${resultado.last.author}`];
    }
    if(!headers) return;
    const blob=new Blob([`﻿${headers}\n${rows.join('\n')}`],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=`SYD_Consulta_${filtTipo}_${filtProj}_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const resumenGeneral=()=>{
    if(!filtProj) return;
    if(!misProyectos.includes(filtProj)) return;
    const cumByMes={};
    reports.filter(r=>r.role==='Ingeniero'&&r.project===filtProj&&r.date).forEach(r=>{
      const m=r.date.substring(0,7);
      if(!cumByMes[m]) cumByMes[m]={};
      (r.financiero||[]).forEach(f=>{if(!cumByMes[m][f.item])cumByMes[m][f.item]=0;cumByMes[m][f.item]+=(+f.ejecutado||0);});
    });
    const meses=Object.keys(cumByMes).sort();
    const allCats=presupuestos.filter(p=>p.project===filtProj);
    const rows=allCats.map(c=>{
      const totalAcum=meses.reduce((s,m)=>s+(cumByMes[m][c.categoria]||0),0);
      const trend=meses.map(m=>({mes:m,val:cumByMes[m][c.categoria]||0}));
      return{categoria:c.categoria,presupuesto:c.presupuesto,ejecutado:totalAcum,acumulado:totalAcum,pct:c.presupuesto>0?totalAcum/c.presupuesto*100:0,sobrecosto:totalAcum>c.presupuesto&&c.presupuesto>0,trend,fase:c.fase||'operativa'};
    }).filter(r=>r.presupuesto>0||r.acumulado>0);
    const repsIng=reports.filter(r=>r.role==='Ingeniero'&&r.project===filtProj).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const byMes={};
    repsIng.forEach(r=>{const m=r.date?.substring(0,7);if(m){if(!byMes[m])byMes[m]=[];byMes[m].push(+r.avanceObra||0);}});
    const trend=Object.entries(byMes).map(([mes,vals])=>({mes,val:Math.max(...vals)})).sort((a,b)=>a.mes.localeCompare(b.mes));
    const lastIng=repsIng[0]||null;
    const byTramite={};
    repsIng.forEach(r=>{(r.tramites||[]).forEach(t=>{if(!byTramite[t.tramite]||r.date>byTramite[t.tramite].date)byTramite[t.tramite]={tramite:t.tramite,pct:+t.pct||0,date:r.date};});});
    setResultado({tipo:'Resumen General',proj:filtProj,rows,lastIng,trendObra:trend,tramites:Object.values(byTramite)});
    guardarReciente({proj:filtProj,tipo:'Resumen General',periodo:'',cat:''});
  };

  const SEL={...INP,padding:'8px 12px',fontSize:13,cursor:'pointer'};
  const showCatFilter=filtTipo==='Financiero'||filtTipo==='Trámites Ambientales';

  return(
    <div>
      <h2 style={{color:C.blue,marginBottom:16,fontWeight:800}}>🔍 Consultas</h2>

      {recientes.length>0&&(
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:6,letterSpacing:0.5,textTransform:'uppercase'}}>Recientes</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {recientes.map((r,i)=>(
              <button key={i} onClick={()=>{setFiltProj(r.proj==='[Comparativa]'?filtProj:r.proj);setFiltTipo(r.tipo.includes('comparativa')?'Financiero':r.tipo);setFiltPeriodo(r.periodo||'');setFiltCat(r.cat||'');setResultado(null);}}
                style={{padding:'5px 12px',borderRadius:20,border:`1px solid ${C.border}`,background:C.bgCard2,color:C.blue,fontSize:11,cursor:'pointer'}}>
                {r.tipo} · {r.proj}{r.periodo?` · ${fmtMes(r.periodo)}`:''}
              </button>
            ))}
          </div>
        </div>
      )}

      <Card style={{marginBottom:16}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Proyecto</div>
            <select style={SEL} value={filtProj} onChange={e=>{setFiltProj(e.target.value);setFiltPeriodo('');setFiltCat('');setResultado(null);}}>
              <option value=''>— Selecciona proyecto —</option>
              {misProyectos.map(p=><option key={p}>{p}</option>)}
            </select>
            {misProyectos.length===0&&<div style={{fontSize:11,color:C.warn,marginTop:4}}>Aún no tienes proyectos con informes registrados</div>}
          </div>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:4}}>¿Qué consultar?</div>
            <select style={SEL} value={filtTipo} onChange={e=>{setFiltTipo(e.target.value);setFiltCat('');setResultado(null);}}>
              {['Financiero','Avance de Obra','Informes de Coordinador','Trámites Ambientales'].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Período</div>
            <select style={SEL} value={filtPeriodo} onChange={e=>{setFiltPeriodo(e.target.value);setResultado(null);}}>
              <option value=''>Todos los períodos</option>
              {periodos.map(m=><option key={m} value={m}>{fmtMes(m)}</option>)}
            </select>
          </div>
          {showCatFilter&&(
            <div>
              <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Categoría / Ítem</div>
              <select style={SEL} value={filtCat} onChange={e=>{setFiltCat(e.target.value);setResultado(null);}}>
                <option value=''>Todas las categorías</option>
                {categorias.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
          <button onClick={consultar} disabled={!filtProj}
            style={{background:filtProj?C.blue:C.border,color:'#fff',border:'none',borderRadius:10,padding:'10px 24px',cursor:filtProj?'pointer':'default',fontWeight:700,fontSize:13}}>
            🔍 Consultar
          </button>
          {filtProj&&(
            <button onClick={resumenGeneral}
              style={{background:C.green,color:'#fff',border:'none',borderRadius:10,padding:'10px 20px',cursor:'pointer',fontWeight:700,fontSize:13}}>
              📋 Resumen General del Proyecto
            </button>
          )}
          {usuario.rol==='Directivo'&&filtTipo==='Financiero'&&filtCat&&(
            <button onClick={consultarComparativa}
              style={{background:C.yellow,color:C.blue,border:'none',borderRadius:10,padding:'10px 20px',cursor:'pointer',fontWeight:700,fontSize:13}}>
              📊 Comparar entre proyectos
            </button>
          )}
        </div>
      </Card>

      {resultado&&resultado.tipo==='Resumen General'&&(
        <div>
          <Card style={{marginBottom:12}}>
            <SectionTitle color={C.blue}>📋 Resumen General — {resultado.proj}</SectionTitle>
            {resultado.lastIng&&(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                <div style={{background:C.bgCard2,borderRadius:10,padding:12,textAlign:'center'}}>
                  <div style={{fontSize:11,color:C.muted}}>Avance de Obra</div>
                  <div style={{fontSize:26,fontWeight:800,color:C.blue}}>{resultado.lastIng.avanceObra||0}%</div>
                </div>
                <div style={{background:C.bgCard2,borderRadius:10,padding:12,textAlign:'center'}}>
                  <div style={{fontSize:11,color:C.muted}}>Avance Recursos</div>
                  <div style={{fontSize:26,fontWeight:800,color:C.blueMid}}>{resultado.lastIng.avanceRecursos||0}%</div>
                </div>
              </div>
            )}
            {resultado.rows.length>0&&(
              <>
                <div style={{fontWeight:700,color:C.blue,fontSize:12,marginBottom:8}}>Estado Financiero</div>
                {resultado.rows.map((r,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:`1px solid ${C.border}44`,fontSize:12}}>
                    <span style={{color:C.text,fontWeight:600,flex:1}}>{r.categoria}</span>
                    <span style={{color:C.muted,fontSize:10,marginRight:8}}>{r.fase==='pre_operativa'?'Pre Op.':'Op.'}</span>
                    <span style={{color:r.sobrecosto?C.danger:C.blue,fontWeight:700,marginRight:12}}>{fmt(r.acumulado)}{r.sobrecosto&&' ⚠️'}</span>
                    <span style={{color:r.pct>=90?C.green:r.pct>=60?C.warn:C.blue,fontWeight:700,minWidth:40,textAlign:'right'}}>{r.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </>
            )}
            {resultado.tramites.length>0&&(
              <>
                <div style={{fontWeight:700,color:C.green,fontSize:12,marginBottom:8,marginTop:14}}>Trámites Ambientales</div>
                {resultado.tramites.map((t,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',fontSize:12}}>
                    <span style={{color:C.text,flex:1}}>{t.tramite}</span>
                    <span style={{color:t.pct>=100?C.green:t.pct>=50?C.warn:C.blue,fontWeight:700}}>{t.pct}%</span>
                  </div>
                ))}
              </>
            )}
          </Card>
        </div>
      )}

      {resultado&&resultado.tipo!=='Resumen General'&&(
        <ResultadoConsulta resultado={resultado} onExportCSV={exportCSV} fmtMes={fmtMes}/>
      )}
    </div>
  );
}
