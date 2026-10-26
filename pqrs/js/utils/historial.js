import { el } from './dom.js';

// Dibuja el registro de gestión de una solicitud.
export function pintarHistorial(historial = []) {
  return el('div', {},
    el('h3', {}, 'Historial de gestión'),
    historial.length
      ? el('ul', {}, ...historial.map((h) => el('li', {},
          `${new Date(h.fecha).toLocaleString('es-CO')} — ${h.usuario} (${h.rol}): ${h.accion}${h.detalle ? ' — ' + h.detalle : ''}`)))
      : el('p', {}, 'Sin movimientos.'));
}
