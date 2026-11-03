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

export type PlayerData = {
  nickname: string;
  characters: PlayerCharacterRecord[];
};

const EXPECTED_CLASSES = ['warrior', 'mage', 'cleric', 'assassin', 'archer'] as const;

/** Busca somente dados pertencentes ao usuário autenticado; as políticas RLS continuam ativas. */
export async function loadPlayerData(userId: string): Promise<PlayerData> {
  if (!supabase) throw new Error('Supabase não está configurado.');

  const [profileResult, charactersResult] = await Promise.all([
    supabase.from('profiles').select('nickname').eq('id', userId).single(),
    supabase
      .from('characters')
      .select('id, class_id, level, xp, unspent_attribute_points, strength, vitality, defense')
      .eq('user_id', userId),
  ]);

  if (profileResult.error) throw new Error('Não foi possível carregar o perfil: ' + profileResult.error.message);
  if (charactersResult.error) throw new Error('Não foi possível carregar os personagens: ' + charactersResult.error.message);

  const characters = (charactersResult.data ?? []) as PlayerCharacterRecord[];
  const classes = new Set(characters.map((character) => character.class_id));
  if (characters.length !== EXPECTED_CLASSES.length || EXPECTED_CLASSES.some((classId) => !classes.has(classId))) {
    throw new Error('A conta não possui os cinco personagens esperados. Verifique o cadastro e as migrations do Supabase.');
  }

  return {
    nickname: profileResult.data.nickname,
    characters,
  };
}
