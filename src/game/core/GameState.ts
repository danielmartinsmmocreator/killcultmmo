import { BOARD_COLS, BOARD_ROWS } from '../config';
import { ABILITY_BALANCE } from './abilities';
import { allocateAttributePoint, applyDeathXpPenalty, awardKillXp } from './progression';
import type { AttributeName } from './progression';
import { createInitialBattle } from '../data/battleSetup';
import type { BattleFactory, BattleSetup } from '../data/battleSetup';
import type {
  AbilityDefinition,
  AbilityEffect,
  AbilityPreview,
  AbilityTargeting,
  AmbushTargeting,
  BattleOutcome,
  BattlePhase,
  DamageEvent,
  ExuraTargeting,
  FireballTargeting,
  GameEvent,
  HealEvent,
  LogEntry,
  LogKind,
  PiercingShotTargeting,
  Position,
  TelegraphIntent,
  Unit,
} from '../types';
import {
  ambushDestinations,
  directionName,
  fireballArea,
  fireballTargets,
  healAmount,
  pierceLine,
  pierceTargets,
  stompArea,
  stompTargets,
} from './abilities';
import { chooseMonsterMove } from './ai';
import type { ReachableCell } from './board';
import {
  ORTHOGONAL_DIRECTIONS,
  computeReachable,
  directionBetween,
  findPlacementProblems,
  footprintCells,
  footprintFits,
  getMovementDirections,
  isInsideBoard,
  occupies,
  positionLabel,
  positionsEqual,
  sizeOf,
  unitCells,
} from './board';
import type { AttackContext } from './combat';
import { findAttackTargets, isAlive } from './combat';
import { chooseTelegraphTarget, createTelegraphIntent, selectTelegraphedAttack } from './telegraph';

type Listener = (event: GameEvent) => void;

export type ProgressionPersistenceEvent =
  | { eventId: string; kind: 'kill'; classId: string; heroUid: string; monsterMaxHp: number; monsterDamage: number; monsterRank: 'normal' | 'mini-boss' | 'boss' }
  | { eventId: string; kind: 'death'; classId: string; heroUid: string };

export type CooperativeBattleAction =
  | { type: 'move'; destination: Position }
  | { type: 'attack' }
  | { type: 'pass' }
  | { type: 'ability'; abilityId: string; target?: Position; destination?: Position; targetUid?: string };

const MAX_LOG_ENTRIES = 200;

/**
 * Estado e regras da batalha. Não depende do Phaser nem do DOM:
 * a cena e o painel apenas observam este objeto via subscribe().
 *
 * Fluxo de um turno:
 *  1. fase 'player': o jogador seleciona um herói e ESCOLHE UMA AÇÃO: mover, usar a habilidade
 *     especial (uma vez por combate) ou passar a vez;
 *  2. fase 'heroes': cada herói vivo ataca (um por vez);
 *  3. fase 'telegraphs': se o chefe ainda está vivo, o golpe que ele anunciou é resolvido e
 *     atinge as casas anunciadas (chefe morto = golpe cancelado);
 *  4. fase 'monsters': cada monstro vivo anda e ataca (um por vez); atordoados perdem a ação;
 *     os chefes anunciam o próximo golpe (a área fica vermelha para o turno seguinte);
 *  5. vitória/derrota é verificada; se o combate continua, começa o próximo turno.
 *
 * As fases 2 e 3 são resolvidas passo a passo por step(), para que a cena possa animar
 * cada ação. Enquanto isso o estado recusa ações do jogador. resolveAll() executa todos os
 * passos de uma vez (usado nos testes).
 *
 * Habilidades com escolha de alvo seguem: beginAbility() -> chooseAbilityCell() (quantas vezes
 * quiser, mostrando a prévia) -> confirmAbility() ou cancelAbility(). Nada é consumido até a
 * confirmação válida.
 */
export class GameState {
  private readonly createBattle: BattleFactory;
  private readonly specialBonusesFor: (hero: Unit) => { defensePercent: number; lifestealPercent: number; ignoreFirstHitPerEncounter?: boolean };
  /** Heróis que já consumiram a proteção do Olho de Medusa neste encontro. */
  private readonly medusaProtectionUsed = new Set<string>();
  /** Todas as unidades da batalha, inclusive as derrotadas (hp <= 0). */
  private allUnits: Unit[] = [];
  private obstacleList: Position[] = [];
  private currentTurn = 1;
  private currentFloor = 0;
  private sandTrapCells: Position[] = [];
  private readonly revealedSandTraps = new Set<string>();
  private frankensteinEnraged = false;
  private readonly specialBossCycles = new Map<string, number>();
  /** Contador independente de ações do Gato Mistério neste encontro. */
  private readonly cheshireCycles = new Map<string, number>();
  /** Posição original dos acompanhantes da Cuca, que ela pode ressuscitar enquanto viver. */
  private readonly cucaMinionSpawns = new Map<string, Position>();
  private currentPhase: BattlePhase = 'player';
  private currentOutcome: BattleOutcome = 'ongoing';
  private selectedUnitUid: string | null = null;
  private targetingState: AbilityTargeting | null = null;
  private noticeText: string | null = null;
  /** Fila (por uid) de quem ainda age na fase atual. */
  private pendingActors: string[] = [];
  /** Na rodada cooperativa, monstros que concluíram o movimento e ainda devem atacar. */
  private cooperativeMonsterAttackQueue: string[] = [];
  private lastActorUid: string | null = null;
  /** Intenções de ataque dos chefes neste encontro (pendentes, resolvidas e canceladas). */
  private intents: TelegraphIntent[] = [];
  private intentCounter = 0;
  private logEntries: LogEntry[] = [];
  private damageEvents: DamageEvent[] = [];
  private healEvents: HealEvent[] = [];
  private effect: AbilityEffect | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly onProgressionEvent?: (event: ProgressionPersistenceEvent) => void;
  /** No modo cooperativo, uma ação individual não inicia automaticamente a fase dos monstros. */
  private cooperativeMode = false;
  private cooperativeControlledHeroUid: string | null = null;

  constructor(
    createBattle: BattleFactory = createInitialBattle,
    specialBonusesFor: (hero: Unit) => { defensePercent: number; lifestealPercent: number; ignoreFirstHitPerEncounter?: boolean } = () => ({ defensePercent: 0, lifestealPercent: 0 }),
    onProgressionEvent?: (event: ProgressionPersistenceEvent) => void,
  ) {
    this.createBattle = createBattle;
    this.specialBonusesFor = specialBonusesFor;
    this.onProgressionEvent = onProgressionEvent;
    this.setup();
  }

  /** Ativa o fluxo de rodada compartilhada e limita a seleção ao herói controlado pelo usuário. */
  configureCooperativeMode(controlledHeroUid: string): boolean {
    const hero = this.allUnits.find((unit) => unit.uid === controlledHeroUid && unit.definition.team === 'hero');
    if (!hero) return false;
    this.cooperativeMode = true;
    this.cooperativeControlledHeroUid = controlledHeroUid;
    this.selectedUnitUid = null;
    this.targetingState = null;
    this.currentPhase = 'player';
    this.pendingActors = [];
    this.emit('select');
    return true;
  }

  /** O cliente líder troca temporariamente o ator ao reproduzir a ação enviada por outro jogador. */
  setCooperativeActor(heroUid: string): boolean {
    if (!this.cooperativeMode) return false;
    const hero = this.allUnits.find((unit) => unit.uid === heroUid && unit.definition.team === 'hero');
    if (!hero) return false;
    this.cooperativeControlledHeroUid = heroUid;
    this.selectedUnitUid = null;
    this.targetingState = null;
    return true;
  }

  /** Aplica no motor local uma ação já validada pelo RPC do servidor. */
  applyCooperativeAction(
    heroUid: string,
    action: {
      type: 'move' | 'attack' | 'ability' | 'pass';
      destination?: Position;
      abilityId?: string;
      target?: Position;
      targetUid?: string;
    },
  ): boolean {
    if (!this.cooperativeMode || this.currentPhase !== 'player' || this.isOver) return false;
    const hero = this.allUnits.find((unit) => unit.uid === heroUid && unit.definition.team === 'hero');
    if (!hero || !isAlive(hero)) return false;
    this.cooperativeControlledHeroUid = heroUid;
    this.selectedUnitUid = heroUid;
    this.targetingState = null;

    if (hero.petrified) {
      hero.petrified = false;
      this.addLog(`${hero.definition.name} se liberta da petrificação e perde sua ação neste turno.`, 'monster');
      return this.passTurn();
    }

    if (action.type === 'move') {
      if (action.destination && this.moveSelectedUnit(action.destination)) return true;
      this.addLog('Movimento inválido recebido; a ação foi convertida em passar a vez.', 'info');
      return this.passTurn();
    }
    if (action.type === 'attack') {
      // Atacar consome a ação individual; o dano é aplicado na fase automática
      // dos heróis, junto com os ataques dos demais participantes.
      this.addLog(`${hero.definition.name} escolheu atacar.`, 'hero');
      this.beginResolution();
      return true;
    }
    if (action.type === 'pass') return this.passTurn();
    if (action.type !== 'ability' || !action.abilityId || hero.definition.ability?.id !== action.abilityId) {
      this.addLog('Habilidade inválida recebida; a ação foi convertida em passar a vez.', 'info');
      return this.passTurn();
    }
    if (!this.beginAbility()) return this.passTurn();
    // beginAbility() define o alvo internamente; a leitura local evita que o
    // TypeScript trate a propriedade como null após o reset feito no início da ação.
    const targeting = this.targetingState as AbilityTargeting | null;
    if (!targeting) return true;

    if (targeting.id === 'ambush') {
      const target = action.targetUid ? this.findUnit(action.targetUid) : null;
      if (!target || !isAlive(target) || !action.destination || !this.chooseAbilityCell(target.position) || !this.chooseAbilityCell(action.destination)) {
        this.cancelAbility();
        return this.passTurn();
      }
    } else if (targeting.id === 'exura') {
      const target = action.targetUid ? this.findUnit(action.targetUid) : null;
      if (!target || !isAlive(target) || !this.chooseAbilityCell(target.position)) {
        this.cancelAbility();
        return this.passTurn();
      }
    } else {
      if (!action.target || !this.chooseAbilityCell(action.target)) {
        this.cancelAbility();
        return this.passTurn();
      }
    }
    if (this.confirmAbility()) return true;
    this.cancelAbility();
    return this.passTurn();
  }

