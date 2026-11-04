import type { Campaign, CampaignStatus } from '../game/core/Campaign';
import type { CooperativeBattleAction, GameState } from '../game/core/GameState';
import type { BattlePhase, EncounterType, Unit } from '../game/types';
import { xpRequiredForNextLevel } from '../game/core/progression';
import type { AttributeName } from '../game/core/progression';
import { MONSTER_DEFINITIONS, HARPY, SATYR, CYCLOPS, GORGON, MINOTAUR, UNDERWORLD_HOUND, UNDERWORLD_WRAITH, CARD_SOLDIER, WHITE_RABBIT, GIANT_CATERPILLAR, MAD_MUSHROOM, THORN_PLANT } from '../game/data/monsters';
import { GOBLIN_CHIEF, ABYSS_IDOL, CRIMSON_COUNTESS, DRACULA, MEDUSA, HADES, CHESHIRE_CAT, QUEEN_OF_HEARTS } from '../game/data/bosses';
import { ITEM_DEFINITIONS } from '../game/data/items';

const MODE_LABEL: Record<CampaignStatus, string> = {
  fighting: 'Em combate',
  'floor-cleared': 'Andar concluído — escolha avançar',
  defeated: 'Derrota — campanha encerrada',
  completed: 'Campanha concluída!',
};

const RANK_LABEL: Record<EncounterType, string> = {
  normal: '',
  'mini-boss': 'MINI-CHEFE',
  boss: 'CHEFE',
};

