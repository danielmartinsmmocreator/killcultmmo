import { CAMPAIGN_FLOORS, ENCOUNTER_LABELS } from '../data/encounters';
import type { FloorConfig } from '../data/encounters';
import type { BattleSetup } from '../data/battleSetup';
import type { EncounterType, Position, Unit, UnitDefinition } from '../types';
import { buildEncounter, createParty, prepareParty, validateFloor } from './encounter';
import { GameState } from './GameState';
import { PlayerInventory } from './progression';
import { ITEM_DEFINITIONS } from '../data/items';



/**
 * Situação da campanha:
 * - 'fighting': combate em andamento;
 * - 'floor-cleared': o andar foi vencido e o jogador ainda precisa confirmar o avanço;
 * - 'defeated': todos os heróis caíram, a campanha terminou;
 * - 'completed': o último andar (o chefe principal) foi vencido.
 */
export type CampaignStatus = 'fighting' | 'floor-cleared' | 'defeated' | 'completed';

/**
 * Estado da campanha: andar atual, grupo de heróis e o combate do andar. Não depende do Phaser
 * nem do DOM. A cena e o painel observam `battle` (todo avanço ou reinício passa por ele, via os
 * eventos 'encounter' e 'reset'); a situação da campanha é DERIVADA do resultado do combate,
 * então nunca fica fora de sincronia com ele.
 *
 * O grupo de heróis é criado uma vez por campanha e reaproveitado em todos os andares: o PV
 * é preservado, heróis derrotados continuam derrotados, e a habilidade especial volta a ficar
 * disponível a cada encontro.
 */
export class Campaign {
  /** O combate do andar atual (o mesmo objeto durante toda a campanha). */
  readonly battle: GameState;
  private readonly floors: readonly FloorConfig[];
  private floorIndex = 0;
  private partyUnits: Unit[];
  private readonly persistedCharacterIds = new Map<string, string>();
  private activePartyUids: string[] = [];
  private readonly rewardedMonsterUids = new Set<string>();
  private readonly rewardMessages: string[] = [];
  private rewardGold = 0;
  private readonly rewardDrops: string[] = [];
  /** Itens já consolidados em extrações anteriores; os novos são temporários até extrair. */
  private retainedItemIds = new Set<string>();
  /** Ouro consolidado em extrações anteriores; o ganho durante a incursão é temporário. */
  private retainedGold = 0;

  /** Recompensas obtidas no andar atual, exibidas ao vencer. */
  get victoryRewards(): readonly string[] { return this.rewardMessages; }
  /** Saldo atual: inclui o ouro temporário da incursão até a próxima extração. */
  gold = 0;
  /** Inventário compartilhado do jogador; os equipamentos são referências nos heróis. */
  readonly inventory = new PlayerInventory();

  constructor(floors: readonly FloorConfig[] = CAMPAIGN_FLOORS) {
    const problems = floors.flatMap((config) => validateFloor(config));
    if (floors.length === 0) problems.push('A campanha precisa de pelo menos um andar.');
    floors.forEach((config, index) => {
      if (config.floor !== index + 1) {
        problems.push(`Andar na posição ${index + 1} está numerado como ${config.floor}.`);
      }
    });
    if (problems.length > 0) {
      throw new Error(`Campanha inválida:\n${problems.join('\n')}`);
    }

    this.floors = floors;
    this.partyUnits = createParty();
    this.retainedItemIds = new Set(this.inventory.instanceIds);
    this.activePartyUids = this.partyUnits.map((hero) => hero.uid);
    this.battle = new GameState(() => this.createEncounter(), (hero) => this.inventory.specialBonusesFor(hero));
    this.battle.subscribe(() => {
      this.collectMonsterRewards();
      if (this.battle.outcome === 'defeat') this.loseExpeditionItems();
    });
  }

