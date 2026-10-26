import * as repo from './pqrsRepository.js';
import { exigirRol, usuarioPorId } from './authService.js';
import { generarRadicado, normalizarRadicado } from '../utils/radicado.js';
import { validarCompletitud } from '../utils/validators.js';
import { sumarDiasHabiles } from '../utils/fechas.js';
import { ROLES, ESTADOS, TIPOS, AREAS, PRIORIDADES, DIAS_LIMITE } from '../config.js';

const leerArchivo = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ nombre: file.name, tipo: file.type, data: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// Un movimiento del historial de gestión
const evento = (sesion, accion, detalle = '') => ({
  fecha: new Date().toISOString(), usuario: sesion.nombre, rol: sesion.rol, accion, detalle,
});

// PERMISO: solo rol "usuario"
export async function registrarPqrs(datos, archivos = []) {
  const sesion = exigirRol(ROLES.USUARIO);
  const evidencias = await Promise.all(archivos.map(leerArchivo));
  const radicado = generarRadicado(repo.siguienteConsecutivo());

  repo.guardar({
    radicado,
    tipo: datos.tipo,
    nombre: datos.nombre,
    email: datos.email,
    descripcion: datos.descripcion,
    usuarioId: sesion.id,
    evidencias,
    estado: 'Radicada',
    estadoValidacion: 'Pendiente',
    respuesta: null,
    fechaRegistro: new Date().toISOString(),
    historial: [evento(sesion, 'Solicitud radicada')],
  });
  return { radicado };
}

// PÚBLICO: sin autenticación. Devuelve SOLO datos públicos y el nombre enmascarado.
export function consultarEstado(radicadoIngresado) {
  const pqrs = repo.buscarPorRadicado(normalizarRadicado(radicadoIngresado));
  if (!pqrs) return null;
  return {
    radicado: pqrs.radicado,
    nombre: enmascararNombre(pqrs.nombre),
    tipo: pqrs.tipo,
    estado: pqrs.estado,
    fechaRegistro: pqrs.fechaRegistro,
    respuesta: pqrs.respuesta,
  };
}

// PERMISO: rol "usuario". Solo ve SUS solicitudes.
export function listarMisSolicitudes() {
  const sesion = exigirRol(ROLES.USUARIO);
  return repo.listar()
    .filter((p) => p.usuarioId === sesion.id)
    .map(({ radicado, tipo, estado, fechaRegistro, respuesta }) =>
      ({ radicado, tipo, estado, fechaRegistro, respuesta }));
}

// ---------------- ANALISTA: revisión, validación y clasificación ----------------

// PERMISO: solo "analista". Solicitudes que esperan validación.
export function listarPendientesValidacion() {
  exigirRol(ROLES.ANALISTA);
  return repo.listar().filter((p) => (p.estadoValidacion ?? 'Pendiente') === 'Pendiente');
}

// PERMISO: solo "analista". Todas, para poder revisar la información registrada.
export function listarSolicitudesAnalista() {
  exigirRol(ROLES.ANALISTA);
  return repo.listar();
}

// PERMISO: solo "analista".
// - Si faltan datos obligatorios: queda "Incompleta" y NO avanza (sigue en "Radicada").
// - Si está completa: se clasifica (Petición/Queja/Reclamo/Sugerencia), queda "Validada" y pasa a "En revisión".
// Todo queda registrado en el historial.
export function validarSolicitud(radicado, { tipo, observaciones = '' } = {}) {
  const sesion = exigirRol(ROLES.ANALISTA);
  const p = repo.buscarPorRadicado(radicado);
  if (!p) throw new Error('No existe una solicitud con ese radicado.');
  if (p.estadoValidacion === 'Validada') throw new Error('La solicitud ya fue validada.');

  const obs = observaciones.trim();
  const historial = [...(p.historial ?? [])];
  const faltantes = validarCompletitud(p);

  if (faltantes.length) {
    historial.push(evento(sesion, 'Validación: incompleta', `Faltan: ${faltantes.join(', ')}${obs ? '. ' + obs : ''}`));
    return repo.actualizar(radicado, { estadoValidacion: 'Incompleta', faltantes, estado: 'Radicada', historial });
  }

  if (!TIPOS.includes(tipo))
    throw new Error('Debes clasificar la solicitud como Petición, Queja, Reclamo o Sugerencia.');
  if (tipo !== p.tipo) historial.push(evento(sesion, 'Clasificación', `${p.tipo ?? 'Sin tipo'} → ${tipo}`));
  historial.push(evento(sesion, 'Validación: completa', obs));

  return repo.actualizar(radicado, { tipo, estadoValidacion: 'Validada', faltantes: [], estado: 'En revisión', historial });
}

// ---------------- ANALISTA: asignación ----------------

