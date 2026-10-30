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

export const MONSTER_DEFINITIONS: readonly UnitDefinition[] = [
  GOBLIN, SKELETON, SLIME,
  CULTIST, INSANE, ACOLYTE, DEFORMED_DEVOTEE,
  ABYSSAL_SCALED, SCALED_GUARDIAN, RLYEH_HORROR,
  VAMPIRIC_THRALL, BLOOD_BAT, NIGHT_HUNTER, BLOOD_KNIGHT, WEREWOLF,
];


// Região 3 — Mitologia.
export const HARPY: UnitDefinition = { id:'harpy', name:'Harpia', team:'monster', symbol:'H', color:0x7c3aed, maxHp:118, damage:26, movement:2, attack:{directions:'diagonal',range:2} };
export const SATYR: UnitDefinition = { id:'satyr', name:'Sátiro', team:'monster', symbol:'S', color:0x15803d, maxHp:145, damage:28, movement:2, attack:{directions:'orthogonal',range:1} };
export const CYCLOPS: UnitDefinition = { id:'cyclops', name:'Ciclope', team:'monster', symbol:'C', color:0x92400e, maxHp:230, damage:30, movement:1, attack:{directions:'orthogonal',range:2} };
export const GORGON: UnitDefinition = { id:'gorgon', name:'Górgona', team:'monster', symbol:'G', color:0x0f766e, maxHp:175, damage:27, movement:1, attack:{directions:'diagonal',range:2} };
export const MINOTAUR: UnitDefinition = { id:'minotaur', name:'Minotauro', team:'monster', symbol:'M', color:0x991b1b, maxHp:260, damage:32, movement:1, attack:{directions:'orthogonal',range:1} };
export const UNDERWORLD_HOUND: UnitDefinition = { id:'underworld-hound', name:'Cão do Submundo', team:'monster', symbol:'U', color:0x7f1d1d, maxHp:190, damage:29, movement:2, attack:{directions:'orthogonal',range:1} };
export const UNDERWORLD_WRAITH: UnitDefinition = { id:'underworld-wraith', name:'Espectro do Submundo', team:'monster', symbol:'W', color:0x64748b, maxHp:180, damage:28, movement:1, attack:{directions:'facing',range:3} };
 
// Região 4 — País das Maravilhas.
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


// Região 4 — País das Maravilhas: criaturas surreais, imprevisíveis e agressivas.
export const CARD_SOLDIER: UnitDefinition = {
  id: 'card-soldier', name: 'Soldado de Cartas', team: 'monster', symbol: '♠', color: 0xdc2626,
  maxHp: 330, damage: 38, movement: 1, attack: { directions: 'orthogonal', range: 1 },
};
export const WHITE_RABBIT: UnitDefinition = {
  id: 'white-rabbit', name: 'Coelho Branco Frenético', team: 'monster', symbol: '兔', color: 0xe5e7eb,
  maxHp: 285, damage: 35, movement: 2, attack: { directions: 'orthogonal', range: 1 },
};
export const GIANT_CATERPILLAR: UnitDefinition = {
  id: 'giant-caterpillar', name: 'Lagarta Oracular', team: 'monster', symbol: '🐛', color: 0x16a34a,
  maxHp: 470, damage: 42, movement: 1, attack: { directions: 'orthogonal', range: 2 },
};
export const MAD_MUSHROOM: UnitDefinition = {
  id: 'mad-mushroom', name: 'Cogumelo Alucinógeno', team: 'monster', symbol: '🍄', color: 0x9333ea,
  maxHp: 390, damage: 36, movement: 1, attack: { directions: 'facing', range: 3 },
};
export const THORN_PLANT: UnitDefinition = {
  id: 'thorn-plant', name: 'Roseira Carnívora', team: 'monster', symbol: '✿', color: 0x15803d,
  maxHp: 520, damage: 44, movement: 0, attack: { directions: 'orthogonal', range: 2 },
};
