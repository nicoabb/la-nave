const CLAVES_CAUCHOS = new Set(['presion_cauchos', 'rotacion', 'balanceo', 'alineacion'])

/** Adónde ir para marcar una tarea periódica como hecha. */
export function rutaParaHacer(t: { id: string; clave: string | null; es_revision: boolean }): string {
  if (t.clave && CLAVES_CAUCHOS.has(t.clave)) return '/taller/cauchos'
  return t.es_revision ? `/revision/${t.id}` : `/taller/visita/nueva?tarea=${t.id}`
}
