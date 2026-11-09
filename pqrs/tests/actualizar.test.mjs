import { test } from 'node:test';
import assert from 'node:assert/strict';

// Almacenamiento simulado (en el navegador lo da el propio navegador)
const mk = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
globalThis.localStorage = mk();
globalThis.sessionStorage = mk();

const auth = await import('../js/services/authService.js');
const svc = await import('../js/services/pqrsService.js');
const repo = await import('../js/services/pqrsRepository.js');
const cfg = await import('../js/config.js');
const [R1] = cfg.RESPONSABLES_INICIALES;

// Inserta una solicitud directamente en el "repositorio" (por defecto: ya validada, en revisión)
function nueva(extra = {}) {
  const n = repo.siguienteConsecutivo();
  const radicado = `PQRS-2026-${String(n).padStart(6, '0')}`;
  repo.guardar({
    radicado, tipo: 'Queja', nombre: 'Juan Pérez', email: 'j@x.com', descripcion: 'Descripción suficientemente larga.',
    evidencias: [{ nombre: 'a.png', tipo: 'image/png', data: 'data:image/png;base64,AAAA' }], usuarioId: 'u1',
    estado: 'En revisión', estadoValidacion: 'Validada', respuesta: null, historial: [],
    fechaRegistro: new Date().toISOString(), ...extra,
  });
  return radicado;
}
async function entrar(email, pass) {
  auth.cerrarSesion();
  assert.equal((await auth.iniciarSesion(email, pass)).ok, true);
}
const comoAdmin = () => entrar(cfg.ADMIN_EMAIL, cfg.ADMIN_PASSWORD_INICIAL);

// ---------- Permisos ----------
test('permisos: solo el admin puede actualizar (sin sesión, usuario, analista y responsable: denegado)', async () => {
  const rad = nueva();
  const cambio = { estado: 'En trámite', respuesta: '' };

  auth.cerrarSesion();
  assert.throws(() => svc.actualizarSolicitud(rad, cambio), /No tienes permiso/);

  await entrar(cfg.ANALISTA_EMAIL, cfg.ANALISTA_PASSWORD_INICIAL);
  assert.throws(() => svc.actualizarSolicitud(rad, cambio), /No tienes permiso/);

  await entrar(R1.email, cfg.RESPONSABLE_PASSWORD_INICIAL);
  assert.throws(() => svc.actualizarSolicitud(rad, cambio), /No tienes permiso/);

  await auth.registrarUsuario({ nombre: 'Ana', email: 'ana@x.com', password: 'Clave1234' });
  await entrar('ana@x.com', 'Clave1234');
  assert.throws(() => svc.actualizarSolicitud(rad, cambio), /No tienes permiso/);

  assert.equal(repo.buscarPorRadicado(rad).estado, 'En revisión');   // nada cambió
});

// ---------- Datos de entrada ----------
test('estado no válido: error y no se guarda nada', async () => {
  await comoAdmin();
  const rad = nueva();
  assert.throws(() => svc.actualizarSolicitud(rad, { estado: 'Inventado', respuesta: '' }), /Estado no válido/);
  assert.throws(() => svc.actualizarSolicitud(rad, { estado: undefined, respuesta: '' }), /Estado no válido/);
  assert.equal(repo.buscarPorRadicado(rad).estado, 'En revisión');
});

test('radicado inexistente: error', async () => {
  await comoAdmin();
  assert.throws(() => svc.actualizarSolicitud('PQRS-2026-999999', { estado: 'En trámite', respuesta: '' }), /No existe una solicitud/);
});

// ---------- Respuesta obligatoria ----------
test('Respondida o Cerrada exigen respuesta (vacía o solo espacios no vale)', async () => {
  await comoAdmin();
  const rad = nueva({ estado: 'En trámite' });
  for (const estado of ['Respondida', 'Cerrada']) {
    assert.throws(() => svc.actualizarSolicitud(rad, { estado, respuesta: '' }), /escribe la respuesta/);
    assert.throws(() => svc.actualizarSolicitud(rad, { estado, respuesta: '   ' }), /escribe la respuesta/);
    assert.throws(() => svc.actualizarSolicitud(rad, { estado }), /escribe la respuesta/);
  }
  assert.equal(repo.buscarPorRadicado(rad).estado, 'En trámite');
});

