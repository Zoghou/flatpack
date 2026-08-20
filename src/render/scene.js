// The shared Three.js stage: renderer, camera, lights, floor. Rendering is on
// demand — nothing redraws unless something changed or an animation is running.

import * as THREE from 'three';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import { MM } from '../core/util.js';

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x11141a);
  scene.fog = new THREE.Fog(0x11141a, 6, 26);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);
  camera.position.set(1.6, 1.4, 2.2);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.4;
  controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.target.set(0, 0.4, 0);

  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2622, 1.15));
  const key = new THREE.DirectionalLight(0xfff2df, 1.55);
  key.position.set(2.6, 4.2, 2.4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fb6ff, 0.5);
  fill.position.set(-3, 1.6, -2.2);
  scene.add(fill);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(9, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x1a1f27, roughness: 0.95, metalness: 0 }),
  );
  floor.position.y = -0.001;
  scene.add(floor);

  const grid = new THREE.GridHelper(12, 48, 0x2f3a49, 0x212832);
  grid.material.transparent = true;
  grid.material.opacity = 0.6;
  scene.add(grid);

  const world = new THREE.Group();          // everything a phase adds lives here
  scene.add(world);

  let dirty = true;
  let animators = new Set();
  const requestRender = () => { dirty = true; };
  controls.addEventListener('change', requestRender);

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    if (canvas.width === w * renderer.getPixelRatio() && canvas.height === h * renderer.getPixelRatio()) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const fn of animators) fn(dt, now / 1000);
    if (controls.update()) dirty = true;
    if (dirty || animators.size) { renderer.render(scene, camera); dirty = false; }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  /** Screen event -> first hit among `objects` (recursive). */
  function pick(event, objects) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((event.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((event.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(objects, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData?.pick) o = o.parent;
      if (o) return { object: o, point: h.point, distance: h.distance };
    }
    return null;
  }

  /** Point the camera at a bounding box, from a comfortable three-quarter angle. */
  function frame(box, { azimuth = 0.85, elevation = 0.42, pad = 1.5 } = {}) {
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.35, size.length() / 2);
    const dist = (radius * pad) / Math.tan((camera.fov * Math.PI) / 360);
    camera.position.set(
      centre.x + Math.sin(azimuth) * Math.cos(elevation) * dist,
      centre.y + Math.sin(elevation) * dist,
      centre.z + Math.cos(azimuth) * Math.cos(elevation) * dist,
    );
    controls.target.copy(centre);
    controls.update();
    requestRender();
  }

  const frameObject = (obj, opts) => frame(new THREE.Box3().setFromObject(obj), opts);

  return {
    THREE, renderer, scene, camera, controls, world, floor, grid,
    requestRender, pick, frame, frameObject,
    addAnimator(fn) { animators.add(fn); return () => animators.delete(fn); },
    clearWorld() {
      for (const child of [...world.children]) { world.remove(child); disposeTree(child); }
      requestRender();
    },
    setBackground(hex) { scene.background = new THREE.Color(hex); scene.fog.color.set(hex); requestRender(); },
    dispose() { ro.disconnect(); controls.dispose(); },
    mm: MM,
  };
}

export function disposeTree(root) {
  root.traverse?.((o) => {
    o.geometry?.dispose?.();
    const m = o.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose?.()); else m?.dispose?.();
  });
}
