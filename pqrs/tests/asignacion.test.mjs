import { test } from 'node:test';
import assert from 'node:assert/strict';

const mk = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
globalThis.localStorage = mk();
globalThis.sessionStorage = mk();

const auth = await import('../js/services/authService.js');
const svc = await import('../js/services/pqrsService.js');
const repo = await import('../js/services/pqrsRepository.js');
const { sumarDiasHabiles } = await import('../js/utils/fechas.js');
const cfg = await import('../js/config.js');
const [R1, R2, R3] = cfg.RESPONSABLES_INICIALES;   // R1 y R2: Atención al Cliente · R3: Facturación

function nueva(extra = {}) {
  const n = repo.siguienteConsecutivo();
  const radicado = `PQRS-2026-${String(n).padStart(6, '0')}`;
  repo.guardar({ radicado, tipo: 'Queja', nombre: 'Juan Pérez', email: 'j@x.com', descripcion: 'Descripción suficientemente larga.',
    evidencias: [{ nombre: 'a.png', tipo: 'image/png', data: 'data:image/png;base64,AAAA' }], usuarioId: 'u1',
    estado: 'En revisión', estadoValidacion: 'Validada', respuesta: null, historial: [], fechaRegistro: new Date().toISOString(), ...extra });
  return radicado;
}
async function entrar(email, pass) {
  auth.cerrarSesion();
  assert.equal((await auth.iniciarSesion(email, pass)).ok, true);
}
const comoAnalista = () => entrar(cfg.ANALISTA_EMAIL, cfg.ANALISTA_PASSWORD_INICIAL);
const comoResp = (r) => entrar(r.email, cfg.RESPONSABLE_PASSWORD_INICIAL);
const idDe = (area, nombre) => auth.listarResponsables(area).find((r) => r.nombre === nombre).id;

test('fechas: suma solo días hábiles (salta fines de semana)', () => {
  const lun = sumarDiasHabiles(new Date(2026, 9, 26, 12), 5);   // lunes 26-oct + 5 hábiles
  assert.deepEqual([lun.getMonth(), lun.getDate()], [10, 2]);    // lunes 2-nov
  const vie = sumarDiasHabiles(new Date(2026, 9, 30, 12), 1);   // viernes + 1
  assert.deepEqual([vie.getMonth(), vie.getDate()], [10, 2]);    // lunes
});

test('asignación VÁLIDA: pasa a "Asignada" y calcula la fecha límite', async () => {
  await comoAnalista();
  const rad = nueva();
  const r = svc.asignarSolicitud(rad, { responsableId: idDe(R1.area, R1.nombre), area: R1.area, prioridad: 'Alta' });
  assert.equal(r.estado, 'Asignada');
  assert.equal(r.asignacion.responsableNombre, R1.nombre);
  assert.equal(r.asignacion.area, 'Atención al Cliente');
  assert.equal(r.asignacion.prioridad, 'Alta');
  assert.equal(r.asignacion.fechaLimite, sumarDiasHabiles(r.asignacion.fechaAsignacion, cfg.DIAS_LIMITE.Alta).toISOString());
  assert.equal(r.historial.at(-1).accion, 'Asignación');
});

test('la fecha límite depende de la prioridad: Alta < Media < Baja', async () => {
  await comoAnalista();
  const id = idDe(R1.area, R1.nombre);
  const lim = (pri) => new Date(svc.asignarSolicitud(nueva(), { responsableId: id, area: R1.area, prioridad: pri }).asignacion.fechaLimite);
  const [alta, media, baja] = [lim('Alta'), lim('Media'), lim('Baja')];
  assert.ok(alta < media && media < baja);
});

test('campos FALTANTES: no se guarda nada', async () => {
  await comoAnalista();
  const id = idDe(R1.area, R1.nombre), rad = nueva();
  assert.throws(() => svc.asignarSolicitud(rad, { area: R1.area, prioridad: 'Alta' }), /Faltan datos obligatorios: Responsable/);
  assert.throws(() => svc.asignarSolicitud(rad, { responsableId: id, prioridad: 'Alta' }), /Faltan datos obligatorios: Área/);
  assert.throws(() => svc.asignarSolicitud(rad, { responsableId: id, area: R1.area }), /Faltan datos obligatorios: Prioridad/);
  assert.throws(() => svc.asignarSolicitud(rad, {}), /Responsable, Área, Prioridad/);
  const p = repo.buscarPorRadicado(rad);
  assert.equal(p.estado, 'En revisión');
  assert.equal(p.asignacion, undefined);
});

