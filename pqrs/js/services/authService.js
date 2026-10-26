import {
  ROLES, USERS_KEY, SESSION_KEY, ADMIN_EMAIL, ADMIN_PASSWORD_INICIAL,
  ANALISTA_EMAIL, ANALISTA_PASSWORD_INICIAL, RESPONSABLES_INICIALES, RESPONSABLE_PASSWORD_INICIAL,
} from '../config.js';

const leerUsuarios = () => JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]');
const guardarUsuarios = (u) => localStorage.setItem(USERS_KEY, JSON.stringify(u));

// La contraseña nunca se guarda en texto plano: se guarda hash(salt + contraseña).
async function hashear(password, salt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + password));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function crearSiFalta(usuarios, { rol, nombre, email, password, area = null }) {
  if (usuarios.some((u) => u.email === email)) return;
  const salt = crypto.randomUUID();
  usuarios.push({ id: crypto.randomUUID(), nombre, email, area, salt, hash: await hashear(password, salt), rol });
}

// Crea las cuentas internas (admin, analista y responsables) si todavía no existen.
async function asegurarAdmin() {
  const usuarios = leerUsuarios();
  const antes = usuarios.length;
  await crearSiFalta(usuarios, { rol: ROLES.ADMIN, nombre: 'Administrador', email: ADMIN_EMAIL, password: ADMIN_PASSWORD_INICIAL });
  await crearSiFalta(usuarios, { rol: ROLES.ANALISTA, nombre: 'Analista', email: ANALISTA_EMAIL, password: ANALISTA_PASSWORD_INICIAL });
  for (const r of RESPONSABLES_INICIALES)
    await crearSiFalta(usuarios, { rol: ROLES.RESPONSABLE, ...r, password: RESPONSABLE_PASSWORD_INICIAL });
  if (usuarios.length !== antes) guardarUsuarios(usuarios);
}

// Solo se pueden crear cuentas con rol "usuario". Las internas existen por defecto.
export async function registrarUsuario({ nombre, email, password }) {
  await asegurarAdmin();
  const correo = email.trim().toLowerCase();
  const usuarios = leerUsuarios();
  if (usuarios.some((u) => u.email === correo))
    return { ok: false, error: 'Ya existe una cuenta con ese correo.' };

  const salt = crypto.randomUUID();
  usuarios.push({
    id: crypto.randomUUID(), nombre: nombre.trim(), email: correo, area: null,
    salt, hash: await hashear(password, salt), rol: ROLES.USUARIO,
  });
  guardarUsuarios(usuarios);
  return { ok: true };
}

export async function iniciarSesion(email, password) {
  await asegurarAdmin();
  const u = leerUsuarios().find((x) => x.email === email.trim().toLowerCase());
  // Mismo mensaje si falla el correo o la contraseña (no revela cuál fue)
  if (!u || (await hashear(password, u.salt)) !== u.hash)
    return { ok: false, error: 'Correo o contraseña incorrectos.' };

  const sesion = { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, area: u.area ?? null };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(sesion));
  return { ok: true, sesion };
}

export function sesionActual() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
}

export function cerrarSesion() {
  sessionStorage.removeItem(SESSION_KEY);
}

// Lanza error si no hay sesión o el rol no está permitido.
export function exigirRol(...roles) {
  const s = sesionActual();
  if (!s || !roles.includes(s.rol)) throw new Error('No tienes permiso para esta acción.');
  return s;
}

// Uso interno de los servicios: busca una cuenta por id.
export function usuarioPorId(id) {
  return leerUsuarios().find((u) => u.id === id) ?? null;
}

// PERMISO: solo "analista". Responsables disponibles (sin datos sensibles).
export function listarResponsables(area) {
  exigirRol(ROLES.ANALISTA);
  return leerUsuarios()
    .filter((u) => u.rol === ROLES.RESPONSABLE && (!area || u.area === area))
    .map(({ id, nombre, area: a }) => ({ id, nombre, area: a }));
}
