import { test } from 'node:test';
import assert from 'node:assert/strict';

const mk = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
globalThis.localStorage = mk();
globalThis.sessionStorage = mk();

const auth = await import('../js/services/authService.js');
const svc = await import('../js/services/pqrsService.js');
const { validarCuenta } = await import('../js/utils/validators.js');
const cfg = await import('../js/config.js');

const DATOS = { tipo: 'Queja', nombre: 'Ana Ruiz', email: 'ana@x.com', descripcion: 'Una descripción de más de veinte caracteres.' };

async function crearYEntrar(nombre, email, password = 'Clave1234') {
  await auth.registrarUsuario({ nombre, email, password });
  auth.cerrarSesion();
  assert.equal((await auth.iniciarSesion(email, password)).ok, true);
}
const comoAdmin = async () => {
  auth.cerrarSesion();
  assert.equal((await auth.iniciarSesion(cfg.ADMIN_EMAIL, cfg.ADMIN_PASSWORD_INICIAL)).ok, true);
};

// ---- Caso 5 ----
test('registrar cuenta con correo repetido: error (sin importar mayúsculas)', async () => {
  assert.deepEqual(await auth.registrarUsuario({ nombre: 'Ana', email: 'rep@x.com', password: 'Clave1234' }), { ok: true });
  const r = await auth.registrarUsuario({ nombre: 'Otra', email: 'REP@x.com', password: 'Otra12345' });
  assert.equal(r.ok, false);
  assert.match(r.error, /Ya existe una cuenta/);
});

test('la contraseña no se guarda en texto plano', async () => {
  await auth.registrarUsuario({ nombre: 'Luis', email: 'luis@x.com', password: 'SuperSecreta99' });
  assert.ok(!localStorage.getItem(cfg.USERS_KEY).includes('SuperSecreta99'));
});

// ---- Caso 6 ----
test('login: contraseña incorrecta y correo inexistente dan el mismo mensaje', async () => {
  await auth.registrarUsuario({ nombre: 'Eva', email: 'eva@x.com', password: 'Clave1234' });
  const malaClave = await auth.iniciarSesion('eva@x.com', 'incorrecta1');
  const noExiste = await auth.iniciarSesion('nadie@x.com', 'Clave1234');
  assert.equal(malaClave.ok, false);
  assert.equal(noExiste.ok, false);
  assert.equal(malaClave.error, noExiste.error);
  assert.equal(auth.sesionActual(), null);   // no quedó sesión iniciada
});

test('login correcto: crea la sesión con el rol "usuario" y sin datos sensibles', async () => {
  await auth.registrarUsuario({ nombre: 'Pedro', email: 'pedro@x.com', password: 'Clave1234' });
  const r = await auth.iniciarSesion('  PEDRO@x.com ', 'Clave1234');
  assert.equal(r.ok, true);
  assert.equal(auth.sesionActual().rol, 'usuario');
  assert.ok(!('hash' in r.sesion) && !('salt' in r.sesion));
  auth.cerrarSesion();
  assert.equal(auth.sesionActual(), null);
});

// ---- Caso 7 ----
test('registrarPqrs sin sesión o como admin: "No tienes permiso"', async () => {
  auth.cerrarSesion();
  await assert.rejects(() => svc.registrarPqrs(DATOS), /No tienes permiso/);
  await comoAdmin();
  await assert.rejects(() => svc.registrarPqrs(DATOS), /No tienes permiso/);
});

test('registrarPqrs como usuario: genera radicado y queda "Radicada" / "Pendiente"', async () => {
  await crearYEntrar('Ana', 'ana.reg@x.com');
  const { radicado } = await svc.registrarPqrs(DATOS);
  assert.match(radicado, /^PQRS-\d{4}-\d{6}$/);
  const r = svc.listarMisSolicitudes().find((p) => p.radicado === radicado);
  assert.equal(r.estado, 'Radicada');
});

// ---- Caso 8 ----
test('listarTodas / actualizarSolicitud como usuario: "No tienes permiso"', async () => {
  await crearYEntrar('Beto', 'beto@x.com');
  const { radicado } = await svc.registrarPqrs(DATOS);
  assert.throws(() => svc.listarTodas(), /No tienes permiso/);
  assert.throws(() => svc.actualizarSolicitud(radicado, { estado: 'Cerrada', respuesta: 'x' }), /No tienes permiso/);
  auth.cerrarSesion();
  assert.throws(() => svc.listarTodas(), /No tienes permiso/);
});

test('listarTodas como admin: sí puede', async () => {
  await comoAdmin();
  assert.ok(Array.isArray(svc.listarTodas()));
});

// ---- Caso 9 ----
test('listarMisSolicitudes solo devuelve las del usuario en sesión', async () => {
  await crearYEntrar('Carla', 'carla@x.com');
  const { radicado: deCarla } = await svc.registrarPqrs({ ...DATOS, email: 'carla@x.com' });

  await crearYEntrar('Diego', 'diego@x.com');
  const { radicado: deDiego } = await svc.registrarPqrs({ ...DATOS, email: 'diego@x.com' });

  const mias = svc.listarMisSolicitudes().map((p) => p.radicado);
  assert.deepEqual(mias, [deDiego]);

  auth.cerrarSesion();
  await auth.iniciarSesion('carla@x.com', 'Clave1234');
  assert.deepEqual(svc.listarMisSolicitudes().map((p) => p.radicado), [deCarla]);
});

test('listarMisSolicitudes no expone email, descripción ni evidencias', async () => {
  await crearYEntrar('Fer', 'fer@x.com');
  await svc.registrarPqrs(DATOS);
  const [p] = svc.listarMisSolicitudes();
  assert.deepEqual(Object.keys(p).sort(), ['estado', 'fechaRegistro', 'radicado', 'respuesta', 'tipo']);
});

// ---- Validación de cuenta ----
test('validarCuenta: reglas de contraseña y correo', () => {
  assert.deepEqual(validarCuenta({ nombre: 'Ana', email: 'a@b.co', password: 'Clave1234', password2: 'Clave1234' }), {});
  assert.ok(validarCuenta({ nombre: '', email: 'malo', password: 'abc', password2: 'xyz' }).nombre);
  assert.equal(validarCuenta({ nombre: 'A', email: 'a@b.co', password: 'soloLetras', password2: 'soloLetras' }).password, 'Debe tener letras y números.');
  assert.equal(validarCuenta({ nombre: 'A', email: 'a@b.co', password: 'Clave1234', password2: 'Otra1234' }).password2, 'Las contraseñas no coinciden.');
});