test('Respondida con respuesta: se guarda recortada y la consulta pública la muestra', async () => {
  await comoAdmin();
  const rad = nueva({ estado: 'En trámite' });
  const r = svc.actualizarSolicitud(rad, { estado: 'Respondida', respuesta: '  Atendida, gracias.  ' });
  assert.equal(r.estado, 'Respondida');
  assert.equal(r.respuesta, 'Atendida, gracias.');
  assert.equal(svc.consultarEstado(rad).respuesta, 'Atendida, gracias.');
});

test('estados intermedios no exigen respuesta y dejan respuesta en null', async () => {
  await comoAdmin();
  const r = svc.actualizarSolicitud(nueva(), { estado: 'En trámite', respuesta: '' });
  assert.equal(r.estado, 'En trámite');
  assert.equal(r.respuesta, null);
});

// ---------- Estado "Asignada" ----------
test('"Asignada": se rechaza sin asignación y se acepta si el analista ya asignó', async () => {
  await comoAdmin();
  assert.throws(() => svc.actualizarSolicitud(nueva(), { estado: 'Asignada', respuesta: '' }), /Asignada/);

  const rad = nueva({ asignacion: { responsableId: 'x', responsableNombre: 'María', area: R1.area, prioridad: 'Alta',
    fechaAsignacion: new Date().toISOString(), fechaLimite: new Date().toISOString() } });
  assert.equal(svc.actualizarSolicitud(rad, { estado: 'Asignada', respuesta: '' }).estado, 'Asignada');
});

// ---------- Solicitud NO validada ----------
test('solicitud no validada: no avanza ni recibe respuesta, pero puede quedarse en "Radicada"', async () => {
  await comoAdmin();
  for (const estadoValidacion of ['Pendiente', 'Incompleta']) {
    const rad = nueva({ estadoValidacion, estado: 'Radicada' });
    assert.throws(() => svc.actualizarSolicitud(rad, { estado: 'En trámite', respuesta: '' }), /no ha sido validada/);
    assert.throws(() => svc.actualizarSolicitud(rad, { estado: 'Radicada', respuesta: 'Respuesta anticipada' }), /no ha sido validada/);
    const r = svc.actualizarSolicitud(rad, { estado: 'Radicada', respuesta: '' });   // sin cambios reales
    assert.equal(r.estado, 'Radicada');
  }
});

// ---------- Historial ----------
test('historial: un cambio de estado registra "estado anterior → nuevo" con quién lo hizo', async () => {
  await comoAdmin();
  const r = svc.actualizarSolicitud(nueva(), { estado: 'En trámite', respuesta: '' });
  const ev = r.historial.at(-1);
  assert.equal(ev.accion, 'Cambio de estado');
  assert.equal(ev.detalle, 'En revisión → En trámite');
  assert.equal(ev.rol, 'admin');
  assert.equal(ev.usuario, 'Administrador');
  assert.ok(ev.fecha);
});

test('historial: cambiar estado y responder registra ambos movimientos, en ese orden', async () => {
  await comoAdmin();
  const r = svc.actualizarSolicitud(nueva(), { estado: 'Respondida', respuesta: 'Listo.' });
  assert.deepEqual(r.historial.map((h) => h.accion), ['Cambio de estado', 'Respuesta registrada']);
});

test('historial: repetir el mismo estado y la misma respuesta no agrega movimientos', async () => {
  await comoAdmin();
  const rad = nueva();
  svc.actualizarSolicitud(rad, { estado: 'Respondida', respuesta: 'Listo.' });
  const antes = repo.buscarPorRadicado(rad).historial.length;
  svc.actualizarSolicitud(rad, { estado: 'Respondida', respuesta: 'Listo.' });
  assert.equal(repo.buscarPorRadicado(rad).historial.length, antes);

  svc.actualizarSolicitud(rad, { estado: 'Respondida', respuesta: 'Listo, con ajuste.' });   // solo cambia la respuesta
  const h = repo.buscarPorRadicado(rad).historial;
  assert.equal(h.length, antes + 1);
  assert.equal(h.at(-1).accion, 'Respuesta registrada');
});

test('historial: se conserva lo que ya había (no se borra)', async () => {
  await comoAdmin();
  const previo = { fecha: '2026-01-01T00:00:00.000Z', usuario: 'Analista', rol: 'analista', accion: 'Validación: completa', detalle: '' };
  const r = svc.actualizarSolicitud(nueva({ historial: [previo] }), { estado: 'En trámite', respuesta: '' });
  assert.deepEqual(r.historial[0], previo);
  assert.equal(r.historial.length, 2);
});
