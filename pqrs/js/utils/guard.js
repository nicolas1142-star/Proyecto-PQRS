import { ROLES, PANEL_POR_ROL } from '../config.js';
import { sesionActual, cerrarSesion } from '../services/authService.js';
import { el } from './dom.js';

// Redirige si no hay sesión o el rol no tiene permiso. Devuelve la sesión o null.
export function protegerPagina(rolesPermitidos) {
  const s = sesionActual();
  if (!s) { location.href = 'login.html'; return null; }
  if (!rolesPermitidos.includes(s.rol)) { location.href = 'index.html'; return null; }
  return s;
}

// Dibuja la barra superior: inicio + datos de sesión.
export function pintarBarra({ inicio = true } = {}) {
  const barra = document.getElementById('barra-sesion');
  if (!barra) return;
  const s = sesionActual();
  const derecha = s
    ? [
        el('span', {}, `${s.nombre} (${s.rol})`),
        el('a', { href: PANEL_POR_ROL[s.rol] }, s.rol === ROLES.USUARIO ? 'Mis solicitudes' : 'Panel'),
        el('button', { type: 'button', class: 'btn-link',
          onclick: () => { cerrarSesion(); location.href = 'index.html'; } }, 'Cerrar sesión'),
      ]
    : [el('a', { href: 'login.html' }, 'Iniciar sesión'), el('a', { href: 'cuenta.html' }, 'Crear cuenta')];
  barra.replaceChildren(
    inicio ? el('a', { href: 'index.html' }, '← Inicio') : el('span'),
    el('span', { class: 'barra-der' }, ...derecha)
  );
}
