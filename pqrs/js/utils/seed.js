// Uso (consola del navegador, con el sitio abierto):
//   const s = await import('/js/utils/seed.js'); s.cargarDatosDePrueba();
import { STORAGE_KEY } from '../config.js';

export function cargarDatosDePrueba() {
  const ev = [{ nombre: 'evidencia.png', tipo: 'image/png', data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' }];
  const base = { nombre: 'Juan Pérez Gómez', email: 'prueba@correo.com', descripcion: 'Descripción de prueba para la solicitud.', evidencias: ev, fechaRegistro: new Date().toISOString(), historial: [] };
  const db = {
    consecutivo: 4,
    items: [
      { ...base, radicado: 'PQRS-2026-000001', tipo: 'Queja', estado: 'En revisión', estadoValidacion: 'Validada', respuesta: null },
      { ...base, radicado: 'PQRS-2026-000002', tipo: 'Petición', estado: 'Respondida', estadoValidacion: 'Validada', respuesta: 'Su solicitud fue atendida. Gracias por escribirnos.' },
      { ...base, radicado: 'PQRS-2026-000003', tipo: 'Reclamo', estado: 'Radicada', estadoValidacion: 'Pendiente', respuesta: null },
      { ...base, radicado: 'PQRS-2026-000004', tipo: 'Sugerencia', estado: 'Radicada', estadoValidacion: 'Pendiente', respuesta: null, descripcion: 'Muy corta', evidencias: [] },
    ],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  console.log('Cargado: 000001 validada (lista para asignar) y 000002 respondida; 000003 pendiente completa; 000004 pendiente INCOMPLETA');
}
