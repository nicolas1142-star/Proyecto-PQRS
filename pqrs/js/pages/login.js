import { iniciarSesion, sesionActual } from '../services/authService.js';
import { pintarBarra } from '../utils/guard.js';
import { PANEL_POR_ROL } from '../config.js';

pintarBarra();
const destino = (rol) => PANEL_POR_ROL[rol];

const ya = sesionActual();
if (ya) location.href = destino(ya.rol);

const form = document.getElementById('form-login');
const error = document.querySelector('[data-error="general"]');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  error.textContent = '';
  if (!form.email.value.trim() || !form.password.value) {
    error.textContent = 'Ingresa tu correo y contraseña.';
    return;
  }
  const r = await iniciarSesion(form.email.value, form.password.value);
  if (!r.ok) { error.textContent = r.error; return; }
  location.href = destino(r.sesion.rol);   // cada rol va a su panel
});