// PERMISO: solo "analista". Asigna (o reasigna / cambia la prioridad de) una solicitud VALIDADA.
// Responsable, área y prioridad son obligatorios; si falta algo no se guarda nada.
export function asignarSolicitud(radicado, { responsableId, area, prioridad } = {}) {
  const sesion = exigirRol(ROLES.ANALISTA);
  const p = repo.buscarPorRadicado(radicado);
  if (!p) throw new Error('No existe una solicitud con ese radicado.');
  if (p.estadoValidacion !== 'Validada') throw new Error('La solicitud debe estar validada antes de asignarla.');
  if (!['En revisión', 'Asignada'].includes(p.estado))
    throw new Error(`Ya no se puede reasignar: la solicitud está en "${p.estado}".`);

  const faltan = [];
  if (!responsableId) faltan.push('Responsable');
  if (!area) faltan.push('Área');
  if (!prioridad) faltan.push('Prioridad');
  if (faltan.length) throw new Error(`Faltan datos obligatorios: ${faltan.join(', ')}.`);

  if (!AREAS.includes(area)) throw new Error('Área no válida.');
  if (!PRIORIDADES.includes(prioridad)) throw new Error('La prioridad debe ser Alta, Media o Baja.');
  const resp = usuarioPorId(responsableId);
  if (!resp || resp.rol !== ROLES.RESPONSABLE) throw new Error('El responsable seleccionado no existe.');
  if (resp.area !== area) throw new Error('El responsable no pertenece al área seleccionada.');

  const previa = p.asignacion;
  const fechaAsignacion = previa?.fechaAsignacion ?? new Date().toISOString();   // el plazo parte de la 1.ª asignación
  const fechaLimite = sumarDiasHabiles(fechaAsignacion, DIAS_LIMITE[prioridad]).toISOString();

  const historial = [...(p.historial ?? [])];
  const limiteTxt = new Date(fechaLimite).toLocaleDateString('es-CO');
  if (!previa) {
    historial.push(evento(sesion, 'Asignación', `${resp.nombre} · ${area} · prioridad ${prioridad} · vence ${limiteTxt}`));
  } else {
    if (previa.responsableId !== responsableId || previa.area !== area)
      historial.push(evento(sesion, 'Reasignación', `${previa.responsableNombre} (${previa.area}) → ${resp.nombre} (${area})`));
    if (previa.prioridad !== prioridad)
      historial.push(evento(sesion, 'Cambio de prioridad', `${previa.prioridad} → ${prioridad} · vence ${limiteTxt}`));
  }

  return repo.actualizar(radicado, {
    asignacion: { responsableId, responsableNombre: resp.nombre, area, prioridad, fechaAsignacion, fechaLimite },
    estado: 'Asignada',
    historial,
  });
}

// ---------------- RESPONSABLE: solo lo que le asignaron ----------------

// ¿Esta solicitud está asignada a esta persona Y a su área?
const esSuya = (u, p) => !!p.asignacion && p.asignacion.responsableId === u.id && p.asignacion.area === u.area;

// PERMISO: solo "responsable". Lista únicamente sus solicitudes asignadas.
export function listarAsignadasAMi() {
  const sesion = exigirRol(ROLES.RESPONSABLE);
  const yo = usuarioPorId(sesion.id);
  if (!yo) throw new Error('No tienes permiso para esta acción.');
  return repo.listar().filter((p) => esSuya(yo, p));
}

// PERMISO: solo "responsable" y solo si la solicitud es suya.
export function verSolicitudAsignada(radicado) {
  const sesion = exigirRol(ROLES.RESPONSABLE);
  const yo = usuarioPorId(sesion.id);
  const p = repo.buscarPorRadicado(radicado);
  if (!yo || !p || !esSuya(yo, p)) throw new Error('Acceso denegado: esta solicitud no está asignada a ti.');
  return p;
}

// ---------------- ADMIN ----------------

// PERMISO: solo "admin". Ve todo, incluidas evidencias e historial.
export function listarTodas() {
  exigirRol(ROLES.ADMIN);
  return repo.listar();
}

// PERMISO: solo "admin". Una solicitud NO validada no puede avanzar ni recibir respuesta.
export function actualizarSolicitud(radicado, { estado, respuesta }) {
  const sesion = exigirRol(ROLES.ADMIN);
  if (!ESTADOS.includes(estado)) throw new Error('Estado no válido.');
  const p = repo.buscarPorRadicado(radicado);
  if (!p) throw new Error('No existe una solicitud con ese radicado.');

  const texto = (respuesta ?? '').trim();
  if (p.estadoValidacion !== 'Validada' && (estado !== 'Radicada' || texto))
    throw new Error('La solicitud aún no ha sido validada por un analista; no puede avanzar.');
  if (estado === 'Asignada' && !p.asignacion)
    throw new Error('Una solicitud solo pasa a "Asignada" cuando el analista le asigna responsable, área y prioridad.');
  if (['Respondida', 'Cerrada'].includes(estado) && !texto)
    throw new Error('Para marcarla como Respondida o Cerrada escribe la respuesta.');

  const historial = [...(p.historial ?? [])];
  if (estado !== p.estado) historial.push(evento(sesion, 'Cambio de estado', `${p.estado} → ${estado}`));
  if (texto && texto !== p.respuesta) historial.push(evento(sesion, 'Respuesta registrada'));
  return repo.actualizar(radicado, { estado, respuesta: texto || null, historial });
}

// "Juan Pérez Gómez" → "Juan P**** G****"
function enmascararNombre(nombre = '') {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  if (partes.length === 1) return partes[0].slice(0, 2) + '****';
  const [primero, ...resto] = partes;
  return [primero, ...resto.map((p) => p[0] + '****')].join(' ');
}
