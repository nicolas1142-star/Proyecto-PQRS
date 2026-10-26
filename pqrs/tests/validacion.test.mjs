import { test } from 'node:test';
import assert from 'node:assert/strict';

// Almacenamiento simulado (en el navegador lo da el propio navegador)
const mk = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
globalThis.localStorage = mk();
globalThis.sessionStorage = mk();

const auth = await import('../js/services/authService.js');
const svc = await import('../js/services/pqrsService.js');
const repo = await import('../js/services/pqrsRepository.js');
const { TIPOS, ADMIN_EMAIL, ADMIN_PASSWORD_INICIAL, ANALISTA_EMAIL, ANALISTA_PASSWORD_INICIAL } = await import('../js/config.js');

const EVID = [{ nombre: 'a.png', tipo: 'image/png', data: 'data:image/png;base64,AAAA' }];
function nueva(extra = {}) {
  const n = repo.siguienteConsecutivo();
  const radicado = `PQRS-2026-${String(n).padStart(6, '0')}`;
  repo.guardar({ radicado, tipo: 'Queja', nombre: 'Juan Pérez', email: 'j@x.com', descripcion: 'Descripción suficientemente larga.',
    evidencias: EVID, usuarioId: 'u1', estado: 'Radicada', estadoValidacion: 'Pendiente', respuesta: null,
    historial: [], fechaRegistro: new Date().toISOString(), ...extra });
  return radicado;
}
async function entrar(email, pass) {
  auth.cerrarSesion();
  assert.equal((await auth.iniciarSesion(email, pass)).ok, true);
}
const comoAnalista = () => entrar(ANALISTA_EMAIL, ANALISTA_PASSWORD_INICIAL);
const comoAdmin = () => entrar(ADMIN_EMAIL, ADMIN_PASSWORD_INICIAL);

test('solicitud COMPLETA: queda validada, clasificada y avanza a "En revisión"', async () => {
  await comoAnalista();
  const r = svc.validarSolicitud(nueva(), { tipo: 'Queja' });
  assert.equal(r.estadoValidacion, 'Validada');
  assert.equal(r.estado, 'En revisión');
  assert.deepEqual(r.faltantes, []);
});

test('solicitud INCOMPLETA: no se valida, no avanza y el admin tampoco puede avanzarla', async () => {
  await comoAnalista();
  const rad = nueva({ evidencias: [], descripcion: 'corta' });
  const r = svc.validarSolicitud(rad, { tipo: 'Queja' });
  assert.equal(r.estadoValidacion, 'Incompleta');
  assert.equal(r.estado, 'Radicada');
  assert.ok(r.faltantes.includes('Evidencia adjunta'));
  assert.ok(r.faltantes.some((f) => f.startsWith('Descripción')));

  await comoAdmin();
  assert.throws(() => svc.actualizarSolicitud(rad, { estado: 'En trámite', respuesta: '' }), /no ha sido validada/);
  assert.throws(() => svc.actualizarSolicitud(rad, { estado: 'Radicada', respuesta: 'Respuesta anticipada' }), /no ha sido validada/);
});

test('clasificación: el analista puede dejar cada uno de los 4 tipos', async () => {
  await comoAnalista();
  for (const t of TIPOS) {
    const r = svc.validarSolicitud(nueva({ tipo: 'Queja' }), { tipo: t });
    assert.equal(r.tipo, t);
  }
  assert.throws(() => svc.validarSolicitud(nueva(), { tipo: 'Otro' }), /clasificar/);
  assert.throws(() => svc.validarSolicitud(nueva(), {}), /clasificar/);
});

test('solo el analista puede validar (usuario, admin y sin sesión: denegado)', async () => {
  const rad = nueva();
  auth.cerrarSesion();
  assert.throws(() => svc.validarSolicitud(rad, { tipo: 'Queja' }), /permiso/);
  await comoAdmin();
  assert.throws(() => svc.validarSolicitud(rad, { tipo: 'Queja' }), /permiso/);
  assert.throws(() => svc.listarPendientesValidacion(), /permiso/);
  await auth.registrarUsuario({ nombre: 'Ana', email: 'ana@x.com', password: 'Clave1234' });
  await entrar('ana@x.com', 'Clave1234');
  assert.throws(() => svc.validarSolicitud(rad, { tipo: 'Queja' }), /permiso/);
  assert.throws(() => svc.listarSolicitudesAnalista(), /permiso/);
});

test('el historial conserva quién hizo qué (clasificación y validación)', async () => {
  await comoAnalista();
  const r = svc.validarSolicitud(nueva({ tipo: 'Queja' }), { tipo: 'Reclamo', observaciones: 'Revisado' });
  const acciones = r.historial.map((h) => h.accion);
  assert.deepEqual(acciones, ['Clasificación', 'Validación: completa']);
  assert.equal(r.historial[0].detalle, 'Queja → Reclamo');
  assert.equal(r.historial[1].usuario, 'Analista');
  assert.equal(r.historial[1].rol, 'analista');
  assert.ok(r.historial[1].fecha);

  const inc = svc.validarSolicitud(nueva({ evidencias: [] }), { tipo: 'Queja' });
  assert.match(inc.historial.at(-1).detalle, /Evidencia adjunta/);
});

test('pendientes: solo aparecen las no validadas; una validada no se revalida', async () => {
  await comoAnalista();
  const rad = nueva();
  assert.ok(svc.listarPendientesValidacion().some((p) => p.radicado === rad));
  svc.validarSolicitud(rad, { tipo: 'Queja' });
  assert.ok(!svc.listarPendientesValidacion().some((p) => p.radicado === rad));
  assert.throws(() => svc.validarSolicitud(rad, { tipo: 'Queja' }), /ya fue validada/);
});

test('admin: una solicitud validada sí avanza y queda registrado', async () => {
  await comoAnalista();
  const rad = nueva();
  svc.validarSolicitud(rad, { tipo: 'Queja' });
  await comoAdmin();
  const r = svc.actualizarSolicitud(rad, { estado: 'Respondida', respuesta: 'Atendida, gracias.' });
  assert.equal(r.estado, 'Respondida');
  assert.ok(r.historial.some((h) => h.accion === 'Cambio de estado' && h.rol === 'admin'));
});
