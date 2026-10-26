// Suma días HÁBILES (lunes a viernes). No considera festivos.
export function sumarDiasHabiles(desde, dias) {
  const f = new Date(desde);
  let contados = 0;
  while (contados < dias) {
    f.setDate(f.getDate() + 1);
    const dia = f.getDay();             // 0 = domingo, 6 = sábado
    if (dia !== 0 && dia !== 6) contados++;
  }
  return f;
}
