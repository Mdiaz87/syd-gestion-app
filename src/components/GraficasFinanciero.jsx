import { BarChart, Bar as RcBar, XAxis, YAxis, CartesianGrid, Tooltip as RcTooltip, ResponsiveContainer, Cell, LabelList, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { C } from "../lib/constants.js";
import { fmt } from "../lib/helpers.js";
import { Card, SectionTitle } from "./ui.jsx";

// ── GRÁFICAS INGENIERO ───────────────────────────────────────────────────────
const NEON=['#00f5ff','#7b2fff','#00ff88','#ff6b35','#ffe600','#f72585','#4cc9f0','#72efdd'];
const CHART_BG='linear-gradient(135deg,#080f1c 0%,#0d1b2a 60%,#0a1628 100%)';
const GC={grid:'#1a3050',axis:'#4a6a8a',label:'#c8dff0',muted:'#506a8a',danger:'#ff2d55'};

const NeonBar=(props)=>{
  const{x,y,width,height,fill}=props;
  if(!fill||!width||!height||width<=0||height<=0) return null;
  return(
    <rect x={x} y={y} width={width} height={height} fill={fill} rx={3}
      style={{filter:`drop-shadow(0 0 5px ${fill}99)`}}/>
  );
};

export function GraficasFinanciero({financiero, tramites, cumAnterior}){
  const finItems=(financiero||[]).filter(f=>+f.presupuesto>0);
  const tramItems=(tramites||[]).filter(t=>+t.pct>0);
  if(!finItems.length&&!tramItems.length) return null;

  const getEjec=f=>{
    const periodo=f.ejecutado!==undefined?+f.ejecutado||0:+f.totalEjec||0;
    return cumAnterior?((cumAnterior[f.item]||0)+periodo):periodo;
  };
  const getPct=f=>{const p=+f.presupuesto||0;const e=getEjec(f);return p>0?e/p*100:0;};

  const SHORT={
    "Red de Distribución de Agua":"Red Distribución",
    "Estructuras Hidráulicas":"Estr. Hidráulicas",
    "Ocupación de Cauce":"Ocup. de Cauce",
    "Prospección y Exploración de Aguas Subterráneas":"Prosp. Aguas Subt.",
    "Concesión de Aguas Subterráneas":"Concesión Ag. Subt.",
  };
  const sh=s=>SHORT[s]||s;

  const barFinData=finItems.map((f,i)=>{
    const pct=getPct(f);
    const ejec=Math.min(Math.round(pct*10)/10,100);
    return{name:sh(f.item),ejecutado:ejec,porEjecutar:Math.max(0,Math.round((100-pct)*10)/10),pctReal:Math.round(pct*10)/10,color:NEON[i%NEON.length]};
  });

  const totalPres=finItems.reduce((s,f)=>s+(+f.presupuesto||0),0);
  const radialData=[...finItems.map((f,i)=>({
    name:sh(f.item),
    value:totalPres>0?Math.round((+f.presupuesto||0)/totalPres*1000)/10:0,
    presupuesto:+f.presupuesto||0,
    fill:NEON[i%NEON.length],
  })).filter(d=>d.presupuesto>0)].sort((a,b)=>b.value-a.value);

  const barTramData=tramItems.map((t,i)=>({name:sh(t.tramite),avance:+t.pct||0,color:NEON[i%NEON.length]}));

  const resumenBar=(()=>{
    if(!barFinData.length) return null;
    const avg=barFinData.reduce((s,d)=>s+d.pctReal,0)/barFinData.length;
    const best=barFinData.reduce((a,b)=>a.pctReal>b.pctReal?a:b);
    const worst=barFinData.reduce((a,b)=>a.pctReal<b.pctReal?a:b);
    return{avg:avg.toFixed(1),best,worst};
  })();

  const TT={contentStyle:{backgroundColor:'#060d18',border:'1px solid #1a3050',borderRadius:8,color:GC.label,fontSize:11},labelStyle:{color:GC.label,fontWeight:700}};

  return (
    <Card style={{marginBottom:16}}>
      <SectionTitle color={C.blue}>📊 Visualización del Avance</SectionTitle>

      {finItems.length>0&&<>
        <div style={{fontWeight:700,color:GC.muted,fontSize:10,marginBottom:6,marginTop:4,letterSpacing:1.5,textTransform:'uppercase'}}>Ejecución por Ítem (% del presupuesto)</div>
        <div style={{background:CHART_BG,borderRadius:14,padding:'16px 8px 8px',border:'1px solid #1a3050'}}>
          <ResponsiveContainer width="100%" height={Math.max(140,finItems.length*46)}>
            <BarChart data={barFinData} layout="vertical" margin={{left:4,right:52,top:2,bottom:2}}>
              <CartesianGrid strokeDasharray="1 6" horizontal={false} stroke={GC.grid}/>
              <XAxis type="number" domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{fontSize:9,fill:GC.axis}} axisLine={{stroke:GC.grid}} tickLine={false}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:10,fill:GC.label,fontWeight:600}} width={132} axisLine={false} tickLine={false}/>
              <RcTooltip {...TT} formatter={(v,n)=>[`${v}%`,n==='ejecutado'?'Ejecutado':'Restante']}/>
              <RcBar dataKey="ejecutado" name="ejecutado" stackId="s" shape={NeonBar}>
                {barFinData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                <LabelList dataKey="ejecutado" position="right" formatter={v=>`${v}%`} style={{fontSize:10,fontWeight:700,fill:GC.label}}/>
              </RcBar>
              <RcBar dataKey="porEjecutar" name="Restante" stackId="s" fill="#0f1e30" radius={[0,4,4,0]} fillOpacity={0.8}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {resumenBar&&(
          <div style={{fontSize:11,color:GC.muted,marginTop:6,padding:'7px 12px',background:'#060d18',borderRadius:8,lineHeight:1.7,border:'1px solid #1a3050'}}>
            📌 Promedio: <b style={{color:'#00f5ff'}}>{resumenBar.avg}%</b>
            {' · '}Más avanzado: <b style={{color:'#00ff88'}}>{resumenBar.best.name} ({resumenBar.best.pctReal}%)</b>
            {' · '}Más rezagado: <b style={{color:'#ff6b35'}}>{resumenBar.worst.name} ({resumenBar.worst.pctReal}%)</b>
          </div>
        )}

        {radialData.length>1&&<>
          <div style={{fontWeight:700,color:GC.muted,fontSize:10,marginBottom:6,marginTop:18,letterSpacing:1.5,textTransform:'uppercase'}}>Distribución del Presupuesto por Ítem</div>
          <div style={{background:CHART_BG,borderRadius:14,padding:'12px 8px 8px',border:'1px solid #1a3050'}}>
            <ResponsiveContainer width="100%" height={Math.max(180,radialData.length*26+80)}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="18%" outerRadius="92%"
                data={radialData} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0,100]} tick={false}/>
                <RadialBar dataKey="value" background={{fill:'#0a1628'}} cornerRadius={5}>
                  {radialData.map((d,i)=><Cell key={i} fill={d.fill}/>)}
                </RadialBar>
                <RcTooltip {...TT}
                  formatter={(v,n,p)=>[`${v}% del total  (${fmt(p.payload.presupuesto)})`,'Participación']}
                  labelFormatter={n=>n}/>
              </RadialBarChart>
            </ResponsiveContainer>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'3px 20px',padding:'4px 12px 8px'}}>
              {radialData.map((d,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:7,fontSize:10,minWidth:0}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:d.fill,flexShrink:0,boxShadow:`0 0 6px ${d.fill}`}}/>
                  <span style={{color:GC.label,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.name}</span>
                  <b style={{color:d.fill,minWidth:34,textAlign:'right'}}>{d.value}%</b>
                </div>
              ))}
            </div>
            <div style={{fontSize:11,color:GC.muted,padding:'6px 12px 4px',borderTop:'1px solid #1a3050'}}>
              💰 Presupuesto total: <b style={{color:'#00f5ff'}}>{fmt(totalPres)}</b>
              {radialData[0]&&<>{' · '}Mayor participación: <b style={{color:radialData[0].fill}}>{radialData[0].name} ({radialData[0].value}%)</b></>}
            </div>
          </div>
        </>}
      </>}

      {barTramData.length>0&&<>
        <div style={{fontWeight:700,color:GC.muted,fontSize:10,marginBottom:6,marginTop:18,letterSpacing:1.5,textTransform:'uppercase'}}>Avance Trámites Ambientales</div>
        <div style={{background:CHART_BG,borderRadius:14,padding:'16px 8px 8px',border:'1px solid #1a3050'}}>
          <ResponsiveContainer width="100%" height={Math.max(100,barTramData.length*48)}>
            <BarChart data={barTramData} layout="vertical" margin={{left:4,right:52,top:2,bottom:2}}>
              <CartesianGrid strokeDasharray="1 6" horizontal={false} stroke={GC.grid}/>
              <XAxis type="number" domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{fontSize:9,fill:GC.axis}} axisLine={{stroke:GC.grid}} tickLine={false}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:10,fill:GC.label,fontWeight:600}} width={162} axisLine={false} tickLine={false}/>
              <RcTooltip {...TT} formatter={v=>[`${v}%`,'Avance']}/>
              <RcBar dataKey="avance" name="Avance" shape={NeonBar}>
                {barTramData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                <LabelList dataKey="avance" position="right" formatter={v=>`${v}%`} style={{fontSize:10,fontWeight:700,fill:GC.label}}/>
              </RcBar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </>}
    </Card>
  );
}
