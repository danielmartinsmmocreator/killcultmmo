// Compatibilidade exclusiva dos testes legados. Esses inimigos não fazem parte do catálogo jogável.
import { SKELETON, CULTIST } from '../data/monsters';
import type { UnitDefinition } from '../types';

export * from '../data/monsters';

export const GOBLIN: UnitDefinition = {
  ...SKELETON,
  id: 'goblin',
  name: 'Goblin (fixture de teste)',
  movement: 2,
};

export const SLIME: UnitDefinition = {
  ...CULTIST,
  id: 'slime',
  name: 'Slime (fixture de teste)',
  movement: 1,
};
