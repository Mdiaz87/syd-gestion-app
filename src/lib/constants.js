// ── PALETA ────────────────────────────────────────────────────────────────────
export const C = {
  blue:    "#1b3a6b",
  yellow:  "#f5c400",
  green:   "#3aaa6e",
  blueMid: "#2d5fa6",
  bg:      "#f4f6f9",
  bgCard:  "#ffffff",
  bgCard2: "#f0f3f8",
  border:  "#dde3ee",
  text:    "#1a2540",
  muted:   "#7a90b0",
  danger:  "#e05252",
  warn:    "#f5a623",
};

export const INP = {background:C.bgCard2,border:`1px solid ${C.border}`,color:C.text,borderRadius:8,padding:"8px 10px",width:"100%",fontSize:13,boxSizing:"border-box"};
export const BTN_SM = {background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12};
export const SEM_COLOR = {verde:C.green,amarillo:C.warn,rojo:C.danger};
export const SEM_LABEL = {verde:"✅ En control",amarillo:"⚠️ Alerta",rojo:"🔴 Crítico"};

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
export const PROJECTS = ["Citrino","Vivante Parque Residencial","Aqqua Club","Aqqua 4","Atalí Conjunto Campestre","Brisas del Lago 1","Brisas del Lago 2","Brisas de Baranoa","Vivante Norte"];
export const TEAM = {
  "Citrino":["Ósmar Álvarez","Ivan Pérez"],
  "Vivante Parque Residencial":["Felipe Zuluaga"],
  "Aqqua Club":["Rafael Espinosa","Ivan Pérez"],
  "Aqqua 4":["Rafael Espinosa","Ivan Pérez","Oscar Solano"],
  "Atalí Conjunto Campestre":["Mary Sierra"],
  "Brisas del Lago 1":["Jorge Cañate","Camilo","Jorge Torres"],
  "Brisas del Lago 2":["Jorge Cañate","Camilo","Jorge Torres"],
  "Brisas de Baranoa":["Germán Mercado"],
  "Vivante Norte":["Carmelo","Rafael Espinosa","Ivan Pérez"],
};
export const MACHINES = ["Minicargador","Guadaña","Tractor","Retroexcavadora","Cargador","Pajarita","Motobomba","Motoniveladora","Marmara","Motocarro","Volqueta Sencilla","Volqueta Doble Troque","Grúa","Bulldozer","Motosierra","Planta Eléctrica"];
export const CLIMA_OPTS = ["Soleado","Nublado","Lluvia","Parcialmente Nublado"];
export const ACTIVIDADES_CATALOGO = ["Limpieza de vías","Limpieza zona puente","Limpieza general","Movimiento de tierra","Conformación de subrasante","Excavación mecánica","Relleno y compactación","Corte y nivelación","Reemplazo de material","Adecuación zona puente","Compactación de vía principal","Recepción de zahorra","Construcción de bordillos","Estabilización química","Riego y corte de terreno","Transporte de material interno","Otro"];
export const UNIDADES = ["m³","m²","ml","horas","viajes","días","und","Otro"];
export const OPERADORES_OPTS = ["1 Operador","2 Operadores","3 Operadores","4 Operadores","5 Operadores","Otro"];
export const ETAPAS = ["Etapa 1","Etapa 2","Etapa 3","Etapa 4","General"];
export const ROLES = ["Coordinador","Ingeniero","Directivo"];
export const ESTADO_OPTS = ["Aprobado","Pendiente","Rechazado"];
export const ITEMS_PREOP=["Limpieza y descapote","Levantamiento topográfico","Estudios ambientales","Estudio hidrológico y diseño hidráulico","Diseño arquitectónico","Diseño eléctrico","Diseño de vías"];
export const ITEMS_OP=["Sistema Vial","Estructuras Hidráulicas","Red de Distribución de Agua","Red Eléctrica","Zonas Sociales","Movimiento de tierras","Drenaje de aguas lluvias","Portería"];
export const DAY_NAMES = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
export const TRAMITES = ["Ocupación de Cauce","RCD","Prospección y Exploración de Aguas Subterráneas","Concesión de Aguas Subterráneas"];

