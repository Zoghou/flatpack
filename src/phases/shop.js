// Phase 2 — the catalogue, and the workbench list it turns into. Both live on
// one screen: what you can buy, what you own, and what still needs building.

import { CATALOG, fitChecks } from '../content/catalog.js';
import { clock, money } from '../core/util.js';
import { h } from '../ui/dom.js';
import { state, own, disown, ownedRecord } from '../core/store.js';

export function mountShop({ root, flat, onBuild, onFurnish, onBack }) {
  const el = h('div', 'screen shop');
  root.append(el);

  function render() {
    el.innerHTML = '';
    const remaining = flat.budget - state.spent;
    const head = h('div', 'screen-head');
    head.innerHTML = `<h1>Furnish the bedroom at ${flat.name}</h1>
      <p>${flat.bedroom.w} × ${flat.bedroom.d} mm, ceiling ${flat.bedroom.ceiling} mm, door ${flat.bedroom.door.width} mm.
      Every product is checked against those numbers before you can buy it.</p>`;
    const wallet = h('div', 'wallet');
    wallet.innerHTML = `<span>Budget</span><b>${money(remaining)}</b><span class="muted">of ${money(flat.budget)}</span>`;
    head.append(wallet);
    el.append(head);

    const cols = h('div', 'shop-cols');
    const grid = h('div', 'catalog');
    for (const p of CATALOG) {
      const owned = !!ownedRecord(p.id);
      const checks = fitChecks(p, flat, remaining + (owned ? p.price : 0));
      const blocking = checks.filter((c) => !c.ok);
      const card = h('article', `card product${owned ? ' owned' : ''}${blocking.length ? ' blocked' : ''}`);
      const top = h('div', 'product-top');
      top.innerHTML = `<div><h3>${p.name}</h3><p class="muted">${p.product}</p></div><div class="price">${money(p.price)}</div>`;
      const fig = h('div', 'product-figs');
      fig.innerHTML = `
        <div><b>${p.size.w} × ${p.size.d} × ${p.size.h}</b><span>mm assembled</span></div>
        <div><b>${p.parts}</b><span>part types</span></div>
        <div><b>${p.fasteners}</b><span>fasteners</span></div>
        <div><b>${p.buildable ? '★'.repeat(p.difficulty) : '—'}</b><span>${p.buildable ? `${p.steps} steps, par ${clock(p.parTimeMs)}` : 'no assembly'}</span></div>`;
      const blurb = h('p', 'blurb', p.blurb);
      const checklist = h('ul', 'checks');
      for (const c of checks) {
        const li = h('li', c.ok ? 'ok' : 'no');
        li.innerHTML = `<span>${c.ok ? '✓' : '✗'}</span><b>${c.label}</b><i>${c.detail}</i>`;
        checklist.append(li);
      }
      const btn = h('button', `btn ${owned ? 'ghost' : 'primary'}`, owned ? 'Take it back' : blocking.length ? 'Will not work' : 'Buy');
      btn.disabled = !owned && blocking.length > 0;
      btn.onclick = () => { owned ? disown(p.id, p.price) : own(p.id, p.price); render(); };
      card.append(top, fig, blurb, checklist, btn);
      grid.append(card);
    }

    const side = h('div', 'shop-side');
    const bench = h('div', 'card bench');
    bench.append(h('h3', null, 'In the flat'));
    if (!state.owned.length) bench.append(h('p', 'muted', 'Nothing bought yet.'));
    for (const o of state.owned) {
      const p = CATALOG.find((c) => c.id === o.kitId);
      const row = h('div', `bench-row${o.built ? ' built' : ''}`);
      const info = h('div', 'bench-info');
      info.innerHTML = `<b>${p.name}</b><span class="muted">${o.built ? `built — grade ${o.result.grade}, ${o.result.score}/100` : p.buildable ? 'still in the box' : 'nothing to assemble'}</span>`;
      row.append(info);
      if (p.buildable) {
        const b = h('button', `btn ${o.built ? 'ghost' : 'primary'} small`, o.built ? 'Build again' : 'Build it');
        b.onclick = () => onBuild(p.kitId);
        row.append(b);
      }
      bench.append(row);
    }
    side.append(bench);

    const built = state.owned.filter((o) => o.built).length;
    const next = h('div', 'card next-card');
    next.append(h('h3', null, 'When you are ready'));
    next.append(h('p', 'muted', built
      ? `${built} piece${built > 1 ? 's' : ''} assembled. You can move ${built > 1 ? 'them' : 'it'} into the room whenever you like.`
      : 'Build something first — an empty room does not score very well.'));
    const furnish = h('button', 'btn primary', 'Move into the bedroom');
    furnish.disabled = !built;
    furnish.onclick = onFurnish;
    next.append(furnish);
    const back = h('button', 'btn ghost', 'Look at other flats');
    back.onclick = onBack;
    next.append(back);
    side.append(next);

    cols.append(grid, side);
    el.append(cols);
  }

  render();
  return { unmount: () => el.remove() };
}
