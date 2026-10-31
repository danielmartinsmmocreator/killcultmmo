import type { ItemDefinition } from '../types';

const F1 = 1;
const F2 = 11;
const F3 = 21;
const F4 = 31;
const F5 = 41;
const W = ['warrior'] as const;
const A = ['assassin'] as const;
const M = ['mage'] as const;
const C = ['cleric'] as const;
const R = ['archer'] as const;

export const ITEM_DEFINITIONS: Readonly<Record<string, ItemDefinition>> = {
  // Compatibilidade com equipamentos antigos; novos kits seguem slots padronizados.
  'worn-right-glove': { id: 'worn-right-glove', name: 'Luva de Couro Gasto', slot: 'weapon', minLevel: F1, sellPrice: 2, bonuses: { strength: 1 } },
  'worn-left-glove': { id: 'worn-left-glove', name: 'Luva de Couro Remendada', slot: 'off-hand', minLevel: F1, sellPrice: 2, bonuses: { defense: 1 } },
  'leather-boots': { id: 'leather-boots', name: 'Botas de Couro', slot: 'boots', minLevel: F1, sellPrice: 5, bonuses: { vitality: 5 } },
  'padded-chest': { id: 'padded-chest', name: 'Peitoral Acolchoado', slot: 'chest', minLevel: F1, sellPrice: 8, bonuses: { vitality: 10, defense: 1 } },
  'iron-helmet': { id: 'iron-helmet', name: 'Capacete de Ferro', slot: 'helmet', minLevel: F1, sellPrice: 7, bonuses: { defense: 2 } },
  'traveler-pants': { id: 'traveler-pants', name: 'Calça de Viajante', slot: 'boots', minLevel: F1, sellPrice: 5, bonuses: { vitality: 5 } },
  'rusty-sword': { id: 'rusty-sword', name: 'Espada Enferrujada', slot: 'weapon', minLevel: F1, sellPrice: 4, bonuses: { strength: 3 } },
  'wooden-buckler': { id: 'wooden-buckler', name: 'Broquel de Madeira', slot: 'off-hand', minLevel: F1, sellPrice: 5, bonuses: { defense: 2 } },

  // Faixa 1 — armas exclusivas por classe.
  'short-sword': { id: 'short-sword', name: 'Espada curta', slot: 'weapon', allowedClasses: W, sellPrice: 8, bonuses: { strength: 4 } },
  'axe': { id: 'axe', name: 'Machado', slot: 'weapon', allowedClasses: W, sellPrice: 10, bonuses: { strength: 5 } },
  'shield': { id: 'shield', name: 'Escudo', slot: 'off-hand', allowedClasses: W, sellPrice: 7, bonuses: { defense: 3 } },
  'knife': { id: 'knife', name: 'Faca', slot: 'weapon', allowedClasses: A, sellPrice: 7, bonuses: { strength: 4 } },
  'dagger': { id: 'dagger', name: 'Punhal', slot: 'weapon', allowedClasses: A, sellPrice: 9, bonuses: { strength: 5 } },
  'offhand-knife': { id: 'offhand-knife', name: 'Faca secundária', slot: 'off-hand', allowedClasses: A, sellPrice: 5, bonuses: { strength: 2 } },
  'offhand-dagger': { id: 'offhand-dagger', name: 'Punhal secundário', slot: 'off-hand', allowedClasses: A, sellPrice: 6, bonuses: { strength: 3 } },
  'wand': { id: 'wand', name: 'Varinha', slot: 'weapon', allowedClasses: M, sellPrice: 8, bonuses: { strength: 4 } },
  'staff': { id: 'staff', name: 'Cajado', slot: 'weapon', allowedClasses: M, sellPrice: 10, bonuses: { strength: 5 } },
  'magic-tome': { id: 'magic-tome', name: 'Tomo de magia', slot: 'off-hand', allowedClasses: M, sellPrice: 8, bonuses: { strength: 4 } },
  'glove': { id: 'glove', name: 'Luva', slot: 'weapon', allowedClasses: C, sellPrice: 7, bonuses: { strength: 3 } },
  'consecrated-staff': { id: 'consecrated-staff', name: 'Cajado consagrado', slot: 'weapon', allowedClasses: C, sellPrice: 10, bonuses: { strength: 5 } },
  'cleric-tome': { id: 'cleric-tome', name: 'Tomo de magia', slot: 'off-hand', allowedClasses: C, sellPrice: 8, bonuses: { strength: 4 } },
  'shortbow': { id: 'shortbow', name: 'Arco curto', slot: 'weapon', allowedClasses: R, sellPrice: 12, bonuses: { strength: 7 } },
  'longbow': { id: 'longbow', name: 'Arco longo', slot: 'weapon', allowedClasses: R, sellPrice: 15, bonuses: { strength: 9 } },

  // Amuletos especiais da faixa 1.
  'shadow-claw': { id: 'shadow-claw', name: 'Garra do Sombrio', slot: 'amulet', sellPrice: 20, bonuses: { strength: 5, vitality: 5, defense: 5 } },
  'cthulhu-tentacle': { id: 'cthulhu-tentacle', name: 'Tentáculo de Cthulhu', slot: 'amulet', sellPrice: 30, bonuses: { strength: 10, vitality: 10, defense: 10 } },

  // Faixa 2 — armas exclusivas por classe.
  'long-sword': { id: 'long-sword', name: 'Espada longa', slot: 'weapon', minLevel: F2, allowedClasses: W, sellPrice: 25, bonuses: { strength: 10 } },
  'double-axe': { id: 'double-axe', name: 'Machado duplo', slot: 'weapon', minLevel: F2, allowedClasses: W, sellPrice: 30, bonuses: { strength: 12 } },
  'iron-shield': { id: 'iron-shield', name: 'Escudo de ferro', slot: 'off-hand', minLevel: F2, allowedClasses: W, sellPrice: 22, bonuses: { defense: 7 } },
  'sharp-knife': { id: 'sharp-knife', name: 'Faca afiada', slot: 'weapon', minLevel: F2, allowedClasses: A, sellPrice: 24, bonuses: { strength: 10 } },
  'sharp-dagger': { id: 'sharp-dagger', name: 'Punhal afiado', slot: 'weapon', minLevel: F2, allowedClasses: A, sellPrice: 28, bonuses: { strength: 12 } },
  'offhand-sharp-knife': { id: 'offhand-sharp-knife', name: 'Faca afiada secundária', slot: 'off-hand', minLevel: F2, allowedClasses: A, sellPrice: 20, bonuses: { strength: 7 } },
  'offhand-sharp-dagger': { id: 'offhand-sharp-dagger', name: 'Punhal afiado secundário', slot: 'off-hand', minLevel: F2, allowedClasses: A, sellPrice: 23, bonuses: { strength: 8 } },
  'magic-wand': { id: 'magic-wand', name: 'Varinha mágica', slot: 'weapon', minLevel: F2, allowedClasses: M, sellPrice: 25, bonuses: { strength: 10 } },
  'magic-staff': { id: 'magic-staff', name: 'Cajado mágico', slot: 'weapon', minLevel: F2, allowedClasses: M, sellPrice: 30, bonuses: { strength: 12 } },
  'damage-tome': { id: 'damage-tome', name: 'Tomo de magia de dano', slot: 'off-hand', minLevel: F2, allowedClasses: M, sellPrice: 25, bonuses: { strength: 10 } },
  'white-glove': { id: 'white-glove', name: 'Luva branca', slot: 'weapon', minLevel: F2, allowedClasses: C, sellPrice: 22, bonuses: { strength: 8 } },
  'superior-consecrated-staff': { id: 'superior-consecrated-staff', name: 'Cajado consagrado superior', slot: 'weapon', minLevel: F2, allowedClasses: C, sellPrice: 30, bonuses: { strength: 12 } },
  'vitality-tome': { id: 'vitality-tome', name: 'Tomo de magia de vida', slot: 'off-hand', minLevel: F2, allowedClasses: C, sellPrice: 25, bonuses: { vitality: 10 } },
  'expert-shortbow': { id: 'expert-shortbow', name: 'Arco curto especialista', slot: 'weapon', minLevel: F2, allowedClasses: R, sellPrice: 35, bonuses: { strength: 15 } },
  'expert-longbow': { id: 'expert-longbow', name: 'Arco longo especialista', slot: 'weapon', minLevel: F2, allowedClasses: R, sellPrice: 40, bonuses: { strength: 18 } },

  // Amuletos especiais da faixa 2.
  'winter-cloak': { id: 'winter-cloak', name: 'Capa do Inverno', slot: 'amulet', minLevel: F2, sellPrice: 45, bonuses: {}, defensePercent: 10 },
  'seventh-fang': { id: 'seventh-fang', name: 'Dente do Sétimo', slot: 'amulet', minLevel: F2, sellPrice: 45, bonuses: {}, lifestealPercent: 5 },

  // Faixa 3 — armas e armaduras da região mitológica (andares 21–30).
  'curved-sword': { id: 'curved-sword', name: 'Espada Encurvada', slot: 'weapon', minLevel: F3, allowedClasses: W, sellPrice: 65, bonuses: { strength: 20 } },
  'bronze-spear': { id: 'bronze-spear', name: 'Lança de Bronze', slot: 'weapon', minLevel: F3, allowedClasses: W, sellPrice: 70, bonuses: { strength: 22 } },
  'hoplite-shield': { id: 'hoplite-shield', name: 'Escudo Hoplita', slot: 'off-hand', minLevel: F3, allowedClasses: W, sellPrice: 60, bonuses: { defense: 10 } },
  'bloodied-dagger': { id: 'bloodied-dagger', name: 'Adaga Ensanguentada', slot: 'weapon', minLevel: F3, allowedClasses: A, sellPrice: 65, bonuses: { strength: 20 } },
  'curved-dagger': { id: 'curved-dagger', name: 'Adaga Curva', slot: 'weapon', minLevel: F3, allowedClasses: A, sellPrice: 70, bonuses: { strength: 22 } },
  'offhand-curved-dagger': { id: 'offhand-curved-dagger', name: 'Adaga Curva Secundária', slot: 'off-hand', minLevel: F3, allowedClasses: A, sellPrice: 55, bonuses: { strength: 14 } },
  'serpent-staff': { id: 'serpent-staff', name: 'Cajado da Serpente', slot: 'weapon', minLevel: F3, allowedClasses: M, sellPrice: 70, bonuses: { strength: 22 } },
  'oracle-tome': { id: 'oracle-tome', name: 'Tomo do Oráculo', slot: 'off-hand', minLevel: F3, allowedClasses: M, sellPrice: 60, bonuses: { strength: 18 } },
  'laurel-staff': { id: 'laurel-staff', name: 'Cajado de Louro', slot: 'weapon', minLevel: F3, allowedClasses: C, sellPrice: 65, bonuses: { strength: 20 } },
  'sacred-sigil': { id: 'sacred-sigil', name: 'Símbolo Sagrado', slot: 'off-hand', minLevel: F3, allowedClasses: C, sellPrice: 55, bonuses: { vitality: 20 } },
  'centaur-bow': { id: 'centaur-bow', name: 'Arco de Centauro', slot: 'weapon', minLevel: F3, allowedClasses: R, sellPrice: 75, bonuses: { strength: 24 } },
  'composite-bow': { id: 'composite-bow', name: 'Arco Composto', slot: 'weapon', minLevel: F3, allowedClasses: R, sellPrice: 80, bonuses: { strength: 26 } },
  'hoplite-armor': { id: 'hoplite-armor', name: 'Armadura Hoplita', slot: 'chest', minLevel: F3, sellPrice: 75, bonuses: { vitality: 30, defense: 5 } },
  'bronze-helmet': { id: 'bronze-helmet', name: 'Elmo de Bronze', slot: 'helmet', minLevel: F3, sellPrice: 55, bonuses: { defense: 8 } },
  'greaves': { id: 'greaves', name: 'Grevas de Bronze', slot: 'boots', minLevel: F3, sellPrice: 60, bonuses: { vitality: 20, defense: 3 } },

  // Itens especiais raros da faixa 3 (5% de chance nos chefes de marco).
  'medusa-eye': { id: 'medusa-eye', name: 'Olho de Medusa', slot: 'amulet', minLevel: F3, sellPrice: 120, bonuses: {}, ignoreFirstHitPerEncounter: true },
  'hades-pendant': { id: 'hades-pendant', name: 'Pingente de Hades', slot: 'amulet', minLevel: F3, sellPrice: 140, bonuses: { strength: 20 } },

  // Faixa 4 — equipamentos do País das Maravilhas (andares 31–40).
  'queen-rapier': { id: 'queen-rapier', name: 'Florete da Rainha', slot: 'weapon', minLevel: F4, allowedClasses: W, sellPrice: 100, bonuses: { strength: 30 } },
  'crooked-axe': { id: 'crooked-axe', name: 'Machado Torto', slot: 'weapon', minLevel: F4, allowedClasses: W, sellPrice: 105, bonuses: { strength: 32 } },
  'card-shield': { id: 'card-shield', name: 'Escudo de Cartas', slot: 'off-hand', minLevel: F4, allowedClasses: W, sellPrice: 90, bonuses: { defense: 14 } },
  'cheshire-daggers': { id: 'cheshire-daggers', name: 'Adagas do Gato', slot: 'weapon', minLevel: F4, allowedClasses: A, sellPrice: 105, bonuses: { strength: 32 } },
  'rabbit-fang': { id: 'rabbit-fang', name: 'Presa do Coelho', slot: 'weapon', minLevel: F4, allowedClasses: A, sellPrice: 95, bonuses: { strength: 29 } },
  'mad-tea-wand': { id: 'mad-tea-wand', name: 'Varinha do Chá Maluco', slot: 'weapon', minLevel: F4, allowedClasses: M, sellPrice: 105, bonuses: { strength: 32 } },
  'caterpillar-staff': { id: 'caterpillar-staff', name: 'Cajado da Lagarta', slot: 'weapon', minLevel: F4, allowedClasses: M, sellPrice: 110, bonuses: { strength: 34 } },
  'mushroom-grimoire': { id: 'mushroom-grimoire', name: 'Grimório dos Cogumelos', slot: 'off-hand', allowedClasses: M, minLevel: F4, sellPrice: 95, bonuses: { strength: 28 } },
  'rose-scepter': { id: 'rose-scepter', name: 'Cetro das Rosas', slot: 'weapon', minLevel: F4, allowedClasses: C, sellPrice: 105, bonuses: { strength: 30 } },
  'looking-glass': { id: 'looking-glass', name: 'Espelho Curativo', slot: 'off-hand', minLevel: F4, allowedClasses: C, sellPrice: 95, bonuses: { vitality: 32 } },
  'queen-guard-staff': { id: 'queen-guard-staff', name: 'Bastão da Guarda Real', slot: 'weapon', minLevel: F4, allowedClasses: C, sellPrice: 110, bonuses: { strength: 33 } },
  'playing-card-bow': { id: 'playing-card-bow', name: 'Arco de Cartas', slot: 'weapon', minLevel: F4, allowedClasses: R, sellPrice: 115, bonuses: { strength: 35 } },
  'rabbit-ear-bow': { id: 'rabbit-ear-bow', name: 'Arco das Orelhas Brancas', slot: 'weapon', minLevel: F4, allowedClasses: R, sellPrice: 120, bonuses: { strength: 37 } },
  'rose-armor': { id: 'rose-armor', name: 'Armadura de Espinhos', slot: 'chest', minLevel: F4, sellPrice: 115, bonuses: { vitality: 42, defense: 8 } },
  'mushroom-cap': { id: 'mushroom-cap', name: 'Chapéu de Cogumelo', slot: 'helmet', minLevel: F4, sellPrice: 80, bonuses: { defense: 12 } },
  'rabbit-boots': { id: 'rabbit-boots', name: 'Botas do Coelho', slot: 'boots', minLevel: F4, sellPrice: 90, bonuses: { vitality: 28, defense: 4 } },

  // Itens especiais raros da faixa 4 (5% de chance nos encontros de marco).
  'cheshire-grin': { id: 'cheshire-grin', name: 'Sorriso de Cheshire', slot: 'amulet', minLevel: F4, sellPrice: 180, bonuses: {}, lifestealPercent: 8 },

  // Faixa 5 — equipamentos do Folclore Brasileiro (andares 41–50).
  'boitata-spear': { id: 'boitata-spear', name: 'Lança das Chamas do Boitatá', slot: 'weapon', minLevel: F5, allowedClasses: W, sellPrice: 145, bonuses: { strength: 40 } },
  'mapinguari-cleaver': { id: 'mapinguari-cleaver', name: 'Cutelo do Mapinguari', slot: 'weapon', minLevel: F5, allowedClasses: W, sellPrice: 155, bonuses: { strength: 43 } },
  'curupira-shield': { id: 'curupira-shield', name: 'Escudo das Pegadas Invertidas', slot: 'off-hand', minLevel: F5, allowedClasses: W, sellPrice: 135, bonuses: { defense: 17 } },
  'mula-hooves': { id: 'mula-hooves', name: 'Lâminas de Casco', slot: 'weapon', minLevel: F5, allowedClasses: A, sellPrice: 150, bonuses: { strength: 42 } },
  'saci-daggers': { id: 'saci-daggers', name: 'Adagas do Redemoinho', slot: 'weapon', minLevel: F5, allowedClasses: A, sellPrice: 140, bonuses: { strength: 39 } },
  'boitata-staff': { id: 'boitata-staff', name: 'Cajado da Serpente de Fogo', slot: 'weapon', minLevel: F5, allowedClasses: M, sellPrice: 155, bonuses: { strength: 43 } },
  'iara-trident': { id: 'iara-trident', name: 'Tridente de Iara', slot: 'weapon', minLevel: F5, allowedClasses: M, sellPrice: 160, bonuses: { strength: 45 } },
  'enchanted-forest-grimoire': { id: 'enchanted-forest-grimoire', name: 'Grimório da Mata Encantada', slot: 'off-hand', minLevel: F5, allowedClasses: M, sellPrice: 140, bonuses: { strength: 38 } },
  'iara-scepter': { id: 'iara-scepter', name: 'Cetro das Águas de Iara', slot: 'weapon', minLevel: F5, allowedClasses: C, sellPrice: 150, bonuses: { strength: 40 } },
  'cuca-bone-staff': { id: 'cuca-bone-staff', name: 'Cajado de Ossos da Cuca', slot: 'weapon', minLevel: F5, allowedClasses: C, sellPrice: 160, bonuses: { strength: 44 } },
  'healing-leaf-tome': { id: 'healing-leaf-tome', name: 'Tomo das Folhas Curativas', slot: 'off-hand', minLevel: F5, allowedClasses: C, sellPrice: 145, bonuses: { vitality: 40 } },
  'curupira-bow': { id: 'curupira-bow', name: 'Arco do Guardião da Mata', slot: 'weapon', minLevel: F5, allowedClasses: R, sellPrice: 165, bonuses: { strength: 47 } },
  'saci-wind-bow': { id: 'saci-wind-bow', name: 'Arco dos Ventos do Saci', slot: 'weapon', minLevel: F5, allowedClasses: R, sellPrice: 170, bonuses: { strength: 49 } },
  'mapinguari-hide': { id: 'mapinguari-hide', name: 'Couraça de Couro do Mapinguari', slot: 'chest', minLevel: F5, sellPrice: 165, bonuses: { vitality: 52, defense: 10 } },
  'boitata-crest': { id: 'boitata-crest', name: 'Crista Flamejante', slot: 'helmet', minLevel: F5, sellPrice: 125, bonuses: { defense: 15 } },
  'saci-boots': { id: 'saci-boots', name: 'Botas de Redemoinho', slot: 'boots', minLevel: F5, sellPrice: 140, bonuses: { vitality: 36, defense: 5 } },

  // Item especial raro da faixa 5 (5% de chance no mini-chefe do andar 45).
  'curupira-charm': { id: 'curupira-charm', name: 'Amuleto das Pegadas Invertidas', slot: 'amulet', minLevel: F5, sellPrice: 260, bonuses: { strength: 18, vitality: 18, defense: 8 } },

  // IDs antigos mantidos para não quebrar drops já configurados.
  'bloodsteel-sword': { id: 'bloodsteel-sword', name: 'Espada de Aço Sanguíneo', slot: 'weapon', minLevel: F2, sellPrice: 20, bonuses: { strength: 7 } },
  'nightfang-dagger': { id: 'nightfang-dagger', name: 'Adaga Presa Noturna', slot: 'weapon', minLevel: F2, sellPrice: 18, bonuses: { strength: 6 } },
  'mooncleaver': { id: 'mooncleaver', name: 'Talhadora da Lua Rubra', slot: 'weapon', minLevel: F2, sellPrice: 25, bonuses: { strength: 9 } },
  'seventh-edge': { id: 'seventh-edge', name: 'Lâmina do Sétimo', slot: 'weapon', minLevel: F2, sellPrice: 30, bonuses: { strength: 12 } },
};
