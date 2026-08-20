// The build-phase HUD. All DOM, no Three.js: it renders whatever the runtime
// says is true and reports clicks back through callbacks.

import { TOOLS, MATERIALS } from '../content/hardware.js';
import { clock } from '../core/util.js';
import { gradeColour } from '../sim/scoring.js';
import { h } from './dom.js';

export function createHud(root, cb) {
  const el = h('div', 'hud');
  root.appendChild(el);

  // ---------------------------------------------------------------- top bar --
  const top = h('div', 'hud-top');
  const title = h('div', 'kit-title');
  title.innerHTML = `<b>${cb.kit.name}</b><span>${cb.kit.product}</span>`;
  const progress = h('div', 'progress');
  const progressBar = h('i');
  progress.appendChild(progressBar);
  const readout = h('div', 'readout');
  const timer = h('div', 'timer', '00:00');
  const buttons = h('div', 'top-buttons');
  const explodeBtn = h('button', 'btn ghost', 'Exploded view');
  const assistBtn = h('button', 'btn ghost', 'Assist: on');
  const exitBtn = h('button', 'btn ghost', 'Leave');
  explodeBtn.onclick = () => cb.onExplode();
  assistBtn.onclick = () => cb.onAssist();
  exitBtn.onclick = () => cb.onExit();
  buttons.append(explodeBtn, assistBtn, exitBtn);
  top.append(title, progress, readout, timer, buttons);

  // ------------------------------------------------------------ left column --
  const left = h('div', 'hud-left');
  const stepCard = h('div', 'card step-card');
  const stepHead = h('div', 'step-head');
  const stepBody = h('div', 'step-body');
  const bookletWrap = h('div', 'booklet');
  const bookletCanvas = h('canvas', 'booklet-canvas');
  const bookletTag = h('div', 'booklet-tag', 'STEP');
  bookletWrap.append(bookletCanvas, bookletTag);
  const stepActions = h('div', 'step-actions');
  stepCard.append(stepHead, bookletWrap, stepBody, stepActions);

  const stepsCard = h('div', 'card steps-card');
  stepsCard.append(h('h3', null, 'Assembly order'));
  const stepList = h('ol', 'step-list');
  stepsCard.append(stepList);
  left.append(stepCard, stepsCard);

  // ----------------------------------------------------------- right column --
  const right = h('div', 'hud-right');
  const bomCard = h('div', 'card bom-card');
  const bomHead = h('div', 'card-head');
  bomHead.append(h('h3', null, 'Parts'), h('span', 'muted', 'click to pick up'));
  const bomList = h('div', 'bom-list');
  bomCard.append(bomHead, bomList);

  const rackCard = h('div', 'card rack-card');
  rackCard.append(h('h3', null, 'Tools'));
  const rack = h('div', 'rack');
  for (const t of Object.values(TOOLS)) {
    const b = h('button', 'tool');
    b.dataset.tool = t.id;
    b.innerHTML = `<span class="glyph">${t.glyph}</span><span class="tname">${t.name}</span><span class="tkey">${t.key}</span>`;
    b.title = t.hint;
    b.onclick = () => cb.onTool(t.id);
    rack.appendChild(b);
  }
  const toolHint = h('div', 'tool-hint');
  rackCard.append(rack, toolHint);

  const rigCard = h('div', 'card rig-card');
  rigCard.append(h('h3', null, 'Constraint readout'));
  const rigBody = h('div', 'rig-body');
  rigCard.append(rigBody);
  right.append(bomCard, rackCard, rigCard);

  // ------------------------------------------------------------ bottom bits --
  const hint = h('div', 'hud-hint');
  const gauge = h('div', 'gauge hidden');
  gauge.innerHTML = `
    <div class="gauge-label"></div>
    <div class="gauge-track">
      <div class="gauge-band"></div>
      <div class="gauge-strip"></div>
      <div class="gauge-fill"></div>
      <div class="gauge-needle"></div>
    </div>
    <div class="gauge-foot"><span class="gauge-value">0%</span><span class="gauge-help">hold to drive, let go inside the band</span></div>`;
  const log = h('div', 'log');
  const overlay = h('div', 'overlay hidden');

  el.append(top, left, right, hint, gauge, log, overlay);

  // ------------------------------------------------------------------- api ---
  let lastStepId = null;

  function setSteps(asm) {
    stepList.innerHTML = '';
    for (const s of asm.steps) {
      const st = asm.stepStatus(s);
      const li = h('li', `step ${st}`);
      li.append(h('span', 'dot'), h('span', 'label', s.title));
      if (st === 'open') li.onclick = () => cb.onStepSelect(s.id);
      stepList.appendChild(li);
    }
    const p = asm.progress();
    progressBar.style.width = `${Math.round(p * 100)}%`;
    progress.title = `${asm.state.completed.size} of ${asm.steps.length} steps`;
  }

  function setStep(step, asm, extra = {}) {
    stepHead.innerHTML = '';
    if (!step) {
      stepHead.append(h('h2', null, 'Nothing left to do'));
      stepBody.innerHTML = '';
      stepActions.innerHTML = '';
      return;
    }
    const n = asm.steps.indexOf(step) + 1;
    stepHead.append(h('div', 'step-no', `Step ${n} of ${asm.steps.length}`), h('h2', null, step.title));
    if (step.tool) {
      const t = TOOLS[step.tool];
      stepHead.append(h('div', 'step-tool', `${t.glyph}  ${t.name}`));
    }
    stepBody.innerHTML = '';
    if (step.blurb) stepBody.append(h('p', null, step.blurb));
    if (step.teach) {
      const box = h('div', 'teach');
      box.append(h('span', 'teach-tag', 'why'), h('p', null, step.teach));
      stepBody.append(box);
    }
    if (extra.detail) stepBody.append(h('p', 'detail', extra.detail));
    stepActions.innerHTML = '';
    for (const a of extra.actions ?? []) {
      const b = h('button', `btn ${a.kind ?? ''}`, a.label);
      b.onclick = a.onClick;
      stepActions.appendChild(b);
    }
    bookletTag.textContent = `STEP ${n}`;
    lastStepId = step.id;
  }

  function setBom(asm, held) {
    bomList.innerHTML = '';
    for (const p of asm.kit.parts) {
      const slots = asm.kit.slots.filter((s) => s.part === p.id);
      const left = slots.filter((s) => !asm.isPlaced(s.id)).length;
      const row = h('button', `bom-row${left === 0 ? ' spent' : ''}${held === p.id ? ' held' : ''}`);
      const swatch = h('span', 'swatch');
      swatch.style.background = `#${(MATERIALS[p.material] ?? MATERIALS.white).color.toString(16).padStart(6, '0')}`;
      const info = h('span', 'bom-info');
      info.innerHTML = `<b>${p.name}</b><span class="art">${p.id}</span>`;
      const dims = h('span', 'bom-dims', `${p.size.map((v) => Math.round(v)).join(' × ')}`);
      const count = h('span', 'bom-count', `${left}/${slots.length}`);
      row.append(swatch, info, dims, count);
      if (asm.state.checked.has(p.id)) row.classList.add('checked');
      row.title = p.note ?? '';
      row.onclick = () => cb.onPartPick(p.id);
      bomList.appendChild(row);
    }
  }

  function setTool(toolId) {
    for (const b of rack.children) b.classList.toggle('on', b.dataset.tool === toolId);
    toolHint.textContent = TOOLS[toolId]?.hint ?? '';
  }

  function setReadout(rig, asm) {
    const pct = Math.round(rig.stiffness * 100);
    readout.innerHTML = `
      <span class="ro"><b>${pct}%</b> stiffness</span>
      <span class="ro"><b>${rig.jointsDone}/${rig.jointsTotal}</b> fasteners</span>
      <span class="ro"><b>${Math.round(rig.squareness * 100)}%</b> square</span>`;
    readout.querySelector('.ro b').style.color = pct > 80 ? '#7ee787' : pct > 45 ? '#f0d264' : '#ef8a6a';

    rigBody.innerHTML = '';
    if (!rig.parts.length) {
      rigBody.append(h('p', 'muted', 'Nothing placed yet. Every part starts with six degrees of freedom; fasteners take them away.'));
      return;
    }
    for (const p of rig.parts) {
      const row = h('div', `rig-row ${p.rigid ? 'ok' : p.connected ? 'weak' : 'free'}`);
      const label = p.byDesign ? `free by design (${p.freeBy})` : p.rigid ? 'fixed' : p.connected ? `${p.dof} DOF left` : 'not tied down';
      row.innerHTML = `<span class="rig-name">${p.name}</span>
        <span class="rig-bar"><i style="width:${Math.round((p.constraints / 6) * 100)}%"></i></span>
        <span class="rig-dof">${label}</span>`;
      if (p.placedWrong) row.classList.add('wrong');
      rigBody.appendChild(row);
    }
  }

  function toast(ev) {
    if (!ev?.text) return;
    const t = h('div', `toast ${ev.kind}`, ev.text);
    log.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 4200);
    while (log.children.length > 4) log.firstChild.remove();
  }

  const setHint = (text) => { hint.innerHTML = text ?? ''; hint.classList.toggle('hidden', !text); };
  const setTimer = (ms) => { timer.textContent = clock(ms); };

  function showGauge({ label, band, strip, unit = 'torque' }) {
    gauge.classList.remove('hidden');
    gauge.querySelector('.gauge-label').textContent = label;
    const b = gauge.querySelector('.gauge-band');
    b.style.left = `${band[0] * 100}%`;
    b.style.width = `${(band[1] - band[0]) * 100}%`;
    gauge.querySelector('.gauge-strip').style.left = `${strip * 100}%`;
    gauge.querySelector('.gauge-help').textContent = unit === 'strike'
      ? 'hold to wind up, let go inside the band' : 'hold to drive, let go inside the band';
    setPower(0);
  }
  const hideGauge = () => gauge.classList.add('hidden');
  function setPower(p) {
    gauge.querySelector('.gauge-fill').style.width = `${p * 100}%`;
    gauge.querySelector('.gauge-needle').style.left = `${p * 100}%`;
    gauge.querySelector('.gauge-value').textContent = `${Math.round(p * 100)}%`;
  }

  /** Big centred panel used for the BOM check, the report card and confirmations. */
  function showOverlay(build) {
    overlay.innerHTML = '';
    overlay.classList.remove('hidden');
    const card = h('div', 'card overlay-card');
    overlay.appendChild(card);
    build(card, () => overlay.classList.add('hidden'));
    return card;
  }
  const hideOverlay = () => overlay.classList.add('hidden');

  function showReport(res, rig, asm, actions) {
    const card = showOverlay((c) => {
      c.classList.add('report');
      const head = h('div', 'report-head');
      const g = h('div', 'grade', res.grade);
      g.style.color = gradeColour(res.grade);
      head.append(g, (() => {
        const d = h('div');
        d.innerHTML = `<h2>${asm.kit.name} — engineering report</h2>
          <p class="muted">${res.score}/100 · built in ${clock(res.elapsed)} (par ${clock(res.par)})</p>`;
        return d;
      })());
      c.append(head);

      const table = h('div', 'terms');
      for (const t of res.terms) {
        const row = h('div', 'term');
        row.innerHTML = `<span>${t.label}</span>
          <span class="term-bar"><i style="width:${Math.round(t.value * 100)}%"></i></span>
          <span class="term-num">${Math.round(t.value * t.weight)}/${t.weight}</span>`;
        table.appendChild(row);
      }
      c.append(table);

      const facts = h('div', 'facts');
      facts.innerHTML = `
        <div><b>${rig.jointsDone}/${rig.jointsTotal}</b><span>fasteners carrying load</span></div>
        <div><b>${Math.round(rig.stiffness * 100)}%</b><span>stiffness</span></div>
        <div><b>${res.damage}</b><span>damaged fasteners</span></div>
        <div><b>${res.misplacements}</b><span>parts fitted wrong way</span></div>`;
      c.append(facts);

      const notes = h('ul', 'notes');
      res.notes.forEach((n) => notes.append(h('li', null, n)));
      c.append(notes);

      if (res.faults.length) {
        const f = h('div', 'faults');
        f.append(h('h4', null, 'Damaged hardware'));
        res.faults.forEach((x) => f.append(h('div', 'fault', `${x.fastener} — ${x.fault}`)));
        c.append(f);
      }

      const row = h('div', 'overlay-actions');
      for (const a of actions) {
        const b = h('button', `btn ${a.kind ?? 'primary'}`, a.label);
        b.onclick = a.onClick;
        row.appendChild(b);
      }
      c.append(row);
    });
    return card;
  }

  return {
    el, bookletCanvas,
    setSteps, setStep, setBom, setTool, setReadout, toast, setHint, setTimer,
    showGauge, hideGauge, setPower, showOverlay, hideOverlay, showReport,
    setAssist(on) { assistBtn.textContent = `Assist: ${on ? 'on' : 'off'}`; },
    setExplode(on) { explodeBtn.classList.toggle('on', on); },
    destroy() { el.remove(); },
  };
}
