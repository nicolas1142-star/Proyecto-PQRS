import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validarArchivos } from '../js/utils/validators.js';
import { ARCHIVOS } from '../js/config.js';

test('validarArchivos', () => {
  const archivo = (name, type, size = 1024) => ({ name, type, size });

  // Válidos: devuelve null
  assert.equal(validarArchivos([archivo('foto.png', 'image/png')]), null);
  assert.equal(
    validarArchivos([
      archivo('a.jpg', 'image/jpeg'),
      archivo('b.pdf', 'application/pdf'),
      archivo('c.png', 'image/png'),
    ]),
    null
  );

  // Sin archivos
  assert.match(validarArchivos([]), /al menos un archivo/);

  // Más del máximo permitido
  const demasiados = Array.from({ length: ARCHIVOS.maxCantidad + 1 }, (_, i) =>
    archivo(`f${i}.png`, 'image/png')
  );
  assert.match(validarArchivos(demasiados), new RegExp(`Máximo ${ARCHIVOS.maxCantidad}`));

  // Tipo no permitido
  assert.match(validarArchivos([archivo('virus.exe', 'application/x-msdownload')]), /solo se permite JPG, PNG o PDF/);

  // Tamaño: exactamente 2 MB pasa, 1 byte más falla
  assert.equal(validarArchivos([archivo('ok.pdf', 'application/pdf', ARCHIVOS.maxBytes)]), null);
  assert.match(
    validarArchivos([archivo('grande.pdf', 'application/pdf', ARCHIVOS.maxBytes + 1)]),
    /supera los 2 MB/
  );
});