  /** Aplica a progressão permanente carregada do banco aos cinco heróis já criados. */
  loadPersistedCharacters(records: readonly {
    class_id: string;
    level: number;
    xp: number;
    unspent_attribute_points: number;
    strength: number;
    vitality: number;
    defense: number;
  }[]): void {
    for (const record of records) {
      if (record.id) this.persistedCharacterIds.set(record.class_id, record.id);
      const hero = this.partyUnits.find((unit) => unit.definition.id === record.class_id);
      if (!hero?.progression) continue;
      hero.progression.level = Math.max(1, record.level);
      hero.progression.xp = Math.max(0, record.xp);
      hero.progression.unspentAttributePoints = Math.max(0, record.unspent_attribute_points);
      hero.progression.attributes = {
        strength: Math.max(0, record.strength),
        vitality: Math.max(0, record.vitality),
        defense: Math.max(0, record.defense),
      };
    }
  }

  /** ID do registro do personagem no Supabase, associado à classe fixa do herói. */
  getPersistedCharacterId(classId: string): string | null {
    return this.persistedCharacterIds.get(classId) ?? null;
  }

  // ---------- Consultas ----------

  /** Número do andar atual (1 a `totalFloors`). */
  get floorNumber(): number {
    return this.floorIndex + 1;
  }

  get totalFloors(): number {
    return this.floors.length;
  }

  get floor(): FloorConfig {
    return this.floors[this.floorIndex];
  }

  get encounterType(): EncounterType {
    return this.floor.type;
  }

  get encounterLabel(): string {
    return ENCOUNTER_LABELS[this.floor.type];
  }

  get isLastFloor(): boolean {
    return this.floorIndex === this.floors.length - 1;
  }

  /** Os cinco heróis disponíveis, incluindo os que não foram escolhidos para esta expedição. */
  get party(): readonly Unit[] {
    return this.partyUnits;
  }

  /** Heróis escolhidos para a expedição atual. */
  get activeParty(): readonly Unit[] {
    return this.partyUnits.filter((hero) => this.activePartyUids.includes(hero.uid));
  }

  /** Define de 1 a 3 heróis e suas casas iniciais antes de iniciar a expedição. */
  configureParty(heroUids: readonly string[], positions: Readonly<Record<string, Position>>): boolean {
    if (heroUids.length < 1 || heroUids.length > 3 || new Set(heroUids).size !== heroUids.length) return false;
    const selected = heroUids.map((uid) => this.partyUnits.find((hero) => hero.uid === uid));
    if (selected.some((hero) => !hero || hero.hp <= 0)) return false;
    const occupied = new Set<string>();
    for (const hero of selected as Unit[]) {
      const pos = positions[hero.uid];
      if (!pos || !Number.isInteger(pos.col) || !Number.isInteger(pos.row) || pos.col < 0 || pos.col > 5 || pos.row < 3 || pos.row > 5) return false;
      const key = `${pos.col},${pos.row}`;
      if (occupied.has(key)) return false;
      occupied.add(key);
    }
    this.activePartyUids = [...heroUids];
    for (const hero of selected as Unit[]) {
      const pos = positions[hero.uid];
      hero.position = { col: pos.col, row: pos.row };
    }

    // A cena Phaser sincroniza o encontro ao iniciar. Não emitir evento aqui:
    // o jogo anterior pode estar sendo destruído e ainda ter listeners temporariamente ativos.
    return true;
  }

  /** Sincroniza o estado de batalha com a equipe selecionada, antes de a cena assinar eventos. */
  syncActiveEncounter(): void {
    // A cena ainda está sendo criada: atualiza os dados sem emitir evento para listeners antigos.
    this.battle.loadEncounter(this.createEncounter(), false);
  }

  get status(): CampaignStatus {
    switch (this.battle.outcome) {
      case 'defeat':
        return 'defeated';
      case 'victory':
        return this.isLastFloor ? 'completed' : 'floor-cleared';
      case 'ongoing':
        return 'fighting';
    }
  }

  // ---------- Ações ----------

