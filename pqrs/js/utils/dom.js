// Crea elementos de forma segura (los textos nunca se interpretan como HTML).
// el('p', { class: 'x', onclick: fn }, 'texto', otroNodo)
export function el(tag, props = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  n.append(...hijos);
  return n;
}