  /** Depois das ações individuais, resolve os ataques automáticos dos heróis e a resposta dos inimigos. */
  resolveCooperativeRound(): boolean {
    if (!this.cooperativeMode || this.currentPhase !== 'player' || this.isOver) return false;
    this.resetEffects();
    this.selectedUnitUid = null;
    this.targetingState = null;
    this.noticeText = null;
    this.currentPhase = 'heroes';
    this.pendingActors = this.heroes.map((hero) => hero.uid);
    this.addLog('Todos os jogadores agiram. Os heróis atacam!', 'hero');
    this.emit('resolving');
    return true;
  }

  // ---------- Consultas ----------

  /** Todas as unidades, vivas e derrotadas (para listas na interface). */
  get roster(): readonly Unit[] {
    return this.allUnits;
  }

  get heroRoster(): Unit[] {
    return this.allUnits.filter((unit) => unit.definition.team === 'hero');
  }

  get monsterRoster(): Unit[] {
    return this.allUnits.filter((unit) => unit.definition.team === 'monster');
  }

  /** Unidades vivas, ou seja, as que estão no tabuleiro. */
  get units(): Unit[] {
    return this.allUnits.filter(isAlive);
  }

  get heroes(): Unit[] {
    return this.units.filter((unit) => unit.definition.team === 'hero');
  }

  get monsters(): Unit[] {
    return this.units.filter((unit) => unit.definition.team === 'monster');
  }

  get obstacles(): readonly Position[] {
    return this.obstacleList;
  }

  get revealedTraps(): readonly Position[] {
    return this.sandTrapCells.filter((cell) => this.revealedSandTraps.has(`${cell.col},${cell.row}`));
  }

  get turn(): number {
    return this.currentTurn;
  }

  get phase(): BattlePhase {
    return this.currentPhase;
  }

  /** true enquanto heróis ou monstros estão agindo (interações do jogador travadas). */
  get isResolving(): boolean {
    return (
      this.currentPhase === 'heroes' ||
      this.currentPhase === 'telegraphs' ||
      this.currentPhase === 'monsters' ||
      this.currentPhase === 'monsters-move' ||
      this.currentPhase === 'monsters-attack'
    );
  }

  get isOver(): boolean {
    return this.currentPhase === 'over';
  }

  get outcome(): BattleOutcome {
    return this.currentOutcome;
  }

  get selectedUid(): string | null {
    return this.selectedUnitUid;
  }

  get selectedUnit(): Unit | null {
    if (this.selectedUnitUid === null) return null;
    return this.allUnits.find((unit) => unit.uid === this.selectedUnitUid && isAlive(unit)) ?? null;
  }

  get log(): readonly LogEntry[] {
    return this.logEntries;
  }

  /** Golpes do último passo de resolução (ou da habilidade que acabou de ser usada). */
  get lastDamage(): readonly DamageEvent[] {
    return this.damageEvents;
  }

  /** Curas do último passo de resolução (ou da habilidade que acabou de ser usada). */
  get lastHealing(): readonly HealEvent[] {
    return this.healEvents;
  }

  /** Área da habilidade que acabou de ser usada, para a cena destacar. */
  get lastEffect(): AbilityEffect | null {
    return this.effect;
  }

  /** Quem agiu no último passo de resolução, se alguém agiu. */
  get lastActor(): Unit | null {
    if (this.lastActorUid === null) return null;
    return this.allUnits.find((unit) => unit.uid === this.lastActorUid) ?? null;
  }

  /** Todas as intenções de ataque do encontro (inclusive resolvidas e canceladas). */
  get telegraphs(): readonly TelegraphIntent[] {
    return this.intents;
  }

  /** Golpes anunciados que ainda não aconteceram: as casas deles aparecem em vermelho. */
  get pendingTelegraphs(): TelegraphIntent[] {
    return this.intents.filter((intent) => intent.status === 'pending');
  }

  /** A casa está numa área anunciada e ainda pendente? */
  isThreatened(pos: Position): boolean {
    return this.pendingTelegraphs.some((intent) => intent.cells.some((cell) => positionsEqual(cell, pos)));
  }

  /** Unidade viva que ocupa a casa, se houver (uma entidade grande responde por todas as suas casas). */
  getUnitAt(pos: Position): Unit | null {
    return this.allUnits.find((unit) => isAlive(unit) && occupies(unit, pos)) ?? null;
  }

  isObstacle(pos: Position): boolean {
    return this.obstacleList.some((obstacle) => positionsEqual(obstacle, pos));
  }

  /**
   * Casas para onde a unidade pode andar: até `movement` passos (heróis também na diagonal),
   * sem sair do tabuleiro e sem atravessar ou parar em casas ocupadas/obstáculos.
   */
  getValidMoves(unit: Unit): Position[] {
    if (!isAlive(unit) || unit.petrified) return [];
    return this.findMoves(unit).map((option) => option.position);
  }

  // ---------- Habilidades: consultas ----------

  /** Habilidade do herói selecionado, se houver. */
  get selectedAbility(): AbilityDefinition | null {
    return this.selectedUnit?.definition.ability ?? null;
  }

  /** A habilidade do herói pode ser usada agora? (vez do jogador, vivo, ainda não usada) */
  canUseAbility(unit: Unit): boolean {
    return (
      this.currentPhase === 'player' &&
      unit.definition.team === 'hero' &&
      isAlive(unit) &&
      unit.definition.ability !== undefined &&
      !unit.abilityUsed &&
      !unit.petrified &&
      (unit.definition.ability.id !== 'exura' || this.heroes.some((hero) => hero.hp < hero.maxHp))
    );
  }

  /** Seleção de alvo em andamento (entre "Usar habilidade" e "Confirmar"), se houver. */
  get targeting(): AbilityTargeting | null {
    return this.targetingState;
  }

  /** Converte a seleção local de alvo em uma ação serializável para a sessão cooperativa. */
  getCooperativeAbilityAction(): CooperativeBattleAction | null {
    const targeting = this.targetingState;
    const hero = this.selectedUnit;
    const abilityId = hero?.definition.ability?.id;
    if (!targeting || !hero || !abilityId) return null;
    switch (targeting.id) {
      case 'ambush':
        return targeting.targetUid && targeting.destination
          ? { type: 'ability', abilityId, targetUid: targeting.targetUid, destination: { ...targeting.destination } }
          : null;
      case 'exura':
        return targeting.targetUid ? { type: 'ability', abilityId, targetUid: targeting.targetUid } : null;
      case 'fireball':
        return targeting.center ? { type: 'ability', abilityId, target: { ...targeting.center } } : null;
      case 'piercing-shot':
        return targeting.direction
          ? { type: 'ability', abilityId, target: { col: hero.position.col + targeting.direction.col, row: hero.position.row + targeting.direction.row } }
          : null;
    }
    return null;
  }

  /** Último aviso para o jogador (ação inválida, motivo de recusa...). */
  get notice(): string | null {
    return this.noticeText;
  }

  /** A escolha de alvo está completa e pode ser confirmada? */
  get canConfirmAbility(): boolean {
    const targeting = this.targetingState;
    if (!targeting) return false;
    switch (targeting.id) {
      case 'ambush':
        return targeting.targetUid !== null && targeting.destination !== null;
      case 'piercing-shot':
        return targeting.direction !== null;
      case 'fireball':
        return targeting.center !== null;
      case 'exura':
        return targeting.targetUid !== null;
    }
  }

  /** Instrução para o passo atual da escolha de alvo. */
  get targetingHint(): string {
    const targeting = this.targetingState;
    if (!targeting) return '';
    switch (targeting.id) {
      case 'ambush':
        if (targeting.targetUid === null) return 'Clique em um monstro para escolhê-lo como alvo.';
        if (targeting.destination === null) {
          return 'Clique em uma das casas destacadas para escolher o destino.';
        }
        return 'Confirme a Emboscada (ou clique em outra casa destacada para mudar o destino).';
      case 'piercing-shot':
        return targeting.direction === null
          ? 'Clique em uma casa na mesma linha ou coluna do Arqueiro para escolher a direção.'
          : 'A trajetória está destacada. Confirme o disparo ou escolha outra direção.';
      case 'fireball':
        return targeting.center === null
          ? 'Clique na casa que será o centro da explosão (área 3×3).'
          : 'A área está destacada. Confirme a explosão ou escolha outro centro.';
      case 'exura': {
        const target = targeting.targetUid === null ? null : this.findUnit(targeting.targetUid);
        if (!target) return 'Clique em um herói ferido para curá-lo.';
        const source = this.findUnit(targeting.heroUid);
        const amount = source ? healAmount(target, ABILITY_BALANCE.exuraHealRatio, source) : 0;
        return `${target.definition.name} recuperará ${amount} PV. Confirme a cura ou escolha outro herói.`;
      }
    }
  }

  /** O que a cena deve desenhar durante a escolha de alvo (null se não há escolha em andamento). */
  get abilityPreview(): AbilityPreview | null {
    const targeting = this.targetingState;
    const hero = this.selectedUnit;
    if (!targeting || !hero) return null;

    switch (targeting.id) {
      case 'ambush': {
        const target = targeting.targetUid === null ? null : this.findUnit(targeting.targetUid);
        if (!target) {
          return { selectable: this.monsters.flatMap((monster) => unitCells(monster)), effect: [], chosen: [] };
        }
        const chosen = unitCells(target);
        if (targeting.destination) chosen.push(targeting.destination);
        return {
          selectable: ambushDestinations(hero, target, this.combatContext()),
          effect: targeting.destination ? unitCells(target) : [],
          chosen,
        };
      }
      case 'piercing-shot': {
        const allLines = ORTHOGONAL_DIRECTIONS.flatMap((dir) => pierceLine(hero.position, dir));
        return {
          selectable: allLines,
          effect: targeting.direction ? pierceLine(hero.position, targeting.direction) : [],
          chosen: [],
        };
      }
      case 'fireball':
        return {
          selectable: [],
          effect: targeting.center ? fireballArea(targeting.center) : [],
          chosen: targeting.center ? [targeting.center] : [],
        };
      case 'exura': {
        const target = targeting.targetUid === null ? null : this.findUnit(targeting.targetUid);
        return {
          selectable: this.heroes.filter((h) => h.hp < h.maxHp).flatMap((h) => unitCells(h)),
          effect: target ? unitCells(target) : [],
          chosen: target ? unitCells(target) : [],
        };
      }
    }
  }

