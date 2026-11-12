// Catálogos fijos — SPEC.md §6 y §7.

export const SISTEMAS = [
  'Motor',
  'Enfriamiento',
  'Combustible',
  'Aire acondicionado',
  'Dirección',
  'Suspensión',
  'Tren delantero',
  'Frenos',
  'Eléctrico',
  'Cauchos',
  'Carrocería',
  'Otros',
] as const

export const TIPOS_ITEM = [
  { valor: 'repuesto', texto: 'Repuesto' },
  { valor: 'servicio', texto: 'Servicio' },
  { valor: 'mano_obra', texto: 'Mano de obra' },
] as const

export const TIPOS_PRODUCTO = [
  'Aceite de motor',
  'Filtro de aceite',
  'Filtro de aire',
  'Refrigerante',
  'Líquido de frenos',
  'ATF',
  'Aceite de dirección',
  'Bujías',
  'Batería',
  'Otro',
] as const

export const CHECKLIST_SEMANAL = [
  'Nivel de aceite del motor',
  'Refrigerante',
  'Líquido de frenos',
  'Aceite de dirección',
  'Agua del limpiaparabrisas',
  'Fugas visibles',
  'Estado de las correas',
  'Luces',
] as const

export type Fuente = 'Manual' | 'Usuario' | 'Sugerido'

interface PlantillaTarea {
  clave: string
  nombre: string
  sistema: (typeof SISTEMAS)[number]
  intervalo_km: number | null
  intervalo_dias: number | null
  es_revision: boolean
  fuente: Fuente
  notas: string
  soloAutomatico?: boolean
}

const MES = 182 / 6
const ANIO = 365

/**
 * Tareas que se precargan al crear un vehículo (todas editables). Valores de
 * referencia para condiciones severas; los marcados "Manual" los confirma el
 * usuario con su manual del propietario.
 */
export const PLANTILLA_TAREAS: PlantillaTarea[] = [
  { clave: 'aceite_motor', nombre: 'Aceite de motor + filtro', sistema: 'Motor', intervalo_km: 6000, intervalo_dias: Math.round(6 * MES), es_revision: false, fuente: 'Manual', notas: '' },
  { clave: 'revision_semanal', nombre: 'Revisión semanal del capó', sistema: 'Otros', intervalo_km: null, intervalo_dias: 7, es_revision: true, fuente: 'Usuario', notas: 'Incluye el aceite de dirección.' },
  { clave: 'presion_cauchos', nombre: 'Presión de cauchos', sistema: 'Cauchos', intervalo_km: null, intervalo_dias: 14, es_revision: true, fuente: 'Usuario', notas: '' },
  { clave: 'rotacion', nombre: 'Rotación de cauchos', sistema: 'Cauchos', intervalo_km: 8000, intervalo_dias: null, es_revision: false, fuente: 'Usuario', notas: '' },
  { clave: 'balanceo', nombre: 'Balanceo', sistema: 'Cauchos', intervalo_km: 8000, intervalo_dias: null, es_revision: false, fuente: 'Usuario', notas: '' },
  { clave: 'alineacion', nombre: 'Alineación', sistema: 'Tren delantero', intervalo_km: null, intervalo_dias: ANIO, es_revision: false, fuente: 'Sugerido', notas: 'O después de trabajos de suspensión.' },
  { clave: 'bateria', nombre: 'Revisión de batería y alternador', sistema: 'Eléctrico', intervalo_km: null, intervalo_dias: Math.round(6 * MES), es_revision: true, fuente: 'Sugerido', notas: '' },
  { clave: 'filtro_aire', nombre: 'Filtro de aire', sistema: 'Motor', intervalo_km: 24000, intervalo_dias: null, es_revision: false, fuente: 'Manual', notas: '' },
  { clave: 'bujias', nombre: 'Bujías', sistema: 'Motor', intervalo_km: 48000, intervalo_dias: null, es_revision: false, fuente: 'Manual', notas: '' },
  { clave: 'correa_tiempo', nombre: 'Correa de tiempo + bomba de agua', sistema: 'Motor', intervalo_km: 96000, intervalo_dias: 7 * ANIO, es_revision: false, fuente: 'Manual', notas: '' },
  { clave: 'valvulas', nombre: 'Ajuste de válvulas', sistema: 'Motor', intervalo_km: 48000, intervalo_dias: null, es_revision: false, fuente: 'Manual', notas: '' },
  { clave: 'refrigerante', nombre: 'Refrigerante (cambio)', sistema: 'Motor', intervalo_km: 48000, intervalo_dias: 2 * ANIO, es_revision: false, fuente: 'Manual', notas: '' },
  { clave: 'liquido_frenos', nombre: 'Líquido de frenos (cambio)', sistema: 'Frenos', intervalo_km: null, intervalo_dias: 3 * ANIO, es_revision: false, fuente: 'Manual', notas: '' },
  { clave: 'atf', nombre: 'Aceite de transmisión automática (ATF)', sistema: 'Motor', intervalo_km: 48000, intervalo_dias: 2 * ANIO, es_revision: false, fuente: 'Manual', notas: '', soloAutomatico: true },
  { clave: 'frenos_revision', nombre: 'Revisión de pastillas y discos', sistema: 'Frenos', intervalo_km: 12000, intervalo_dias: null, es_revision: true, fuente: 'Sugerido', notas: '' },
  { clave: 'correa_accesorios', nombre: 'Correa de accesorios (revisión)', sistema: 'Motor', intervalo_km: 24000, intervalo_dias: ANIO, es_revision: true, fuente: 'Sugerido', notas: '' },
]