  /**
   * Avança para o próximo andar. Só funciona depois de vencer um andar que não é o último (o
   * jogador precisa pedir). Retorna false em qualquer outro caso, inclusive em cliques repetidos:
   * depois do primeiro avanço a situação volta a 'fighting' e os demais são recusados.
   */
  advance(): boolean {
    if (this.status !== 'floor-cleared') return false;

    this.floorIndex += 1;
    this.rewardedMonsterUids.clear();
    this.rewardMessages.length = 0;
    this.rewardGold = 0;
    this.rewardDrops.length = 0;
    prepareParty(this.activeParty);
    this.battle.loadEncounter(this.createEncounter());
    return true;
  }

  /** Pula para qualquer andar e recria o encontro preservando o grupo. */
  debugJumpToFloor(floorNumber: number): boolean {
    if (!Number.isInteger(floorNumber) || floorNumber < 1 || floorNumber > this.totalFloors) return false;
    this.floorIndex = floorNumber - 1;
    this.rewardedMonsterUids.clear();
    this.rewardMessages.length = 0;
    this.rewardGold = 0;
    this.rewardDrops.length = 0;
    prepareParty(this.activeParty);
    this.battle.loadEncounter(this.createEncounter());
    return true;
  }

  /** Substitui os inimigos do andar atual pelos selecionados no painel de desenvolvimento. */
  debugSetMonsters(monsters: readonly UnitDefinition[]): boolean {
    if (monsters.length < 1 || monsters.length > 12 || monsters.some((m) => m.team !== 'monster')) return false;
    const config: FloorConfig = {
      ...this.floor,
      type: monsters.some((m) => m.rank === 'boss') ? 'boss' : monsters.some((m) => m.rank === 'mini-boss') ? 'mini-boss' : 'normal',
      monsters,
      obstacles: [],
    };
    // A configuração customizada é validada pelo construtor do encontro; o tipo acompanha o chefe escolhido.
    try {
      const setup = buildEncounter(config, this.activeParty);
      this.battle.loadEncounter({ ...setup, title: `DEV — Andar ${this.floorNumber}: encontro personalizado` });
      return true;
    } catch {
      return false;
    }
  }

  debugAddGold(amount: number): void {
    if (Number.isFinite(amount)) this.gold = Math.max(0, this.gold + Math.trunc(amount));
  }

  debugAddItem(definitionId: string): boolean {
    if (!ITEM_DEFINITIONS[definitionId]) return false;
    this.inventory.add(definitionId, this.floorNumber);
    return true;
  }

  debugSetHeroLevel(uid: string, level: number): boolean {
    const hero = this.partyUnits.find((unit) => unit.uid === uid);
    if (!hero?.progression || !Number.isInteger(level) || level < 1 || level > 999) return false;
    const p = hero.progression;
    const gained = Math.max(0, level - p.level);
    p.level = level;
    p.xp = 0;
    p.unspentAttributePoints += gained * 3;
    return true;
  }

  debugToggleExtraction(enabled: boolean): void {
    this.debugExtractionEnabled = enabled;
  }

  debugExtractionEnabled = false;

  /** Extração manual após concluir um marco de 5 andares (ex.: andar 5). */
  get canExtract(): boolean {
    return (this.status === 'floor-cleared' || this.status === 'completed') && (this.debugExtractionEnabled || this.floorNumber % 5 === 0);
  }

  /** Consolida os itens obtidos e retorna à base ao extrair em um marco válido. */
  extract(): boolean {
    if (!this.canExtract) return false;
    this.retainedItemIds = new Set(this.inventory.instanceIds);
    this.retainedGold = this.gold;
    this.restart(false);
    return true;
  }

  /** Descarta os itens e o ouro obtidos desde a última extração. */
  loseExpeditionItems(): void {
    this.inventory.removeItemsExcept(this.retainedItemIds, this.partyUnits);
    this.gold = this.retainedGold;
  }

