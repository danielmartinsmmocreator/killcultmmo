import type { EncounterType, Position, UnitDefinition } from '../types';
import { ABYSS_IDOL, GOBLIN_CHIEF, CRIMSON_COUNTESS, DRACULA, MEDUSA, HADES, CHESHIRE_CAT, QUEEN_OF_HEARTS, CURUPIRA, CUCA, SAND_VIZIER, SULTAN_OF_NIGHTS, MAD_SCIENTIST, FRANKENSTEIN_ABOMINATION, WICKED_WITCH, WIZARD_OF_OZ, TENGU_LORD, YAMATA_NO_OROCHI } from './bosses';
import {
  CULTIST,
  INSANE,
  ACOLYTE,
  DEFORMED_DEVOTEE,
  ABYSSAL_SCALED,
  SCALED_GUARDIAN,
  RLYEH_HORROR,
  HARPY, SATYR, CYCLOPS, GORGON, MINOTAUR, UNDERWORLD_HOUND, UNDERWORLD_WRAITH, SKELETON,
  VAMPIRIC_THRALL, BLOOD_BAT, NIGHT_HUNTER, BLOOD_KNIGHT, WEREWOLF,
  CARD_SOLDIER, WHITE_RABBIT, GIANT_CATERPILLAR, MAD_MUSHROOM, THORN_PLANT,
  SACI, BOITATA, IARA, MULA_SEM_CABECA, MAPINGUARI, CUCA_MINION,
  DESERT_BANDIT, BRONZE_SCORPION, SAND_DJINN, MIRAGE_SORCERER, DESERT_SERPENT, DUNE_GUARDIAN,
  STITCHED_THRALL, PLAGUE_SURGEON, LIGHTNING_REVENANT, HOMUNCULUS, IRON_AUTOMATON, FLESH_GOLEM,
  MUNCHKIN_GUARD, FLYING_MONKEY, TIN_WOODSMAN, COWARDLY_LION, POPPY_SENTINEL, EMERALD_SENTINEL,
  KAPPA, TENGU, YUKI_ONNA, ONI, JOROGUMO, KITSUNE,
} from './monsters';

/**
 * Configuração dos andares da campanha. Só dados: nada aqui conhece Phaser ou o DOM.
 */

export interface FloorConfig {
  readonly floor: number;
  readonly type: EncounterType;
  readonly name: string;
  readonly monsters: readonly UnitDefinition[];
  readonly obstacles: readonly Position[];
}

export const ENCOUNTER_LABELS: Record<EncounterType, string> = {
  normal: 'Comum',
  'mini-boss': 'Mini-chefe',
  boss: 'Chefe principal',
};

export const SPAWN_SLOTS: readonly Position[] = [
  { col: 2, row: 0 },
  { col: 3, row: 0 },
  { col: 1, row: 1 },
  { col: 4, row: 1 },
  { col: 1, row: 0 },
  { col: 4, row: 0 },
  { col: 2, row: 1 },
  { col: 3, row: 1 },
  { col: 0, row: 0 },
  { col: 5, row: 0 },
  { col: 0, row: 1 },
  { col: 5, row: 1 },
  { col: 0, row: 2 }, { col: 1, row: 2 }, { col: 2, row: 2 },
  { col: 3, row: 2 }, { col: 4, row: 2 }, { col: 5, row: 2 },];

/** Reforça um tipo de monstro sem alterar sua identidade ou comportamento. */
function stronger(base: UnitDefinition, hp: number, damage: number): UnitDefinition {
  return { ...base, maxHp: base.maxHp + hp, damage: base.damage + damage };
}

function floor(
  number: number,
  name: string,
  monsters: readonly UnitDefinition[],
  obstacles: readonly Position[] = [],
  type: EncounterType = 'normal',
): FloorConfig {
  return { floor: number, type, name, monsters, obstacles };
}

