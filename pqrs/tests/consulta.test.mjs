import { test } from 'node:test';
import assert from 'node:assert/strict';

// Almacenamiento simulado (en el navegador lo da el propio navegador)
const mk = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
globalThis.localStorage = mk();
globalThis.sessionStorage = mk();

const svc = await import('../js/services/pqrsService.js');
const repo = await import('../js/services/pqrsRepository.js');
const { validarRadicado } = await import('../js/utils/validators.js');
const { generarRadicado, normalizarRadicado } = await import('../js/utils/radicado.js');

// Inserta una solicitud directamente en el "repositorio" y devuelve su radicado
function nueva(extra = {}) {
  const n = repo.siguienteConsecutivo();
  const radicado = generarRadicado(n, new Date(2026, 5, 1));
  repo.guardar({
    radicado, tipo: 'Queja', nombre: 'Juan Pérez Gómez', email: 'juan@correo.com',
    descripcion: 'Descripción privada de la solicitud.',
    evidencias: [{ nombre: 'a.png', tipo: 'image/png', data: 'data:image/png;base64,AAAA' }],
    usuarioId: 'u1', estado: 'Radicada', estadoValidacion: 'Pendiente', respuesta: null,
    historial: [], fechaRegistro: '2026-06-01T10:00:00.000Z', ...extra,
  });
  return radicado;
}

// ---- Caso 1 ----
test('radicado válido: devuelve estado, tipo y fecha', () => {
  const rad = nueva({ estado: 'En trámite', tipo: 'Reclamo' });
  const r = svc.consultarEstado(rad);
  assert.equal(r.radicado, rad);
  assert.equal(r.estado, 'En trámite');
  assert.equal(r.tipo, 'Reclamo');
  assert.equal(r.fechaRegistro, '2026-06-01T10:00:00.000Z');
});

test('el radicado se normaliza (espacios y minúsculas)', () => {
  const rad = nueva();
  assert.equal(svc.consultarEstado(`  ${rad.toLowerCase()}  `).radicado, rad);
});

// ---- Caso 2 ----
test('radicado inexistente: devuelve null', () => {
  assert.equal(svc.consultarEstado('PQRS-2026-999999'), null);
});

// ---- Caso 3 ----
test('solicitud con respuesta: el resultado incluye la respuesta', () => {
  const rad = nueva({ estado: 'Respondida', respuesta: 'Ya fue atendida, gracias.' });
  assert.equal(svc.consultarEstado(rad).respuesta, 'Ya fue atendida, gracias.');
});

test('solicitud sin respuesta: respuesta es null', () => {
  assert.equal(svc.consultarEstado(nueva()).respuesta, null);
});

// ---- Caso 4 (seguridad) ----
test('seguridad: el resultado NO expone email, descripción ni evidencias', () => {
  const r = svc.consultarEstado(nueva());
  for (const campo of ['email', 'descripcion', 'evidencias', 'usuarioId', 'historial'])
    assert.ok(!(campo in r), `el resultado no debe incluir "${campo}"`);
  assert.deepEqual(Object.keys(r).sort(), ['estado', 'fechaRegistro', 'nombre', 'radicado', 'respuesta', 'tipo']);
});

test('seguridad: el nombre sale enmascarado', () => {
  const r = svc.consultarEstado(nueva({ nombre: 'Juan Pérez Gómez' }));
  assert.equal(r.nombre, 'Juan P**** G****');
  assert.ok(!JSON.stringify(r).includes('Pérez'));
  assert.equal(svc.consultarEstado(nueva({ nombre: 'Ana' })).nombre, 'An****');
});

// ---- Utilidades de radicado ----
test('generarRadicado: formato PQRS-AAAA-000000', () => {
  assert.equal(generarRadicado(7, new Date(2026, 0, 15)), 'PQRS-2026-000007');
  assert.equal(generarRadicado(123456, new Date(2030, 11, 31)), 'PQRS-2030-123456');
});

test('validarRadicado: acepta el formato correcto y rechaza el resto', () => {
  assert.equal(validarRadicado('PQRS-2026-000001'), true);
  for (const malo of ['', 'pqrs-2026-000001', 'PQRS-26-000001', 'PQRS-2026-1', 'PQRS-2026-000001 x'])
    assert.equal(validarRadicado(malo), false, `"${malo}" no debería ser válido`);
});

test('normalizarRadicado: recorta y pasa a mayúsculas', () => {
  assert.equal(normalizarRadicado('  pqrs-2026-000001 '), 'PQRS-2026-000001');
});
