import { TIPOS, ARCHIVOS } from '../config.js';

export const RADICADO_REGEX = /^PQRS-\d{4}-\d{6}$/;

export function validarRadicado(radicado) {
  return RADICADO_REGEX.test(radicado);
}

export function validarPqrs({ tipo, nombre, email, descripcion }) {
  const errores = {};
  if (!TIPOS.includes(tipo)) errores.tipo = 'Selecciona un tipo válido.';
  if (!nombre?.trim()) errores.nombre = 'El nombre es obligatorio.';
  if (!/^\S+@\S+\.\S+$/.test(email ?? '')) errores.email = 'Correo no válido.';
  if ((descripcion ?? '').trim().length < 20)
    errores.descripcion = 'Describe tu solicitud (mínimo 20 caracteres).';
  return errores;
}

export function validarArchivos(files) {
  if (files.length === 0)
    return 'Debes adjuntar al menos un archivo como evidencia.';
  if (files.length > ARCHIVOS.maxCantidad)
    return `Máximo ${ARCHIVOS.maxCantidad} archivos.`;
  for (const f of files) {
    if (!ARCHIVOS.tiposPermitidos.includes(f.type))
      return `"${f.name}": solo se permite JPG, PNG o PDF.`;
    if (f.size > ARCHIVOS.maxBytes)
      return `"${f.name}" supera los 2 MB.`;
  }
  return null;
}

export function validarCuenta({ nombre, email, password, password2 }) {
  const errores = {};
  if (!nombre?.trim()) errores.nombre = 'El nombre es obligatorio.';
  if (!/^\S+@\S+\.\S+$/.test(email ?? '')) errores.email = 'Correo no válido.';
  if ((password ?? '').length < 8) errores.password = 'Mínimo 8 caracteres.';
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    errores.password = 'Debe tener letras y números.';
  if (password !== password2) errores.password2 = 'Las contraseñas no coinciden.';
  return errores;
}

// Datos obligatorios que debe traer la solicitud del ciudadano.
// (El tipo no se exige aquí: lo define el analista al clasificar.)
export function validarCompletitud(p) {
  const faltantes = [];
  if (!p.nombre?.trim()) faltantes.push('Nombre');
  if (!/^\S+@\S+\.\S+$/.test(p.email ?? '')) faltantes.push('Correo electrónico válido');
  if ((p.descripcion ?? '').trim().length < 20) faltantes.push('Descripción (mínimo 20 caracteres)');
  if (!p.evidencias?.length) faltantes.push('Evidencia adjunta');
  return faltantes;
}
