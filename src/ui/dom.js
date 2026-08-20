// The one DOM helper every screen uses. Kept on its own so the flat hunt and the
// shop do not have to reach into the build HUD for it.

export function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}

export const svg = (tag) => document.createElementNS('http://www.w3.org/2000/svg', tag);
