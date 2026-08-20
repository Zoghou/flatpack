// Boot and phase router. Exactly one phase is mounted at a time; the 3D stage is
// shared and cleared between them.

import { createStage } from './render/scene.js';
import { state, load, save, reset, setPhase } from './core/store.js';
import { getApartment } from './content/apartments.js';
import { mountApartment } from './phases/apartment.js';
import { mountShop } from './phases/shop.js';
import { mountTitle } from './phases/title.js';
import { h } from './ui/dom.js';

const root = document.getElementById('ui');
const stage = createStage(document.getElementById('stage'));
let current = null;

/** Placeholder for a phase that is not written yet. */
function notYet(text) {
  const el = h('div', 'hud-hint', text);
  root.append(el);
  setTimeout(() => el.remove(), 3500);
}

function go(phase, extra = {}) {
  current?.unmount();
  current = null;
  root.innerHTML = '';
  stage.clearWorld();
  document.body.dataset.phase = phase;
  setPhase(phase, extra);

  const flat = getApartment(state.flatId);
  switch (phase) {
    case 'apartment':
      current = mountApartment({
        root,
        onChosen: (a) => {
          const changed = state.flatId !== a.id;
          go('shop', { flatId: a.id, budget: a.budget, ...(changed ? { spent: 0, owned: [], layout: {} } : {}) });
        },
      });
      break;
    case 'shop':
      current = mountShop({
        root, flat,
        onBuild: (kitId) => notYet(`Assembly arrives in the next phase — ${kitId} is in the box for now.`),
        onFurnish: () => notYet('Furnishing arrives once there is something built to put in the room.'),
        onBack: () => go('apartment'),
      });
      break;
    default:
      current = mountTitle({
        root,
        onNew: () => { reset(); go('apartment'); },
        onResume: state.flatId ? () => go('shop') : null,
      });
  }
}

load();
go('title');
window.addEventListener('beforeunload', save);
