import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validarPqrs } from '../js/utils/validators.js';

test('validarPqrs', () => {
  // Caso válido: sin errores
  const valido = {
    tipo: 'Queja',
    nombre: 'Juan Pérez',
    email: 'juan@correo.com',
    descripcion: 'Esta es una descripción suficientemente larga.',
  };
  assert.deepEqual(validarPqrs(valido), {});

  // Caso inválido: todos los campos fallan (nombre solo con espacios, descripción corta)
  const errores = validarPqrs({
    tipo: 'Otro',
    nombre: '   ',
    email: 'correo-sin-arroba',
    descripcion: 'muy corta',
  });
  assert.deepEqual(Object.keys(errores).sort(), ['descripcion', 'email', 'nombre', 'tipo']);

  // Límite: 19 caracteres falla, 20 pasa
  assert.ok(validarPqrs({ ...valido, descripcion: 'a'.repeat(19) }).descripcion);
  assert.equal(validarPqrs({ ...valido, descripcion: 'a'.repeat(20) }).descripcion, undefined);

  // Campos ausentes no deben romper la función
  const vacio = validarPqrs({});
  assert.ok(vacio.tipo && vacio.nombre && vacio.email && vacio.descripcion);
});
