import { listarSolicitudesAnalista, validarSolicitud, asignarSolicitud } from '../services/pqrsService.js';
import { listarResponsables } from '../services/authService.js';
import { protegerPagina, pintarBarra } from '../utils/guard.js';
import { validarCompletitud } from '../utils/validators.js';
import { pintarHistorial } from '../utils/historial.js';
import { pintarAsignacion } from '../utils/asignacion.js';
import { el } from '../utils/dom.js';
import { ROLES, TIPOS, AREAS, PRIORIDADES } from '../config.js';

pintarBarra();
if (protegerPagina([ROLES.ANALISTA])) iniciar();

const validacionDe = (p) => p.estadoValidacion ?? 'Pendiente';
const opcion = (valor, seleccionado, texto = valor) => {
  const o = el('option', { value: valor }, texto);
  if (valor === seleccionado) o.selected = true;
  return o;
};
const coincide = (p, f) => {
  if (!f) return true;
  if (f === 'PorAsignar') return validacionDe(p) === 'Validada' && p.estado === 'En revisión';
  if (f === 'Asignada') return p.estado === 'Asignada';
  return validacionDe(p) === f;
};

function iniciar() {
  const lista = document.getElementById('lista');
  const detalle = document.getElementById('detalle');
  const filtro = document.getElementById('filtro');
  let items = [];

  filtro.addEventListener('change', pintarTabla);
  cargar();

  function cargar() {
    items = listarSolicitudesAnalista();
    pintarTabla();
  }

  function pintarTabla() {
    const visibles = items.filter((p) => coincide(p, filtro.value)).reverse();
    if (!visibles.length) {
      lista.replaceChildren(el('p', {}, 'No hay solicitudes en esta vista.'));
      return;
    }
    lista.replaceChildren(el('table', {},
      el('thead', {}, el('tr', {}, ...['Radicado', 'Tipo', 'Solicitante', 'Validación', 'Estado', 'Prioridad', 'Fecha', ''].map((t) => el('th', {}, t)))),
      el('tbody', {}, ...visibles.map((p) => el('tr', {},
        el('td', {}, p.radicado),
        el('td', {}, p.tipo ?? '—'),
        el('td', {}, p.nombre),
        el('td', {}, el('span', { class: 'badge' }, validacionDe(p))),
        el('td', {}, p.estado),
        el('td', {}, p.asignacion?.prioridad ?? '—'),
        el('td', {}, new Date(p.fechaRegistro).toLocaleDateString('es-CO')),
        el('td', {}, el('button', { type: 'button', class: 'btn-chico', onclick: () => abrir(p) }, 'Revisar'))
      )))
    ));
  }

  // ---- Formulario de validación y clasificación ----
  function formValidacion(p, msg) {
    const sel = el('select', { id: 'a-tipo' }, ...TIPOS.map((t) => opcion(t, p.tipo)));
    const obs = el('textarea', { id: 'a-obs', rows: '3' });
    return [
      el('label', { for: 'a-tipo' }, 'Clasificar como'), sel,
      el('label', { for: 'a-obs' }, 'Observaciones (opcional)'), obs,
      el('button', { type: 'button', onclick: () => {
        try {
          const r = validarSolicitud(p.radicado, { tipo: sel.value, observaciones: obs.value });
          cargar();
          abrir(items.find((x) => x.radicado === r.radicado), r.estadoValidacion === 'Validada'
            ? `Solicitud validada y clasificada como ${r.tipo}. Pasó a "En revisión".`
            : `Solicitud incompleta. No avanza. Faltan: ${r.faltantes.join(', ')}.`,
            r.estadoValidacion !== 'Validada');
        } catch (err) { msg.className = 'error'; msg.textContent = err.message; }
      } }, 'Validar y clasificar'),
    ];
  }

  // ---- Formulario de asignación: responsable, área y prioridad ----
  function formAsignacion(p, msg) {
    const a = p.asignacion;
    const selArea = el('select', { id: 's-area' }, el('option', { value: '' }, 'Selecciona un área'), ...AREAS.map((x) => opcion(x, a?.area)));
    const selResp = el('select', { id: 's-resp' });
    const selPri = el('select', { id: 's-pri' }, el('option', { value: '' }, 'Selecciona una prioridad'), ...PRIORIDADES.map((x) => opcion(x, a?.prioridad)));

    const cargarResponsables = () => {
      const rs = selArea.value ? listarResponsables(selArea.value) : [];
      selResp.replaceChildren(el('option', { value: '' }, 'Selecciona un responsable'), ...rs.map((r) => opcion(r.id, a?.responsableId, r.nombre)));
    };
    selArea.addEventListener('change', cargarResponsables);
    cargarResponsables();

    return [
      el('h3', {}, a ? 'Reasignar o cambiar prioridad' : 'Asignar solicitud'),
      el('label', { for: 's-area' }, 'Área encargada'), selArea,
      el('label', { for: 's-resp' }, 'Responsable'), selResp,
      el('label', { for: 's-pri' }, 'Prioridad'), selPri,
      el('button', { type: 'button', onclick: () => {
        try {
          const r = asignarSolicitud(p.radicado, { responsableId: selResp.value, area: selArea.value, prioridad: selPri.value });
          cargar();
          abrir(items.find((x) => x.radicado === r.radicado),
            `Asignada a ${r.asignacion.responsableNombre}. Vence el ${new Date(r.asignacion.fechaLimite).toLocaleDateString('es-CO')}.`);
        } catch (err) { msg.className = 'error'; msg.textContent = err.message; }
      } }, 'Guardar asignación'),
    ];
  }

  function abrir(p, mensaje, esError = false) {
    const faltantes = validarCompletitud(p);
    const msg = el('p', { role: 'alert', class: mensaje ? (esError ? 'error' : 'exito') : '' }, mensaje ?? '');
    const evidencias = p.evidencias?.length
      ? p.evidencias.map((ev) => el('a', { href: ev.data, download: ev.nombre }, ev.nombre))
      : ['Sin evidencias'];

    const bloques = [];
    if (validacionDe(p) !== 'Validada') bloques.push(...formValidacion(p, msg));
    else if (['En revisión', 'Asignada'].includes(p.estado)) bloques.push(...formAsignacion(p, msg));

    detalle.hidden = false;
    detalle.replaceChildren(
      el('h2', {}, p.radicado),
      el('p', {}, el('strong', {}, 'Validación: '), validacionDe(p), ' · ', el('strong', {}, 'Estado: '), p.estado),
      faltantes.length
        ? el('p', { class: 'error' }, 'Datos obligatorios faltantes: ' + faltantes.join(', '))
        : el('p', { class: 'exito' }, 'Todos los datos obligatorios están completos.'),
      pintarAsignacion(p),
      el('p', {}, el('strong', {}, 'Solicitante: '), `${p.nombre ?? '—'} (${p.email ?? '—'})`),
      el('p', {}, el('strong', {}, 'Tipo registrado: '), p.tipo ?? '—'),
      el('p', {}, el('strong', {}, 'Descripción:')),
      el('p', { class: 'respuesta' }, p.descripcion ?? ''),
      el('p', {}, el('strong', {}, 'Evidencias: '), ...evidencias.flatMap((x, i) => (i ? [' · ', x] : [x]))),
      pintarHistorial(p.historial),
      ...bloques,
      msg
    );
    detalle.scrollIntoView({ behavior: 'smooth' });
  }
}
