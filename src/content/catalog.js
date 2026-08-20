// The shop. Buildable entries point at a kit; props are bought, not built.

import nightstand from './kits/nightstand.js';
import wardrobe from './kits/wardrobe.js';
import bed from './kits/bed.js';

export const KITS = { nightstand, wardrobe, bed };
export const getKit = (id) => KITS[id] ?? null;

const fromKit = (kit, extra) => ({
  id: kit.id, kitId: kit.id, name: kit.name, product: kit.product, price: kit.price,
  blurb: kit.blurb, difficulty: kit.difficulty, buildable: true,
  size: kit.assembled, parts: kit.parts.length, partSizes: kit.parts.map((x) => x.size),
  fasteners: kit.joints.length, steps: kit.steps.length,
  parTimeMs: kit.parTimeMs, clearance: kit.clearance,
  ...extra,
});

export const CATALOG = [
  fromKit(bed, { essential: true, tags: ['bed', 'pine'] }),
  fromKit(wardrobe, { essential: true, tags: ['storage', 'door'] }),
  fromKit(nightstand, { tags: ['storage', 'small'] }),
  {
    id: 'rug', name: 'SÄVGRÄS', product: 'Flat-woven rug 170 × 240', price: 45, buildable: false,
    blurb: 'Unroll it. That is the entire assembly procedure.', size: { w: 1700, d: 2400, h: 8 },
    parts: 1, fasteners: 0, steps: 0, difficulty: 0, tags: ['soft'], clearance: [], flexible: true,
  },
  {
    id: 'lamp', name: 'GLÖDBOK', product: 'Floor lamp, 1500 mm', price: 29, buildable: false,
    blurb: 'Three pieces that push together. Not a build, and it knows it.', size: { w: 280, d: 280, h: 1500 },
    parts: 3, fasteners: 0, steps: 0, difficulty: 0, tags: ['light'], clearance: [],
  },
];

export const getProduct = (id) => CATALOG.find((c) => c.id === id) ?? null;

/**
 * Everything the shop needs to warn you about before you spend the money.
 * The interesting one is `tilt`: a tall carcass is built flat on the floor and
 * then stood up, which needs its diagonal, not its height, in ceiling clearance.
 */
export function fitChecks(product, flat, remaining) {
  const room = flat.bedroom;
  const { w, d, h } = product.size;
  const tilt = Math.hypot(h, d);
  const checks = [
    { id: 'budget', label: 'Within budget', ok: product.price <= remaining, detail: `€${product.price} of €${remaining} left` },
    { id: 'footprint', label: 'Fits the floor', ok: w <= room.w - 200 && d <= room.d - 200, detail: `${w} × ${d} mm in a ${room.w} × ${room.d} room` },
    { id: 'height', label: 'Fits under the ceiling', ok: h <= room.ceiling - 50, detail: `${h} mm under ${room.ceiling} mm` },
  ];
  if (h > 900) {
    checks.push({
      id: 'tilt', label: 'Can be stood up in the room', ok: tilt <= room.ceiling - 30,
      detail: `needs ${Math.round(tilt)} mm of swing to tilt upright; ceiling is ${room.ceiling} mm`,
    });
  }
  // The assembled piece never has to go through the door — you build it in the
  // room. What has to get there is the flat pack, and the thing that stops it is
  // the way up: a stairwell turn or a lift car.
  const boards = product.partSizes ?? [[w, d, h]];
  const longest = Math.max(...boards.map((s) => Math.max(...s)));
  const widest = Math.max(...boards.map((s) => [...s].sort((a, b) => b - a)[1]));
  if (!product.flexible) {
    checks.push({
      id: 'access', label: 'Gets up to the flat', ok: longest <= flat.access.maxBoard,
      detail: `longest board ${Math.round(longest)} mm; ${flat.access.note.toLowerCase()} (${flat.access.maxBoard} mm)`,
    });
    checks.push({
      id: 'door', label: 'Through the bedroom door', ok: widest <= room.door.height - 40,
      detail: `boards go through on edge at ${Math.round(widest)} mm; the opening is ${room.door.width} × ${room.door.height} mm`,
    });
  }
  return checks;
}
