import { el } from './dom.js';

// Muestra responsable, área, prioridad y fecha límite de una solicitud.
export function pintarAsignacion(p) {
  const a = p.asignacion;
  if (!a) return el('p', {}, el('strong', {}, 'Asignación: '), 'Sin asignar');
  const abierta = !['Respondida', 'Cerrada'].includes(p.estado);
  const vencida = abierta && new Date(a.fechaLimite) < new Date();
  return el('div', {},
    el('p', {}, el('strong', {}, 'Responsable: '), a.responsableNombre, ' · ', el('strong', {}, 'Área: '), a.area),
    el('p', {}, el('strong', {}, 'Prioridad: '), a.prioridad, ' · ', el('strong', {}, 'Fecha límite: '),
      new Date(a.fechaLimite).toLocaleDateString('es-CO'), vencida ? ' (VENCIDA)' : ''));
}
