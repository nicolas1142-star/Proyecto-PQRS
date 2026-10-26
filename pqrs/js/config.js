export const TIPOS = ['Petición', 'Queja', 'Reclamo', 'Sugerencia'];
export const ESTADOS = ['Radicada', 'En revisión', 'Asignada', 'En trámite', 'Respondida', 'Cerrada'];

export const ARCHIVOS = {
  maxCantidad: 3,
  maxBytes: 2 * 1024 * 1024, // 2 MB (localStorage tiene poco espacio)
  tiposPermitidos: ['image/jpeg', 'image/png', 'application/pdf'],
};

export const STORAGE_KEY = 'pqrs_db';

// ---- Autenticación y permisos ----
export const ROLES = { USUARIO: 'usuario', ANALISTA: 'analista', RESPONSABLE: 'responsable', ADMIN: 'admin' };
export const USERS_KEY = 'pqrs_users';
export const SESSION_KEY = 'pqrs_session';
export const ADMIN_EMAIL = 'admin@pqrs.com';
export const ADMIN_PASSWORD_INICIAL = 'Admin123!';

export const ANALISTA_EMAIL = 'analista@pqrs.com';
export const ANALISTA_PASSWORD_INICIAL = 'Analista123!';

// A qué página va cada rol al iniciar sesión
export const PANEL_POR_ROL = { usuario: 'mis-solicitudes.html', analista: 'analista.html', responsable: 'responsable.html', admin: 'admin.html' };

// ---- Asignación ----
export const AREAS = ['Atención al Cliente', 'Facturación', 'Soporte Técnico'];
export const PRIORIDADES = ['Alta', 'Media', 'Baja'];
// Días hábiles para resolver, según la prioridad (se cuentan desde la asignación)
export const DIAS_LIMITE = { Alta: 5, Media: 10, Baja: 15 };

// Cuentas de responsables de ejemplo (se crean solas)
export const RESPONSABLES_INICIALES = [
  { nombre: 'María Responsable', email: 'responsable1@pqrs.com', area: 'Atención al Cliente' },
  { nombre: 'Carlos Responsable', email: 'responsable2@pqrs.com', area: 'Atención al Cliente' },
  { nombre: 'Laura Responsable', email: 'responsable3@pqrs.com', area: 'Facturación' },
];
export const RESPONSABLE_PASSWORD_INICIAL = 'Resp12345!';
