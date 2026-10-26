import { registrarUsuario, iniciarSesion } from '../services/authService.js';
import { validarCuenta } from '../utils/validators.js';
import { pintarBarra } from '../utils/guard.js';

pintarBarra();
const form = document.getElementById('form-cuenta');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  document.querySelectorAll('[data-error]').forEach((s) => (s.textContent = ''));

  const datos = Object.fromEntries(
    ['nombre', 'email', 'password', 'password2'].map((k) => [k, form[k].value])
  );
  const errores = validarCuenta(datos);
  if (Object.keys(errores).length) {
    for (const [campo, msg] of Object.entries(errores))
      document.querySelector(`[data-error="${campo}"]`).textContent = msg;
    return;
  }

  const r = await registrarUsuario(datos);
  if (!r.ok) { document.querySelector('[data-error="general"]').textContent = r.error; return; }

  await iniciarSesion(datos.email, datos.password);   // entra directamente
  location.href = 'mis-solicitudes.html';
});
