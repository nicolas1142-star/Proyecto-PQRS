export function generarRadicado(consecutivo, fecha = new Date()) {
  const anio = fecha.getFullYear();
  return `PQRS-${anio}-${String(consecutivo).padStart(6, '0')}`;
}

export function normalizarRadicado(valor) {
  return valor.trim().toUpperCase();
}