const PHASE_LABEL: Record<BattlePhase, string> = {
  player: 'Vez do jogador',
  heroes: 'Resolvendo: heróis atacando…',
  telegraphs: 'Resolvendo: golpe do chefe…',
  monsters: 'Resolvendo: monstros agindo…',
  over: 'Combate encerrado',
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function section(title: string, content: HTMLElement, className?: string): HTMLElement {
  const wrapper = el('section', className);
  wrapper.append(el('h2', undefined, title), content);
  return wrapper;
}

export class SidePanel {
  private readonly campaign: Campaign;
  private readonly state: GameState;

  // Campanha: andar atual, tipo de encontro e modo (combate / andar concluído / fim)
  private readonly goldEl = el('div', 'gold-balance');
  private readonly floorEl = el('span', 'floor-label');
  private readonly encounterEl = el('span', 'encounter-chip');
  private readonly floorNameEl = el('div', 'floor-name');
  private readonly modeEl = el('div', 'mode');
  private readonly advanceButton = el('button', 'btn-advance');
  private readonly extractButton = el('button', 'btn-extract', 'Extrair e voltar à base');
  private readonly retreatButton = el('button', 'btn-retreat', 'Bater em retirada');

  private readonly turnEl = el('span', 'turn-value');
  private readonly phaseEl = el('div', 'phase');
  private readonly telegraphBox = el('section', 'telegraph-box');
  private readonly bannerEl = el('div', 'banner');
  private readonly statusEl = el('p', 'status');
  private readonly characterStatsBox = el('section', 'character-stats');
  private readonly attributesButton = el('button', 'btn-open-attributes', 'Atributos');
  private readonly attributesModal = el('div', 'attributes-modal');
  private attributesOpen = false;
  private pendingAttributeBatch: number | null = null;
  private readonly specialConfirmModal = el('div', 'special-confirm-modal');
  private readonly specialConfirmText = el('p', 'special-confirm-text');

  // Habilidade do herói selecionado
  private readonly abilityBox = el('section', 'ability-box');
  private readonly abilityNameEl = el('span', 'ability-name');
  private readonly abilityStatusEl = el('span', 'ability-status');
  private readonly abilityDescEl = el('p', 'ability-desc');
  private readonly abilityHintEl = el('p', 'ability-hint');
  private readonly noticeEl = el('p', 'notice');
  private readonly useButton = el('button', 'btn-ability', 'Usar habilidade');
  private readonly confirmButton = el('button', 'btn-confirm', 'Confirmar');
  private readonly cancelButton = el('button', 'btn-cancel', 'Cancelar');

  private readonly heroesEl = el('div', 'unit-list');
  private readonly monstersEl = el('div', 'unit-list');
  private readonly logEl = el('ol', 'log');
  private readonly passButton = el('button', 'btn-pass', 'Passar a vez');
  private readonly attackButton = el('button', 'btn-attack', 'Atacar');
  private readonly devSettingsButton = el('button', 'btn-dev-settings', '👑');
  private readonly boardActions = el('div', 'board-floor-actions');
  private readonly isGameMaster: boolean;
  private readonly devPanel = el('section', 'dev-panel');
  private devUnlocked = false;
  private transitionScheduled = false;
  private readonly onRestart?: () => void;
  private readonly onAllocateAttribute?: (classId: string, attribute: AttributeName, points: number) => Promise<boolean>;
  private readonly onFloorChange?: (floor: number) => void;
  private readonly onActivity?: (floor: number) => void;
  private readonly onExtract?: () => Promise<void>;
  private readonly onRetreat?: () => Promise<void>;
  private attributeSavePending = false;
  private unsubscribe: (() => void) | null = null;
  private readonly onCooperativeAction?: (action: CooperativeBattleAction) => void;
  private cooperativeCanAct: boolean | null = null;
  private cooperativeStatusText = '';
  private readonly cooperativeMode: boolean;
  private cooperativeLeader = true;

  constructor(root: HTMLElement, campaign: Campaign, onRestart?: () => void, onAllocateAttribute?: (classId: string, attribute: AttributeName, points: number) => Promise<boolean>, onFloorChange?: (floor: number) => void, onActivity?: (floor: number) => void, onExtract?: () => Promise<void>, onRetreat?: () => Promise<void>, isGameMaster = false, onCooperativeAction?: (action: CooperativeBattleAction) => void, cooperativeMode = false) {
    this.campaign = campaign;
    this.state = campaign.battle;
    this.isGameMaster = isGameMaster;
    this.onRestart = onRestart;
    this.onAllocateAttribute = onAllocateAttribute;
    this.onFloorChange = onFloorChange;
    this.onActivity = onActivity;
    this.onExtract = onExtract;
    this.onRetreat = onRetreat;
    this.onCooperativeAction = onCooperativeAction;
    this.cooperativeMode = cooperativeMode;

    const title = el('h1', undefined, 'Roguelike Alfa');

    const floorRow = el('div', 'floor-row');
    floorRow.append(this.floorEl, this.encounterEl);
    const campaignBox = el('div', 'campaign-box');
    campaignBox.append(floorRow, this.floorNameEl, this.modeEl);

    // "Avançar" só aparece com o andar concluído; cliques repetidos são recusados pela campanha.
    this.advanceButton.type = 'button';
    this.advanceButton.hidden = true;
    this.advanceButton.addEventListener('click', () => {
      if (this.campaign.advance()) this.onFloorChange?.(this.campaign.floorNumber);
    });
    this.extractButton.type = 'button';
    this.extractButton.hidden = true;
    this.extractButton.addEventListener('click', () => {
      if (this.campaign.canExtract) void this.onExtract?.();
    });
    this.retreatButton.type = 'button';
    this.retreatButton.addEventListener('click', () => {
      const confirmed = window.confirm('Bater em retirada e encerrar esta incursão? Todo ouro e equipamento temporário desta expedição será perdido. O progresso permanente já salvo será mantido.');
      if (confirmed) void this.onRetreat?.();
    });

    const turnBox = el('div', 'turn-box');
    turnBox.append(el('span', 'turn-label', 'Turno'), this.turnEl);

    this.bannerEl.hidden = true;
    this.telegraphBox.hidden = true;
    this.devPanel.hidden = true;
    this.devPanel.style.cssText = 'position:absolute;top:48px;right:8px;z-index:21;width:min(300px,calc(100% - 16px));box-sizing:border-box;padding:12px;margin:0;background:rgba(17,24,39,.97);border:1px solid #a78bfa;border-radius:8px;color:#f8fafc;display:none;max-height:70%;overflow:auto;box-shadow:0 8px 24px #000b;';
    this.devSettingsButton.type = 'button';
    this.devSettingsButton.title = 'Ferramentas de Game Master';
    this.devSettingsButton.setAttribute('aria-label', 'Abrir ferramentas de Game Master');
    this.devSettingsButton.hidden = !this.isGameMaster;
    this.devSettingsButton.style.cssText = 'position:absolute;top:8px;right:8px;z-index:20;width:32px;height:32px;padding:0;margin:0;background:rgba(25,13,25,.88);border:1px solid #d6ad45;border-radius:50%;color:#ffe16b;font-size:15px;cursor:pointer;box-shadow:0 2px 8px #0009;';
    this.devSettingsButton.addEventListener('click', () => {
      if (!this.isGameMaster) return;
      this.devPanel.hidden = !this.devPanel.hidden;
      this.devPanel.style.display = this.devPanel.hidden ? 'none' : 'block';
      this.renderDevPanel();
    });
    this.buildDevPanel();
    this.buildAbilityBox();
    this.buildAttributesModal();
    this.buildSpecialConfirmModal();

    this.passButton.type = 'button';
    this.passButton.addEventListener('click', () => {
      if (this.onCooperativeAction) this.onCooperativeAction({ type: 'pass' });
      else this.state.passTurn();
    });
    this.attackButton.type = 'button';
    this.attackButton.addEventListener('click', () => {
      if (this.onCooperativeAction) this.onCooperativeAction({ type: 'attack' });
    });

    const actions = el('div', 'actions');
    actions.append(this.attackButton, this.passButton);
    actions.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:1200;width:min(260px,calc(100vw - 36px));padding:6px;background:#111827;border:1px solid #334155;box-shadow:0 8px 24px #0009;';

    this.goldEl.style.cssText = 'padding:8px 10px;margin:8px 0;border:1px solid #a16207;border-radius:6px;background:#422006;color:#fde68a;font-weight:800;';
    const leftRail = el('div', 'battle-rail battle-rail--left');
    leftRail.append(
      title,
      this.goldEl,
      campaignBox,
      turnBox,
      section('Heróis', this.heroesEl),
      this.retreatButton,
    );

    const rightRail = el('div', 'battle-rail battle-rail--right');
    rightRail.append(
      this.phaseEl,
      this.telegraphBox,
      this.bannerEl,
      this.statusEl,
      this.attributesButton,
      this.abilityBox,
      (() => { const monstersSection = section('Monstros', this.monstersEl, 'monsters-section'); monstersSection.append(actions); return monstersSection; })(),
      section('Registro de combate', this.logEl, 'log-section'),
    );

    root.replaceChildren(leftRail, rightRail, this.attributesModal, this.specialConfirmModal);

    const boardRoot = document.getElementById('game-container');
    if (boardRoot) {
      boardRoot.append(this.boardActions, this.devSettingsButton, this.devPanel);
    } else {
      root.append(this.boardActions, this.devSettingsButton, this.devPanel);
    }
    this.boardActions.append(this.advanceButton, this.extractButton);
    this.boardActions.hidden = true;

    this.attributesButton.type = 'button';
    this.attributesButton.addEventListener('click', () => {
      this.attributesOpen = true;
      this.attributesModal.hidden = false;
      this.render();
    });

    this.unsubscribe = this.state.subscribe(() => this.render());
    this.render();
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.boardActions.remove();
    this.devSettingsButton.remove();
    this.devPanel.remove();
  }

  private buildDevPanel(): void {
    const heading = el('h2', undefined, 'Dev Mode');
    heading.style.cssText = 'margin:0 0 8px;color:#c4b5fd;';
    this.devPanel.append(heading);
    const addButton = (label: string, action: () => void): void => {
      const button = el('button', 'btn-dev-action', label);
      button.type = 'button';
      button.style.cssText = 'display:block;width:100%;padding:8px;margin:5px 0;background:#29243f;border:1px solid #6d5bb2;color:#fff;cursor:pointer;text-align:left;';
      button.addEventListener('click', (event) => { event.stopPropagation(); action(); this.render(); });
      this.devPanel.append(button);
    };
    addButton('Pular para andar…', () => {
      const value = Number(window.prompt(`Andar desejado (1–${this.campaign.totalFloors}):`, String(this.campaign.floorNumber)));
      if (this.campaign.debugJumpToFloor(value)) this.transitionScheduled = false;
      else window.alert('Número de andar inválido.');
    });
    addButton('Escolher monstros/chefes…', () => {
      const catalog = [...MONSTER_DEFINITIONS, HARPY, SATYR, CYCLOPS, GORGON, MINOTAUR, UNDERWORLD_HOUND, UNDERWORLD_WRAITH, CARD_SOLDIER, WHITE_RABBIT, GIANT_CATERPILLAR, MAD_MUSHROOM, THORN_PLANT, GOBLIN_CHIEF, ABYSS_IDOL, CRIMSON_COUNTESS, DRACULA, MEDUSA, HADES, CHESHIRE_CAT, QUEEN_OF_HEARTS];
      const listing = catalog.map((m) => `${m.id} — ${m.name}`).join('\n');
      const value = window.prompt('Digite os IDs separados por vírgula:\n' + listing, this.campaign.floor.monsters.map((m) => m.id).join(','));
      if (value === null) return;
      const selected = value.split(',').map((id) => catalog.find((m) => m.id === id.trim())).filter((m): m is typeof catalog[number] => Boolean(m));
      if (!this.campaign.debugSetMonsters(selected)) window.alert('Seleção inválida. Verifique os IDs e a quantidade de inimigos.');
    });
    addButton('Vencer batalha instantaneamente', () => this.state.debugSetOutcome('victory'));
    addButton('Perder batalha instantaneamente', () => this.state.debugSetOutcome('defeat'));
    addButton('Adicionar ouro…', () => {
      const amount = Number(window.prompt('Quantidade de ouro (use valor negativo para remover):', '1000'));
      if (Number.isFinite(amount)) this.campaign.debugAddGold(amount);
    });
    addButton('Adicionar equipamento…', () => {
      const listing = Object.values(ITEM_DEFINITIONS).map((item) => `${item.id} — ${item.name}`).join('\n');
      const id = window.prompt('Digite o ID do equipamento:\n' + listing);
      if (id && !this.campaign.debugAddItem(id.trim())) window.alert('Equipamento não encontrado.');
    });
    addButton('Recuperar vida de todos os heróis', () => this.state.debugHealHeroes());
    addButton('Definir nível do herói selecionado…', () => {
      const hero = this.state.selectedUnit;
      if (!hero || hero.definition.team !== 'hero') { window.alert('Selecione um herói primeiro.'); return; }
      const level = Number(window.prompt(`Novo nível para ${hero.definition.name}:`, String(hero.progression?.level ?? 1)));
      if (!this.campaign.debugSetHeroLevel(hero.uid, level)) window.alert('Nível inválido.');
    });
    const extraction = el('label');
    extraction.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 0;';
    const toggle = el('input');
    toggle.type = 'checkbox';
    toggle.checked = this.campaign.debugExtractionEnabled;
    toggle.addEventListener('change', () => { this.campaign.debugToggleExtraction(toggle.checked); this.render(); });
    extraction.append(toggle, document.createTextNode('Permitir extração fora dos marcos'));
    this.devPanel.append(extraction);
  }

  private renderDevPanel(): void {
    if (!this.devUnlocked) this.devPanel.hidden = true;
  }

  private buildAbilityBox(): void {
    for (const button of [this.useButton, this.confirmButton, this.cancelButton]) {
      button.type = 'button';
    }
    this.useButton.addEventListener('click', () => this.state.beginAbility());
    // Evita que o clique nos controles DOM também seja interpretado como clique no tabuleiro Phaser.
    for (const button of [this.confirmButton, this.cancelButton]) {
      for (const eventName of ['pointerdown', 'mousedown', 'touchstart', 'click']) {
        button.addEventListener(eventName, (event) => event.stopPropagation());
      }
    }
    this.confirmButton.addEventListener('click', () => {
      if (this.onCooperativeAction) {
        const action = this.state.getCooperativeAbilityAction();
        if (action) this.onCooperativeAction(action);
      } else this.state.confirmAbility();
    });
    this.cancelButton.addEventListener('click', () => this.state.cancelAbility());

    const head = el('div', 'ability-head');
    head.append(this.abilityNameEl, this.abilityStatusEl);

    const buttons = el('div', 'ability-actions');
    buttons.append(this.useButton);

    this.abilityBox.append(
      el('h2', undefined, 'Habilidade especial'),
      head,
      this.abilityDescEl,
      this.abilityHintEl,
      this.noticeEl,
      buttons,
    );
    this.abilityBox.hidden = true;
  }

  private buildAttributesModal(): void {
    this.attributesModal.hidden = true;
    this.attributesModal.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(2,6,23,.88);backdrop-filter:blur(5px);pointer-events:auto;touch-action:manipulation;';
    // Bloqueia os eventos no overlay antes que cheguem ao canvas do Phaser.
    for (const eventName of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'dblclick', 'contextmenu']) {
      this.attributesModal.addEventListener(eventName, (event) => event.stopPropagation());
    }
    const dialog = el('div', 'attributes-modal__dialog');
    dialog.style.cssText = 'position:relative;z-index:1;pointer-events:auto;touch-action:pan-y;width:min(560px,100%);max-height:88dvh;overflow:auto;padding:12px;background:#0f172a;border:1px solid #8b5cf6;box-shadow:0 20px 70px #000a;';
    for (const eventName of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'dblclick', 'contextmenu']) {
      dialog.addEventListener(eventName, (event) => event.stopPropagation());
    }
    const header = el('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px;';
    header.append(el('strong', undefined, 'Atributos do personagem'));
    const close = el('button', 'btn-close-attributes', 'Fechar ✕');
    close.type = 'button';
    close.addEventListener('click', () => { this.attributesOpen = false; this.attributesModal.hidden = true; this.attributesModal.style.display = 'none'; });
    header.append(close);
    this.characterStatsBox.style.cssText = 'padding:8px;margin:0;background:#20212b;border:0;color:#f3f0ff;';
    dialog.append(header, this.characterStatsBox);
    this.attributesModal.append(dialog);
    this.attributesModal.addEventListener('click', (event) => { if (event.target === this.attributesModal) { this.attributesOpen = false; this.attributesModal.hidden = true; this.attributesModal.style.display = 'none'; } });
  }

  private buildSpecialConfirmModal(): void {
    this.specialConfirmModal.hidden = true;
    this.specialConfirmModal.style.cssText = 'position:fixed;inset:0;z-index:1300;display:none;align-items:center;justify-content:center;padding:16px;pointer-events:none;';
    const dialog = el('div', 'special-confirm-modal__dialog');
    dialog.style.cssText = 'width:min(360px,92vw);padding:16px;text-align:center;background:rgba(10,15,28,.97);border:2px solid #a78bfa;box-shadow:0 12px 50px #000c;pointer-events:auto;';
    dialog.append(el('h2', undefined, 'Confirmar ataque especial'), this.specialConfirmText);
    const actions = el('div', 'ability-actions');
    actions.style.cssText = 'display:flex;justify-content:center;gap:8px;';
    this.confirmButton.textContent = 'Confirmar ataque';
    actions.append(this.confirmButton, this.cancelButton);
    dialog.append(actions);
    this.specialConfirmModal.append(dialog);
  }
  updateCooperativeStatus(canAct: boolean, statusText: string, isLeader = true): void {
    this.cooperativeCanAct = canAct;
    this.cooperativeStatusText = statusText;
    this.cooperativeLeader = isLeader;
    this.render();
  }

  private render(): void {
    this.onActivity?.(this.campaign.floorNumber);
    const phase = this.state.phase;
    const status = this.campaign.status;
    if (status === 'defeated') this.campaign.loseExpeditionItems();

    // Avança automaticamente nos andares comuns; marcos divisíveis por 5 aguardam decisão de extração.
    if (status === 'fighting') this.transitionScheduled = false;
    if (!this.transitionScheduled && status !== 'fighting' && !(status === 'floor-cleared' && this.campaign.canExtract) && !(status === 'completed' && this.campaign.canExtract)) {
      this.transitionScheduled = true;
      const completedFloor = this.campaign.floorNumber;
      window.setTimeout(() => {
        this.transitionScheduled = false;
        const currentStatus = this.campaign.status;
        if (currentStatus === 'floor-cleared' && !this.campaign.canExtract && this.campaign.floorNumber === completedFloor) {
          if (this.campaign.advance()) this.onFloorChange?.(this.campaign.floorNumber);
        } else if (currentStatus === 'defeated' || (currentStatus === 'completed' && !this.campaign.canExtract)) {
          this.onRestart?.();
        }
      }, 1200);
    }
    const canAct = phase === 'player' && (this.cooperativeCanAct ?? true);
    const floor = this.campaign.floorNumber;
    this.goldEl.textContent = `🪙 Ouro: ${this.campaign.gold}`;

    this.floorEl.textContent = `Andar ${floor}/${this.campaign.totalFloors}`;
    this.encounterEl.textContent = this.campaign.encounterLabel;
    this.encounterEl.className = `encounter-chip encounter-chip--${this.campaign.encounterType}`;
    this.floorNameEl.textContent = this.campaign.floor.name;
    this.modeEl.textContent = MODE_LABEL[status];
    this.modeEl.dataset.mode = status;

    this.turnEl.textContent = String(this.state.turn);
    this.phaseEl.textContent = PHASE_LABEL[phase];
    this.phaseEl.dataset.phase = phase;
    this.phaseEl.hidden = status !== 'fighting';
    this.passButton.disabled = !canAct;
    this.attackButton.hidden = !this.onCooperativeAction;
    this.attackButton.disabled = !canAct || !this.state.selectedUnit;

    this.renderCampaignEnd(status, floor);
    this.extractButton.hidden = this.cooperativeMode || !this.campaign.canExtract;
    this.advanceButton.hidden = status !== 'floor-cleared';
    this.advanceButton.disabled = this.cooperativeMode && !this.cooperativeLeader;
    if (this.cooperativeMode && status === 'floor-cleared') this.advanceButton.textContent = this.cooperativeLeader ? 'Continuar para o próximo andar' : 'Aguardando o líder avançar';
    this.boardActions.hidden = this.advanceButton.hidden && this.extractButton.hidden;
    this.retreatButton.hidden = status === 'defeated' || status === 'completed';
    this.renderTelegraphs();

    const selected = this.state.selectedUnit;
    const targeting = this.state.targeting;
    if (status === 'floor-cleared') {
      this.statusEl.textContent = `Andar ${floor} concluído. Próximo andar em instantes…`;
    } else if (status === 'completed') {
      this.statusEl.textContent = 'Campanha concluída! Retornando à base de operações…';
    } else if (status === 'defeated') {
      this.statusEl.textContent = 'Todos os heróis caíram. Retornando à base de operações…';
    } else if (!canAct) {
      this.statusEl.textContent = this.cooperativeStatusText || 'Aguarde: o turno está sendo resolvido.';
    } else if (targeting && selected) {
      this.statusEl.textContent = `${selected.definition.name}: escolhendo o alvo da habilidade.`;
    } else if (selected) {
      this.statusEl.textContent =
        `${selected.definition.name} selecionado. Clique em uma casa verde para mover ou use a habilidade. ` +
        'Depois disso os heróis atacam e os monstros respondem.';
    } else {
      this.statusEl.textContent = 'Clique em um herói para selecioná-lo ou passe a vez.';
    }

    this.renderCharacterStats(selected);
    this.renderAbility(selected, canAct);

    this.heroesEl.replaceChildren(...this.campaign.activeParty.map((unit) => this.createUnitCard(unit)));
    this.monstersEl.replaceChildren(...this.state.monsterRoster.map((unit) => this.createUnitCard(unit)));

    const items = this.state.log.map((entry) => {
      const item = el('li', `log-${entry.kind}`);
      item.append(el('span', 'log-turn', `T${entry.turn}`), document.createTextNode(entry.message));
      return item;
    });
    this.logEl.replaceChildren(...items);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  /** Aviso dos golpes de chefe anunciados (some quando são resolvidos ou cancelados). */
  private renderTelegraphs(): void {
    const pending = this.state.pendingTelegraphs;
    this.telegraphBox.hidden = pending.length === 0;
    if (pending.length === 0) return;

    const lines = pending.map((intent) => {
      const line = el('p', 'telegraph-line');
      line.append(
        el('strong', undefined, `⚠ ${intent.bossName} está preparando ${intent.attackName}!`),
        document.createTextNode(
          ` As casas em vermelho serão atingidas (${intent.damage} de dano, ${intent.cells.length} casas).`,
        ),
      );
      return line;
    });
    const hint = el(
      'p',
      'telegraph-hint',
      'Mova um herói para fora da área antes da resolução — ou passe a vez e aceite o golpe.',
    );
    this.telegraphBox.replaceChildren(...lines, hint);
  }

  /** Banner de fim de andar/campanha e botão "Avançar" (só visível com o andar concluído). */
  private renderCampaignEnd(status: CampaignStatus, floor: number): void {
    this.bannerEl.hidden = status === 'fighting';
    this.advanceButton.hidden = true;

    switch (status) {
      case 'fighting':
        break;
      case 'floor-cleared':
        this.bannerEl.className = 'banner banner--cleared';
        this.bannerEl.textContent = `Andar ${floor} concluído! Todos os monstros foram derrotados.`;
        this.advanceButton.textContent = `Avançar para o andar ${floor + 1}`;
        break;
      case 'completed':
        this.bannerEl.className = 'banner banner--completed';
        this.bannerEl.textContent =
          'Campanha de teste concluída! O Ídolo do Abismo foi derrotado e todos os 10 andares foram vencidos.';
        break;
      case 'defeated':
        this.bannerEl.className = 'banner banner--defeat';
        this.bannerEl.textContent = `Derrota! Todos os heróis foram derrotados. A campanha terminou no andar ${floor}.`;
        break;
    }
  }


  /** Painel de atributos e progresso do herói selecionado. */
  private renderCharacterStats(selected: Unit | null): void {
    if (!selected || selected.definition.team !== 'hero' || !selected.progression) {
      this.characterStatsBox.hidden = true;
      this.attributesButton.hidden = true;
      this.characterStatsBox.replaceChildren();
      return;
    }

    const p = selected.progression;
    const needed = xpRequiredForNextLevel(p.level);
    const ratio = Math.max(0, Math.min(1, p.xp / needed));
    const header = el('div', 'character-stats__header');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;';
    header.append(
      el('h2', undefined, selected.definition.name),
      el('strong', undefined, `NÍVEL ${p.level}`),
    );

    const xpRow = el('div', 'character-stats__xp-row');
    xpRow.style.cssText = 'display:flex;justify-content:space-between;gap:8px;font-size:0.85rem;margin:6px 0;';
    xpRow.append(
      el('span', undefined, 'Experiência'),
      el('strong', undefined, `${p.xp} / ${needed} XP`),
    );
    const xpFill = el('div', 'character-stats__xp-fill');
    xpFill.style.cssText = `height:100%;width:${ratio * 100}%;background:#a78bfa;border-radius:inherit;transition:width 160ms ease;`;
    const xpBar = el('div', 'character-stats__xp-bar');
    xpBar.style.cssText = 'height:9px;background:#272536;border:1px solid #4b465e;border-radius:6px;overflow:hidden;';
    xpBar.append(xpFill);
    const remaining = el('p', 'character-stats__remaining', `Faltam ${Math.max(0, needed - p.xp)} XP para o próximo nível`);
    remaining.style.cssText = 'font-size:0.78rem;opacity:0.8;margin:5px 0 10px;';

    const stats = el('div', 'character-stats__grid');
    stats.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;';
    const values: Array<[string, string]> = [
      ['PV', `${selected.hp} / ${selected.maxHp}`],
      ['Dano', String(selected.damage)],
    ];
    for (const [label, value] of values) {
      const tile = el('div', 'character-stats__tile');
      tile.style.cssText = 'background:#171923;border:1px solid #343746;padding:7px 9px;border-radius:4px;display:flex;justify-content:space-between;gap:6px;';
      tile.append(el('span', undefined, label), el('strong', undefined, value));
      stats.append(tile);
    }

    const pointsTitle = el('h3', undefined, `Distribuir atributos · ${p.unspentAttributePoints} ponto(s)`);
    pointsTitle.style.cssText = 'font-size:0.95rem;margin:12px 0 6px;';
    const quickAmounts = el('div', 'character-stats__quick-amounts');
    quickAmounts.style.cssText = 'display:flex;justify-content:flex-end;gap:6px;margin:0 0 8px;';
    for (const amount of [10, 50, 100]) {
      const quickButton = el('button', 'btn-attribute-batch', `+ ${amount}`);
      quickButton.type = 'button';
      quickButton.disabled = this.attributeSavePending || p.unspentAttributePoints < 1 || this.state.phase !== 'player' || selected.hp <= 0;
      quickButton.title = `Selecionar ${amount} ponto(s) para o próximo atributo escolhido`;
      quickButton.style.cssText = 'min-width:54px;padding:5px 9px;border:1px solid #8b7be8;border-radius:4px;background:#342c57;color:#fff;font-weight:700;cursor:pointer;';
      quickButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.pendingAttributeBatch = amount;
        quickAmounts.querySelectorAll('button').forEach((button) => {
          (button as HTMLButtonElement).style.background = button === quickButton ? '#6d5bb2' : '#342c57';
        });
      });
      quickAmounts.append(quickButton);
    }
    const attributes = el('div', 'character-stats__attributes');
    attributes.style.cssText = 'display:grid;gap:6px;';
    const attributeRows: Array<{ key: AttributeName; label: string; value: number; effect: string }> = [
      { key: 'strength', label: 'Força', value: p.attributes.strength, effect: '+1 dano por ponto' },
      { key: 'vitality', label: 'Vitalidade', value: p.attributes.vitality, effect: '+5 PV máximos por ponto' },
      { key: 'defense', label: 'Defesa', value: p.attributes.defense, effect: '−1 dano recebido por ponto (mín. 1)' },
    ];
    for (const attribute of attributeRows) {
      const row = el('div', 'character-stats__attribute-row');
      row.style.cssText = 'display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;background:#171923;border:1px solid #343746;padding:8px 9px;border-radius:4px;';
      const info = el('div');
      info.append(el('strong', undefined, attribute.label), el('div', undefined, attribute.effect));
      info.lastElementChild && ((info.lastElementChild as HTMLElement).style.cssText = 'font-size:0.72rem;opacity:0.72;margin-top:2px;');
      row.append(info, el('strong', undefined, String(attribute.value)));
      const add = el('button', 'btn-attribute', '+');
      add.type = 'button';
      add.title = `Adicionar 1 ponto em ${attribute.label}`;
      add.setAttribute('aria-label', add.title);
      add.disabled = this.attributeSavePending || p.unspentAttributePoints < 1 || this.state.phase !== 'player' || selected.hp <= 0;
      add.style.cssText = 'min-width:34px;height:32px;border:1px solid #8b7be8;border-radius:4px;background:#342c57;color:#fff;font-weight:700;cursor:pointer;';
      add.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const requestedPoints = Math.min(this.pendingAttributeBatch ?? 1, selected.progression?.unspentAttributePoints ?? 0);
        this.pendingAttributeBatch = null;
        if (requestedPoints < 1 || this.attributeSavePending) return;
        this.attributeSavePending = true;
        this.render();
        void (async () => {
          try {
            const saved = this.onAllocateAttribute
              ? await this.onAllocateAttribute(selected.definition.id, attribute.key, requestedPoints)
              : true;
            if (!saved) {
              window.alert('Não foi possível salvar os atributos. Nenhum ponto foi consumido.');
              return;
            }
            if (!this.state.applyPersistedAttributeAllocation(selected.uid, attribute.key, requestedPoints)) {
              window.alert('Os atributos foram salvos, mas a interface mudou durante a operação. Recarregue a tela para sincronizar.');
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro desconhecido.';
            window.alert('Falha ao salvar atributos: ' + message);
          } finally {
            this.attributeSavePending = false;
            this.render();
          }
        })();
      });
      row.append(add);
      attributes.append(row);
    }

    this.attributesButton.hidden = false;
    this.attributesButton.textContent = 'Atributos · ' + selected.definition.name;
    this.attributesButton.style.cssText = 'width:100%;padding:9px;background:#342c57;border:1px solid #8b7be8;color:#fff;font-weight:800;cursor:pointer;';
    this.characterStatsBox.hidden = false;
    this.characterStatsBox.style.cssText = 'padding:12px;margin:8px 0;background:#20212b;border:1px solid #4b465e;border-radius:5px;color:#f3f0ff;';
    this.characterStatsBox.replaceChildren(header, xpRow, xpBar, remaining, stats, pointsTitle, quickAmounts, attributes);
    this.attributesModal.style.display = this.attributesOpen ? 'flex' : 'none';
    this.attributesModal.hidden = !this.attributesOpen;
  }

  /** Mostra nome, descrição, disponibilidade e controles da habilidade do herói selecionado. */
  private renderAbility(selected: Unit | null, canAct: boolean): void {
    const ability = selected?.definition.ability ?? null;
    if (!selected || !ability || !canAct) {
      this.abilityBox.hidden = true;
      this.specialConfirmModal.hidden = true;
      this.specialConfirmModal.style.display = 'none';
      return;
    }

    const used = selected.abilityUsed;
    const targeting = this.state.targeting;

    this.abilityBox.hidden = false;
    this.abilityNameEl.textContent = ability.name;
    this.abilityStatusEl.textContent = used ? 'Já utilizada' : 'Disponível';
    this.abilityStatusEl.className = `ability-status ability-status--${used ? 'used' : 'ready'}`;
    this.abilityDescEl.textContent = ability.description;

    // Escolhendo alvo: instrução do passo atual + Confirmar/Cancelar. Senão: botão "Usar".
    const targetReady = targeting !== null && this.state.canConfirmAbility;
    this.useButton.hidden = targeting !== null;
    this.useButton.disabled = !this.state.canUseAbility(selected);
    this.confirmButton.hidden = !targetReady;
    this.confirmButton.disabled = !targetReady;
    this.cancelButton.hidden = !targetReady;
    this.specialConfirmText.textContent = this.state.targetingHint;
    // A janela só aparece depois que o jogador escolhe um alvo/área válida.
    this.specialConfirmModal.hidden = !targetReady;
    this.specialConfirmModal.style.display = targetReady ? 'flex' : 'none';

    if (targeting) {
      this.abilityHintEl.textContent = 'Escolha o alvo no tabuleiro e confirme aqui.';
    } else if (used) {
      this.abilityHintEl.textContent = 'Esta habilidade já foi usada neste combate.';
    } else {
      this.abilityHintEl.textContent = 'Usar a habilidade substitui o movimento deste turno.';
    }

    const notice = this.state.notice;
    this.noticeEl.hidden = notice === null;
    this.noticeEl.textContent = notice ?? '';
  }

  private createUnitCard(unit: Unit): HTMLElement {
    const def = unit.definition;
    const isHero = def.team === 'hero';
    const alive = unit.hp > 0;

    let card: HTMLElement;
    if (isHero) {
      const button = el('button', 'unit-card');
      button.type = 'button';
      button.disabled = !alive || this.state.phase !== 'player';
      button.addEventListener('click', () => this.state.toggleSelection(unit.uid));
      card = button;
    } else {
      card = el('div', 'unit-card');
    }

    if (!alive) {
      card.classList.add('dead');
    } else if (unit.uid === this.state.selectedUid) {
      card.classList.add('selected');
    }

    const rank: EncounterType = isHero ? 'normal' : (def.rank ?? 'normal');
    const badgeClass = isHero ? 'badge' : rank === 'normal' ? 'badge badge--monster' : `badge badge--monster badge--${rank}`;
    const badge = el('span', badgeClass, def.symbol);
    badge.style.background = cssColor(def.color);

    const name = el('span', 'unit-name', def.name);
    if (rank !== 'normal') name.append(el('span', `unit-rank unit-rank--${rank}`, RANK_LABEL[rank]));

    const top = el('div', 'unit-top');
    if (isHero) top.append(name, el('span', 'unit-hp', `PV ${unit.hp}/${unit.maxHp}`));
    else top.append(name);

    const fill = el('div', 'hp-fill');
    const ratio = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
    fill.style.width = `${ratio * 100}%`;
    if (ratio <= 0.25) {
      fill.classList.add('hp-fill--low');
    } else if (ratio <= 0.5) {
      fill.classList.add('hp-fill--mid');
    }
    const bar = el('div', 'hp-bar');
    bar.append(fill);

    const info = el('div', 'unit-info');
    if (isHero) info.append(top, bar, el('div', 'unit-stats', this.statsText(unit, alive)));
    else info.append(top, el('div', 'unit-stats', this.statsText(unit, alive)));

    card.append(badge, info);
    return card;
  }

  private statsText(unit: Unit, alive: boolean): string {
    if (!alive) return 'Derrotado';
    const def = unit.definition;
    let text = `Dano ${unit.damage} · Mov ${def.movement}`;
    if (def.ability) {
      text += ` · ${def.ability.name}: ${unit.abilityUsed ? 'usada' : 'pronta'}`;
    }
    if (unit.stunned) text += ' · Atordoado';
    return text;
  }
}