  // ---------- Ações do jogador (só na fase 'player') ----------

  /** Seleciona um herói vivo; se ele já estava selecionado, desfaz a seleção. */
  toggleSelection(uid: string): void {
    if (this.currentPhase !== 'player') return;
    if (this.selectedUnitUid === uid) {
      this.clearSelection();
      return;
    }
    const unit = this.allUnits.find((candidate) => candidate.uid === uid);
    if (!unit || !isAlive(unit) || unit.definition.team !== 'hero') return;
    if (this.cooperativeMode && unit.uid !== this.cooperativeControlledHeroUid) return;
    this.selectedUnitUid = uid;
    this.targetingState = null;
    this.noticeText = null;
    this.emit('select');
  }

  /** Distribui pontos no herói selecionado sem consumir o turno de combate. */
  allocateSelectedAttribute(attribute: AttributeName): boolean {
    return this.allocateSelectedAttributePoints(attribute, 1);
  }

  /** Distribui até a quantidade solicitada, limitada aos pontos disponíveis. */
  allocateSelectedAttributePoints(attribute: AttributeName, requestedPoints: number): boolean {
    if (this.currentPhase !== 'player' || this.targetingState) return false;
    const hero = this.selectedUnit;
    return hero ? this.applyPersistedAttributeAllocation(hero.uid, attribute, requestedPoints) : false;
  }

  /** Aplica localmente uma alocação que já foi validada e gravada pelo servidor. */
  applyPersistedAttributeAllocation(heroUid: string, attribute: AttributeName, requestedPoints: number): boolean {
    const hero = this.allUnits.find((unit) => unit.uid === heroUid);
    if (!hero || hero.definition.team !== 'hero' || !hero.progression) return false;
    if (!Number.isInteger(requestedPoints) || requestedPoints < 1) return false;
    if (attribute !== 'strength' && attribute !== 'vitality' && attribute !== 'defense') return false;
    if (!allocateAttributePoint(hero, attribute, requestedPoints)) return false;
    if (attribute === 'strength') hero.damage += requestedPoints;
    else if (attribute === 'vitality') {
      hero.maxHp += requestedPoints * 5;
      hero.hp = Math.min(hero.maxHp, hero.hp + requestedPoints * 5);
    }
    const label = attribute === 'strength' ? 'Força' : attribute === 'vitality' ? 'Vitalidade' : 'Defesa';
    this.addLog(`${hero.definition.name} investiu ${requestedPoints} ponto(s) em ${label}.`, 'hero');
    this.emit('select');
    return true;
  }
  /** Desfaz a seleção do herói e qualquer escolha de alvo em andamento. */
  clearSelection(): void {
    if (this.selectedUnitUid === null && this.targetingState === null) return;
    this.selectedUnitUid = null;
    this.targetingState = null;
    this.noticeText = null;
    this.emit('select');
  }

  /**
   * Move o herói selecionado para `destination` se for uma casa válida e inicia a
   * resolução do turno. Retorna true se a movimentação ocorreu.
   */
  moveSelectedUnit(destination: Position): boolean {
    if (this.currentPhase !== 'player') return false;
    if (this.targetingState) return false; // escolhendo alvo de habilidade: nada de mover
    const unit = this.selectedUnit;
    if (!unit || unit.petrified || (unit.trappedTurns ?? 0) > 0) {
      if (unit?.petrified) this.setNotice(`${unit.definition.name} está petrificado e não pode agir neste turno.`);
      else if (unit && (unit.trappedTurns ?? 0) > 0) this.setNotice(`${unit.definition.name} está preso na areia movediça por mais ${unit.trappedTurns} turno(s), mas ainda pode atacar.`);
      return false;
    }

    const option = this.findMoves(unit).find((move) => positionsEqual(move.position, destination));
    if (!option) return false;

    this.resetEffects();
    const from = positionLabel(unit.position);
    unit.facing = directionBetween(unit.position, option.position);
    unit.position = { col: option.position.col, row: option.position.row };
    this.addLog(`${unit.definition.name} moveu de ${from} para ${positionLabel(unit.position)}.`, 'hero');
    if (this.currentFloor === 55 && this.sandTrapCells.some((cell) => positionsEqual(cell, unit.position))) {
      const key = `${unit.position.col},${unit.position.row}`;
      if (!this.revealedSandTraps.has(key)) {
        this.revealedSandTraps.add(key);
        unit.trappedTurns = 4;
        this.addLog(`AREIA MOVEDIÇA! ${unit.definition.name} ficou preso por 3 turnos. Ainda pode atacar!`, 'monster');
        this.effect = { id: 'telegraph', cells: [{ ...unit.position }] };
      }
    }

    this.noticeText = null;
    this.beginResolution();
    return true;
  }

  /** O jogador passa a vez: ninguém se move, mas os ataques do turno acontecem. */
  passTurn(): boolean {
    if (this.currentPhase !== 'player') return false;
    this.resetEffects();
    this.targetingState = null;
    this.noticeText = null;
    this.addLog('O jogador passou a vez.', 'info');
    this.beginResolution();
    return true;
  }

  /** Reinicia a batalha a qualquer momento, inclusive durante a resolução. */
  reset(notify = true): void {
    this.setup();
    // O menu destrói a cena antes de reiniciar; não notifique listeners antigos nesse caso.
    if (notify) this.emit('reset');
  }

  /**
   * Prepara um novo encontro (por exemplo, o próximo andar): troca as unidades e os obstáculos,
   * volta ao turno 1 e limpa seleção, escolha de alvo, avisos, efeitos e filas pendentes.
   * As unidades recebidas são usadas como estão: para manter o grupo entre andares, a campanha
   * reaproveita os mesmos heróis (com o PV atual) no `setup.units`. O log é preservado.
   */
  loadEncounter(battle: BattleSetup, notify = true): void {
    this.applyBattle(battle, false);
    // Ao inicializar uma cena nova, o estado deve ser preparado sem notificar listeners
    // pertencentes à cena anterior (que pode estar em processo de destruição).
    if (notify) this.emit('encounter');
  }

  // ---------- Habilidades: ações do jogador ----------

  /**
   * Inicia a habilidade do herói selecionado. A Pisada, que não precisa de alvo, é usada na hora;
   * as demais abrem a escolha de alvo. Retorna false se não for possível (e explica no aviso).
   */
  beginAbility(): boolean {
    if (this.currentPhase !== 'player') return false;
    const hero = this.selectedUnit;
    const ability = hero?.definition.ability;
    if (!hero || !ability) return false;
    if (hero.petrified) {
      this.setNotice(`${hero.definition.name} está petrificado e não pode usar habilidades neste turno.`);
      this.emit('targeting');
      return false;
    }

    if (hero.abilityUsed) {
      this.setNotice(`${ability.name} já foi usada neste combate.`);
      this.emit('targeting');
      return false;
    }

    if (ability.id === 'exura' && !this.heroes.some((ally) => ally.hp < ally.maxHp)) {
      this.setNotice('Exura não pode ser ativada: todos os heróis estão com a vida cheia.');
      this.emit('targeting');
      return false;
    }

    this.noticeText = null;
    switch (ability.id) {
      case 'stomp':
        this.useAbility(hero, ability, '', () => this.castStomp(hero));
        return true;
      case 'ambush':
        this.targetingState = { id: 'ambush', heroUid: hero.uid, targetUid: null, destination: null };
        break;
      case 'piercing-shot':
        this.targetingState = { id: 'piercing-shot', heroUid: hero.uid, direction: null };
        break;
      case 'fireball':
        this.targetingState = { id: 'fireball', heroUid: hero.uid, center: null };
        break;
      case 'exura':
        this.targetingState = { id: 'exura', heroUid: hero.uid, targetUid: null };
        break;
    }
    this.emit('targeting');
    return true;
  }

  /** Cancela a escolha de alvo sem consumir a habilidade. */
  cancelAbility(): void {
    if (!this.targetingState) return;
    this.targetingState = null;
    this.noticeText = null;
    this.emit('targeting');
  }

  /**
   * Clique numa casa durante a escolha de alvo: atualiza a escolha e a prévia (sem usar a
   * habilidade). Retorna true se a escolha foi aceita; se não, explica no aviso.
   */
  chooseAbilityCell(cell: Position): boolean {
    if (this.currentPhase !== 'player') return false;
    const targeting = this.targetingState;
    const hero = this.selectedUnit;
    if (!targeting || !hero || hero.uid !== targeting.heroUid) return false;

    let accepted = false;
    switch (targeting.id) {
      case 'ambush':
        accepted = this.chooseAmbushCell(hero, targeting, cell);
        break;
      case 'piercing-shot':
        accepted = this.choosePierceCell(hero, targeting, cell);
        break;
      case 'fireball':
        accepted = this.chooseFireballCell(targeting, cell);
        break;
      case 'exura':
        accepted = this.chooseExuraCell(targeting, cell);
        break;
    }
    this.emit('targeting');
    return accepted;
  }

