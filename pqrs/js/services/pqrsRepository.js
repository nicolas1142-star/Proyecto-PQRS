// Único lugar que sabe dónde se guardan los datos.
// Para usar una API real, solo reescribe estas funciones.
import { STORAGE_KEY } from '../config.js';

function leer() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{"consecutivo":0,"items":[]}');
}
function escribir(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

export function siguienteConsecutivo() {
  const db = leer();
  db.consecutivo += 1;
  escribir(db);
  return db.consecutivo;
}

export function guardar(pqrs) {
  const db = leer();
  db.items.push(pqrs);
  escribir(db);
}

export function buscarPorRadicado(radicado) {
  return leer().items.find((p) => p.radicado === radicado) ?? null;
}

export function listar() {
  return leer().items;
}

export function actualizar(radicado, cambios) {
  const db = leer();
  const i = db.items.findIndex((p) => p.radicado === radicado);
  if (i < 0) return null;
  db.items[i] = { ...db.items[i], ...cambios };
  escribir(db);
  return db.items[i];
}
