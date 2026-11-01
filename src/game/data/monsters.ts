import type { UnitDefinition } from '../types';

/**
 * Monstros antigos mantidos para a batalha inicial e compatibilidade com testes.
 * Os novos tipos são usados na campanha principal.
 */
export const GOBLIN: UnitDefinition = {
  id: 'goblin',
  name: 'Goblin',
  team: 'monster',
  symbol: 'G',
  color: 0x991b1b,
  maxHp: 12,
  damage: 4,
  movement: 2,
  attack: { directions: 'orthogonal', range: 1 },
};

export const SKELETON: UnitDefinition = {
  id: 'skeleton',
  name: 'Esqueleto',
  team: 'monster',
  symbol: 'E',
  color: 0x7f1d1d,
  maxHp: 16,
  damage: 5,
  movement: 1,
  attack: { directions: 'orthogonal', range: 1 },
};

export const SLIME: UnitDefinition = {
  id: 'slime',
  name: 'Gosma',
  team: 'monster',
  symbol: 'S',
  color: 0x9f1239,
  maxHp: 14,
  damage: 3,
  movement: 1,
  attack: { directions: 'orthogonal', range: 1 },
};

export const CULTIST: UnitDefinition = {
  id: 'cultist',
  name: 'Adorador do Abismo',
  team: 'monster',
  symbol: 'A',
  color: 0x7c3aed,
  maxHp: 12,
  damage: 4,
  movement: 1,
  attack: { directions: 'orthogonal', range: 1 },
};

export const INSANE: UnitDefinition = {
  id: 'insane',
  name: 'Fanático Insano',
  team: 'monster',
  symbol: 'F',
  color: 0xb91c1c,
  maxHp: 10,
  damage: 5,
  movement: 2,
  attack: { directions: 'orthogonal', range: 1 },
};

export const ACOLYTE: UnitDefinition = {
  id: 'acolyte',
  name: 'Acólito Ritualista',
  team: 'monster',
  symbol: 'R',
  color: 0x0f766e,
  maxHp: 16,
  damage: 3,
  movement: 1,
  attack: { directions: 'orthogonal', range: 1 },
};

export const DEFORMED_DEVOTEE: UnitDefinition = {
  id: 'deformed-devotee',
  name: 'Devoto Deformado',
  team: 'monster',
  symbol: 'D',
  color: 0x64748b,
  maxHp: 18,
  damage: 5,
  movement: 1,
  attack: { directions: 'orthogonal', range: 1 },
};

export const ABYSSAL_SCALED: UnitDefinition = {
  id: 'abyssal-scaled',
  name: 'Escamoso do Abismo',
  team: 'monster',
  symbol: 'E',
  color: 0x0e7490,
  maxHp: 18,
  damage: 5,
  movement: 1,
  attack: { directions: 'orthogonal', range: 1 },
};

export const SCALED_GUARDIAN: UnitDefinition = {
  id: 'scaled-guardian',
  name: 'Guardião Escamoso',
  team: 'monster',
  symbol: 'G',
  color: 0x166534,
  maxHp: 22,
  damage: 6,
  movement: 1,
  attack: { directions: 'orthogonal', range: 1 },
};

export const RLYEH_HORROR: UnitDefinition = {
  id: 'rlyeh-horror',
  name: 'Horror de R’lyeh',
  team: 'monster',
  symbol: 'H',
  color: 0x4338ca,
  maxHp: 20,
  damage: 7,
  movement: 1,
  attack: { directions: 'orthogonal', range: 1 },
};

// Região 2 — Reino da Noite. Valores iniciais para teste: cerca de 2–3x a pressão
// dos monstros comuns da primeira região, com papéis distintos em vez de só inflar PV.
export const VAMPIRIC_THRALL: UnitDefinition = {
  id: 'vampiric-thrall', name: 'Servo Vampírico', team: 'monster', symbol: 'V', color: 0x7f1d1d,
  maxHp: 60, damage: 18, movement: 1,
  attack: { directions: 'orthogonal', range: 1 },
};

export const BLOOD_BAT: UnitDefinition = {
  id: 'blood-bat', name: 'Morcego Sanguinário', team: 'monster', symbol: 'M', color: 0xbe123c,
  maxHp: 44, damage: 16, movement: 2,
  attack: { directions: 'orthogonal', range: 1 },
};

export const NIGHT_HUNTER: UnitDefinition = {
  id: 'night-hunter', name: 'Caçador Noturno', team: 'monster', symbol: 'N', color: 0x6d28d9,
  maxHp: 56, damage: 20, movement: 2,
  attack: { directions: 'orthogonal', range: 1 },
};