  /**
   * Confirma e usa a habilidade com a escolha atual. Revalida tudo; se algo não estiver válido,
   * não consome a habilidade. Depois do uso, a resolução do turno começa (os heróis atacam...).
   */
  confirmAbility(): boolean {
    if (this.currentPhase !== 'player') return false;
    const targeting = this.targetingState;
    const hero = this.selectedUnit;
    const ability = hero?.definition.ability;
    if (!targeting || !hero || !ability || hero.uid !== targeting.heroUid) return false;
    if (hero.abilityUsed) return false;

    switch (targeting.id) {
      case 'ambush': {
        const target = targeting.targetUid === null ? null : this.findUnit(targeting.targetUid);
        const destination = targeting.destination;
        if (!target || !isAlive(target) || !destination) {
          this.rejectConfirm('Escolha o alvo e a casa de destino antes de confirmar.');
          return false;
        }
        const valid = ambushDestinations(hero, target, this.combatContext()).some((cell) =>
          positionsEqual(cell, destination),
        );
        if (!valid) {
          this.rejectConfirm('A casa de destino não é mais válida. Escolha outra.');
          return false;
        }
        const detail = ` em ${target.definition.name} (${positionLabel(target.position)})`;
        this.useAbility(hero, ability, detail, () => this.castAmbush(hero, target, destination));
        return true;
      }
      case 'piercing-shot': {
        const direction = targeting.direction;
        if (!direction) {
          this.rejectConfirm('Escolha a direção do disparo antes de confirmar.');
          return false;
        }
        const detail = ` (${directionName(direction)})`;
        this.useAbility(hero, ability, detail, () => this.castPiercingShot(hero, direction));
        return true;
      }
      case 'fireball': {
        const center = targeting.center;
        if (!center || !isInsideBoard(center)) {
          this.rejectConfirm('Escolha o centro da explosão antes de confirmar.');
          return false;
        }
        const detail = ` (centro em ${positionLabel(center)})`;
        this.useAbility(hero, ability, detail, () => this.castFireball(hero, center));
        return true;
      }
      case 'exura': {
        const target = targeting.targetUid === null ? null : this.findUnit(targeting.targetUid);
        if (!target || !isAlive(target) || target.definition.team !== 'hero') {
          this.rejectConfirm('Escolha um herói vivo antes de confirmar.');
          return false;
        }
        if (healAmount(target, ABILITY_BALANCE.exuraHealRatio, hero) === 0) {
          this.rejectConfirm(`${target.definition.name} já está com PV máximo.`, true);
          return false;
        }
        const detail = ` em ${target.definition.name}`;
        this.useAbility(hero, ability, detail, () => this.castExura(hero, target));
        return true;
      }
    }
  }

  // ---------- Resolução do turno ----------

  /**
   * Avança a resolução em um passo: o próximo herói/monstro que realmente age (ataca ou anda).
   * Unidades derrotadas ou sem nada a fazer são puladas sem custar um passo. Quando não há mais
   * ninguém para agir, a fase termina e é emitido 'turn' (próximo turno) ou 'over' (fim).
   * Não faz nada se não houver resolução em andamento.
   */
  step(): void {
    if (!this.isResolving) return;
    this.resetEffects();
    this.lastActorUid = null;

    while (this.isResolving) {
      if (this.advance()) {
        this.emit('step');
        return;
      }
    }

    this.emit(this.isOver ? 'over' : 'turn');
  }

  /** Executa todos os passos pendentes de uma vez, sem animação. */
  resolveAll(): void {
    while (this.isResolving) {
      this.step();
    }
  }

  /** Exporta o estado mutável completo do combate para persistência JSON. */
  exportSnapshot(): Record<string, unknown> {
    return {
      version: 1,
      units: this.allUnits.map((unit) => {
        const { definition, ...state } = unit;
        return { ...state, definitionId: definition.id };
      }),
      obstacles: this.obstacleList.map((cell) => ({ ...cell })),
      turn: this.currentTurn,
      floor: this.currentFloor,
      sandTrapCells: this.sandTrapCells.map((cell) => ({ ...cell })),
      revealedSandTraps: [...this.revealedSandTraps],
      frankensteinEnraged: this.frankensteinEnraged,
      specialBossCycles: [...this.specialBossCycles.entries()],
      cheshireCycles: [...this.cheshireCycles.entries()],
      cucaMinionSpawns: [...this.cucaMinionSpawns.entries()].map(([uid, pos]) => [uid, { ...pos }]),
      phase: this.currentPhase,
      outcome: this.currentOutcome,
      selectedUnitUid: this.selectedUnitUid,
      targeting: this.targetingState,
      notice: this.noticeText,
      pendingActors: [...this.pendingActors],
      lastActorUid: this.lastActorUid,
      intents: this.intents.map((intent) => ({ ...intent, cells: intent.cells.map((cell) => ({ ...cell })) })),
      intentCounter: this.intentCounter,
      log: this.logEntries.map((entry) => ({ ...entry })),
      damageEvents: this.damageEvents.map((event) => ({ ...event, position: { ...event.position } })),
      healEvents: this.healEvents.map((event) => ({ ...event, position: { ...event.position } })),
      effect: this.effect ? { ...this.effect, cells: this.effect.cells.map((cell) => ({ ...cell })) } : null,
      medusaProtectionUsed: [...this.medusaProtectionUsed],
    };
  }

  /**
   * Restaura o snapshot sobre o encontro-base já montado para o mesmo andar.
   * As definições de unidades vêm dos dados locais do jogo, nunca do JSON do cliente.
   */
  restoreSnapshot(snapshot: unknown, animate = false): boolean {
    if (!snapshot || typeof snapshot !== 'object') return false;
    const saved = snapshot as Record<string, unknown>;
    if (saved.version !== 1 || !Array.isArray(saved.units)) return false;
    if (!Number.isInteger(saved.turn) || Number(saved.turn) < 1) return false;
    if (!Number.isInteger(saved.floor) || Number(saved.floor) !== this.currentFloor) return false;
    if (!['player', 'heroes', 'telegraphs', 'monsters', 'over'].includes(String(saved.phase))) return false;
    if (!['ongoing', 'victory', 'defeat'].includes(String(saved.outcome))) return false;
    const definitions = new Map<string, Unit['definition']>();
    for (const unit of this.allUnits) definitions.set(unit.uid, unit.definition);
    if (saved.units.length !== this.allUnits.length) return false;
    const pending: { unit: Unit; mutable: Record<string, unknown> }[] = [];
    const seen = new Set<string>();
    for (const entry of saved.units) {
      if (!entry || typeof entry !== 'object') return false;
      const state = entry as Record<string, unknown>;
      const uid = state.uid;
      const definition = typeof uid === 'string' ? definitions.get(uid) : undefined;
      if (!definition || definition.id !== state.definitionId || seen.has(uid as string)) return false;
      const unit = this.allUnits.find((candidate) => candidate.uid === uid);
      if (!unit || !Number.isFinite(state.hp) || !Number.isFinite(state.maxHp) || !Number.isFinite(state.damage)) return false;
      if (!state.position || typeof state.position !== 'object' || !state.facing || typeof state.facing !== 'object') return false;
      const mutable = { ...state };
      delete mutable.uid;
      delete mutable.definitionId;
      pending.push({ unit, mutable });
      seen.add(uid as string);
    }
    if (seen.size !== definitions.size) return false;

    for (const item of pending) Object.assign(item.unit, item.mutable);
    this.allUnits = pending.map((item) => item.unit);
    this.obstacleList = Array.isArray(saved.obstacles) ? saved.obstacles as Position[] : [];
    this.currentTurn = Number(saved.turn);
    this.currentFloor = Number(saved.floor) || 0;
    this.sandTrapCells = Array.isArray(saved.sandTrapCells) ? saved.sandTrapCells as Position[] : [];
    this.revealedSandTraps.clear();
    if (Array.isArray(saved.revealedSandTraps)) saved.revealedSandTraps.forEach((key) => { if (typeof key === 'string') this.revealedSandTraps.add(key); });
    this.frankensteinEnraged = saved.frankensteinEnraged === true;
    this.specialBossCycles.clear();
    if (Array.isArray(saved.specialBossCycles)) for (const pair of saved.specialBossCycles) if (Array.isArray(pair) && typeof pair[0] === 'string' && Number.isInteger(pair[1])) this.specialBossCycles.set(pair[0], Number(pair[1]));
    this.cheshireCycles.clear();
    if (Array.isArray(saved.cheshireCycles)) for (const pair of saved.cheshireCycles) if (Array.isArray(pair) && typeof pair[0] === 'string' && Number.isInteger(pair[1])) this.cheshireCycles.set(pair[0], Number(pair[1]));
    this.cucaMinionSpawns.clear();
    if (Array.isArray(saved.cucaMinionSpawns)) for (const pair of saved.cucaMinionSpawns) if (Array.isArray(pair) && typeof pair[0] === 'string' && pair[1] && typeof pair[1] === 'object') this.cucaMinionSpawns.set(pair[0], pair[1] as Position);
    this.currentPhase = saved.phase as BattlePhase;
    this.currentOutcome = saved.outcome as BattleOutcome;
    this.selectedUnitUid = typeof saved.selectedUnitUid === 'string' ? saved.selectedUnitUid : null;
    this.targetingState = saved.targeting && typeof saved.targeting === 'object' ? saved.targeting as AbilityTargeting : null;
    this.noticeText = typeof saved.notice === 'string' ? saved.notice : null;
    this.pendingActors = Array.isArray(saved.pendingActors) ? saved.pendingActors.filter((uid): uid is string => typeof uid === 'string') : [];
    this.lastActorUid = typeof saved.lastActorUid === 'string' ? saved.lastActorUid : null;
    this.intents = Array.isArray(saved.intents) ? saved.intents as TelegraphIntent[] : [];
    this.intentCounter = Number.isInteger(saved.intentCounter) ? Number(saved.intentCounter) : 0;
    this.logEntries = Array.isArray(saved.log) ? (saved.log as LogEntry[]).slice(-MAX_LOG_ENTRIES) : [];
    this.damageEvents = Array.isArray(saved.damageEvents) ? saved.damageEvents as DamageEvent[] : [];
    this.healEvents = Array.isArray(saved.healEvents) ? saved.healEvents as HealEvent[] : [];
    this.effect = saved.effect && typeof saved.effect === 'object' ? saved.effect as AbilityEffect : null;
    this.medusaProtectionUsed.clear();
    if (Array.isArray(saved.medusaProtectionUsed)) saved.medusaProtectionUsed.forEach((uid) => { if (typeof uid === 'string') this.medusaProtectionUsed.add(uid); });
    this.emit(animate ? 'sync' : 'reset');
    return true;
  }

  // ---------- Observadores ----------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---------- Internos: resolução ----------

