import { supabase } from './supabase';

export type PlayerCharacterRecord = {
  id: string;
  class_id: 'warrior' | 'mage' | 'cleric' | 'assassin' | 'archer';
  level: number;
  xp: number;
  unspent_attribute_points: number;
  strength: number;
  vitality: number;
  defense: number;
};

export type PlayerInventoryRecord = {
  id: string;
  item_definition_id: string;
  obtained_at_floor: number | null;
};

export type PlayerEquippedRecord = {
  character_id: string;
  inventory_item_id: string;
  slot: import('../game/types').EquipmentSlot;
};

export type PlayerData = {
  nickname: string;
  characters: PlayerCharacterRecord[];
  gold: number;
  inventory: PlayerInventoryRecord[];
  equipped: PlayerEquippedRecord[];
  partyFormation: unknown | null;
};

const EXPECTED_CLASSES = ['warrior', 'mage', 'cleric', 'assassin', 'archer'] as const;

/** Busca somente dados pertencentes ao usuário autenticado; as políticas RLS continuam ativas. */
export async function loadPlayerData(userId: string): Promise<PlayerData> {
  if (!supabase) throw new Error('Supabase não está configurado.');

  const [profileResult, charactersResult, walletResult, inventoryResult, equippedResult] = await Promise.all([
    supabase.from('profiles').select('nickname, party_formation').eq('id', userId).single(),
    supabase
      .from('characters')
      .select('id, class_id, level, xp, unspent_attribute_points, strength, vitality, defense')
      .eq('user_id', userId),
    supabase.from('player_wallet').select('gold').eq('user_id', userId).single(),
    supabase.from('inventory').select('id, item_definition_id, obtained_at_floor').eq('user_id', userId),
    supabase.from('equipped_items').select('character_id, inventory_item_id, slot').eq('user_id', userId),
  ]);

  if (profileResult.error) throw new Error('Não foi possível carregar o perfil: ' + profileResult.error.message);
  if (charactersResult.error) throw new Error('Não foi possível carregar os personagens: ' + charactersResult.error.message);
  if (walletResult.error) throw new Error('Não foi possível carregar a carteira: ' + walletResult.error.message);
  if (inventoryResult.error) throw new Error('Não foi possível carregar o inventário: ' + inventoryResult.error.message);
  if (equippedResult.error) throw new Error('Não foi possível carregar os equipamentos: ' + equippedResult.error.message);

  const characters = (charactersResult.data ?? []) as PlayerCharacterRecord[];
  const classes = new Set(characters.map((character) => character.class_id));
  if (characters.length !== EXPECTED_CLASSES.length || EXPECTED_CLASSES.some((classId) => !classes.has(classId))) {
    throw new Error('A conta não possui os cinco personagens esperados. Verifique o cadastro e as migrations do Supabase.');
  }

  return {
    nickname: profileResult.data.nickname,
    characters,
    gold: Number(walletResult.data.gold ?? 0),
    inventory: (inventoryResult.data ?? []) as PlayerInventoryRecord[],
    equipped: (equippedResult.data ?? []) as PlayerEquippedRecord[],
    partyFormation: (profileResult.data.party_formation as unknown | null) ?? null,
  };
}