export const BLOOD_KNIGHT: UnitDefinition = {
  id: 'blood-knight', name: 'Cavaleiro Sangrento', team: 'monster', symbol: 'K', color: 0x991b1b,
  maxHp: 92, damage: 24, movement: 1,
  attack: { directions: 'orthogonal', range: 1 },
};

export const WEREWOLF: UnitDefinition = {
  id: 'werewolf', name: 'Lobisomem da Lua Rubra', team: 'monster', symbol: 'L', color: 0x713f12,
  maxHp: 76, damage: 26, movement: 2,
  attack: { directions: 'orthogonal', range: 1 },
};




// Região 3 — Mitologia.
export const HARPY: UnitDefinition = { id:'harpy', name:'Harpia', team:'monster', symbol:'H', color:0x7c3aed, maxHp:118, damage:26, movement:2, attack:{directions:'diagonal',range:2} };
export const SATYR: UnitDefinition = { id:'satyr', name:'Sátiro', team:'monster', symbol:'S', color:0x15803d, maxHp:145, damage:28, movement:2, attack:{directions:'orthogonal',range:1} };
export const CYCLOPS: UnitDefinition = { id:'cyclops', name:'Ciclope', team:'monster', symbol:'C', color:0x92400e, maxHp:230, damage:30, movement:1, attack:{directions:'orthogonal',range:2} };
export const GORGON: UnitDefinition = { id:'gorgon', name:'Górgona', team:'monster', symbol:'G', color:0x0f766e, maxHp:175, damage:27, movement:1, attack:{directions:'diagonal',range:2} };
export const MINOTAUR: UnitDefinition = { id:'minotaur', name:'Minotauro', team:'monster', symbol:'M', color:0x991b1b, maxHp:260, damage:32, movement:1, attack:{directions:'orthogonal',range:1} };
export const UNDERWORLD_HOUND: UnitDefinition = { id:'underworld-hound', name:'Cão do Submundo', team:'monster', symbol:'U', color:0x7f1d1d, maxHp:190, damage:29, movement:2, attack:{directions:'orthogonal',range:1} };
export const UNDERWORLD_WRAITH: UnitDefinition = { id:'underworld-wraith', name:'Espectro do Submundo', team:'monster', symbol:'W', color:0x64748b, maxHp:180, damage:28, movement:1, attack:{directions:'facing',range:3} };
 
// Região 4 — País das Maravilhas: criaturas surreais, imprevisíveis e agressivas.
export const CARD_SOLDIER: UnitDefinition = {
  id: 'card-soldier', name: 'Soldado de Cartas', team: 'monster', symbol: 'C', color: 0xdc2626,
  maxHp: 330, damage: 38, movement: 1, attack: { directions: 'orthogonal', range: 1 },
};
export const WHITE_RABBIT: UnitDefinition = {
  id: 'white-rabbit', name: 'Coelho Branco Frenético', team: 'monster', symbol: 'R', color: 0xe5e7eb,
  maxHp: 285, damage: 35, movement: 2, attack: { directions: 'orthogonal', range: 1 },
};
export const GIANT_CATERPILLAR: UnitDefinition = {
  id: 'giant-caterpillar', name: 'Lagarta Oracular', team: 'monster', symbol: 'L', color: 0x16a34a,
  maxHp: 470, damage: 42, movement: 1, attack: { directions: 'orthogonal', range: 2 },
};
export const MAD_MUSHROOM: UnitDefinition = {
  id: 'mad-mushroom', name: 'Cogumelo Alucinógeno', team: 'monster', symbol: 'M', color: 0x9333ea,
  maxHp: 390, damage: 36, movement: 1, attack: { directions: 'facing', range: 3 },
};
export const THORN_PLANT: UnitDefinition = {
  id: 'thorn-plant', name: 'Roseira Carnívora', team: 'monster', symbol: 'P', color: 0x15803d,
  maxHp: 520, damage: 44, movement: 0, attack: { directions: 'orthogonal', range: 2 },
};