  private beginResolution(): void {
    this.selectedUnitUid = null;
    if (this.cooperativeMode) {
      this.targetingState = null;
      this.lastActorUid = null;
      this.pendingActors = [];
      this.currentPhase = 'player';
      this.addLog('Ação enviada. Aguardando os demais jogadores.', 'info');
      this.emit('turn');
      return;
    }
    this.targetingState = null;
    this.lastActorUid = null;
    this.currentPhase = 'heroes';
    this.pendingActors = this.heroes.map((hero) => hero.uid);
    this.addLog('Os heróis atacam.', 'info');
    this.emit('resolving');
  }

  /** Processa o próximo ator da fila. Retorna true se alguém agiu de fato. */
  private advance(): boolean {
    const uid = this.pendingActors.shift();

    if (uid === undefined) {
      if (this.currentPhase === 'heroes') {
        this.finishHeroPhase();
      } else if (this.currentPhase === 'telegraphs') {
        this.finishTelegraphPhase();
      } else if (this.currentPhase === 'monsters-move') {
        this.finishMonsterMovePhase();
      } else {
        this.finishMonsterPhase();
      }
      return false;
    }

    // Na fase dos golpes anunciados a fila guarda ids de intenções, não de unidades.
    if (this.currentPhase === 'telegraphs') {
      return this.resolveTelegraph(uid);
    }

    // Quem morreu depois de entrar na fila não age.
    const actor = this.allUnits.find((unit) => unit.uid === uid);
    if (!actor || !isAlive(actor)) return false;

    const acted = this.currentPhase === 'heroes'
      ? this.heroAct(actor)
      : this.currentPhase === 'monsters-move'
        ? this.cooperativeMonsterMoveAct(actor)
        : this.currentPhase === 'monsters-attack'
          ? this.cooperativeMonsterAttackAct(actor)
          : this.monsterAct(actor);
    if (acted) this.lastActorUid = actor.uid;
    return acted;
  }

  private finishHeroPhase(): void {
    this.updateOutcome();
    if (this.isOver) return;
    this.currentPhase = 'telegraphs';
    this.pendingActors = this.pendingTelegraphs.map((intent) => intent.id);
  }

  private finishTelegraphPhase(): void {
    this.updateOutcome();
    if (this.isOver) return;
    this.cooperativeMonsterAttackQueue = [];
    this.currentPhase = this.cooperativeMode ? 'monsters-move' : 'monsters';
    this.pendingActors = this.monsters.map((monster) => monster.uid);
    this.addLog(this.cooperativeMode ? 'Os monstros se movimentam.' : 'Os monstros agem.', 'info');
  }

  /** Na cooperação, todos os monstros primeiro se movimentam; os ataques vêm em outra fase animada. */
  private finishMonsterMovePhase(): void {
    this.updateOutcome();
    if (this.isOver) return;
    this.currentPhase = 'monsters-attack';
    this.pendingActors = [...this.cooperativeMonsterAttackQueue];
    this.addLog('Os monstros agora atacam!', 'monster');
  }

  private cooperativeMonsterMoveAct(monster: Unit): boolean {
    if (monster.stunned) {
      monster.stunned = false;
      this.addLog(`${monster.definition.name} está atordoado e perde a ação. Já se recuperou.`, 'monster');
      return true;
    }

    if (monster.definition.id === 'medusa') {
      monster.medusaCycle = (monster.medusaCycle ?? 0) + 1;
      if (monster.medusaCycle % 2 === 0) {
        const directions = [
          { col: 0, row: -1 }, { col: 1, row: 0 },
          { col: 0, row: 1 }, { col: -1, row: 0 },
        ];
        const gazeDirection = directions[(2 + Math.floor(monster.medusaCycle / 2) - 1) % directions.length];
        monster.facing = { ...gazeDirection };
        const body = unitCells(monster);
        const affected = this.heroes.filter((hero) =>
          unitCells(hero).some((heroCell) =>
            body.some((bodyCell) => {
              const dx = heroCell.col - bodyCell.col;
              const dy = heroCell.row - bodyCell.row;
              if (gazeDirection.col === 1) return dy === 0 && dx > 0;
              if (gazeDirection.col === -1) return dy === 0 && dx < 0;
              if (gazeDirection.row === 1) return dx === 0 && dy > 0;
              return dx === 0 && dy < 0;
            }),
          ),
        );
        for (const hero of affected) {
          hero.petrified = true;
          this.addLog(`${hero.definition.name} foi petrificado pelo olhar da Medusa e perderá sua próxima ação!`, 'monster');
        }
        this.effect = { id: 'telegraph', cells: affected.flatMap((hero) => unitCells(hero)) };
        this.addLog(affected.length ? 'Medusa lançou seu olhar petrificante!' : 'Medusa lançou seu olhar petrificante, mas não atingiu ninguém.', 'monster');
        return true;
      }
    }

    if (monster.definition.id === 'cheshire-cat') {
      const cycle = (this.cheshireCycles.get(monster.uid) ?? 0) + 1;
      this.cheshireCycles.set(monster.uid, cycle);
      if (cycle % 2 === 0) {
        this.teleportCheshireCat(monster);
        return true;
      }
    }

    if (monster.definition.id === 'yamata-no-orochi') {
      const stage = ((this.specialBossCycles.get(monster.uid) ?? 0) % 3) + 1;
      this.specialBossCycles.set(monster.uid, stage);
      this.yamataSwordSweep(monster, stage);
      return true;
    }

    if (this.tryAnnounceTelegraph(monster)) return true;

    const move = chooseMonsterMove(monster, this.combatContext());
    if (move) {
      const from = positionLabel(monster.position);
      monster.facing = directionBetween(monster.position, move.position);
      monster.position = { col: move.position.col, row: move.position.row };
      this.addLog(`${monster.definition.name} avançou de ${from} para ${positionLabel(monster.position)}.`, 'monster');
    }
    this.cooperativeMonsterAttackQueue.push(monster.uid);
    return Boolean(move);
  }

  private cooperativeMonsterAttackAct(monster: Unit): boolean {
    let acted = this.performAttack(monster) > 0;
    if (monster.definition.id === 'cuca' && this.resurrectCucaMinions(monster)) acted = true;
    return acted;
  }

  private finishMonsterPhase(): void {
    this.updateOutcome();
    if (this.isOver) return;
    for (const hero of this.heroRoster) {
      if ((hero.trappedTurns ?? 0) > 0) {
        hero.trappedTurns = Math.max(0, (hero.trappedTurns ?? 0) - 1);
        if (hero.trappedTurns === 0) this.addLog(`${hero.definition.name} conseguiu se soltar da areia movediça!`, 'hero');
      }
    }
    if (this.currentFloor === 80 && this.currentTurn % 3 === 0) this.teleportOzHeroes();
    this.currentTurn += 1;
    this.currentPhase = 'player';
    this.addLog(`Turno ${this.currentTurn} começou. Sua vez.`, 'info');
  }

  private heroAct(hero: Unit): boolean {
    if (hero.petrified) {
      hero.petrified = false;
      this.addLog(`${hero.definition.name} se liberta da petrificação e perde sua ação neste turno.`, 'monster');
      return true;
    }
    return this.performAttack(hero) > 0;
  }

  /**
   * Monstro atordoado perde a ação (e se recupera). Os demais avançam (se não tiverem alvo
   * ao alcance) e atacam (se tiverem alvo depois de avançar).
   */
  private monsterAct(monster: Unit): boolean {
    if (this.heroes.length === 0) return false;

    if (monster.stunned) {
      monster.stunned = false;
      this.addLog(`${monster.definition.name} está atordoado e perde a ação. Já se recuperou.`, 'monster');
      return true;
    }

    // A cada duas ações, a Medusa usa o olhar petrificante. Esse golpe substitui
    // o movimento e o ataque comum, para que a direção do olhar não seja sobrescrita
    // pela movimentação da IA antes de o jogador poder perceber o efeito.
    if (monster.definition.id === 'medusa') {
      monster.medusaCycle = (monster.medusaCycle ?? 0) + 1;
      if (monster.medusaCycle % 2 === 0) {
        const directions = [
          { col: 0, row: -1 },
          { col: 1, row: 0 },
          { col: 0, row: 1 },
          { col: -1, row: 0 },
        ];
        // O primeiro olhar deve apontar para baixo, em direção à formação inicial dos heróis.
        // Não podemos derivar a direção de `monster.facing`: o movimento comum altera essa
        // propriedade e poderia fazer a Medusa começar olhando para longe dos personagens.
        const gazeIndex = (2 + Math.floor(monster.medusaCycle / 2) - 1) % directions.length;
        const gazeDirection = directions[gazeIndex];
        monster.facing = { ...gazeDirection };

        const body = unitCells(monster);
        const affected = this.heroes.filter((hero) =>
          unitCells(hero).some((heroCell) =>
            body.some((bodyCell) => {
              const dx = heroCell.col - bodyCell.col;
              const dy = heroCell.row - bodyCell.row;
              if (gazeDirection.col === 1) return dy === 0 && dx > 0;
              if (gazeDirection.col === -1) return dy === 0 && dx < 0;
              if (gazeDirection.row === 1) return dx === 0 && dy > 0;
              return dx === 0 && dy < 0;
            }),
          ),
        );

        for (const hero of affected) {
          hero.petrified = true;
          this.addLog(`${hero.definition.name} foi petrificado pelo olhar da Medusa e perderá sua próxima ação!`, 'monster');
        }
        this.effect = { id: 'telegraph', cells: affected.flatMap((hero) => unitCells(hero)) };
        const directionName = monster.facing.col === 1
          ? 'leste'
          : monster.facing.col === -1
            ? 'oeste'
            : monster.facing.row === 1
              ? 'sul'
              : 'norte';
        this.addLog(
          affected.length
            ? `Medusa lançou seu olhar petrificante para ${directionName}!`
            : `Medusa lançou seu olhar petrificante para ${directionName}, mas não atingiu ninguém.`,
          'monster',
        );
        return true;
      }
    }

    // O Gato Mistério desaparece e reaparece atrás de um herói a cada duas ações.
    // Se os três heróis vivos estiverem encostados nas bordas, escolhe uma casa livre aleatória.
    if (monster.definition.id === 'cheshire-cat') {
      const cycle = (this.cheshireCycles.get(monster.uid) ?? 0) + 1;
      this.cheshireCycles.set(monster.uid, cycle);
      if (cycle % 2 === 0) {
        this.teleportCheshireCat(monster);
        return true;
      }
    }

    if (monster.definition.id === 'yamata-no-orochi') {
      // O golpe avança uma faixa por ação do chefe: uma etapa em cada turno.
      const stage = ((this.specialBossCycles.get(monster.uid) ?? 0) % 3) + 1;
      this.specialBossCycles.set(monster.uid, stage);
      this.yamataSwordSweep(monster, stage);
      return true;
    }

    // Chefe com ataques telegrafados: anunciar o golpe é a ação dele neste turno.
    if (this.tryAnnounceTelegraph(monster)) return true;

    let acted = false;

    const move = chooseMonsterMove(monster, this.combatContext());
    if (move) {
      const from = positionLabel(monster.position);
      monster.facing = directionBetween(monster.position, move.position);
      monster.position = { col: move.position.col, row: move.position.row };
      this.addLog(
        `${monster.definition.name} avançou de ${from} para ${positionLabel(monster.position)}.`,
        'monster',
      );
      acted = true;
    }

    if (this.performAttack(monster) > 0) acted = true;
    if (monster.definition.id === 'cuca' && this.resurrectCucaMinions(monster)) acted = true;
    return acted;
  }

