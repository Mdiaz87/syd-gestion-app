import { useState, useEffect, useMemo } from "react";
import { C, INP, BTN_SM, PROJECTS, FRENTES_MASTER, FRENTES_POR_PROYECTO, ITEMS_PREOP, ITEMS_OP, ESTADO_OPTS } from "../lib/constants.js";
import { fmt, emptyFrente, emptyGasto, emptyFinanciero, emptyTramite } from "../lib/helpers.js";
import { loadPresupuestoProyecto, savePresupuestoProyecto } from "../lib/api.js";
import { Card, SectionTitle, PhotoUpload, CurrencyInput, Bar } from "./ui.jsx";
import { GraficasFinanciero } from "./GraficasFinanciero.jsx";

// ── INGENIERO FORM ────────────────────────────────────────────────────────────
export function IngForm({onSubmit, editingReport, onCancelEdit, usuario, reports}){
  const initial = editingReport;
  const initFrentes = (proj) => (FRENTES_POR_PROYECTO[proj]||FRENTES_MASTER).map(nombre=>emptyFrente(nombre));

  const [project,setProject]=useState(initial?.project||PROJECTS[0]);
  const author = initial?.author || usuario.nombre;
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

  // Acumulado histórico de todos los informes anteriores del mismo proyecto (excluye el actual)
  const cumAnterior=useMemo(()=>{
    const acc={};
    (reports||[]).filter(r=>r.role==="Ingeniero"&&r.project===project&&r.id!==(initial?.id)).forEach(r=>{
      (r.financiero||[]).forEach(f=>{
        if(!acc[f.item]) acc[f.item]=0;
        acc[f.item]+=(+f.ejecutado||0);
      });
    });
    return acc;
  },[reports,project,initial?.id]);

  // Cargar categorías del proyecto desde Supabase al montar (solo informes nuevos)
  useEffect(()=>{
    if(initial) return;
    loadPresupuestoProyecto(project).then(cats=>{
      if(!cats||!cats.length) return;
      const fixedPre=ITEMS_PREOP.map(item=>{const found=cats.find(c=>c.categoria===item);return {item,presupuesto:found?String(found.presupuesto):"",ejecutado:"",fase:"pre_operativa",isCustom:false};});
      const fixedOp=ITEMS_OP.map(item=>{const found=cats.find(c=>c.categoria===item);return {item,presupuesto:found?String(found.presupuesto):"",ejecutado:"",fase:"operativa",isCustom:false};});
      const custom=cats.filter(c=>c.is_custom).map(c=>({id:Date.now()+Math.random(),item:c.categoria,presupuesto:String(c.presupuesto),ejecutado:"",isCustom:true,fase:c.fase||"operativa"}));
      setFinanciero([...fixedPre,...fixedOp,...custom]);
    });
  },[]);// eslint-disable-line

  const cargarCategoriasProyecto=async(proj)=>{
    const cats=await loadPresupuestoProyecto(proj);
    if(cats&&cats.length){
      const fixedPre=ITEMS_PREOP.map(item=>{const found=cats.find(c=>c.categoria===item);return {item,presupuesto:found?String(found.presupuesto):"",ejecutado:"",fase:"pre_operativa",isCustom:false};});
      const fixedOp=ITEMS_OP.map(item=>{const found=cats.find(c=>c.categoria===item);return {item,presupuesto:found?String(found.presupuesto):"",ejecutado:"",fase:"operativa",isCustom:false};});
      const custom=cats.filter(c=>c.is_custom).map(c=>({id:Date.now()+Math.random(),item:c.categoria,presupuesto:String(c.presupuesto),ejecutado:"",isCustom:true,fase:c.fase||"operativa"}));
      setFinanciero([...fixedPre,...fixedOp,...custom]);
    } else {
      setFinanciero(emptyFinanciero());
    }
  };

  const chgProj=async p=>{setProject(p);setFrentes(initFrentes(p));await cargarCategoriasProyecto(p);};
  const addCategoria=(fase)=>setFinanciero(fs=>[...fs,{id:Date.now()+Math.random(),item:"",presupuesto:"",ejecutado:"",isCustom:true,fase:fase||"operativa"}]);
  const rmCategoria=i=>setFinanciero(fs=>fs.filter((_,j)=>j!==i));

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

  const doSubmit=async()=>{
    if(!mes.trim()){
      alert("⚠️ Completa el campo \"Mes / Período\" antes de enviar el informe.");
      return;
    }
    const tieneContenido=frentes.some(f=>f.descripcion?.trim())||financiero.some(f=>+f.presupuesto>0||+f.ejecutado>0);
    if(!tieneContenido){
      alert("⚠️ Agrega al menos una descripción en un frente de trabajo o datos financieros antes de enviar el informe.");
      return;
    }
    setSending(true);
    const now=new Date().toISOString();
    const baseReport={
      id: initial?.id || Date.now(),
      type,role:"Ingeniero",project,author,mes,avanceObra:+avObra,avanceRecursos:+avRec,
      date:new Date().toISOString().slice(0,10),frentes,financiero,tramites,resumen,totalGastos,
      activities:frentes.map(f=>f.nombre).join(", "),
      novelties:frentes.map(f=>f.descripcion).filter(Boolean).slice(0,1).join(" ")||"Sin novedades",
    };
    let history = initial?.history || [{accion:"Creado",por:author,uid:usuario.id,fecha:initial?.createdAt||now}];
    if(editingReport){
      history=[...history,{accion:"Editado",por:usuario.nombre,uid:usuario.id,fecha:now}];
    }
    const report={...baseReport, createdAt: initial?.createdAt||now, history};
    await Promise.all([
      onSubmit(report, !!editingReport),
      savePresupuestoProyecto(project, financiero)
    ]);
    setSending(false);
    setSent(true);
    setTimeout(()=>setSent(false),3000);
  };

  const handleClick=()=>{ doSubmit(); };

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
            <div style={{...INP,background:C.bgCard,color:C.text,display:"flex",alignItems:"center",gap:6,cursor:"default"}}>👤 {author}</div>
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
            <input type="number" min={0} max={100} style={INP} value={avRec} onChange={e=>{
              const v=e.target.value;
              setAvRec(v===""?"":Math.max(0,Math.min(100,+v)));
            }}/>
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
        {[{key:"pre_operativa",label:"PRE OPERATIVA",icon:"📋"},{key:"operativa",label:"OPERATIVA",icon:"⚙️"}].map(({key:faseKey,label:faseLabel,icon:faseIcon})=>{
          const items=financiero.map((f,ii)=>({...f,_ii:ii})).filter(f=>(f.fase||"operativa")===faseKey);
          const subPres=items.reduce((s,f)=>s+(+f.presupuesto||0),0);
          const subAcum=items.reduce((s,f)=>s+(cumAnterior[f.item]||0)+(+f.ejecutado||0),0);
          const subPct=subPres>0?subAcum/subPres*100:0;
          const subBarC=subPct>100?C.danger:subPct>=90?C.green:subPct>=60?C.warn:C.danger;
          return (
            <div key={faseKey} style={{marginBottom:16}}>
              <div style={{background:C.bgCard2,borderRadius:8,padding:"6px 12px",marginBottom:8,borderLeft:`3px solid ${C.blue}`}}>
                <span style={{color:C.blue,fontWeight:800,fontSize:12,letterSpacing:0.5}}>{faseIcon} FASE {faseLabel}</span>
              </div>
              {items.map(f=>{
                const ii=f._ii;
                const pres=+f.presupuesto||0;
                const periodo=+f.ejecutado||0;
                const acum=(cumAnterior[f.item]||0)+periodo;
                const pct=pres>0?acum/pres*100:0;
                const balance=pres-acum;
                const barColor=pct>100?C.danger:pct>=90?C.green:pct>=60?C.warn:C.danger;
                return (
                  <div key={f.isCustom?(f.id||ii):f.item} style={{borderBottom:`1px solid ${C.border}`,padding:"10px 0"}}>
                    <div style={{display:"flex",gap:8,alignItems:"flex-start",flexWrap:"wrap"}}>
                      {f.isCustom
                        ?<div style={{width:150,flexShrink:0}}>
                            <input style={{...INP,padding:"4px 8px",fontSize:12,marginTop:14}} placeholder="Nombre categoría..." value={f.item} onChange={e=>setFin(ii,"item",e.target.value)}/>
                            <label style={{display:"flex",alignItems:"center",gap:5,marginTop:6,fontSize:11,color:C.muted,cursor:"pointer"}}>
                              <input type="checkbox" checked={!!f.finalizado} onChange={e=>setFin(ii,"finalizado",e.target.checked)}/> Finalizado
                            </label>
                          </div>
                        :<div style={{width:155,flexShrink:0}}>
                            <div style={{color:C.blue,fontWeight:700,fontSize:12,paddingTop:18}}>{f.item}</div>
                            <label style={{display:"flex",alignItems:"center",gap:5,marginTop:6,fontSize:11,color:C.muted,cursor:"pointer"}}>
                              <input type="checkbox" checked={!!f.finalizado} onChange={e=>setFin(ii,"finalizado",e.target.checked)}/> Finalizado
                            </label>
                          </div>
                      }
                      <div style={{flex:1,minWidth:100}}>
                        <div style={{fontSize:10,color:C.muted,marginBottom:3}}>Presupuesto (COP)</div>
                        <CurrencyInput style={{...INP,padding:"4px 8px",fontSize:12}} value={f.presupuesto} onChange={v=>setFin(ii,"presupuesto",v)}/>
                      </div>
                      <div style={{flex:1,minWidth:100}}>
                        <div style={{fontSize:10,color:C.muted,marginBottom:3}}>Este período (COP)</div>
                        <CurrencyInput style={{...INP,padding:"4px 8px",fontSize:12}} value={f.ejecutado} onChange={v=>setFin(ii,"ejecutado",v)}/>
                      </div>
                      <div style={{flex:1,minWidth:100}}>
                        <div style={{fontSize:10,color:C.muted,marginBottom:3}}>Acumulado histórico</div>
                        <div style={{...INP,padding:"4px 8px",fontSize:12,background:C.blue+"0d",fontWeight:700,color:C.blue,cursor:"default"}}>{fmt(acum)}</div>
                      </div>
                      {pres>0&&acum>0&&(
                        <div style={{minWidth:100,textAlign:"center",paddingTop:16}}>
                          {balance<0
                            ?<div style={{color:C.danger,fontWeight:700,fontSize:11}}>🔴 SOBRECOSTO<br/><span style={{fontSize:12}}>{fmt(Math.abs(balance))}</span></div>
                            :balance>0
                              ?(f.finalizado
                                  ?<div style={{color:C.green,fontWeight:700,fontSize:11}}>💚 AHORRO<br/><span style={{fontSize:12}}>{fmt(balance)}</span></div>
                                  :<div style={{color:C.blueMid,fontWeight:700,fontSize:11}}>🔷 SALDO DISPONIBLE<br/><span style={{fontSize:12}}>{fmt(balance)}</span></div>)
                              :<div style={{color:C.muted,fontSize:11,paddingTop:4}}>En punto</div>
                          }
                        </div>
                      )}
                      {f.isCustom&&<button style={{...BTN_SM,padding:"4px 8px",alignSelf:"center",marginTop:14,color:C.danger,borderColor:C.danger,flexShrink:0}} onClick={()=>rmCategoria(ii)}>✕</button>}
                    </div>
                    {pres>0&&acum>0&&(
                      <div style={{marginTop:8,display:"flex",alignItems:"center",gap:10}}>
                        <div style={{flex:1,background:C.border,borderRadius:4,height:7,overflow:"hidden"}}>
                          <div style={{width:`${Math.min(pct,100)}%`,height:"100%",background:barColor,borderRadius:4,transition:"width 0.3s"}}/>
                        </div>
                        <span style={{color:barColor,fontWeight:700,fontSize:11,minWidth:68,whiteSpace:"nowrap"}}>Acum: {pct.toFixed(1)}%</span>
                        {periodo>0&&pres>0&&(
                          <span style={{color:C.muted,fontSize:11,minWidth:80,whiteSpace:"nowrap"}}>Período: {(pres>0?periodo/pres*100:0).toFixed(1)}%</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <button style={{...BTN_SM,color:C.blueMid,borderColor:C.blueMid,marginTop:8,marginBottom:4}} onClick={()=>addCategoria(faseKey)}>+ Categoría {faseKey==="pre_operativa"?"Pre Operativa":"Operativa"}</button>
              {subPres>0&&(
                <div style={{background:C.bgCard2,borderRadius:8,padding:"7px 12px",marginTop:6,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",border:`1px solid ${C.border}`}}>
                  <span style={{color:C.blue,fontWeight:800,fontSize:11,flex:1}}>Subtotal {faseLabel}</span>
                  <span style={{color:C.muted,fontSize:11}}>Pres: <b style={{color:C.blue}}>{fmt(subPres)}</b></span>
                  <span style={{color:C.muted,fontSize:11}}>Acum: <b style={{color:C.blue}}>{fmt(subAcum)}</b></span>
                  <span style={{color:subBarC,fontWeight:800,fontSize:12}}>{subPct.toFixed(1)}%</span>
                </div>
              )}
            </div>
          );
        })}
        {(()=>{
          const totalPres=financiero.reduce((s,f)=>s+(+f.presupuesto||0),0);
          const totalPeriodo=financiero.reduce((s,f)=>s+(+f.ejecutado||0),0);
          const totalAcum=financiero.reduce((s,f)=>s+(cumAnterior[f.item]||0)+(+f.ejecutado||0),0);
          const totalPct=totalPres>0?totalAcum/totalPres*100:0;
          const barColor=totalPct>100?C.danger:totalPct>=90?C.green:totalPct>=60?C.warn:C.danger;
          if(!totalPres&&!totalAcum) return null;
          const totalBalance=totalPres-totalAcum;
          const itemsConPresupuesto=financiero.filter(f=>+f.presupuesto>0);
          const todoFinalizado=itemsConPresupuesto.length>0&&itemsConPresupuesto.every(f=>f.finalizado);
          return (
            <div style={{borderTop:`2px solid ${C.blue}33`,paddingTop:10,marginTop:8}}>
              <div style={{display:"flex",gap:8,alignItems:"flex-start",flexWrap:"wrap"}}>
                <div style={{width:155,color:C.blue,fontWeight:800,fontSize:12,paddingTop:18,flexShrink:0}}>TOTAL GENERAL</div>
                <div style={{flex:1,minWidth:100}}>
                  <div style={{fontSize:10,color:C.muted,marginBottom:3}}>Presupuesto total</div>
                  <div style={{...INP,padding:"4px 8px",fontSize:12,background:C.blue+"10",fontWeight:700,color:C.blue,cursor:"default"}}>{fmt(totalPres)}</div>
                </div>
                <div style={{flex:1,minWidth:100}}>
                  <div style={{fontSize:10,color:C.muted,marginBottom:3}}>Este período</div>
                  <div style={{...INP,padding:"4px 8px",fontSize:12,background:C.blue+"10",fontWeight:700,color:C.blue,cursor:"default"}}>{fmt(totalPeriodo)}</div>
                </div>
                <div style={{flex:1,minWidth:100}}>
                  <div style={{fontSize:10,color:C.muted,marginBottom:3}}>Acumulado histórico</div>
                  <div style={{...INP,padding:"4px 8px",fontSize:12,background:C.blue+"10",fontWeight:700,color:C.blue,cursor:"default"}}>{fmt(totalAcum)}</div>
                </div>
                <div style={{minWidth:100,textAlign:"center",paddingTop:16}}>
                  {totalPres>0&&totalAcum>0&&(
                    totalBalance<0
                      ?<div style={{color:C.danger,fontWeight:700,fontSize:11}}>🔴 SOBRECOSTO<br/><span style={{fontSize:12}}>{fmt(Math.abs(totalBalance))}</span></div>
                      :totalBalance>0
                        ?(todoFinalizado
                            ?<div style={{color:C.green,fontWeight:700,fontSize:11}}>💚 AHORRO<br/><span style={{fontSize:12}}>{fmt(totalBalance)}</span></div>
                            :<div style={{color:C.blueMid,fontWeight:700,fontSize:11}}>🔷 SALDO<br/><span style={{fontSize:12}}>{fmt(totalBalance)}</span></div>)
                        :<div style={{color:C.muted,fontSize:11,paddingTop:4}}>En punto</div>
                  )}
                </div>
              </div>
              <div style={{marginTop:8,display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,background:C.border,borderRadius:4,height:7,overflow:"hidden"}}>
                  <div style={{width:`${Math.min(totalPct,100)}%`,height:"100%",background:barColor,borderRadius:4}}/>
                </div>
                <span style={{color:barColor,fontWeight:700,fontSize:11,minWidth:68,whiteSpace:"nowrap"}}>Acum: {totalPct.toFixed(1)}%</span>
              </div>
            </div>
          );
        })()}
        <div style={{textAlign:"right",marginTop:10,color:C.blue,fontWeight:700}}>Total gastos período: {fmt(totalGastos)}</div>
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

      <GraficasFinanciero financiero={financiero} tramites={tramites} cumAnterior={cumAnterior}/>

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

    </div>
  );
}
