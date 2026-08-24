// Real-world summit elevations (meters above sea level), paired with the
// images already sitting in static/mountain_images/ — reused as-is rather
// than sourcing new assets, per ARCHITECTURE.md's note that an item pool can
// be shared across game types (mountainQuiz can reuse this same file later
// for identification instead of comparison).
//
// Only 22 items — that folder has no more images. GAME_PLANS.md suggests
// 30+ so a party doesn't repeat a round; flagging that shortfall rather than
// inventing items without real images. Worth adding more images later if
// repeats turn out to matter in practice.
module.exports = [
  { id: 'mont-blanc', name: 'Mont Blanc', image: '/static/mountain_images/Mont_Blanc.JPG', value: 4808 },
  { id: 'matterhorn', name: 'Matterhorn', image: '/static/mountain_images/Matterhorn.jpg', value: 4478 },
  { id: 'jungfrau', name: 'Jungfrau', image: '/static/mountain_images/Jungfrau.jpg', value: 4158 },
  { id: 'monch', name: 'Mönch', image: '/static/mountain_images/Mönch.jpg', value: 4107 },
  { id: 'eiger', name: 'Eiger', image: '/static/mountain_images/Eiger.jpg', value: 3967 },
  { id: 'gran-paradiso', name: 'Gran Paradiso', image: '/static/mountain_images/Gran_Paradiso.jpg', value: 4061 },
  { id: 'lyskamm', name: 'Lyskamm', image: '/static/mountain_images/Lyskamm.jpg', value: 4527 },
  { id: 'castor', name: 'Castor', image: '/static/mountain_images/Castor.jpg', value: 4228 },
  { id: 'mount-everest', name: 'Mount Everest', image: '/static/mountain_images/Mount_Everest.jpg', value: 8849 },
  { id: 'k2', name: 'K2', image: '/static/mountain_images/K2.jpg', value: 8611 },
  { id: 'monte-pelmo', name: 'Monte Pelmo', image: '/static/mountain_images/Monte_Pelmo.jpg', value: 3168 },
  { id: 'monte-civetta', name: 'Monte Civetta', image: '/static/mountain_images/Monte_Civetta.jpg', value: 3220 },
  { id: 'marmolata', name: 'Marmolata', image: '/static/mountain_images/Marmolata.jpg', value: 3343 },
  { id: 'sella-group', name: 'Sella Group', image: '/static/mountain_images/Sella_group.jpg', value: 3152 },
  { id: 'langkofel', name: 'Langkofel', image: '/static/mountain_images/Langkofel.jpg', value: 3181 },
  { id: 'reinebringen', name: 'Reinebringen', image: '/static/mountain_images/Reinebringen.jpg', value: 448 },
  { id: 'stetinden', name: 'Stetinden', image: '/static/mountain_images/Stetinden.JPG', value: 1392 },
  { id: 'ryten', name: 'Ryten', image: '/static/mountain_images/Ryten.jpg', value: 543 },
  { id: 'mount-asgard', name: 'Mount Asgard', image: '/static/mountain_images/Mount_Asgard.jpg', value: 2015 },
  { id: 'devils-tower', name: 'Devils Tower', image: '/static/mountain_images/Devils_Tower.jpg', value: 1267 },
  { id: 'half-dome', name: 'Half Dome', image: '/static/mountain_images/Half_Dome.jpg', value: 2694 },
  { id: 'el-capitan', name: 'El Capitan', image: '/static/mountain_images/El_Capitan.jpg', value: 2307 },
];
