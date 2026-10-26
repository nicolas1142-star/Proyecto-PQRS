import { consultarEstado } from '../services/pqrsService.js';
import { validarRadicado } from '../utils/validators.js';
import { normalizarRadicado } from '../utils/radicado.js';
import { pintarBarra } from '../utils/guard.js';
import { el } from '../utils/dom.js';

pintarBarra();
const form = document.getElementById('form-consulta');
const resultado = document.getElementById('resultado');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  try {
    const valor = normalizarRadicado(document.getElementById('radicado').value);
    if (!validarRadicado(valor))
      return mostrarError('El formato del radicado no es válido. Ejemplo: PQRS-2026-000001');
    const pqrs = consultarEstado(valor);
    if (!pqrs) return mostrarError('No existe una solicitud con ese radicado.');
    mostrarResultado(pqrs);
  } catch (error) {
    console.error('Error al consultar:', error);
    mostrarError('Ocurrió un error inesperado. Revisa la consola (F12).');
  }
});

const linea = (etiqueta, valor) => el('p', {}, el('strong', {}, etiqueta + ': '), valor);

function mostrarResultado(p) {
  const card = el('article', { class: 'card' },
    el('h2', {}, p.radicado),
    linea('Nombre', p.nombre),
    linea('Tipo', p.tipo),
    linea('Estado', p.estado),
    linea('Fecha de registro', new Date(p.fechaRegistro).toLocaleString('es-CO')),
    p.respuesta
      ? el('div', {}, el('p', {}, el('strong', {}, 'Respuesta:')), el('p', { class: 'respuesta' }, p.respuesta))
      : el('p', {}, 'Aún no hay una respuesta disponible.')
  );
  resultado.replaceChildren(card);
}

function mostrarError(mensaje) {
  resultado.replaceChildren(el('p', { class: 'alert alert-error', role: 'alert' }, mensaje));
}
