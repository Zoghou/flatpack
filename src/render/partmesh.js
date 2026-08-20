// Panels, boards, legs and rails, built from a part spec plus its derived holes.
// No CSG: a hole is a recessed disc, which reads correctly from every angle a
// player can orbit to and costs nothing.

import * as THREE from 'three';
import { MM, DEG } from '../core/util.js';
import { MATERIALS } from '../content/hardware.js';
import { faceProject } from './holes.js';

const HOLE_MAT = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 1 });
const HOLE_MAT_BAD = new THREE.MeshStandardMaterial({ color: 0x7a2020, roughness: 1, emissive: 0x3a0d0d });
const holeGeoCache = new Map();

function holeGeo(dia) {
  const key = dia.toFixed(2);
  if (!holeGeoCache.has(key)) {
    // A shallow cylinder sunk into the face: reads as a drilled hole in profile.
    holeGeoCache.set(key, new THREE.CylinderGeometry((dia / 2) * MM, (dia / 2) * MM * 0.86, 4 * MM, 20, 1, true));
  }
  return holeGeoCache.get(key);
}

/**
 * @param part  part spec (mm)
 * @param holes derived hole features for this slot
 * @param opts  { ghost, wrong, opacity, colour }
 */
export function buildPart(part, holes = [], opts = {}) {
  const g = new THREE.Group();
  const mat = MATERIALS[part.material] ?? MATERIALS.white;
  const [w, h, d] = part.size.map((v) => v * MM);

  let body;
  if (part.kind === 'rail') {
    body = new THREE.Mesh(
      new THREE.CylinderGeometry(part.size[1] / 2 * MM, part.size[1] / 2 * MM, w, 18).rotateZ(Math.PI / 2),
      surface(mat, opts),
    );
  } else {
    body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), surface(mat, opts));
  }
  body.name = 'body';
  g.add(body);

  if (!opts.ghost) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(body.geometry, 20),
      new THREE.LineBasicMaterial({ color: mat.edge, transparent: true, opacity: 0.55 }),
    );
    g.add(edges);
  }

  for (const hole of holes) {
    const { local, normal, dia } = faceProject(part, hole);
    const m = new THREE.Mesh(holeGeo(dia), opts.wrong ? HOLE_MAT_BAD : HOLE_MAT);
    m.position.set(local[0] * MM, local[1] * MM, local[2] * MM);
    orientTo(m, normal);
    m.translateY(-1.4 * MM);              // sink it just below the surface
    m.userData.hole = hole;
    g.add(m);
  }

  g.userData.part = part;
  return g;
}

function surface(mat, opts) {
  if (opts.ghost) {
    return new THREE.MeshStandardMaterial({
      color: opts.colour ?? mat.color, transparent: true, opacity: opts.opacity ?? 0.28,
      roughness: 0.8, depthWrite: false, emissive: opts.colour ?? mat.color, emissiveIntensity: 0.18,
    });
  }
  return new THREE.MeshStandardMaterial({
    color: opts.colour ?? mat.color, roughness: 0.72, metalness: mat === MATERIALS.steel ? 0.6 : 0.04,
    transparent: opts.opacity != null, opacity: opts.opacity ?? 1,
  });
}

/** A cylinder's own axis is +Y; point it along `normal` instead. */
export function orientTo(obj, normal) {
  const n = new THREE.Vector3(normal[0], normal[1], normal[2]).normalize();
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
}

/** Put a group where a slot says it goes (mm + degrees in, scene metres out). */
export function placeAt(group, pos, rot) {
  group.position.set(pos[0] * MM, pos[1] * MM, pos[2] * MM);
  group.rotation.set(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG, 'XYZ');
  return group;
}

/** Wireframe outline used for ghosts and for the exploded view. */
export function buildOutline(part, colour = 0x6fd3ff) {
  const [w, h, d] = part.size.map((v) => v * MM);
  const box = new THREE.BoxGeometry(w, h, d);
  const line = new THREE.LineSegments(
    new THREE.EdgesGeometry(box),
    new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: 0.9 }),
  );
  box.dispose();
  return line;
}
