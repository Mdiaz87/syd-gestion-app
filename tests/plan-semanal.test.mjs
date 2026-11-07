import assert from "node:assert";
import * as P from "../supabase/functions/_shared/plan-semanal.js";
// Festivos 2026 conocidos (lunes): 12 ene, 23 mar, 18 may, 8 jun, 15 jun, 29 jun, 17 ago, 12 oct, 2 nov, 16 nov
for (const f of ["2026-01-12","2026-03-23","2026-05-18","2026-06-08","2026-06-15","2026-06-29","2026-08-17","2026-10-12","2026-11-02","2026-11-16","2026-04-02","2026-04-03"]) assert(P.esFestivo(f), f);
assert(!P.esFestivo("2026-11-09")); assert(!P.esFestivo("2026-10-19"));
assert.equal(P.diaEntrega("2026-11-02"), "2026-11-03"); assert.equal(P.diaEntrega("2026-11-09"), "2026-11-09");
assert.equal(P.estadoEntrega(null, "2026-11-02", "2026-11-03").estado, "pendiente");
assert.equal(P.estadoEntrega(null, "2026-11-02", "2026-11-04").estado, "vencido");
assert.equal(P.estadoEntrega({estado:"enviado",enviado_at:"2026-11-04T15:00:00Z"}, "2026-11-02", "2026-11-04").estado, "enviado_tarde");
assert(P.mismaActividad("Limpieza de vías","limpieza de vias")); assert(P.mismaActividad("Limpieza de vías","Limpieza vías principal"));
assert(!P.mismaActividad("Limpieza general","Limpieza de vías"));
assert(P.mismaActividad("ENTREGA DE LOTE","Entrega de lotes")); assert.notEqual(P.normalizar("m²"),P.normalizar("m³")); assert(P.mismaActividad("AVANCE DE OBRA","AVANCE DE OBRAS"));
assert(P.mismaActividad("AMPLIACION DE LAGO","LIMPIEZA Y AMPLIACION DE LAGO")); assert(!P.mismaActividad("REDES DE GAS","REDES DE AGUA"));
assert.deepEqual(P.actividadesRecientes([{role:"Coordinador",project:"Y",days:[{date:"2026-11-01",activities:[{actividad:"Otro",actividadOtro:"REDES DE GAS"},{actividad:"Otro",actividadOtro:"redes de gas"}]}]}],"Y","2026-11-03"),["REDES DE GAS"]);
const day=(date,acts,o={})=>({date,climaPrincipal:"Soleado",activities:acts,novelties:"",...o});
const a=(actividad,cantidad,unidad)=>({actividad,cantidad,unidad,etapa:"Etapa 1"});
const reports=[{role:"Coordinador",project:"X",days:[
 day("2026-11-10",[a("Excavación mecánica",60,"m³")]),
 day("2026-11-11",[a("Excavación mecánica",50,"m³"),a("Limpieza general",8,"horas")],{climaPrincipal:"Lluvioso",novelties:"Se dañó la volqueta"}),
 day("2026-11-03",[a("Excavación mecánica",100,"m³")]),day("2026-11-04",[a("Excavación mecánica",20,"m³")]),day("2026-10-27",[a("Excavación mecánica",100,"m³")]),
]}];
const plan={project:"X",semana:"2026-11-09",estado:"enviado",actividades:[{actividad:"Excavación mecánica",meta:200,unidad:"m³"},{actividad:"Relleno y compactación",meta:50,unidad:"m³"},{actividad:"Construcción de bordillos",meta:"",unidad:"ml"}]};
const fin=P.cotejarPlan(plan,reports,"2026-11-16");
assert.equal(fin.filas[0].estado,"parcial"); assert.equal(fin.filas[0].ejecutado,110); assert.equal(fin.filas[0].pct,55);
assert.equal(fin.filas[1].estado,"incumplida"); assert.equal(fin.total,3); assert.equal(fin.cumplidas,0);
assert(fin.noPlaneadas["Limpieza general"]); assert.deepEqual(fin.diasLluvia,["2026-11-11"]); assert.equal(fin.novedades[0].texto,"Se dañó la volqueta");
const mitad=P.cotejarPlan(plan,reports,"2026-11-12"); assert.equal(mitad.terminada,false); assert.equal(mitad.filas[1].estado,"en_riesgo");
const lun=P.cotejarPlan(plan,reports,"2026-11-09"); assert.equal(lun.filas[1].estado,"por_iniciar");
const prev={project:"X",semana:"2026-11-02",estado:"enviado",actividades:[{actividad:"Reemplazo de material",meta:10,unidad:"m³"}]};
const r=P.revisarPlan({...plan,actividades:[{actividad:"Excavación mecánica",meta:500,unidad:"m³"}]},reports,prev,"2026-11-09");
assert(r.avisos.some(x=>x.texto.includes("supera"))); assert(r.avisos.some(x=>x.texto.includes("Reemplazo de material"))); assert.equal(r.adecuado,false);
const al=P.alertasPlanes([plan],reports,[{project:"X",plan_semanal:true},{project:"Citrino",plan_semanal:false}],null,"2026-11-12");
assert.equal(al.length,1); assert.equal(al[0].entrega.estado,"enviado");
console.log("OK todas");
