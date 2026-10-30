import { describe, expect, it } from 'vitest';
import { PlayerInventory } from '../core/progression';

describe('Filtro de inventário por faixa de obtenção', () => {
  it('retorna apenas os itens obtidos nos andares da faixa selecionada', () => {
    const inventory = new PlayerInventory();
    const firstRange = inventory.add('short-sword', 7);
    const secondRange = inventory.add('long-sword', 18);
    const thirdRange = inventory.add('bloodied-dagger', 25);
    const legacyItem = inventory.add('rusty-sword');

    expect(inventory.filterByRange(1).map((item) => item.instanceId)).toEqual([firstRange.instanceId]);
    expect(inventory.filterByRange(2).map((item) => item.instanceId)).toEqual([secondRange.instanceId]);
    expect(inventory.filterByRange(3).map((item) => item.instanceId)).toEqual([thirdRange.instanceId]);
    expect(inventory.filterByRange(null).map((item) => item.instanceId)).toEqual([
      firstRange.instanceId, secondRange.instanceId, thirdRange.instanceId, legacyItem.instanceId,
    ]);
  });

  it('mantém o item na faixa em que foi obtido, mesmo após avançar de andar', () => {
    const inventory = new PlayerInventory();
    const item = inventory.add('medusa-eye', 25);

    expect(inventory.filterByRange(3)).toContainEqual(item);
    expect(inventory.filterByRange(2)).not.toContainEqual(item);
  });
});
