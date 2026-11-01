import type { ItemDefinition } from '../types';

const F1 = 1;
const F2 = 11;
const F3 = 21;
const F4 = 31;
const F5 = 41;
const F6 = 51;
const F7 = 61;
const F8 = 71;
const F9 = 81;
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
  'shadow-claw': { id: 'shadow-claw', name: 'Garra do Sombrio', slot: 'amulet', sellPrice: 20, bonuses: { strength: 5, vitality: 5, defense: 5}, rarity: 'rare' },
  'cthulhu-tentacle': { id: 'cthulhu-tentacle', name: 'Tentáculo de Cthulhu', slot: 'amulet', sellPrice: 30, bonuses: { strength: 10, vitality: 10, defense: 10}, rarity: 'rare' },

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
  'winter-cloak': { id: 'winter-cloak', name: 'Capa do Inverno', slot: 'amulet', minLevel: F2, sellPrice: 45, bonuses: {}, defensePercent: 10, rarity: 'rare' },
  'seventh-fang': { id: 'seventh-fang', name: 'Dente do Sétimo', slot: 'amulet', minLevel: F2, sellPrice: 45, bonuses: {}, lifestealPercent: 5, rarity: 'rare' },

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
  'medusa-eye': { id: 'medusa-eye', name: 'Olho de Medusa', slot: 'amulet', minLevel: F3, sellPrice: 120, bonuses: {}, ignoreFirstHitPerEncounter: true, rarity: 'rare' },
  'hades-pendant': { id: 'hades-pendant', name: 'Pingente de Hades', slot: 'amulet', minLevel: F3, sellPrice: 140, bonuses: { strength: 20}, rarity: 'rare' },

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
  'cheshire-grin': { id: 'cheshire-grin', name: 'Sorriso de Cheshire', slot: 'amulet', minLevel: F4, sellPrice: 180, bonuses: {}, lifestealPercent: 8, rarity: 'rare' },

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
  'curupira-charm': { id: 'curupira-charm', name: 'Amuleto das Pegadas Invertidas', slot: 'amulet', minLevel: F5, sellPrice: 260, bonuses: { strength: 18, vitality: 18, defense: 8}, rarity: 'rare' },

  'dune-scimitar': { id:'dune-scimitar', name:'Cimitarra das Dunas', slot:'weapon', minLevel:F6, allowedClasses:W, sellPrice:190, bonuses:{strength:52} },
  'sultan-greatsword': { id:'sultan-greatsword', name:'Lâmina do Sultão', slot:'weapon', minLevel:F6, allowedClasses:W, sellPrice:205, bonuses:{strength:56} },
  'sandguard-shield': { id:'sandguard-shield', name:'Escudo do Guardião de Areia', slot:'off-hand', minLevel:F6, allowedClasses:W, sellPrice:180, bonuses:{defense:21} },
  'serpent-fang-daggers': { id:'serpent-fang-daggers', name:'Adagas Presas da Serpente', slot:'weapon', minLevel:F6, allowedClasses:A, sellPrice:200, bonuses:{strength:55} },
  'mirage-stiletto': { id:'mirage-stiletto', name:'Estilete da Miragem', slot:'weapon', minLevel:F6, allowedClasses:A, sellPrice:185, bonuses:{strength:50} },
  'djinnfire-staff': { id:'djinnfire-staff', name:'Cajado da Chama Djinn', slot:'weapon', minLevel:F6, allowedClasses:M, sellPrice:205, bonuses:{strength:56} },
  'moonlit-scepter': { id:'moonlit-scepter', name:'Cetro do Luar', slot:'weapon', minLevel:F6, allowedClasses:M, sellPrice:195, bonuses:{strength:53} },
  'thousand-tales-grimoire': { id:'thousand-tales-grimoire', name:'Grimório das Mil Histórias', slot:'off-hand', minLevel:F6, allowedClasses:M, sellPrice:185, bonuses:{strength:48} },
  'oasis-scepter': { id:'oasis-scepter', name:'Cetro do Oásis Sagrado', slot:'weapon', minLevel:F6, allowedClasses:C, sellPrice:190, bonuses:{strength:51} },
  'golden-lamp-staff': { id:'golden-lamp-staff', name:'Cajado da Lâmpada Dourada', slot:'weapon', minLevel:F6, allowedClasses:C, sellPrice:205, bonuses:{strength:56} },
  'desert-prayer-tome': { id:'desert-prayer-tome', name:'Tomo das Preces do Deserto', slot:'off-hand', minLevel:F6, allowedClasses:C, sellPrice:185, bonuses:{vitality:50} },
  'crescent-bow': { id:'crescent-bow', name:'Arco da Lua Crescente', slot:'weapon', minLevel:F6, allowedClasses:R, sellPrice:215, bonuses:{strength:60} },
  'caravan-hunter-bow': { id:'caravan-hunter-bow', name:'Arco do Caçador de Caravanas', slot:'weapon', minLevel:F6, allowedClasses:R, sellPrice:220, bonuses:{strength:62} },
  'sandweave-armor': { id:'sandweave-armor', name:'Armadura de Trama Arenosa', slot:'chest', minLevel:F6, sellPrice:210, bonuses:{vitality:65,defense:12} },
  'djinn-circlet': { id:'djinn-circlet', name:'Diadema do Djinn', slot:'helmet', minLevel:F6, sellPrice:165, bonuses:{defense:18} },
  'oasis-sandals': { id:'oasis-sandals', name:'Sandálias do Oásis', slot:'boots', minLevel:F6, sellPrice:175, bonuses:{vitality:45,defense:7} },
  'vizier-seal': { id:'vizier-seal', name:'Selo do Vizir', slot:'amulet', minLevel:F6, sellPrice:320, bonuses:{strength:24,vitality:22,defense:10}, rarity: 'rare' },

  // Faixa 7 — Ciência Proibida.
  'surgical-cleaver': { id:'surgical-cleaver', name:'Cutelo Cirúrgico', slot:'weapon', minLevel:F7, allowedClasses:W, sellPrice:245, bonuses:{strength:66} },
  'iron-heart-blade': { id:'iron-heart-blade', name:'Lâmina do Coração de Ferro', slot:'weapon', minLevel:F7, allowedClasses:W, sellPrice:260, bonuses:{strength:70} },
  'coilguard-shield': { id:'coilguard-shield', name:'Escudo das Bobinas', slot:'off-hand', minLevel:F7, allowedClasses:W, sellPrice:230, bonuses:{defense:25} },
  'vivisection-daggers': { id:'vivisection-daggers', name:'Adagas da Vivissecção', slot:'weapon', minLevel:F7, allowedClasses:A, sellPrice:255, bonuses:{strength:69} },
  'voltneedle': { id:'voltneedle', name:'Agulha Voltaica', slot:'weapon', minLevel:F7, allowedClasses:A, sellPrice:240, bonuses:{strength:64} },
  'tesla-coil-staff': { id:'tesla-coil-staff', name:'Cajado da Bobina de Tesla', slot:'weapon', minLevel:F7, allowedClasses:M, sellPrice:265, bonuses:{strength:72} },
  'homunculus-core': { id:'homunculus-core', name:'Núcleo de Homúnculo', slot:'off-hand', minLevel:F7, allowedClasses:M, sellPrice:235, bonuses:{strength:62} },
  'alchemist-rod': { id:'alchemist-rod', name:'Bastão do Alquimista', slot:'weapon', minLevel:F7, allowedClasses:M, sellPrice:250, bonuses:{strength:67} },
  'plague-scepter': { id:'plague-scepter', name:'Cetro da Peste', slot:'weapon', minLevel:F7, allowedClasses:C, sellPrice:250, bonuses:{strength:67} },
  'serum-grimoire': { id:'serum-grimoire', name:'Grimório dos Soros', slot:'off-hand', minLevel:F7, allowedClasses:C, sellPrice:235, bonuses:{vitality:62} },
  'lifeweaver-staff': { id:'lifeweaver-staff', name:'Cajado do Tecelão da Vida', slot:'weapon', minLevel:F7, allowedClasses:C, sellPrice:265, bonuses:{strength:72} },
  'lightning-railbow': { id:'lightning-railbow', name:'Arco de Trilho Elétrico', slot:'weapon', minLevel:F7, allowedClasses:R, sellPrice:275, bonuses:{strength:76} },
  'surgeon-crossbow': { id:'surgeon-crossbow', name:'Besta do Cirurgião', slot:'weapon', minLevel:F7, allowedClasses:R, sellPrice:280, bonuses:{strength:78} },
  'stitched-coat': { id:'stitched-coat', name:'Sobretudo de Retalhos', slot:'chest', minLevel:F7, sellPrice:255, bonuses:{vitality:78,defense:15} },
  'copper-conductor-helm': { id:'copper-conductor-helm', name:'Elmo do Condutor de Cobre', slot:'helmet', minLevel:F7, sellPrice:205, bonuses:{defense:22} },
  'surgeon-boots': { id:'surgeon-boots', name:'Botas do Cirurgião', slot:'boots', minLevel:F7, sellPrice:215, bonuses:{vitality:55,defense:9} },
  'mad-scientist-seal': { id:'mad-scientist-seal', name:'Selo do Doutor', slot:'amulet', minLevel:F7, sellPrice:390, bonuses:{strength:30,vitality:28,defense:12}, rarity: 'rare' },


  // Faixa 8 — equipamentos do Reino de Oz (andares 71–80).
  'emerald-greatsword': { id:'emerald-greatsword', name:'Espada Grande Esmeralda', slot:'weapon', minLevel:F8, allowedClasses:W, sellPrice:300, bonuses:{strength:82} },
  'tin-forged-axe': { id:'tin-forged-axe', name:'Machado Forjado em Lata', slot:'weapon', minLevel:F8, allowedClasses:W, sellPrice:315, bonuses:{strength:86} },
  'yellow-brick-shield': { id:'yellow-brick-shield', name:'Escudo da Estrada Dourada', slot:'off-hand', minLevel:F8, allowedClasses:W, sellPrice:285, bonuses:{defense:29} },
  'witchfang-daggers': { id:'witchfang-daggers', name:'Adagas Presa da Bruxa', slot:'weapon', minLevel:F8, allowedClasses:A, sellPrice:310, bonuses:{strength:85} },
  'monkey-claw': { id:'monkey-claw', name:'Garras do Macaco Alado', slot:'weapon', minLevel:F8, allowedClasses:A, sellPrice:295, bonuses:{strength:80} },
  'emerald-wand': { id:'emerald-wand', name:'Varinha Esmeralda', slot:'weapon', minLevel:F8, allowedClasses:M, sellPrice:315, bonuses:{strength:86} },
  'oz-illusion-staff': { id:'oz-illusion-staff', name:'Cajado das Ilusões de Oz', slot:'weapon', minLevel:F8, allowedClasses:M, sellPrice:325, bonuses:{strength:90} },
  'poppy-grimoire': { id:'poppy-grimoire', name:'Grimório das Papoulas', slot:'off-hand', minLevel:F8, allowedClasses:M, sellPrice:290, bonuses:{strength:78} },
  'emerald-scepter': { id:'emerald-scepter', name:'Cetro da Cidade Esmeralda', slot:'weapon', minLevel:F8, allowedClasses:C, sellPrice:305, bonuses:{strength:82} },
  'lionheart-staff': { id:'lionheart-staff', name:'Cajado do Coração de Leão', slot:'weapon', minLevel:F8, allowedClasses:C, sellPrice:325, bonuses:{strength:88} },
  'good-witch-tome': { id:'good-witch-tome', name:'Tomo da Boa Bruxa', slot:'off-hand', minLevel:F8, allowedClasses:C, sellPrice:295, bonuses:{vitality:82} },
  'flying-monkey-bow': { id:'flying-monkey-bow', name:'Arco do Macaco Alado', slot:'weapon', minLevel:F8, allowedClasses:R, sellPrice:330, bonuses:{strength:92} },
  'rainbow-longbow': { id:'rainbow-longbow', name:'Arco Longo do Arco-Íris', slot:'weapon', minLevel:F8, allowedClasses:R, sellPrice:340, bonuses:{strength:95} },
  'emerald-plate': { id:'emerald-plate', name:'Armadura da Cidade Esmeralda', slot:'chest', minLevel:F8, sellPrice:320, bonuses:{vitality:95,defense:18} },
  'witch-hat': { id:'witch-hat', name:'Chapéu da Bruxa do Oeste', slot:'helmet', minLevel:F8, sellPrice:250, bonuses:{defense:26} },
  'yellow-brick-boots': { id:'yellow-brick-boots', name:'Botas de Tijolos Amarelos', slot:'boots', minLevel:F8, sellPrice:265, bonuses:{vitality:68,defense:11} },
  'oz-heart': { id:'oz-heart', name:'Coração de Oz', slot:'amulet', minLevel:F8, sellPrice:470, bonuses:{strength:38,vitality:35,defense:15}, rarity:'rare' },

  // Faixa 9 — equipamentos do Folclore Japonês (andares 81–90).
  'oni-kanabo': { id:'oni-kanabo', name:'Kanabo do Oni', slot:'weapon', minLevel:F9, allowedClasses:W, sellPrice:360, bonuses:{strength:100} },
  'orochi-fangblade': { id:'orochi-fangblade', name:'Lâmina Presa de Orochi', slot:'weapon', minLevel:F9, allowedClasses:W, sellPrice:375, bonuses:{strength:105} },
  'tengu-war-fan': { id:'tengu-war-fan', name:'Leque de Guerra Tengu', slot:'off-hand', minLevel:F9, allowedClasses:W, sellPrice:345, bonuses:{defense:33} },
  'kitsune-claws': { id:'kitsune-claws', name:'Garras da Kitsune', slot:'weapon', minLevel:F9, allowedClasses:A, sellPrice:370, bonuses:{strength:103} },
  'jorogumo-silk-daggers': { id:'jorogumo-silk-daggers', name:'Adagas de Seda da Jorogumo', slot:'weapon', minLevel:F9, allowedClasses:A, sellPrice:350, bonuses:{strength:96} },
  'oni-fire-staff': { id:'oni-fire-staff', name:'Cajado da Chama Oni', slot:'weapon', minLevel:F9, allowedClasses:M, sellPrice:375, bonuses:{strength:105} },
  'yuki-scepter': { id:'yuki-scepter', name:'Cetro da Yuki-onna', slot:'weapon', minLevel:F9, allowedClasses:M, sellPrice:360, bonuses:{strength:100} },
  'eight-heads-grimoire': { id:'eight-heads-grimoire', name:'Grimório das Oito Cabeças', slot:'off-hand', minLevel:F9, allowedClasses:M, sellPrice:345, bonuses:{strength:94} },
  'kami-scepter': { id:'kami-scepter', name:'Cetro dos Kami', slot:'weapon', minLevel:F9, allowedClasses:C, sellPrice:365, bonuses:{strength:100} },
  'sakura-prayer-staff': { id:'sakura-prayer-staff', name:'Cajado da Prece de Sakura', slot:'weapon', minLevel:F9, allowedClasses:C, sellPrice:380, bonuses:{strength:108} },
  'purification-scroll': { id:'purification-scroll', name:'Pergaminho de Purificação', slot:'off-hand', minLevel:F9, allowedClasses:C, sellPrice:350, bonuses:{vitality:95} },
  'tengu-feather-bow': { id:'tengu-feather-bow', name:'Arco de Penas Tengu', slot:'weapon', minLevel:F9, allowedClasses:R, sellPrice:385, bonuses:{strength:110} },
  'moonlit-yumi': { id:'moonlit-yumi', name:'Yumi do Luar', slot:'weapon', minLevel:F9, allowedClasses:R, sellPrice:395, bonuses:{strength:114} },
  'oni-scale-armor': { id:'oni-scale-armor', name:'Armadura de Escamas Oni', slot:'chest', minLevel:F9, sellPrice:380, bonuses:{vitality:112,defense:21} },
  'tengu-mask': { id:'tengu-mask', name:'Máscara do Tengu', slot:'helmet', minLevel:F9, sellPrice:290, bonuses:{defense:30} },
  'kitsune-sandals': { id:'kitsune-sandals', name:'Sandálias da Kitsune', slot:'boots', minLevel:F9, sellPrice:305, bonuses:{vitality:78,defense:13} },
  'orochi-scale': { id:'orochi-scale', name:'Escama de Orochi', slot:'amulet', minLevel:F9, sellPrice:540, bonuses:{strength:45,vitality:42,defense:18}, rarity:'rare' },

  // IDs antigos mantidos para não quebrar drops já configurados.
  'bloodsteel-sword': { id: 'bloodsteel-sword', name: 'Espada de Aço Sanguíneo', slot: 'weapon', minLevel: F2, sellPrice: 20, bonuses: { strength: 7 } },
  'nightfang-dagger': { id: 'nightfang-dagger', name: 'Adaga Presa Noturna', slot: 'weapon', minLevel: F2, sellPrice: 18, bonuses: { strength: 6 } },
  'mooncleaver': { id: 'mooncleaver', name: 'Talhadora da Lua Rubra', slot: 'weapon', minLevel: F2, sellPrice: 25, bonuses: { strength: 9 } },
  'seventh-edge': { id: 'seventh-edge', name: 'Lâmina do Sétimo', slot: 'weapon', minLevel: F2, sellPrice: 30, bonuses: { strength: 12 } },
};