  private collectMonsterRewards(): void {
    for (const monster of this.battle.roster) {
      if (monster.definition.team !== 'monster' || monster.hp > 0 || this.rewardedMonsterUids.has(monster.uid)) continue;
      this.rewardedMonsterUids.add(monster.uid);

      const rank = monster.definition.rank ?? 'normal';
      const reward = rank === 'boss' ? 100 : rank === 'mini-boss' ? 35 : 5;
      this.gold += reward;
      this.rewardGold += reward;
      const drops: string[] = [];
      const tierStart = Math.floor((this.floorNumber - 1) / 10) * 10 + 1;
      const classIds = new Set(this.activeParty.map((hero) => hero.definition.id));
      const tierItems = Object.values(ITEM_DEFINITIONS).filter((item) => item.minLevel === tierStart);
      const addRandomDrop = (rarity: 'common' | 'rare' | 'epic' | 'legendary'): void => {
        // A última faixa regular disponível continua valendo nos andares 91–99.
        const eligibleTier = tierItems.some((item) => item.rarity === rarity)
          ? tierStart
          : tierStart > 1 ? tierStart - 10 : tierStart;
        const pool = Object.values(ITEM_DEFINITIONS).filter((item) =>
          item.minLevel === eligibleTier &&
          item.rarity === rarity &&
          (!item.allowedClasses || item.allowedClasses.some((classId) => classIds.has(classId))),
        );
        if (pool.length === 0) return;
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        const instance = this.inventory.add(chosen.id, this.floorNumber);
        drops.push(ITEM_DEFINITIONS[instance.definitionId]?.name ?? chosen.name);
      };

      // Monstros comuns podem deixar equipamentos de qualquer uma das três raridades.
      // Cada chance é independente, então um monstro pode deixar mais de um item.
      if (rank === 'normal') {
        if (Math.random() < 0.05) addRandomDrop('common');
        if (Math.random() < 0.025) addRandomDrop('rare');
        if (Math.random() < 0.01) addRandomDrop('epic');
      }

      // Lendários são exclusivos dos chefes principais e têm chance de 1%.
      if (rank === 'boss' && this.floorNumber % 10 === 0) {
        if (Math.random() < 0.01) addRandomDrop('legendary');
      }

      this.rewardDrops.push(...drops);
      this.rewardMessages.splice(0, this.rewardMessages.length,
        this.rewardDrops.length
          ? `${this.rewardGold} moedas de ouro + ${this.rewardDrops.join(', ')}`
          : `${this.rewardGold} moedas de ouro`,
      );
    }
  }

  /** Vende um item disponível no inventário e credita seu preço de venda. */
  sellInventoryItem(instanceId: string): number {
    const value = this.inventory.sell(instanceId);
    if (value > 0) this.gold += value;
    return value;
  }

  /** Reinicia uma expedição no andar 1 sem apagar níveis, XP ou atributos permanentes. */
  restart(notify = true): void {
    // Reiniciar sem extrair equivale a abandonar a incursão: drops recentes são perdidos.
    this.loseExpeditionItems();
    this.floorIndex = 0;
    this.rewardedMonsterUids.clear();
    this.rewardMessages.length = 0;
    this.rewardGold = 0;
    this.rewardDrops.length = 0;
    for (const hero of this.partyUnits) {
      hero.hp = hero.maxHp;
      hero.abilityUsed = false;
      hero.stunned = false;
      hero.petrified = false;
    }

    if (this.activePartyUids.length === 0) this.activePartyUids = this.partyUnits.slice(0, 3).map((hero) => hero.uid);

    // Heróis derrotados deixam de ocupar casas durante o combate. Por isso, dois ou mais
    // podem terminar sobre a mesma posição. Antes de reconstruir o encontro, reposicionamos
    // a equipe ativa em casas iniciais distintas para evitar um encontro inválido no reset.
    this.activeParty.forEach((hero, index) => {
      hero.position = { col: index + 1, row: 5 };
    });

    this.battle.reset(notify);
    this.retainedItemIds = new Set(this.inventory.instanceIds);
    this.retainedGold = this.gold;
  }

  // ---------- Internos ----------

  /** Encontro do andar atual, com o grupo atual. Usado pelo GameState ao iniciar e reiniciar. */
  private createEncounter(): BattleSetup {
    const config = this.floor;
    const setup = buildEncounter(config, this.activeParty);
    return {
      ...setup,
      title: `Andar ${config.floor}/${this.floors.length} — ${ENCOUNTER_LABELS[config.type]}: ${config.name}`,
      floor: config.floor,
    };
  }
}
