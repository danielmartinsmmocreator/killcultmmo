import type { UnitDefinition } from '../types';
import { SIZE_2X2 } from './sizes';
import { ABYSS_IDOL_TELEGRAPH, CRIMSON_COUNTESS_TELEGRAPH, DRACULA_TELEGRAPH, HADES_TELEGRAPH, QUEEN_OF_HEARTS_TELEGRAPH } from './telegraphs';

/**
 * Mini-chefe e chefe principal: usam a lógica de combate comum (movimento ortogonal e ataque
 * corpo a corpo). O Ídolo do Abismo também tem ataques telegrafados (data/telegraphs.ts).
 */

export const GOBLIN_CHIEF: UnitDefinition = {
  id: 'shadow-creature',
  name: 'Criatura Sombria',
  team: 'monster',
  symbol: '♜',
  color: 0x4b5563,
  maxHp: 48,
  damage: 6,
  movement: 2,
  attack: { directions: 'orthogonal', range: 1 },
  rank: 'mini-boss',
};

export const ABYSS_IDOL: UnitDefinition = {
  id: 'abyss-idol',
  name: 'Ídolo do Abismo',
  team: 'monster',
  symbol: '♛',
  color: 0x4c1d95,
  maxHp: 170,
  damage: 8,
  movement: 1,
  attack: { directions: 'orthogonal', range: 1 },
  rank: 'boss',
  size: SIZE_2X2,
  telegraph: ABYSS_IDOL_TELEGRAPH,
};

export const CRIMSON_COUNTESS: UnitDefinition = {
  id: 'inverno', name: 'Inverno', team: 'monster', symbol: '♕', color: 0xbe123c,
  maxHp: 250, damage: 28, movement: 2,
  attack: { directions: 'orthogonal', range: 1 },
  rank: 'mini-boss', telegraph: CRIMSON_COUNTESS_TELEGRAPH,
};

export const DRACULA: UnitDefinition = {
  id: 'the-seventh', name: 'O Sétimo', team: 'monster', symbol: '♛', color: 0x7f1d1d,
  maxHp: 960, damage: 36, movement: 2,
  attack: { directions: 'orthogonal', range: 1 },
  rank: 'boss', telegraph: DRACULA_TELEGRAPH,
};

export const MEDUSA: UnitDefinition = { id:'medusa', name:'Medusa', team:'monster', symbol:'♛', color:0x0f766e, maxHp:520, damage:28, movement:1, attack:{directions:'orthogonal',range:1}, rank:'mini-boss', size: SIZE_2X2 };
export const HADES: UnitDefinition = { id:'hades', name:'Hades', team:'monster', symbol:'♚', color:0x581c87, maxHp:1250, damage:34, movement:1, attack:{directions:'orthogonal',range:1}, rank:'boss', telegraph: HADES_TELEGRAPH };

export const CHESHIRE_CAT: UnitDefinition = {
  id: 'cheshire-cat', name: 'Gato Mistério', team: 'monster', symbol: 'C', color: 0xc084fc,
  maxHp: 880, damage: 43, movement: 2,
  attack: { directions: 'diagonal', range: 2 },
  rank: 'mini-boss',
};

export const QUEEN_OF_HEARTS: UnitDefinition = {
  id: 'queen-of-hearts', name: 'Rainha de Copas', team: 'monster', symbol: 'Q', color: 0xbe123c,
  maxHp: 2350, damage: 48, movement: 1,
  attack: { directions: 'orthogonal', range: 1 },
  rank: 'boss',
  telegraph: QUEEN_OF_HEARTS_TELEGRAPH,
};


// Região 5 — Folclore Brasileiro.
export const CURUPIRA: UnitDefinition = {
  id: 'curupira', name: 'Curupira', team: 'monster', symbol: 'C', color: 0x16a34a,
  maxHp: 2600, damage: 88, movement: 2,
  attack: { directions: 'diagonal', range: 2 },
  rank: 'mini-boss',
};
export const CUCA: UnitDefinition = {
  id: 'cuca', name: 'Cuca', team: 'monster', symbol: 'Q', color: 0x4d7c0f,
  maxHp: 5900, damage: 108, movement: 1,
  attack: { directions: 'orthogonal', range: 2 },
  rank: 'boss',
};

export const SAND_VIZIER: UnitDefinition = { id:'sand-vizier', name:'Vizir das Areias', team:'monster', symbol:'♜', color:0xb45309, maxHp:3900, damage:118, movement:1, attack:{directions:'orthogonal',range:2}, rank:'mini-boss' };
export const SULTAN_OF_NIGHTS: UnitDefinition = { id:'sultan-of-nights', name:'Sultão das Mil Noites', team:'monster', symbol:'♛', color:0x92400e, maxHp:7800, damage:138, movement:1, attack:{directions:'orthogonal',range:2}, rank:'boss' };

 
// Região 7 — Ciência Proibida: chefes-base para posterior especificação de mecânicas.
export const MAD_SCIENTIST: UnitDefinition = { id:'mad-scientist', name:'Doutor das Experiências', team:'monster', symbol:'⚗', color:0x15803d, maxHp:5200, damage:152, movement:1, attack:{directions:'orthogonal',range:2}, rank:'mini-boss' };
export const FRANKENSTEIN_ABOMINATION: UnitDefinition = { id:'frankenstein-abomination', name:'Abominação de Frankenstein', team:'monster', symbol:'♜', color:0x475569, maxHp:10200, damage:178, movement:1, attack:{directions:'orthogonal',range:2}, rank:'boss' };