// Região 5 — Folclore Brasileiro: criaturas das matas, rios e estradas.
export const SACI: UnitDefinition = {
  id: 'saci', name: 'Saci-Pererê', team: 'monster', symbol: 'S', color: 0xdc2626,
  maxHp: 980, damage: 58, movement: 2, attack: { directions: 'orthogonal', range: 1 },
};
export const BOITATA: UnitDefinition = {
  id: 'boitata', name: 'Boitatá', team: 'monster', symbol: 'B', color: 0xf97316,
  maxHp: 1250, damage: 64, movement: 1, attack: { directions: 'facing', range: 3 },
};
export const IARA: UnitDefinition = {
  id: 'iara', name: 'Iara', team: 'monster', symbol: 'I', color: 0x0ea5e9,
  maxHp: 1120, damage: 60, movement: 1, attack: { directions: 'diagonal', range: 2 },
};
export const MULA_SEM_CABECA: UnitDefinition = {
  id: 'mula-sem-cabeca', name: 'Mula sem Cabeça', team: 'monster', symbol: 'M', color: 0xea580c,
  maxHp: 1480, damage: 72, movement: 2, attack: { directions: 'orthogonal', range: 1 },
};
export const MAPINGUARI: UnitDefinition = {
  id: 'mapinguari', name: 'Mapinguari', team: 'monster', symbol: 'P', color: 0x78350f,
  maxHp: 1750, damage: 78, movement: 1, attack: { directions: 'orthogonal', range: 1 },
};
export const CUCA_MINION: UnitDefinition = {
  id: 'cuca-servant', name: 'Criatura da Cuca', team: 'monster', symbol: 'C', color: 0x65a30d,
  maxHp: 1320, damage: 66, movement: 1, attack: { directions: 'orthogonal', range: 2 },
};

export const DESERT_BANDIT: UnitDefinition = { id:'desert-bandit', name:'Saqueador das Dunas', team:'monster', symbol:'S', color:0xb45309, maxHp:1000, damage:92, movement:2, attack:{directions:'orthogonal',range:1} };
export const BRONZE_SCORPION: UnitDefinition = { id:'bronze-scorpion', name:'Escorpião de Bronze', team:'monster', symbol:'E', color:0xa16207, maxHp:2450, damage:96, movement:1, attack:{directions:'diagonal',range:1} };
export const SAND_DJINN: UnitDefinition = { id:'sand-djinn', name:'Djinn Errante', team:'monster', symbol:'D', color:0xf59e0b, maxHp:2250, damage:104, movement:1, attack:{directions:'facing',range:3} };
export const MIRAGE_SORCERER: UnitDefinition = { id:'mirage-sorcerer', name:'Feiticeiro das Miragens', team:'monster', symbol:'M', color:0x7c3aed, maxHp:1900, damage:100, movement:1, attack:{directions:'diagonal',range:2} };
export const DESERT_SERPENT: UnitDefinition = { id:'desert-serpent', name:'Serpente das Areias', team:'monster', symbol:'S', color:0x65a30d, maxHp:2700, damage:110, movement:2, attack:{directions:'orthogonal',range:1} };
export const DUNE_GUARDIAN: UnitDefinition = { id:'dune-guardian', name:'Guardião de Arenito', team:'monster', symbol:'G', color:0x92400e, maxHp:3100, damage:112, movement:1, attack:{directions:'orthogonal',range:2} };
// Região 7 — Ciência Proibida.
export const STITCHED_THRALL: UnitDefinition = { id:'stitched-thrall', name:'Servo Costurado', team:'monster', symbol:'T', color:0x64748b, maxHp:3450, damage:126, movement:1, attack:{directions:'orthogonal',range:1} };
export const PLAGUE_SURGEON: UnitDefinition = { id:'plague-surgeon', name:'Cirurgião da Peste', team:'monster', symbol:'P', color:0x166534, maxHp:2950, damage:120, movement:1, attack:{directions:'diagonal',range:2} };
export const LIGHTNING_REVENANT: UnitDefinition = { id:'lightning-revenant', name:'Revenante Elétrico', team:'monster', symbol:'R', color:0x38bdf8, maxHp:3250, damage:132, movement:2, attack:{directions:'facing',range:3} };
export const HOMUNCULUS: UnitDefinition = { id:'homunculus', name:'Homúnculo Instável', team:'monster', symbol:'H', color:0xa3e635, maxHp:2800, damage:118, movement:2, attack:{directions:'diagonal',range:1} };
export const IRON_AUTOMATON: UnitDefinition = { id:'iron-automaton', name:'Autômato de Ferro', team:'monster', symbol:'A', color:0x94a3b8, maxHp:3900, damage:138, movement:1, attack:{directions:'orthogonal',range:2} };
export const FLESH_GOLEM: UnitDefinition = { id:'flesh-golem', name:'Golem de Retalhos', team:'monster', symbol:'G', color:0x9f1239, maxHp:4400, damage:145, movement:1, attack:{directions:'orthogonal',range:1} };


 
// Região 8 — Reino de Oz.
export const MUNCHKIN_GUARD: UnitDefinition = { id:'munchkin-guard', name:'Guarda Munchkin', team:'monster', symbol:'M', color:0x0ea5e9, maxHp:4800, damage:158, movement:1, attack:{directions:'orthogonal',range:1} };
export const FLYING_MONKEY: UnitDefinition = { id:'flying-monkey', name:'Macaco Alado', team:'monster', symbol:'F', color:0x7c3aed, maxHp:4300, damage:166, movement:2, attack:{directions:'diagonal',range:2} };
export const TIN_WOODSMAN: UnitDefinition = { id:'tin-woodsman', name:'Lenhador de Lata', team:'monster', symbol:'T', color:0x94a3b8, maxHp:5600, damage:172, movement:1, attack:{directions:'orthogonal',range:2} };
export const COWARDLY_LION: UnitDefinition = { id:'cowardly-lion', name:'Leão Covarde', team:'monster', symbol:'L', color:0xd97706, maxHp:5200, damage:180, movement:2, attack:{directions:'orthogonal',range:1} };
export const POPPY_SENTINEL: UnitDefinition = { id:'poppy-sentinel', name:'Sentinela das Papoulas', team:'monster', symbol:'P', color:0xdc2626, maxHp:4900, damage:168, movement:0, attack:{directions:'facing',range:3} };
export const EMERALD_SENTINEL: UnitDefinition = { id:'emerald-sentinel', name:'Sentinela Esmeralda', team:'monster', symbol:'E', color:0x16a34a, maxHp:6100, damage:185, movement:1, attack:{directions:'orthogonal',range:2} };

