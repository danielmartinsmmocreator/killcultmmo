import type { EncounterType, Position, UnitDefinition } from '../types';
import { ABYSS_IDOL, GOBLIN_CHIEF, CRIMSON_COUNTESS, DRACULA, MEDUSA, HADES, CHESHIRE_CAT, QUEEN_OF_HEARTS, CURUPIRA, CUCA } from './bosses';
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
  CARD_SOLDIER, WHITE_RABBIT, GIANT_CATERPILLAR, MAD_MUSHROOM, THORN_PLANT,\n  SACI, BOITATA, IARA, MULA_SEM_CABECA, MAPINGUARI, CUCA_MINION,
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
  { col: 5, row: 1 },];

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
];