  /** A Cuca mantém seus acompanhantes no combate: se caírem, ela os ressuscita. */
  private resurrectCucaMinions(cuca: Unit): boolean {
    if (!isAlive(cuca)) return false;
    let resurrected = false;
    for (const [uid, originalPosition] of this.cucaMinionSpawns) {
      const minion = this.allUnits.find((unit) => unit.uid === uid);
      if (!minion || isAlive(minion)) continue;
      const isFree = (position: Position): boolean =>
        isInsideBoard(position) && !this.isObstacle(position) &&
        !this.units.some((unit) => unit !== minion && occupies(unit, position));
      let destination: Position | undefined;
      if (isFree(originalPosition)) destination = { ...originalPosition };
      else {
        const candidates: Position[] = [];
        for (let row = 0; row < BOARD_ROWS; row++) {
          for (let col = 0; col < BOARD_COLS; col++) {
            const cell = { col, row };
            if (isFree(cell)) candidates.push(cell);
          }
        }
        candidates.sort((left, right) =>
          Math.abs(left.col - originalPosition.col) + Math.abs(left.row - originalPosition.row) -
          Math.abs(right.col - originalPosition.col) - Math.abs(right.row - originalPosition.row),
        );
        destination = candidates[0];
      }
      if (!destination) continue;
      minion.position = destination;
      minion.hp = minion.maxHp;
      minion.stunned = false;
      minion.petrified = false;
      minion.abilityUsed = false;
      this.addLog(`A Cuca ergueu as mãos e ressuscitou ${minion.definition.name}!`, 'ability');
      resurrected = true;
    }
    if (resurrected) {
      this.lastActorUid = cuca.uid;
      this.addLog('A magia da Cuca mantém seus servos presos à batalha. Derrote a Cuca para impedir novas ressurreições!', 'ability');
    }
    return resurrected;
  }
  /**
   * Teleporte especial do Gato Mistério. A casa-alvo fica imediatamente atrás do herói,
   * no lado oposto ao Gato. Se todos os heróis vivos estiverem nas bordas, ou a casa
   * estiver bloqueada, usa uma casa livre aleatória do tabuleiro.
   */
  private teleportCheshireCat(cat: Unit): void {
    const heroes = this.heroes;
    if (heroes.length === 0) return;

    const allAgainstWall = heroes.length === 3 && heroes.every((hero) =>
      unitCells(hero).some((cell) =>
        cell.col === 0 || cell.col === BOARD_COLS - 1 || cell.row === 0 || cell.row === BOARD_ROWS - 1,
      ),
    );

    const target = heroes[Math.floor(Math.random() * heroes.length)];
    const direction = directionBetween(cat.position, target.position);
    const behindTarget = {
      col: target.position.col + direction.col,
      row: target.position.row + direction.row,
    };
    const isFree = (position: Position): boolean =>
      isInsideBoard(position) &&
      !this.isObstacle(position) &&
      !this.units.some((unit) => unit !== cat && occupies(unit, position));

    let destination: Position | undefined;
    if (!allAgainstWall && isFree(behindTarget)) {
      destination = behindTarget;
    } else {
      const freeCells: Position[] = [];
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const cell = { col, row };
          if (isFree(cell)) freeCells.push(cell);
        }
      }
      if (freeCells.length > 0) {
        destination = freeCells[Math.floor(Math.random() * freeCells.length)];
      }
    }

    if (!destination) {
      this.addLog('Gato Mistério tentou desaparecer, mas não encontrou uma casa livre.', 'monster');
      return;
    }

    const from = positionLabel(cat.position);
    cat.position = { col: destination.col, row: destination.row };
    cat.facing = directionBetween(cat.position, target.position);
    this.addLog(
      allAgainstWall
        ? `Gato Mistério desapareceu de ${from} e reapareceu em ${positionLabel(destination)}!`
        : `Gato Mistério desapareceu de ${from} e surgiu atrás de ${target.definition.name}, em ${positionLabel(destination)}!`,
      'monster',
    );
    this.performAttack(cat);
  }

  /** Ataque normal: acerta todos os alvos válidos da unidade. Retorna quantos foram atingidos. */
  private performAttack(attacker: Unit): number {
    const targets = findAttackTargets(attacker, this.combatContext());
    const kind: LogKind = attacker.definition.team === 'hero' ? 'hero' : 'monster';

    for (const target of targets) {
      this.dealDamage(target, attacker.damage, kind, `${attacker.definition.name} atacou`, attacker);
    }

    return targets.length;
  }

  /** Aplica dano (HP nunca fica abaixo de zero), registra o golpe e a morte. */
  private dealDamage(target: Unit, amount: number, kind: LogKind, prefix: string, attacker?: Unit, ignoreMitigation = false): void {
    if (!isAlive(target)) return;
    const cell = positionLabel(target.position);
    const defenseAttribute = target.definition.team === 'hero' ? (target.progression?.attributes.defense ?? 0) : 0;
    // Cada 2 pontos de Defesa absorvem 1 ponto de dano; arredonda para baixo.
    const defense = Math.floor(defenseAttribute / 2);
    const targetSpecial = target.definition.team === 'hero' ? this.specialBonusesFor(target) : { defensePercent: 0, lifestealPercent: 0 };
    if (target.definition.team === 'hero' && targetSpecial.ignoreFirstHitPerEncounter && !this.medusaProtectionUsed.has(target.uid)) {
      this.medusaProtectionUsed.add(target.uid);
      this.addLog(`O Olho de Medusa anulou o primeiro golpe recebido por ${target.definition.name} nesta fase.`, 'ability');
      return;
    }
    const afterPercent = ignoreMitigation ? amount : Math.floor(amount * (1 - targetSpecial.defensePercent / 100));
    const effectiveAmount = target.definition.team === 'hero'
      ? (ignoreMitigation ? amount : Math.max(1, afterPercent - defense))
      : amount;
    target.hp = Math.max(0, target.hp - effectiveAmount);
    const killed = target.hp === 0;

    this.damageEvents.push({
      targetUid: target.uid,
      amount: effectiveAmount,
      position: { col: target.position.col, row: target.position.row },
      killed,
    });

    this.addLog(
      `${prefix} ${target.definition.name} (${cell}) e causou ${effectiveAmount} de dano. ` +
        `PV ${target.hp}/${target.maxHp}.`,
      kind,
    );
    if (attacker?.definition.id === 'the-seventh' && attacker.hp > 0 && target.definition.team === 'hero') {
      const healing = Math.min(attacker.maxHp - attacker.hp, Math.floor(effectiveAmount * 0.10));
      if (healing > 0) { attacker.hp += healing; this.addLog(`O Sétimo drenou a essência de ${target.definition.name} e recuperou ${healing} PV (10% do dano).`, 'monster'); this.healEvents.push({ targetUid: attacker.uid, amount: healing, position: { ...attacker.position } }); }
    }
    if (target.definition.id === 'frankenstein-abomination' && !this.frankensteinEnraged && target.hp > 0 && target.hp <= Math.floor(target.maxHp / 2)) {
      this.frankensteinEnraged = true;
      const healing = Math.floor(target.maxHp * 0.35);
      target.hp = Math.min(target.maxHp, target.hp + healing);
      target.damage = Math.ceil(target.damage * 1.5);
      this.addLog(`A Abominação de Frankenstein reanima o próprio corpo! Recupera ${healing} PV e seu dano aumenta em 50%!`, 'monster');
      this.healEvents.push({ targetUid: target.uid, amount: healing, position: { ...target.position } });
    }
    if (attacker && attacker.definition.team === 'hero' && attacker.hp > 0 && target.definition.team === 'monster') {
      const lifesteal = this.specialBonusesFor(attacker).lifestealPercent;
      const healing = Math.min(attacker.maxHp - attacker.hp, Math.floor(effectiveAmount * lifesteal / 100));
      if (healing > 0) {
        attacker.hp += healing;
        this.addLog(`${attacker.definition.name} recuperou ${healing} PV pelo Dente do Sétimo.`, 'hero');
        this.healEvents.push({ targetUid: attacker.uid, amount: healing, position: { col: attacker.position.col, row: attacker.position.row } });
      }
    }
    if (killed) {
      this.addLog(`${target.definition.name} foi derrotado!`, 'death');
      if (target.definition.team === 'hero') {
        const lost = applyDeathXpPenalty(target);
        if (lost > 0) {
          this.addLog(`${target.definition.name} perdeu ${lost} XP pela morte (penalidade de 10% da barra do nível).`, 'death');
          this.onProgressionEvent?.({ eventId: crypto.randomUUID(), kind: 'death', classId: target.definition.id, heroUid: target.uid });
        }
      }
      if (attacker && attacker.definition.team === 'hero' && target.definition.team === 'monster') {
        const gained = awardKillXp(attacker, target);
        if (gained > 0) {
          this.addLog(`${attacker.definition.name} recebeu ${gained} XP pelo golpe final.`, 'hero');
          const rank = target.definition.rank ?? 'normal';
          this.onProgressionEvent?.({ eventId: crypto.randomUUID(), kind: 'kill', classId: attacker.definition.id, heroUid: attacker.uid, monsterMaxHp: target.definition.maxHp, monsterDamage: target.definition.damage, monsterRank: rank });
        }
      }
      // Chefe morto não executa o golpe que tinha anunciado.
      this.cancelTelegraphsOf(target, `foi derrotado antes de concluir o golpe`);
    }
  }

  /** Heróis derrotados têm precedência: se todos caíram (por exemplo, por fogo amigo), é derrota. */
  /** Ferramentas de desenvolvimento: encerra o combate sem executar turnos. */
  debugSetOutcome(outcome: 'victory' | 'defeat'): void {
    if (outcome === 'victory') {
      for (const monster of this.monsters) monster.hp = 0;
    } else {
      for (const hero of this.heroes) hero.hp = 0;
    }
    this.updateOutcome();
    this.emit('step');
  }

  /** Recupera todos os heróis vivos do grupo atual. */
  debugHealHeroes(): void {
    for (const hero of this.heroRoster) {
      if (hero.hp > 0) hero.hp = hero.maxHp;
    }
    this.emit('step');
  }

  private updateOutcome(): void {
    if (this.isOver) return;

    if (this.heroes.length === 0) {
      this.currentOutcome = 'defeat';
      this.currentPhase = 'over';
      this.pendingActors = [];
      this.cancelAllTelegraphs('o combate terminou');
      this.addLog('Derrota! Todos os heróis foram derrotados.', 'result');
    } else if (this.monsters.length === 0) {
      this.currentOutcome = 'victory';
      this.currentPhase = 'over';
      this.pendingActors = [];
      this.cancelAllTelegraphs('o combate terminou');
      this.addLog('Vitória! Todos os monstros foram derrotados.', 'result');
    }
  }

  // ---------- Internos: ataques telegrafados ----------

  /**
   * Se o chefe pode, anuncia o próximo golpe: escolhe o ataque da vez e o herói-alvo, calcula a
   * área UMA vez e registra a intenção pendente. Respeita a pausa entre golpes e só admite um
   * golpe pendente por chefe. Retorna true se anunciou (isso conta como a ação do chefe).
   */
  private tryAnnounceTelegraph(boss: Unit): boolean {
    const config = boss.definition.telegraph;
    const state = boss.telegraph;
    if (!config || !state || !isAlive(boss)) return false;
    if (this.intents.some((intent) => intent.bossUid === boss.uid && intent.status === 'pending')) {
      return false;
    }

    // Em pausa: o chefe age normalmente (anda e ataca) enquanto a pausa conta.
    if (state.cooldown > 0) {
      state.cooldown -= 1;
      return false;
    }

    const attack = selectTelegraphedAttack(boss, config);
    if (!attack) return false;
    const target = chooseTelegraphTarget(boss, this.heroes, attack.targeting);
    if (!target) return false;

    this.intentCounter += 1;
    const intent = createTelegraphIntent(
      `${boss.uid}#${this.intentCounter}`,
      boss,
      attack,
      target,
      this.currentTurn,
    );
    this.intents.push(intent);
    state.nextAttack = (state.nextAttack + 1) % config.attacks.length;

    this.addLog(
      `⚠ ${boss.definition.name} está preparando ${attack.name}! ` +
        `As casas em vermelho serão atingidas (${attack.damage} de dano).`,
      'telegraph',
    );
    return true;
  }

  /**
   * Resolve uma intenção pendente. Só executa se ainda estiver pendente e o chefe estiver vivo:
   * marca como resolvida ANTES de causar dano (então não há como executar duas vezes) e atinge
   * quem estiver nas casas ANUNCIADAS agora (as casas nunca são recalculadas).
   */
  private resolveTelegraph(intentId: string): boolean {
    const intent = this.intents.find((candidate) => candidate.id === intentId);
    if (!intent || intent.status !== 'pending') return false;

    const boss = this.findUnit(intent.bossUid);
    if (!boss || !isAlive(boss)) {
      this.cancelTelegraph(intent, `${intent.bossName} foi derrotado antes de concluir ${intent.attackName}.`);
      return false;
    }

    intent.status = 'resolved';
    this.effect = {
      id: 'telegraph',
      cells: intent.cells.map((cell) => ({ col: cell.col, row: cell.row })),
    };
    this.lastActorUid = boss.uid;
    this.addLog(`${boss.definition.name} libera ${intent.attackName}!`, 'telegraph');

    const victims = this.units.filter(
      (unit) =>
        unit.uid !== boss.uid &&
        (intent.friendlyFire || unit.definition.team !== boss.definition.team) &&
        // Uma entidade grande é atingida uma única vez, mesmo com várias casas na área.
        unitCells(unit).some((own) => intent.cells.some((cell) => positionsEqual(cell, own))),
    );
    if (victims.length === 0) {
      this.addLog('Ninguém estava nas casas atingidas.', 'telegraph');
    }
    for (const victim of victims) {
      this.dealDamage(victim, intent.damage, 'monster', `${intent.attackName} atingiu`, boss);
    }

    // Começa a pausa antes do próximo anúncio.
    if (boss.telegraph && boss.definition.telegraph) {
      boss.telegraph.cooldown = boss.definition.telegraph.cooldownTurns;
    }
    return true;
  }

  private cancelTelegraph(intent: TelegraphIntent, message: string): void {
    if (intent.status !== 'pending') return;
    intent.status = 'cancelled';
    this.addLog(`Golpe cancelado: ${message}`, 'telegraph');
  }

  private cancelTelegraphsOf(boss: Unit, reason: string): void {
    for (const intent of this.intents) {
      if (intent.bossUid === boss.uid && intent.status === 'pending') {
        this.cancelTelegraph(intent, `${intent.bossName} ${reason}.`);
      }
    }
  }

  private cancelAllTelegraphs(reason: string): void {
    for (const intent of this.intents) {
      if (intent.status === 'pending') {
        this.cancelTelegraph(intent, `${intent.attackName} não acontece: ${reason}.`);
      }
    }
  }

  // ---------- Internos: habilidades ----------

  /**
   * Passo comum de uso: marca a habilidade como usada, registra no log, aplica o efeito e
   * inicia a resolução do turno (os heróis atacam normalmente depois). O uso substitui o
   * movimento do herói neste turno, porque a vez do jogador termina aqui.
   */
  private useAbility(hero: Unit, ability: AbilityDefinition, detail: string, cast: () => void): void {
    this.resetEffects();
    hero.abilityUsed = true;
    this.targetingState = null;
    this.noticeText = null;
    this.addLog(`${hero.definition.name} usou ${ability.name}${detail}!`, 'ability');
    cast();
    this.beginResolution();
  }

  /** Pisada: atordoa os monstros das 8 casas ao redor. Sem dano. */
  private castStomp(hero: Unit): void {
    this.effect = { id: 'stomp', cells: stompArea(hero) };
    const affected = stompTargets(hero, this.units);

    if (affected.length === 0) {
      this.addLog('Nenhum inimigo estava ao alcance: ninguém foi atordoado.', 'ability');
      return;
    }
    for (const monster of affected) {
      monster.stunned = true;
      this.addLog(
        `${monster.definition.name} (${positionLabel(monster.position)}) foi atordoado e perderá a próxima ação.`,
        'ability',
      );
    }
  }

  /** Emboscada: o Assassino salta direto para o destino e ataca o alvo até duas vezes. */
  private castAmbush(hero: Unit, target: Unit, destination: Position): void {
    const from = positionLabel(hero.position);
    hero.facing = directionBetween(destination, target.position);
    hero.position = { col: destination.col, row: destination.row };
    this.effect = { id: 'ambush', cells: [destination, ...unitCells(target)] };
    if (positionLabel(hero.position) !== from) {
      this.addLog(
        `${hero.definition.name} saltou de ${from} para ${positionLabel(hero.position)}.`,
        'ability',
      );
    }

    for (let attack = 0; attack < ABILITY_BALANCE.ambushAttacks; attack++) {
      // O segundo golpe não acontece se o primeiro matou o alvo.
      if (!isAlive(target)) break;
      // Cada golpe é um ataque normal: o alvo precisa estar no padrão de ataque da classe.
      if (!findAttackTargets(hero, this.combatContext()).includes(target)) break;
      this.dealDamage(target, hero.damage, 'hero', `${hero.definition.name} atacou`, hero);
    }
  }

  /** Tiro Perfurante: atinge todos na linha (aliados incluídos), atravessando tudo. */
  private castPiercingShot(hero: Unit, direction: Position): void {
    this.effect = { id: 'piercing-shot', cells: pierceLine(hero.position, direction) };
    const targets = pierceTargets(hero, direction, this.units);

    if (targets.length === 0) {
      this.addLog('O disparo não atingiu ninguém.', 'ability');
      return;
    }
    for (const target of targets) {
      this.dealDamage(target, hero.damage, 'hero', 'Tiro Perfurante atingiu', hero);
    }
  }

  /** Bola de Fogo: dano em todos na área 3×3 (aliados e o próprio Mago incluídos). */
  private castFireball(hero: Unit, center: Position): void {
    this.effect = { id: 'fireball', cells: fireballArea(center) };
    const targets = fireballTargets(center, this.units);

    if (targets.length === 0) {
      this.addLog('A explosão não atingiu ninguém.', 'ability');
      return;
    }
    for (const target of targets) {
      const prefix = target === hero ? 'Bola de Fogo atingiu o próprio conjurador,' : 'Bola de Fogo atingiu';
      this.dealDamage(target, hero.damage, 'hero', prefix, hero);
    }
  }

  /** Exura: cura 50% do PV máximo (arredondado para cima), sem passar do máximo. */
  private castExura(hero: Unit, target: Unit): void {
    const amount = healAmount(target, ABILITY_BALANCE.exuraHealRatio, hero);
    target.hp += amount;
    this.effect = { id: 'exura', cells: unitCells(target) };
    this.healEvents.push({
      targetUid: target.uid,
      amount,
      position: { col: target.position.col, row: target.position.row },
    });
    const who = target === hero ? 'a si mesmo' : target.definition.name;
    this.addLog(
      `${hero.definition.name} curou ${who} (${positionLabel(target.position)}): ` +
        `+${amount} PV. PV ${target.hp}/${target.maxHp}.`,
      'heal',
    );
  }

  // ---------- Internos: escolha de alvo ----------

  private chooseAmbushCell(hero: Unit, targeting: AmbushTargeting, cell: Position): boolean {
    const clicked = this.getUnitAt(cell);

    // Clicar num monstro (re)escolhe o alvo.
    if (clicked && clicked.definition.team === 'monster') {
      const destinations = ambushDestinations(hero, clicked, this.combatContext());
      if (destinations.length === 0) {
        this.targetingState = { ...targeting, targetUid: null, destination: null };
        this.setNotice(
          `Emboscada impossível: não há casa diagonal livre ao redor de ${clicked.definition.name}.`,
          true,
        );
        return false;
      }
      this.targetingState = {
        ...targeting,
        targetUid: clicked.uid,
        // Com um único destino possível, ele já vem escolhido (ainda falta confirmar).
        destination: destinations.length === 1 ? destinations[0] : null,
      };
      this.noticeText = null;
      return true;
    }

    // Com alvo escolhido, clicar numa casa destacada escolhe o destino.
    const target = targeting.targetUid === null ? null : this.findUnit(targeting.targetUid);
    if (target && isAlive(target)) {
      const valid = ambushDestinations(hero, target, this.combatContext()).some((destination) =>
        positionsEqual(destination, cell),
      );
      if (valid) {
        this.targetingState = { ...targeting, destination: { col: cell.col, row: cell.row } };
        this.noticeText = null;
        return true;
      }
      this.setNotice('Escolha uma das casas destacadas, diagonais ao alvo.');
      return false;
    }

    this.setNotice('Escolha um monstro vivo como alvo.');
    return false;
  }

  private choosePierceCell(hero: Unit, targeting: PiercingShotTargeting, cell: Position): boolean {
    const dCol = cell.col - hero.position.col;
    const dRow = cell.row - hero.position.row;
    // Precisa estar na mesma linha OU na mesma coluna (e não ser a casa do próprio arqueiro).
    const sameLine = (dCol === 0) !== (dRow === 0);
    if (!sameLine) {
      this.setNotice('Escolha uma casa na mesma linha ou coluna do Arqueiro (sem diagonais).');
      return false;
    }
    this.targetingState = {
      ...targeting,
      direction: { col: Math.sign(dCol), row: Math.sign(dRow) },
    };
    this.noticeText = null;
    return true;
  }

  private chooseFireballCell(targeting: FireballTargeting, cell: Position): boolean {
    if (!isInsideBoard(cell)) {
      this.setNotice('Escolha uma casa dentro do tabuleiro.');
      return false;
    }
    this.targetingState = { ...targeting, center: { col: cell.col, row: cell.row } };
    this.noticeText = null;
    return true;
  }

  private chooseExuraCell(targeting: ExuraTargeting, cell: Position): boolean {
    const clicked = this.getUnitAt(cell);
    if (!clicked || clicked.definition.team !== 'hero') {
      this.setNotice('Escolha um herói vivo para curar (monstros e casas vazias não valem).');
      return false;
    }
    const healer = this.findUnit(targeting.heroUid);
    if (!healer || healAmount(clicked, ABILITY_BALANCE.exuraHealRatio, healer) === 0) {
      this.setNotice(`${clicked.definition.name} já está com PV máximo.`, true);
      return false;
    }
    this.targetingState = { ...targeting, targetUid: clicked.uid };
    this.noticeText = null;
    return true;
  }

  private rejectConfirm(message: string, log = false): void {
    this.setNotice(message, log);
    this.emit('targeting');
  }

  private setNotice(message: string, log = false): void {
    this.noticeText = message;
    if (log) this.addLog(message, 'info');
  }

  // ---------- Internos: gerais ----------

  private findUnit(uid: string): Unit | null {
    return this.allUnits.find((unit) => unit.uid === uid) ?? null;
  }

  private findMoves(unit: Unit): ReachableCell[] {
    const size = sizeOf(unit.definition);
    // Casa bloqueada para esta unidade: obstáculo ou outra unidade (o próprio corpo é livre, pois
    // uma entidade grande pode andar para uma posição que sobrepõe a anterior).
    const isCellBlocked = (cell: Position): boolean =>
      this.isObstacle(cell) || this.units.some((other) => other !== unit && occupies(other, cell));
    return computeReachable(
      unit.position,
      unit.definition.movement,
      // A posição só vale se a área inteira couber no tabuleiro e estiver livre.
      (anchor) => (unit.definition.team === 'hero' && (unit.trappedTurns ?? 0) > 0) || !footprintFits(anchor, size) || footprintCells(anchor, size).some(isCellBlocked),
      getMovementDirections(unit.definition),
    );
  }

  private teleportOzHeroes(): void {
    const heroes = this.heroes;
    const occupied = new Set(this.monsters.flatMap((unit) => unitCells(unit)).map((cell) => `${cell.col},${cell.row}`));
    const free: Position[] = [];
    for (let row = 0; row < BOARD_ROWS; row++) for (let col = 0; col < BOARD_COLS; col++) { const cell = { col, row }; if (!this.isObstacle(cell) && !occupied.has(`${col},${row}`)) free.push(cell); }
    for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
    if (free.length < heroes.length) return;
    heroes.forEach((hero, index) => { hero.position = { ...free[index] }; });
    this.addLog('O Mágico de Oz distorce o espaço! Seus heróis foram teletransportados e a formação foi embaralhada!', 'monster');
    this.effect = { id: 'telegraph', cells: heroes.flatMap((hero) => unitCells(hero)) };
  }

  private yamataSwordSweep(boss: Unit, stage: number): void {
    const direction = boss.facing;
    const perpendicular = direction.col !== 0 ? { col: 0, row: 1 } : { col: 1, row: 0 };
    const cells: Position[] = [];
    // Cada turno atinge somente a próxima faixa frontal de três casas.
    for (let width = -1; width <= 1; width++) {
      const cell = {
        col: boss.position.col + direction.col * stage + perpendicular.col * width,
        row: boss.position.row + direction.row * stage + perpendicular.row * width,
      };
      if (isInsideBoard(cell)) cells.push(cell);
    }
    this.effect = { id: 'orochi-sweep', cells };
    const victims = this.heroes.filter((hero) =>
      unitCells(hero).some((cell) => cells.some((hit) => positionsEqual(hit, cell))),
    );
    this.addLog(`Yamata-no-Orochi avança o golpe de espada — etapa ${stage}/3!`, 'monster');
    victims.forEach((hero) =>
      this.dealDamage(hero, Math.ceil(boss.damage * 1.5), 'monster', 'A lâmina de Yamata-no-Orochi atingiu', boss, true),
    );
    if (victims.length === 0) this.addLog(`A etapa ${stage}/3 do golpe não encontrou nenhum herói na faixa atingida.`, 'monster');
  }

  private combatContext(): AttackContext {
    return { units: this.units, obstacles: this.obstacleList };
  }

  private resetEffects(): void {
    this.damageEvents = [];
    this.healEvents = [];
    this.effect = null;
  }

  private setup(): void {
    this.applyBattle(this.createBattle(), true);
  }

  /** `firstBattle`: começo de uma batalha/campanha (limpa o log); senão, continua o log. */
  private applyBattle(battle: BattleSetup, firstBattle: boolean): void {
    const problems = findPlacementProblems(battle.units, battle.obstacles);
    if (problems.length > 0) {
      throw new Error(`Posicionamento inválido no encontro:\n${problems.join('\n')}`);
    }
    this.allUnits = battle.units;
    this.obstacleList = battle.obstacles;
    this.currentFloor = battle.floor ?? 0;
    this.sandTrapCells = [];
    this.revealedSandTraps.clear();
    this.frankensteinEnraged = false;
    this.specialBossCycles.clear();
    if (this.currentFloor === 55) {
      const occupied = new Set<string>([...battle.obstacles, ...battle.units.filter(isAlive).flatMap((unit) => unitCells(unit))].map((cell) => `${cell.col},${cell.row}`));
      const candidates: Position[] = [];
      for (let row = 0; row < BOARD_ROWS; row++) for (let col = 0; col < BOARD_COLS; col++) { const cell = { col, row }; if (!occupied.has(`${col},${row}`)) candidates.push(cell); }
      for (let i = candidates.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
      this.sandTrapCells = candidates.slice(0, Math.min(10, candidates.length));
    }
    this.cucaMinionSpawns.clear();
    const cuca = battle.units.find((unit) => unit.definition.id === 'cuca');
    if (cuca) {
      for (const minion of battle.units) {
        if (minion.definition.team === 'monster' && minion.uid !== cuca.uid) {
          this.cucaMinionSpawns.set(minion.uid, { ...minion.position });
        }
      }
    }
    this.medusaProtectionUsed.clear();
    this.currentTurn = 1;
    this.currentPhase = 'player';
    this.currentOutcome = 'ongoing';
    this.selectedUnitUid = null;
    this.targetingState = null;
    this.noticeText = null;
    this.pendingActors = [];
    this.lastActorUid = null;
    // Nada anunciado antes sobrevive a um reinício ou à troca de andar.
    this.intents = [];
    this.cheshireCycles.clear();
    this.intentCounter = 0;
    this.resetEffects();
    if (firstBattle) this.logEntries = [];
    if (battle.title) this.addLog(battle.title, 'floor');
    this.addLog('Turno 1 começou. Sua vez.', 'info');
    if (firstBattle) {
      this.addLog(
        'Mova um herói, use uma habilidade ou passe a vez; depois os heróis atacam e os monstros respondem.',
        'info',
      );
    }
    // Chefes com ataques telegrafados já começam o encontro anunciando o primeiro golpe.
    for (const monster of this.monsters) this.tryAnnounceTelegraph(monster);
  }

  private addLog(message: string, kind: LogKind = 'info'): void {
    this.logEntries.push({ turn: this.currentTurn, message, kind });
    if (this.logEntries.length > MAX_LOG_ENTRIES) {
      this.logEntries.shift();
    }
  }

  private emit(event: GameEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}