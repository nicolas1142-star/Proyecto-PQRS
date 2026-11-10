import { test } from 'node:test';
import assert from 'node:assert/strict';

const mk = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
globalThis.localStorage = mk();
globalThis.sessionStorage = mk();

const auth = await import('../js/services/authService.js');
const svc = await import('../js/services/pqrsService.js');
const repo = await import('../js/services/pqrsRepository.js');
const cfg = await import('../js/config.js');

function nueva(extra = {}) {
  const n = repo.siguienteConsecutivo();
  const radicado = `PQRS-2026-${String(n).padStart(6, '0')}`;
  repo.guardar({ radicado, tipo: 'Queja', nombre: 'Juan Pérez', email: 'j@x.com', descripcion: 'Descripción suficientemente larga.',
    evidencias: [{ nombre: 'a.png', tipo: 'image/png', data: 'data:image/png;base64,AAAA' }], usuarioId: 'u1',
    estado: 'En revisión', estadoValidacion: 'Validada', respuesta: null, historial: [], fechaRegistro: new Date().toISOString(), ...extra });
  return radicado;
}
async function comoAdmin() {
  auth.cerrarSesion();
  assert.equal((await auth.iniciarSesion(cfg.ADMIN_EMAIL, cfg.ADMIN_PASSWORD_INICIAL)).ok, true);
}

test('actualizarSolicitud: el admin cambia el estado y responde; queda en el historial', async () => {
  await comoAdmin();
  const rad = nueva();
  const r = svc.actualizarSolicitud(rad, { estado: 'Respondida', respuesta: '  Ya solucionamos su caso.  ' });
  assert.equal(r.estado, 'Respondida');
  assert.equal(r.respuesta, 'Ya solucionamos su caso.');           // se recorta el texto
  assert.deepEqual(r.historial.map((h) => h.accion), ['Cambio de estado', 'Respuesta registrada']);
  assert.equal(r.historial[0].detalle, 'En revisión → Respondida');
});

test('actualizarSolicitud: rechaza estado inválido, radicado inexistente y respuesta vacía al cerrar', async () => {
  await comoAdmin();
  const rad = nueva();
  assert.throws(() => svc.actualizarSolicitud(rad, { estado: 'Inventado', respuesta: '' }), /Estado no válido/);
  assert.throws(() => svc.actualizarSolicitud('PQRS-2026-999999', { estado: 'Cerrada', respuesta: 'x' }), /No existe una solicitud/);
  assert.throws(() => svc.actualizarSolicitud(rad, { estado: 'Cerrada', respuesta: '   ' }), /escribe la respuesta/);
  assert.equal(repo.buscarPorRadicado(rad).estado, 'En revisión');  // no se guardó nada
});

test('actualizarSolicitud: una solicitud no validada no puede avanzar ni recibir respuesta', async () => {
  await comoAdmin();
  const rad = nueva({ estadoValidacion: 'Pendiente', estado: 'Radicada' });
  assert.throws(() => svc.actualizarSolicitud(rad, { estado: 'En trámite', respuesta: '' }), /no ha sido validada/);
  assert.throws(() => svc.actualizarSolicitud(rad, { estado: 'Radicada', respuesta: 'hola' }), /no ha sido validada/);
  assert.equal(svc.actualizarSolicitud(rad, { estado: 'Radicada', respuesta: '' }).estado, 'Radicada'); // sin cambios: permitido
});
