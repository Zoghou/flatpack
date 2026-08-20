// Boot and phase router. For now there is one screen; phases get wired in here
// as they arrive. See docs/PLAN.md for the order.

import { createStage } from './render/scene.js';
import { state, load, save } from './core/store.js';
import { mountTitle } from './phases/title.js';

const root = document.getElementById('ui');
createStage(document.getElementById('stage'));   // the lit backdrop behind the UI

load();
mountTitle({ root, onNew: null, onResume: null });
window.addEventListener('beforeunload', save);
