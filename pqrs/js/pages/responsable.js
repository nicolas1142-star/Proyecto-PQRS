import { listarAsignadasAMi, verSolicitudAsignada } from '../services/pqrsService.js';
import { protegerPagina, pintarBarra } from '../utils/guard.js';
import { pintarHistorial } from '../utils/historial.js';
import { pintarAsignacion } from '../utils/asignacion.js';
import { el } from '../utils/dom.js';
import { ROLES } from '../config.js';

pintarBarra();
const sesion = protegerPagina([ROLES.RESPONSABLE]);
if (sesion) iniciar(sesion);

const ORDEN = { Alta: 0, Media: 1, Baja: 2 };

function iniciar(sesion) {
  document.getElementById('area').textContent = `Área: ${sesion.area ?? '—'}`;
  const lista = document.getElementById('lista');
  const detalle = document.getElementById('detalle');

  // Los más urgentes primero: prioridad y luego fecha límite
  const items = listarAsignadasAMi().sort((a, b) =>
    ORDEN[a.asignacion.prioridad] - ORDEN[b.asignacion.prioridad] || a.asignacion.fechaLimite.localeCompare(b.asignacion.fechaLimite));

  if (!items.length) {
    lista.replaceChildren(el('p', {}, 'No tienes casos asignados.'));
    return;
  }
  lista.replaceChildren(el('table', {},
    el('thead', {}, el('tr', {}, ...['Radicado', 'Tipo', 'Prioridad', 'Fecha límite', 'Estado', ''].map((t) => el('th', {}, t)))),
    el('tbody', {}, ...items.map((p) => el('tr', {},
      el('td', {}, p.radicado),
      el('td', {}, p.tipo),
      el('td', {}, p.asignacion.prioridad),
      el('td', {}, new Date(p.asignacion.fechaLimite).toLocaleDateString('es-CO')),
      el('td', {}, p.estado),
      el('td', {}, el('button', { type: 'button', class: 'btn-chico', onclick: () => abrir(p.radicado) }, 'Revisar'))
    )))
  ));

  function abrir(radicado) {
    let p;
    try { p = verSolicitudAsignada(radicado); }   // vuelve a comprobar que sea suya
    catch (err) {
      detalle.hidden = false;
      detalle.replaceChildren(el('p', { class: 'alert alert-error', role: 'alert' }, err.message));
      return;
    }
    const evidencias = p.evidencias?.length
      ? p.evidencias.map((ev) => el('a', { href: ev.data, download: ev.nombre }, ev.nombre))
      : ['Sin evidencias'];
    detalle.hidden = false;
    detalle.replaceChildren(
      el('h2', {}, p.radicado),
      el('p', {}, el('strong', {}, 'Estado: '), p.estado, ' · ', el('strong', {}, 'Tipo: '), p.tipo),
      pintarAsignacion(p),
      el('p', {}, el('strong', {}, 'Solicitante: '), `${p.nombre} (${p.email})`),
      el('p', {}, el('strong', {}, 'Descripción:')),
      el('p', { class: 'respuesta' }, p.descripcion),
      el('p', {}, el('strong', {}, 'Evidencias: '), ...evidencias.flatMap((x, i) => (i ? [' · ', x] : [x]))),
      pintarHistorial(p.historial)
    );
    detalle.scrollIntoView({ behavior: 'smooth' });
  }
}
