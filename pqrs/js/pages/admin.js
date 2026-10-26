import { listarTodas, actualizarSolicitud } from '../services/pqrsService.js';
import { protegerPagina, pintarBarra } from '../utils/guard.js';
import { el } from '../utils/dom.js';
import { pintarHistorial } from '../utils/historial.js';
import { pintarAsignacion } from '../utils/asignacion.js';
import { ROLES, ESTADOS } from '../config.js';

pintarBarra();
if (protegerPagina([ROLES.ADMIN])) iniciar();

function iniciar() {
  const lista = document.getElementById('lista');
  const detalle = document.getElementById('detalle');
  const filtro = document.getElementById('filtro');
  ESTADOS.forEach((e) => filtro.append(el('option', { value: e }, e)));
  filtro.addEventListener('change', pintarTabla);
  pintarTabla();

  function pintarTabla() {
    const items = listarTodas().filter((p) => !filtro.value || p.estado === filtro.value).reverse();
    if (items.length === 0) {
      lista.replaceChildren(el('p', {}, 'No hay solicitudes.'));
      return;
    }
    lista.replaceChildren(el('table', {},
      el('thead', {}, el('tr', {}, ...['Radicado', 'Tipo', 'Solicitante', 'Estado', 'Fecha', '']
        .map((t) => el('th', {}, t)))),
      el('tbody', {}, ...items.map((p) => el('tr', {},
        el('td', {}, p.radicado),
        el('td', {}, p.tipo),
        el('td', {}, p.nombre),
        el('td', {}, el('span', { class: `badge badge-${p.estado.replace(' ', '-')}` }, p.estado)),
        el('td', {}, new Date(p.fechaRegistro).toLocaleDateString('es-CO')),
        el('td', {}, el('button', { type: 'button', class: 'btn-chico', onclick: () => abrir(p) }, 'Gestionar'))
      )))
    ));
  }

  function abrir(p) {
    const estado = el('select', { id: 'g-estado' }, ...ESTADOS.map((e) => {
      const o = el('option', { value: e }, e);
      if (e === p.estado) o.selected = true;
      return o;
    }));
    const respuesta = el('textarea', { id: 'g-resp', rows: '4' });
    respuesta.value = p.respuesta ?? '';
    const msg = el('p', { role: 'alert' });

    const evidencias = p.evidencias.length
      ? p.evidencias.map((ev) => el('a', { href: ev.data, download: ev.nombre }, ev.nombre))
      : ['Sin evidencias'];

    detalle.hidden = false;
    detalle.replaceChildren(
      el('h2', {}, p.radicado),
      el('p', {}, el('strong', {}, 'Solicitante: '), `${p.nombre} (${p.email})`),
      el('p', {}, el('strong', {}, 'Tipo: '), p.tipo),
      el('p', {}, el('strong', {}, 'Descripción:')),
      el('p', { class: 'respuesta' }, p.descripcion),
      el('p', {}, el('strong', {}, 'Validación: '), p.estadoValidacion ?? 'Pendiente'),
      pintarAsignacion(p),
      el('p', {}, el('strong', {}, 'Evidencias: '), ...evidencias.flatMap((x, i) => (i ? [' · ', x] : [x]))),
      pintarHistorial(p.historial),
      el('label', { for: 'g-estado' }, 'Estado'), estado,
      el('label', { for: 'g-resp' }, 'Respuesta al ciudadano'), respuesta,
      el('button', { type: 'button', onclick: () => {
        try {
          actualizarSolicitud(p.radicado, { estado: estado.value, respuesta: respuesta.value });
          pintarTabla();
          msg.className = 'exito';
          msg.textContent = 'Cambios guardados.';
        } catch (err) {
          msg.className = 'error';
          msg.textContent = err.message;
        }
      } }, 'Guardar cambios'),
      msg
    );
    detalle.scrollIntoView({ behavior: 'smooth' });
  }
}
