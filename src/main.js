// Boot and phase router. Exactly one phase is mounted at a time; the 3D stage is
// shared and cleared between them.

import { createStage } from './render/scene.js';
import { state, load, save, reset, setPhase } from './core/store.js';
import { getApartment } from './content/apartments.js';
import { mountApartment } from './phases/apartment.js';
import { mountTitle } from './phases/title.js';

const root = document.getElementById('ui');
const stage = createStage(document.getElementById('stage'));
let current = null;

function go(phase, extra = {}) {
  current?.unmount();
  current = null;
  root.innerHTML = '';
  stage.clearWorld();
  document.body.dataset.phase = phase;
  setPhase(phase, extra);

  switch (phase) {
    case 'apartment':
      current = mountApartment({
        root,
        onChosen: (a) => go('title', { flatId: a.id, budget: a.budget, spent: 0, owned: [], layout: {} }),
      });
      break;
    default:
      current = mountTitle({
        root,
        onNew: () => { reset(); go('apartment'); },
        onResume: state.flatId ? () => go('apartment') : null,
        resumeLabel: state.flatId ? `Back to the listings (${getApartment(state.flatId).name})` : 'Continue',
      });
  }
}

load();
go('title');
window.addEventListener('beforeunload', save);
