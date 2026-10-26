import { registrarPqrs } from '../services/pqrsService.js';
import { validarPqrs, validarArchivos } from '../utils/validators.js';
import { protegerPagina, pintarBarra } from '../utils/guard.js';
import { ROLES } from '../config.js';

pintarBarra();
const sesion = protegerPagina([ROLES.USUARIO]);   // solo usuarios con sesión
if (sesion) iniciar(sesion);

function iniciar(sesion) {
  const form = document.getElementById('form-registro');
  const exito = document.getElementById('exito');
  form.nombre.value = sesion.nombre;
  form.email.value = sesion.email;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.querySelectorAll('[data-error]').forEach((s) => (s.textContent = ''));

    const datos = Object.fromEntries(
      ['tipo', 'nombre', 'email', 'descripcion'].map((k) => [k, form[k].value])
    );
    const archivos = [...form.evidencia.files];
    const errores = validarPqrs(datos);
    const errorArchivos = validarArchivos(archivos);
    if (errorArchivos) errores.evidencia = errorArchivos;

    if (Object.keys(errores).length) {
      for (const [campo, msg] of Object.entries(errores)) {
        const span = document.querySelector(`[data-error="${campo}"]`);
        if (span) span.textContent = msg;
      }
      return;
    }

    try {
      const { radicado } = await registrarPqrs(datos, archivos);
      form.hidden = true;
      exito.hidden = false;
      exito.querySelector('.radicado-num').textContent = radicado;
    } catch (err) {
      document.querySelector('[data-error="general"]').textContent =
        err.message.includes('permiso') ? err.message
          : 'No se pudo guardar. Los archivos pueden ser demasiado pesados.';
    }
  });
}
