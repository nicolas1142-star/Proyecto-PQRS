import { listarMisSolicitudes } from '../services/pqrsService.js';
import { protegerPagina, pintarBarra } from '../utils/guard.js';
import { el } from '../utils/dom.js';
import { ROLES } from '../config.js';

pintarBarra();
if (protegerPagina([ROLES.USUARIO])) {
  const items = listarMisSolicitudes().reverse();
  const lista = document.getElementById('lista');

  if (items.length === 0) {
    lista.replaceChildren(el('p', {}, 'Aún no has registrado solicitudes.'));
  } else {
    lista.replaceChildren(el('table', {},
      el('thead', {}, el('tr', {}, ...['Radicado', 'Tipo', 'Estado', 'Fecha', 'Respuesta']
        .map((t) => el('th', {}, t)))),
      el('tbody', {}, ...items.map((p) => el('tr', {},
        el('td', {}, p.radicado),
        el('td', {}, p.tipo),
        el('td', {}, el('span', { class: `badge badge-${p.estado.replace(' ', '-')}` }, p.estado)),
        el('td', {}, new Date(p.fechaRegistro).toLocaleDateString('es-CO')),
        el('td', {}, p.respuesta ?? 'Pendiente')
      )))
    ));
  }
}
