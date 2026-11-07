import assert from "node:assert";
import { controlPresupuesto, hojas, codigos, mesesEntre } from "../src/lib/controlPresupuesto.js";
assert.deepEqual(mesesEntre("2026-11-09","2027-02-01"),["2026-11","2026-12","2027-01","2027-02"]);
const P=[{id:"a",linaje:"LA",fase:"operativa",padre_id:null,nombre:"Vías"},{id:"s1",linaje:"L1",fase:"operativa",padre_id:"a",cantidad:10,precio_unitario:100,fecha_inicio:"2026-11-01",fecha_fin:"2026-11-30"},
 {id:"s2",linaje:"L2",fase:"operativa",padre_id:"a",cantidad:1,precio_unitario:3000,fecha_inicio:"2026-12-01",fecha_fin:"2027-01-31"},{id:"b",linaje:"LB",fase:"pre_operativa",padre_id:null,cantidad:1,precio_unitario:500}];
assert.deepEqual(hojas(P).map(p=>p.id),["s1","s2","b"]); assert.equal(codigos(P).s2,"1.2"); assert.equal(codigos(P).b,"PO1");
const pagada={partida_linaje:"L1",estado:"aprobado_total",pago_realizado:true,valor:950,historial:[{accion:"Marcado como pagado",fecha:"2026-11-20T15:00:00Z"}]};
const sinPagar={partida_linaje:"L1",estado:"aprobado_total",pago_realizado:false,valor:100};
const tramite={partida_linaje:"L2",estado:"pendiente_contable",valor:700,valor_final_pagar:650};
const c=controlPresupuesto({fecha_inicio:"2026-11-01",fecha_fin:"2027-01-31"},P,[pagada,sinPagar,tramite,{partida_linaje:"OTRO",estado:"aprobado_total",pago_realizado:true,valor:1}],[{linaje:"L2",mes:"2026-12-01",valor:200}],"2026-11-30");
const f1=c.filas.find(f=>f.partida.id==="s1"), f2=c.filas.find(f=>f.partida.id==="s2");
assert.equal(f1.pagado,950); assert.equal(f1.comprometido,100); assert.equal(f1.alerta,"sobrecosto"); assert.equal(Math.round(f1.proyectadoHoy),1000);
assert.equal(f2.tramite,650); assert.equal(f2.manual,200); assert.equal(f2.ejecutado,200);
assert.equal(c.total,4500); assert.equal(c.ejecutado,1150); assert.equal(c.mensual.find(m=>m.mes==="2026-11").real,950);
assert.equal(c.mensual.find(m=>m.mes==="2027-01").realAcum,null);
console.log("OK control presupuesto");