export const FRENTES_MASTER = [
  "Sistema Vial","Vías Externas","Movimiento de Tierras / Relleno y Corte","Limpieza y Descapote / Mantenimiento",
  "Redes de Agua","Red Eléctrica / Acometidas","Red de Gas Natural","Estructuras Hidráulicas / Bordillos",
  "Drenaje de Aguas Fluviales","Puente / Box Culvert","Portería / Garita","Zonas Sociales","Casa Modelo",
  "Casa Amatista","Entrega de Lotes","Estabilización Química","Levantamiento Topográfico","Estudios Ambientales",
  "Estudio Hidrológico y Diseño Hidráulico","Diseño Arquitectónico","Diseño Eléctrico","Diseño de Vías","Pre-lanzamiento","Otro"
];

export const FRENTES_POR_PROYECTO = {
  "Citrino": [
    "Sistema Vial","Movimiento de Tierras / Relleno y Corte","Limpieza y Descapote / Mantenimiento",
    "Red Eléctrica / Acometidas","Estructuras Hidráulicas / Bordillos","Drenaje de Aguas Fluviales",
    "Zonas Sociales","Portería / Garita","Entrega de Lotes","Levantamiento Topográfico","Estudios Ambientales",
    "Estudio Hidrológico y Diseño Hidráulico","Diseño Arquitectónico","Diseño Eléctrico","Diseño de Vías","Pre-lanzamiento"
  ],
  "Vivante Parque Residencial": [
    "Sistema Vial","Vías Externas","Limpieza y Descapote / Mantenimiento",
    "Redes de Agua","Red Eléctrica / Acometidas","Red de Gas Natural",
    "Estructuras Hidráulicas / Bordillos","Portería / Garita","Zonas Sociales",
    "Casa Modelo","Casa Amatista","Entrega de Lotes","Estudios Ambientales"
  ],
  "Aqqua Club": [
    "Sistema Vial","Movimiento de Tierras / Relleno y Corte","Limpieza y Descapote / Mantenimiento",
    "Redes de Agua","Red Eléctrica / Acometidas","Estructuras Hidráulicas / Bordillos",
    "Drenaje de Aguas Fluviales","Puente / Box Culvert","Portería / Garita","Zonas Sociales","Entrega de Lotes",
    "Levantamiento Topográfico","Estudios Ambientales","Estudio Hidrológico y Diseño Hidráulico",
    "Diseño Arquitectónico","Diseño Eléctrico","Diseño de Vías"
  ],
  "Atalí Conjunto Campestre": [
    "Sistema Vial","Movimiento de Tierras / Relleno y Corte","Limpieza y Descapote / Mantenimiento",
    "Redes de Agua","Red Eléctrica / Acometidas","Estructuras Hidráulicas / Bordillos",
    "Zonas Sociales","Portería / Garita","Entrega de Lotes","Levantamiento Topográfico"
  ],
  "Brisas del Lago 1": [
    "Sistema Vial","Limpieza y Descapote / Mantenimiento","Estructuras Hidráulicas / Bordillos",
    "Zonas Sociales","Entrega de Lotes","Estabilización Química","Levantamiento Topográfico"
  ],
  "Brisas del Lago 2": [
    "Sistema Vial","Limpieza y Descapote / Mantenimiento","Estructuras Hidráulicas / Bordillos",
    "Zonas Sociales","Entrega de Lotes","Estabilización Química","Levantamiento Topográfico"
  ],
  "Brisas de Baranoa": [
    "Sistema Vial","Movimiento de Tierras / Relleno y Corte","Limpieza y Descapote / Mantenimiento",
    "Redes de Agua","Red Eléctrica / Acometidas","Estructuras Hidráulicas / Bordillos","Entrega de Lotes",
    "Levantamiento Topográfico"
  ],
  "Aqqua 4": [
    "Sistema Vial","Movimiento de Tierras / Relleno y Corte","Limpieza y Descapote / Mantenimiento",
    "Redes de Agua","Red Eléctrica / Acometidas","Estructuras Hidráulicas / Bordillos",
    "Drenaje de Aguas Fluviales","Puente / Box Culvert","Portería / Garita","Zonas Sociales","Entrega de Lotes",
    "Levantamiento Topográfico","Estudios Ambientales","Estudio Hidrológico y Diseño Hidráulico",
    "Diseño Arquitectónico","Diseño Eléctrico","Diseño de Vías"
  ],
  "Vivante Norte": [
    "Sistema Vial","Vías Externas","Limpieza y Descapote / Mantenimiento",
    "Redes de Agua","Red Eléctrica / Acometidas","Red de Gas Natural",
    "Estructuras Hidráulicas / Bordillos","Portería / Garita","Zonas Sociales",
    "Casa Modelo","Entrega de Lotes","Estudios Ambientales"
  ],
};
