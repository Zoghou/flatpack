// Boot and phase router. Exactly one phase is mounted at a time; the 3D stage is
// shared and cleared between them.

import { createStage } from './render/scene.js';
import { state, load, save, reset, setPhase, ownedRecord } from './core/store.js';
import { getApartment } from './content/apartments.js';
import { getKit } from './content/catalog.js';
import { mountApartment } from './phases/apartment.js';
import { mountShop } from './phases/shop.js';
import { mountBuild } from './phases/build.js';
import { mountTitle } from './phases/title.js';
import { h } from './ui/dom.js';

/** Placeholder for a phase that is not written yet. */
function notYet(text) {
  const el = h('div', 'hud-hint', text);
  document.getElementById('ui').append(el);
  setTimeout(() => el.remove(), 3500);
}

const canvas = document.getElementById('stage');
const root = document.getElementById('ui');
const stage = createStage(canvas);
let current = null;

function go(phase, extra = {}) {
  current?.unmount();
  current = null;
  root.innerHTML = '';
  stage.clearWorld();
  document.body.dataset.phase = phase;
  setPhase(phase, extra);

  const flat = getApartment(state.flatId);
  switch (phase) {
    case 'title': {
      const resume = resumePhase();
      current = mountTitle({
        root,
        onNew: () => { reset(); go('apartment'); },
        onResume: state.flatId ? () => go(resume) : null,
        resumeLabel: resume === 'build' ? `Continue building ${getKit(state.activeKitId).name}` : 'Continue',
      });
      break;
    }
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
        onBuild: (kitId) => go('build', { activeKitId: kitId }),
        onFurnish: () => notYet('Furnishing the room is the next phase.'),
        onBack: () => go('apartment'),
      });
      break;
    case 'build': {
      const kit = getKit(state.activeKitId);
      if (!kit) { go('shop'); return; }
      if (ownedRecord(kit.id)?.built) state.buildSnapshot = null;
      current = mountBuild({
        stage, root, kit,
        onExit: () => go('shop'),
        onFinished: () => go('shop'),
      });
      break;
    }
    default:
      go('title');
  }
}

/** Where "Continue" drops you: back into the build if one is half finished. */
function resumePhase() {
  if (!state.flatId) return 'apartment';
  if (state.buildSnapshot?.kitId && getKit(state.buildSnapshot.kitId)) return 'build';
  return state.phase === 'title' ? 'shop' : state.phase;
}

load();
if (state.buildSnapshot?.kitId) state.activeKitId = state.buildSnapshot.kitId;
go('title');
window.addEventListener('beforeunload', save);
