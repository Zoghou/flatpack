// The fasteners you can actually see once they are in, and the rings you click
// on to drive them.

import * as THREE from 'three';
import { MM } from '../core/util.js';
import { FASTENERS } from '../content/hardware.js';
import { orientTo } from './partmesh.js';

const QUALITY_COLOUR = (q) => (q >= 0.95 ? 0xd7dce3 : q >= 0.5 ? 0xd8a24a : 0xc4483c);

/** The visible end of a driven fastener, at a site from holes.driveSite(). */
export function buildFastener(joint, phase, quality, site) {
  const f = FASTENERS[joint.type];
  const g = new THREE.Group();
  const colour = QUALITY_COLOUR(quality);
  const mat = new THREE.MeshStandardMaterial({ color: colour, metalness: 0.75, roughness: 0.35 });
  const shape = f.geom.shape;

  if (shape === 'dowel') {
    const d = f.geom.dia * MM, l = f.geom.len * MM;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, l, 14),
      new THREE.MeshStandardMaterial({ color: f.geom.color, roughness: 0.85 }));
    m.position.y = l / 2 - 2 * MM;        // sticking out of the face it was tapped into
    g.add(m);
  } else if (shape === 'cam') {
    const d = f.geom.dia * MM;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, 3 * MM, 20), mat);
    disc.position.y = -1 * MM;
    g.add(disc);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(d * 0.62, 1.6 * MM, d * 0.22),
      new THREE.MeshStandardMaterial({ color: 0x22262c }));
    slot.position.y = 0.6 * MM;
    g.add(slot);
  } else if (shape === 'screw') {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(f.geom.head ? f.geom.head / 2 * MM : 5 * MM, 3 * MM, 2.6 * MM, 16), mat);
    g.add(head);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(6 * MM, 1.2 * MM, 1.4 * MM),
      new THREE.MeshStandardMaterial({ color: 0x2a2e34 }));
    cross.position.y = 1.2 * MM;
    g.add(cross);
    const cross2 = cross.clone(); cross2.rotation.y = Math.PI / 2; g.add(cross2);
  } else if (shape === 'nail') {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(f.geom.head / 2 * MM, f.geom.head / 2 * MM, 1.2 * MM, 10), mat);
    g.add(head);
  } else if (shape === 'hinge') {
    const [pw, ph, pt] = f.geom.plate;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(pt * MM, ph * MM, pw * MM), mat);
    plate.position.y = pt * MM;
    g.add(plate);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(f.geom.cup / 2 * MM, f.geom.cup / 2 * MM, 4 * MM, 20), mat);
    g.add(cup);
  }

  orientTo(g, site.normal);
  g.position.set(site.pos[0] * MM, site.pos[1] * MM, site.pos[2] * MM);
  g.userData.joint = { id: joint.id, phase, quality };
  return g;
}

/** The clickable ring that says "the next thing happens here". */
export function buildMarker(site, { colour = 0x63d7ff, radius = 11, id, kind = 'joint', phase } = {}) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius * MM, 1.5 * MM, 8, 28).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.95, depthTest: false }),
  );
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius * MM, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.16, depthTest: false, side: THREE.DoubleSide }),
  );
  g.add(ring, disc);
  g.renderOrder = 990;
  orientTo(g, site.normal);
  g.position.set(site.pos[0] * MM, site.pos[1] * MM, site.pos[2] * MM);
  g.translateY(1.2 * MM);
  g.userData.pick = { kind, id, phase };
  return g;
}

/** An arrow showing which way a part or fastener goes in. */
export function buildArrow(fromMm, dirMm, length = 90, colour = 0x63d7ff) {
  const dir = new THREE.Vector3(...dirMm).normalize();
  const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(fromMm[0] * MM, fromMm[1] * MM, fromMm[2] * MM),
    length * MM, colour, 26 * MM, 16 * MM);
  arrow.line.material.transparent = true;
  arrow.line.material.depthTest = false;
  arrow.cone.material.depthTest = false;
  arrow.renderOrder = 991;
  return arrow;
}
