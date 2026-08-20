// Flats you can rent. The bedroom is the room the MVP plays in; the rest of the
// flat is there to make the trade-off real. All dimensions in millimetres.

export const APARTMENTS = [
  {
    id: 'linden',
    name: 'Lindenstraße 14',
    line: 'Second floor, 1930s block, no lift',
    rent: 980,
    area: 54,
    budget: 620,
    photo: ['#3b4a5e', '#7d8ea6'],
    access: { maxBoard: 2400, note: 'Wide 1930s stairwell, no lift — long boards go up on their edge' },
    bedroom: {
      w: 3600, d: 3200, ceiling: 2500,
      door: { wall: 'south', at: 700, width: 850, height: 2050, swing: 'in-right' },
      window: { wall: 'north', at: 1900, width: 1400, sill: 900 },
      radiator: { wall: 'north', at: 1900, width: 1200, depth: 120 },
    },
    quirks: [
      'Parquet, so nothing gets dragged',
      'Radiator under the window — do not box it in',
      'Door opens inward and takes a 850 mm bite out of the corner',
    ],
  },
  {
    id: 'kanal',
    name: 'Kanalweg 3',
    line: 'Attic conversion, cheap for a reason',
    rent: 720,
    area: 47,
    budget: 880,
    photo: ['#4a4335', '#a8956f'],
    access: { maxBoard: 1800, note: 'The last flight is a boxed attic stair with a 90° turn' },
    bedroom: {
      w: 4000, d: 3000, ceiling: 2100,
      door: { wall: 'south', at: 500, width: 720, height: 1900, swing: 'in-left' },
      window: { wall: 'east', at: 1500, width: 900, sill: 1100 },
      radiator: { wall: 'south', at: 2600, width: 800, depth: 110 },
    },
    quirks: [
      'Biggest bedroom of the three, and the cheapest',
      'Ceiling is 2.10 m — measure before you buy anything tall',
      'The attic stair turns 90° — nothing over 1.8 m gets up it',
    ],
  },
  {
    id: 'hafen',
    name: 'Hafenblick 22',
    line: 'New build, third floor, lift',
    rent: 1240,
    area: 61,
    budget: 340,
    photo: ['#2f4a4a', '#7fb0ac'],
    access: { maxBoard: 2100, note: 'Lift, 2100 mm car' },
    bedroom: {
      w: 3200, d: 2800, ceiling: 2600,
      door: { wall: 'west', at: 1600, width: 900, height: 2100, swing: 'in-right' },
      window: { wall: 'south', at: 1600, width: 2000, sill: 400 },
      radiator: { wall: 'south', at: 800, width: 900, depth: 90 },
    },
    quirks: [
      'Tall ceilings, flat walls, everything square',
      'Floor-to-almost-floor window eats a whole wall',
      'The rent leaves you very little for furniture',
    ],
  },
];

export const getApartment = (id) => APARTMENTS.find((a) => a.id === id) ?? null;