test('validaciones: prioridad inválida, responsable de otra área, solicitud no validada', async () => {
  await comoAnalista();
  const id = idDe(R1.area, R1.nombre);
  assert.throws(() => svc.asignarSolicitud(nueva(), { responsableId: id, area: R1.area, prioridad: 'Urgente' }), /Alta, Media o Baja/);
  assert.throws(() => svc.asignarSolicitud(nueva(), { responsableId: id, area: 'Facturación', prioridad: 'Alta' }), /no pertenece al área/);
  assert.throws(() => svc.asignarSolicitud(nueva({ estadoValidacion: 'Pendiente', estado: 'Radicada' }), { responsableId: id, area: R1.area, prioridad: 'Alta' }), /validada/);
  assert.throws(() => svc.asignarSolicitud(nueva({ estadoValidacion: 'Incompleta', estado: 'Radicada' }), { responsableId: id, area: R1.area, prioridad: 'Alta' }), /validada/);
  assert.throws(() => svc.asignarSolicitud(nueva({ estado: 'En trámite' }), { responsableId: id, area: R1.area, prioridad: 'Alta' }), /Ya no se puede reasignar/);
});

test('CAMBIO de prioridad y reasignación: se recalcula la fecha y queda en el historial', async () => {
  await comoAnalista();
  const rad = nueva(), id1 = idDe(R1.area, R1.nombre), id2 = idDe(R2.area, R2.nombre);
  const a = svc.asignarSolicitud(rad, { responsableId: id1, area: R1.area, prioridad: 'Baja' });
  const b = svc.asignarSolicitud(rad, { responsableId: id1, area: R1.area, prioridad: 'Alta' });
  assert.equal(b.asignacion.fechaAsignacion, a.asignacion.fechaAsignacion);          // el plazo parte de la 1.ª asignación
  assert.ok(new Date(b.asignacion.fechaLimite) < new Date(a.asignacion.fechaLimite)); // Alta vence antes que Baja
  assert.deepEqual([b.historial.at(-1).accion, b.historial.at(-1).detalle.startsWith('Baja → Alta')], ['Cambio de prioridad', true]);

  const c = svc.asignarSolicitud(rad, { responsableId: id2, area: R2.area, prioridad: 'Alta' });
  assert.equal(c.historial.at(-1).accion, 'Reasignación');
  assert.equal(c.estado, 'Asignada');
});

test('solo el analista asigna (usuario, responsable, admin y sin sesión: denegado)', async () => {
  const rad = nueva();
  const datos = { responsableId: 'x', area: R1.area, prioridad: 'Alta' };
  auth.cerrarSesion();
  assert.throws(() => svc.asignarSolicitud(rad, datos), /permiso/);
  await comoResp(R1);
  assert.throws(() => svc.asignarSolicitud(rad, datos), /permiso/);
  assert.throws(() => auth.listarResponsables(), /permiso/);
  await entrar(cfg.ADMIN_EMAIL, cfg.ADMIN_PASSWORD_INICIAL);
  assert.throws(() => svc.asignarSolicitud(rad, datos), /permiso/);
});

test('VISIBILIDAD: solo el responsable y el área asignados ven la solicitud', async () => {
  await comoAnalista();
  const rad = nueva();
  svc.asignarSolicitud(rad, { responsableId: idDe(R1.area, R1.nombre), area: R1.area, prioridad: 'Media' });

  await comoResp(R1);                                                          // el asignado
  assert.ok(svc.listarAsignadasAMi().some((p) => p.radicado === rad));
  assert.equal(svc.verSolicitudAsignada(rad).radicado, rad);

  await comoResp(R2);                                                          // misma área, otra persona
  assert.ok(!svc.listarAsignadasAMi().some((p) => p.radicado === rad));
  assert.throws(() => svc.verSolicitudAsignada(rad), /Acceso denegado/);

  await comoResp(R3);                                                          // otra área
  assert.ok(!svc.listarAsignadasAMi().some((p) => p.radicado === rad));
  assert.throws(() => svc.verSolicitudAsignada(rad), /Acceso denegado/);

  await comoAnalista();                                                        // no es rol responsable
  assert.throws(() => svc.listarAsignadasAMi(), /permiso/);
});

test('al REASIGNAR, el acceso se traslada al nuevo responsable', async () => {
  await comoAnalista();
  const rad = nueva(), id1 = idDe(R1.area, R1.nombre), id2 = idDe(R2.area, R2.nombre);
  svc.asignarSolicitud(rad, { responsableId: id1, area: R1.area, prioridad: 'Media' });
  svc.asignarSolicitud(rad, { responsableId: id2, area: R2.area, prioridad: 'Media' });
  await comoResp(R1);
  assert.throws(() => svc.verSolicitudAsignada(rad), /Acceso denegado/);
  await comoResp(R2);
  assert.equal(svc.verSolicitudAsignada(rad).radicado, rad);
});

test('admin: no puede poner "Asignada" a mano sin asignación', async () => {
  await entrar(cfg.ADMIN_EMAIL, cfg.ADMIN_PASSWORD_INICIAL);
  assert.throws(() => svc.actualizarSolicitud(nueva(), { estado: 'Asignada', respuesta: '' }), /Asignada/);
});