const cultist2 = stronger(CULTIST, 2, 0);
const insane2 = stronger(INSANE, 2, 0);
const acolyte2 = stronger(ACOLYTE, 2, 0);
const devotee2 = stronger(DEFORMED_DEVOTEE, 2, 0);
const scaled2 = stronger(ABYSSAL_SCALED, 2, 0);
const guardian2 = stronger(SCALED_GUARDIAN, 2, 0);
const horror2 = stronger(RLYEH_HORROR, 2, 0);
const scaled4 = stronger(ABYSSAL_SCALED, 4, 1);
const guardian4 = stronger(SCALED_GUARDIAN, 4, 1);
const horror4 = stronger(RLYEH_HORROR, 4, 1);

export const CAMPAIGN_FLOORS: readonly FloorConfig[] = [
  floor(1, 'Portão da Masmorra', [CULTIST, INSANE]),
  floor(2, 'Corredor Escuro', [CULTIST, CULTIST, ACOLYTE]),
  floor(3, 'Sala do Ritual', [cultist2, insane2, acolyte2]),
  floor(4, 'Galeria Profana', [acolyte2, devotee2, cultist2, insane2], [
    { col: 1, row: 3 },
    { col: 4, row: 3 },
  ]),
  floor(5, 'Covil da Criatura Sombria', [GOBLIN_CHIEF, insane2, devotee2], [], 'mini-boss'),
  floor(6, 'Câmara Profunda', [ABYSSAL_SCALED, SCALED_GUARDIAN, RLYEH_HORROR]),
  floor(7, 'Ponte Quebrada', [scaled4, guardian2, horror2], [
    { col: 2, row: 3 },
    { col: 3, row: 2 },
  ]),
  floor(8, 'Salão das Sombras', [scaled2, scaled2, guardian2, horror2]),
  floor(9, 'Antecâmara do Abismo', [scaled4, guardian4, horror4, scaled4], [
    { col: 0, row: 3 },
    { col: 5, row: 3 },
  ]),
  floor(10, 'Altar do Ídolo do Abismo', [ABYSS_IDOL, scaled2, guardian2], [], 'boss'),

  // Região 2 — Reino da Noite: cerca de 2–3x a pressão dos inimigos iniciais.
  floor(11, 'Estrada dos Morcegos', [BLOOD_BAT, BLOOD_BAT, VAMPIRIC_THRALL]),
  floor(12, 'Aldeia Sem Pulso', [VAMPIRIC_THRALL, VAMPIRIC_THRALL, NIGHT_HUNTER]),
  floor(13, 'Cemitério da Lua Rubra', [WEREWOLF, BLOOD_BAT, NIGHT_HUNTER], [
    { col: 1, row: 2 }, { col: 4, row: 2 },
  ]),
  floor(14, 'Portões do Castelo Carmesim', [BLOOD_KNIGHT, VAMPIRIC_THRALL, NIGHT_HUNTER]),
  floor(15, 'Salão de Inverno', [CRIMSON_COUNTESS, BLOOD_KNIGHT, BLOOD_BAT], [], 'mini-boss'),
  floor(16, 'Galeria dos Uivos', [WEREWOLF, WEREWOLF, VAMPIRIC_THRALL, BLOOD_BAT]),
  floor(17, 'Banquete Eterno', [BLOOD_KNIGHT, NIGHT_HUNTER, NIGHT_HUNTER], [
    { col: 2, row: 2 }, { col: 3, row: 2 },
  ]),
  floor(18, 'Cripta dos Nobres', [BLOOD_KNIGHT, WEREWOLF, NIGHT_HUNTER, BLOOD_BAT]),
  floor(19, 'Trono Vazio', [BLOOD_KNIGHT, WEREWOLF, NIGHT_HUNTER, NIGHT_HUNTER], [
    { col: 1, row: 2 }, { col: 4, row: 2 },
  ]),
  floor(20, 'Trono do Sétimo', [DRACULA, BLOOD_KNIGHT, BLOOD_BAT], [], 'boss'),

  floor(21, 'Penhascos das Harpias', [HARPY, SKELETON, SATYR]),
  floor(22, 'Templo dos Ossos', [SKELETON, HARPY, SKELETON, SATYR]),
  floor(23, 'Bosque dos Sátiros', [SATYR, SATYR, HARPY, SKELETON], [{ col:1,row:2 }, { col:4,row:3 }]),
  floor(24, 'Entrada do Labirinto', [HARPY, SATYR, SKELETON, HARPY]),
  floor(25, 'Jardim das Serpentes', [MEDUSA, GORGON, SKELETON], [], 'mini-boss'),
  floor(26, 'Salões do Labirinto', [CYCLOPS, GORGON, SATYR]),
  floor(27, 'Pátio dos Ciclopes', [CYCLOPS, CYCLOPS, HARPY]),
  floor(28, 'Câmara das Górgonas', [GORGON, GORGON, MINOTAUR]),
  floor(29, 'Último Portão', [MINOTAUR, CYCLOPS, GORGON, HARPY]),
  floor(30, 'Trono do Submundo', [HADES, UNDERWORLD_HOUND, UNDERWORLD_WRAITH], [], 'boss'),

  // Região 4 — País das Maravilhas: surrealismo, labirintos e realidade distorcida.
  floor(31, 'A Toca do Coelho', [WHITE_RABBIT, CARD_SOLDIER, MAD_MUSHROOM]),
  floor(32, 'O Chá que Nunca Esfria', [CARD_SOLDIER, GIANT_CATERPILLAR, WHITE_RABBIT], [
    { col: 1, row: 2 }, { col: 4, row: 3 },
  ]),
  floor(33, 'Bosque dos Cogumelos', [MAD_MUSHROOM, MAD_MUSHROOM, THORN_PLANT, CARD_SOLDIER]),
  floor(34, 'Jardim das Rosas Pintadas', [THORN_PLANT, WHITE_RABBIT, CARD_SOLDIER, GIANT_CATERPILLAR], [
    { col: 2, row: 2 }, { col: 3, row: 3 },
  ]),
  floor(35, 'O Sorriso no Escuro', [CHESHIRE_CAT, CARD_SOLDIER, WHITE_RABBIT], [], 'mini-boss'),
  floor(36, 'Labirinto das Cartas', [CARD_SOLDIER, CARD_SOLDIER, THORN_PLANT, MAD_MUSHROOM], [
    { col: 1, row: 3 }, { col: 4, row: 2 },
  ]),
  floor(37, 'Pântano da Lagarta', [GIANT_CATERPILLAR, GIANT_CATERPILLAR, WHITE_RABBIT]),
  floor(38, 'Salão dos Espelhos', [MAD_MUSHROOM, THORN_PLANT, CARD_SOLDIER, WHITE_RABBIT]),
  floor(39, 'Portões do Castelo de Copas', [CARD_SOLDIER, CARD_SOLDIER, GIANT_CATERPILLAR, THORN_PLANT], [
    { col: 2, row: 3 }, { col: 3, row: 2 },
  ]),
  floor(40, 'Trono da Rainha de Copas', [QUEEN_OF_HEARTS, CARD_SOLDIER, MAD_MUSHROOM], [], 'boss'),

  // Região 5 — Folclore Brasileiro: mata fechada, rios encantados e lendas das estradas.
  floor(41, 'Trilha das Pegadas Invertidas', [SACI, CUCA_MINION, SACI]),
  floor(42, 'Margens do Rio Encantado', [IARA, SACI, BOITATA], [
    { col: 1, row: 2 }, { col: 4, row: 3 },
  ]),
  floor(43, 'Clareira do Fogo Vivo', [BOITATA, BOITATA, CUCA_MINION, SACI]),
  floor(44, 'Estrada da Meia-Noite', [MULA_SEM_CABECA, SACI, MAPINGUARI], [
    { col: 2, row: 2 }, { col: 3, row: 3 },
  ]),
  floor(45, 'A Floresta de Trás para Frente', [CURUPIRA, SACI, IARA], [], 'mini-boss'),
  floor(46, 'Coração da Mata', [MAPINGUARI, CUCA_MINION, BOITATA]),
  floor(47, 'Lagoa das Vozes', [IARA, IARA, MULA_SEM_CABECA], [
    { col: 1, row: 3 }, { col: 4, row: 2 },
  ]),
  floor(48, 'Território do Gigante', [MAPINGUARI, MAPINGUARI, SACI, CUCA_MINION]),
  floor(49, 'Portal do Pântano', [MULA_SEM_CABECA, BOITATA, MAPINGUARI, IARA], [
    { col: 2, row: 3 }, { col: 3, row: 2 },
  ]),
  floor(50, 'Caldeirão da Cuca', [CUCA, MULA_SEM_CABECA, CUCA_MINION], [], 'boss'),
  floor(51, 'A Rota das Caravanas', [DESERT_BANDIT, DESERT_BANDIT, BRONZE_SCORPION]),
  floor(52, 'Oásis das Vozes', [SAND_DJINN, DESERT_SERPENT, DESERT_BANDIT], [{ col:1,row:2 }, { col:4,row:3 }]),
  floor(53, 'Ruínas Soterradas', [DUNE_GUARDIAN, BRONZE_SCORPION, MIRAGE_SORCERER]),
  floor(54, 'Templo dos Espelhos de Areia', [MIRAGE_SORCERER, SAND_DJINN, DESERT_SERPENT], [{ col:2,row:2 }, { col:3,row:3 }]),
  floor(55, 'O Palácio do Vizir', [SAND_VIZIER, BRONZE_SCORPION, DESERT_BANDIT], [], 'mini-boss'),
  floor(56, 'Cemitério das Caravanas', [DESERT_SERPENT, DESERT_SERPENT, DUNE_GUARDIAN]),
  floor(57, 'A Cidade sob as Dunas', [DUNE_GUARDIAN, MIRAGE_SORCERER, SAND_DJINN, DESERT_BANDIT]),
  floor(58, 'Jardins da Lua Crescente', [SAND_DJINN, MIRAGE_SORCERER, BRONZE_SCORPION], [{ col:1,row:3 }, { col:4,row:2 }]),
  floor(59, 'Os Portões de Âmbar', [DUNE_GUARDIAN, DESERT_SERPENT, SAND_DJINN, MIRAGE_SORCERER], [{ col:2,row:3 }, { col:3,row:2 }]),
  floor(60, 'O Trono das Mil e Uma Noites', [SULTAN_OF_NIGHTS, DUNE_GUARDIAN, SAND_DJINN, ...Array.from({ length: 10 }, () => DESERT_BANDIT)], [], 'boss'),
  floor(61, 'Os Corredores do Sanatório', [STITCHED_THRALL, HOMUNCULUS, PLAGUE_SURGEON]),
  floor(62, 'Ala de Contenção', [IRON_AUTOMATON, STITCHED_THRALL, LIGHTNING_REVENANT], [{ col:1,row:2 }, { col:4,row:3 }]),
  floor(63, 'Laboratório de Transmutação', [HOMUNCULUS, PLAGUE_SURGEON, HOMUNCULUS, STITCHED_THRALL]),
  floor(64, 'Galeria das Bobinas', [LIGHTNING_REVENANT, IRON_AUTOMATON, PLAGUE_SURGEON], [{ col:2,row:2 }, { col:3,row:3 }]),
  floor(65, 'O Teatro da Vivissecção', [MAD_SCIENTIST, STITCHED_THRALL, HOMUNCULUS], [], 'mini-boss'),
  floor(66, 'Fornalha dos Corpos', [FLESH_GOLEM, IRON_AUTOMATON, STITCHED_THRALL]),
  floor(67, 'Arquivo dos Experimentos', [PLAGUE_SURGEON, LIGHTNING_REVENANT, HOMUNCULUS, STITCHED_THRALL]),
  floor(68, 'A Câmara do Relâmpago', [LIGHTNING_REVENANT, LIGHTNING_REVENANT, IRON_AUTOMATON], [{ col:1,row:3 }, { col:4,row:2 }]),
  floor(69, 'O Coração da Máquina', [FLESH_GOLEM, IRON_AUTOMATON, PLAGUE_SURGEON, LIGHTNING_REVENANT], [{ col:2,row:3 }, { col:3,row:2 }]),
  floor(70, 'A Cripta da Vida Artificial', [FRANKENSTEIN_ABOMINATION, FLESH_GOLEM, LIGHTNING_REVENANT], [], 'boss'),

  // Região 8 — Reino de Oz (andares 71–80).
  floor(71, 'Estrada de Tijolos Amarelos', [MUNCHKIN_GUARD, COWARDLY_LION, FLYING_MONKEY]),
  floor(72, 'Campo das Papoulas', [POPPY_SENTINEL, FLYING_MONKEY, MUNCHKIN_GUARD], [{ col:1,row:2 }, { col:4,row:3 }]),
  floor(73, 'Oficina do Lenhador', [TIN_WOODSMAN, MUNCHKIN_GUARD, EMERALD_SENTINEL]),
  floor(74, 'Floresta dos Sussurros', [COWARDLY_LION, FLYING_MONKEY, POPPY_SENTINEL, TIN_WOODSMAN], [{ col:2,row:2 }, { col:3,row:3 }]),
  floor(75, 'Castelo da Bruxa do Oeste', [WICKED_WITCH, FLYING_MONKEY, POPPY_SENTINEL], [], 'mini-boss'),
  floor(76, 'Muralhas da Cidade Esmeralda', [EMERALD_SENTINEL, MUNCHKIN_GUARD, TIN_WOODSMAN]),
  floor(77, 'Salão dos Espelhos Verdes', [EMERALD_SENTINEL, FLYING_MONKEY, COWARDLY_LION, MUNCHKIN_GUARD]),
  floor(78, 'A Câmara do Grande Oz', [TIN_WOODSMAN, POPPY_SENTINEL, EMERALD_SENTINEL], [{ col:1,row:3 }, { col:4,row:2 }]),
  floor(79, 'O Trono por Trás da Cortina', [WICKED_WITCH, COWARDLY_LION, FLYING_MONKEY, EMERALD_SENTINEL], [{ col:2,row:3 }, { col:3,row:2 }]),
  floor(80, 'O Grande Salão de Oz', [WIZARD_OF_OZ, EMERALD_SENTINEL, TIN_WOODSMAN], [], 'boss'),

  // Região 9 — Folclore Japonês (andares 81–90).
  floor(81, 'Margens do Rio dos Kappa', [KAPPA, KITSUNE, KAPPA]),
  floor(82, 'Trilha dos Tengu', [TENGU, KAPPA, YUKI_ONNA], [{ col:1,row:2 }, { col:4,row:3 }]),
  floor(83, 'Vila sob a Neve Eterna', [YUKI_ONNA, KITSUNE, ONI]),
  floor(84, 'Santuário das Tecelãs', [JOROGUMO, KAPPA, TENGU, KITSUNE], [{ col:2,row:2 }, { col:3,row:3 }]),
  floor(85, 'Pico do Senhor Tengu', [TENGU_LORD, TENGU, KITSUNE], [], 'mini-boss'),
  floor(86, 'Portões do Inferno Oni', [ONI, ONI, KAPPA]),
  floor(87, 'Floresta das Raposas', [KITSUNE, JOROGUMO, YUKI_ONNA, TENGU]),
  floor(88, 'Templo das Oito Sombras', [JOROGUMO, ONI, KITSUNE], [{ col:1,row:3 }, { col:4,row:2 }]),
  floor(89, 'Covil das Serpentes Antigas', [YAMATA_NO_OROCHI, ONI, JOROGUMO, YUKI_ONNA], [{ col:2,row:3 }, { col:3,row:2 }]),
  floor(90, 'Altar das Oito Cabeças', [YAMATA_NO_OROCHI, TENGU, KITSUNE], [], 'boss'),
];
