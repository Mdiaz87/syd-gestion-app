import { ITEMS_PREOP, ITEMS_OP, TRAMITES } from "./constants.js";

export const fmt = n => n ? new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(+n) : "-";

export function getMondayStr(){
  const d=new Date();
  const day=d.getDay();
  const diff=day===0?-6:1-day;
  const m=new Date(d);
  m.setDate(d.getDate()+diff);
  return m.toISOString().slice(0,10);
}

export function semaforo(avObra,avRec,actP,actE,presup,ejec){
  let f=[];
  if(presup&&ejec){const r=ejec/presup;f.push(r>1.05?"rojo":r>0.95?"verde":"amarillo");}
  if(actP&&actE!==undefined){const c=actE/actP;f.push(c>=0.9?"verde":c>=0.7?"amarillo":"rojo");}
  const ef=(avObra||0)-(avRec||0);
  if(ef>5)f.push("verde");else if(ef<-5)f.push("rojo");
  if(f.includes("rojo"))return"rojo";if(f.includes("amarillo"))return"amarillo";return"verde";
}

export function exportarJSON(reports){
  const fecha = new Date().toISOString().slice(0,10);
  const data = {
    exportado: new Date().toISOString(),
    totalInformes: reports.length,
    informes: reports
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SYD_Informes_${fecha}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function puedeGestionar(report,usuario){
  return usuario?.rol==="Directivo" || report.author===usuario?.nombre;
}

export const emptyAct = () => ({id:Date.now()+Math.random(),actividad:"",actividadOtro:"",equipo:"",equipoOtro:"",personal:"",personalOtro:"",cantidad:"",unidad:"m³",unidadOtro:"",etapa:"Etapa 1",observaciones:""});
export const emptyDay=()=>({id:Date.now()+Math.random(),date:"",climaPrincipal:"Soleado",inicioJornada:"7:30",finJornada:"16:30",activities:[emptyAct()],novelties:"",photos:[]});
export const emptyGasto=()=>({id:Date.now()+Math.random(),proveedor:"",estado:"Aprobado",descripcion:"",valor:"",centroCosto:""});
export const emptyFrente=(nombre)=>({id:Date.now()+Math.random(),nombre:nombre||"Otro",descripcion:"",gastos:[emptyGasto()],photos:[],lotesData:null});
export const emptyFinanciero=()=>[
  ...ITEMS_PREOP.map(item=>({item,presupuesto:"",ejecutado:"",fase:"pre_operativa"})),
  ...ITEMS_OP.map(item=>({item,presupuesto:"",ejecutado:"",fase:"operativa"})),
];
export const emptyTramite=()=>TRAMITES.map(t=>({tramite:t,pct:""}));