// Região 9 — Folclore Japonês.
export const KAPPA: UnitDefinition = { id:'kappa', name:'Kappa', team:'monster', symbol:'K', color:0x0f766e, maxHp:6500, damage:190, movement:1, attack:{directions:'diagonal',range:2} };
export const TENGU: UnitDefinition = { id:'tengu', name:'Tengu', team:'monster', symbol:'T', color:0xdc2626, maxHp:6200, damage:198, movement:2, attack:{directions:'facing',range:3} };
export const YUKI_ONNA: UnitDefinition = { id:'yuki-onna', name:'Yuki-onna', team:'monster', symbol:'Y', color:0x7dd3fc, maxHp:5900, damage:194, movement:1, attack:{directions:'orthogonal',range:2} };
export const ONI: UnitDefinition = { id:'oni', name:'Oni', team:'monster', symbol:'O', color:0x991b1b, maxHp:7600, damage:210, movement:1, attack:{directions:'orthogonal',range:1} };
export const JOROGUMO: UnitDefinition = { id:'jorogumo', name:'Jorogumo', team:'monster', symbol:'J', color:0x7e22ce, maxHp:6800, damage:202, movement:1, attack:{directions:'diagonal',range:3} };
export const KITSUNE: UnitDefinition = { id:'kitsune', name:'Kitsune', team:'monster', symbol:'狐', color:0xea580c, maxHp:6300, damage:205, movement:2, attack:{directions:'orthogonal',range:2} };

export const MONSTER_DEFINITIONS: readonly UnitDefinition[] = [
  GOBLIN, SKELETON, SLIME, CULTIST, INSANE, ACOLYTE, DEFORMED_DEVOTEE, ABYSSAL_SCALED,
  SCALED_GUARDIAN, RLYEH_HORROR, VAMPIRIC_THRALL, BLOOD_BAT, NIGHT_HUNTER, BLOOD_KNIGHT,
  WEREWOLF, HARPY, SATYR, CYCLOPS, GORGON, MINOTAUR, UNDERWORLD_HOUND, UNDERWORLD_WRAITH,
  CARD_SOLDIER, WHITE_RABBIT, GIANT_CATERPILLAR, MAD_MUSHROOM, THORN_PLANT, SACI, BOITATA,
  IARA, MULA_SEM_CABECA, MAPINGUARI, CUCA_MINION, DESERT_BANDIT, BRONZE_SCORPION,
  SAND_DJINN, MIRAGE_SORCERER, DESERT_SERPENT, DUNE_GUARDIAN,
  STITCHED_THRALL, PLAGUE_SURGEON, LIGHTNING_REVENANT, HOMUNCULUS, IRON_AUTOMATON, FLESH_GOLEM,
  MUNCHKIN_GUARD, FLYING_MONKEY, TIN_WOODSMAN, COWARDLY_LION, POPPY_SENTINEL, EMERALD_SENTINEL,
  KAPPA, TENGU, YUKI_ONNA, ONI, JOROGUMO, KITSUNE,
];

