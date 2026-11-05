import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Campaign } from './Campaign';
import { CooperativeSessionClient } from './CooperativeSession';
import type { CooperativeAction, CooperativeSessionState } from './CooperativeSession';
import type { CooperativeBattleAction } from './GameState';
import { BattleScene } from '../scenes/BattleScene';
import { SidePanel } from '../../ui/SidePanel';
import { supabase } from '../../lib/supabase';
import type { ProgressionPersistenceEvent } from './GameState';

type RuntimeMember = CooperativeSessionState['members'][number];
type CooperativeProgressionEvent = ProgressionPersistenceEvent & { character_id: string };

export class CooperativeBattleRuntime {
  private campaign: Campaign | null = null;
  private client: CooperativeSessionClient | null = null;
  private game: Phaser.Game | null = null;
  private sidePanel: SidePanel | null = null;
  private scene: BattleScene | null = null;
  private mounted = false;
  private sceneReady = false;
  private disposed = false;
  private processingRound = false;
  private processingPlayerAction = false;
  private submittingAction = false;
  private snapshotSignature = '';
  private readonly progressionEvents: CooperativeProgressionEvent[] = [];
  private readonly processedProgressionEvents = new Set<string>();
  private readonly progressionEventsInFlight = new Set<string>();
  private readonly gameRoot: HTMLElement;
  private readonly panelRoot: HTMLElement;
  private readonly userId: string;
  private readonly sessionId: string;
  private readonly characterId: string;
  private readonly onBack: () => void;

  constructor(
    gameRoot: HTMLElement,
    panelRoot: HTMLElement,
    userId: string,
    sessionId: string,
    characterId: string,
    onBack: () => void,
  ) {
    this.gameRoot = gameRoot;
    this.panelRoot = panelRoot;
    this.userId = userId;
    this.sessionId = sessionId;
    this.characterId = characterId;
    this.onBack = onBack;
  }

  async start(): Promise<void> {
    this.panelRoot.replaceChildren(this.message('Conectando à expedição cooperativa...'));
    const campaign = new Campaign(undefined, (event) => {
      if (!event.heroUid.startsWith('coop-')) return;
      const characterId = event.heroUid.slice('coop-'.length);
      if (!characterId || this.progressionEvents.some((queued) => queued.eventId === event.eventId)) return;
      this.progressionEvents.push({ ...event, character_id: characterId });
    }, true);
    this.campaign = campaign;
    const client = new CooperativeSessionClient(
      this.sessionId,
      this.userId,
      this.characterId,
      (session) => { void this.handleSessionUpdate(session); },
      (message) => console.error('Sessão cooperativa:', message),
      (snapshot) => this.applyBroadcastBattleState(snapshot),
    );
    this.client = client;

    const session = await client.connect();
    this.configureRoster(session.members);
    if (session.state_snapshot) {
      if (!campaign.restoreSnapshot(session.state_snapshot)) {
        throw new Error('O estado compartilhado não corresponde aos personagens desta sala. A sessão foi mantida intacta.');
      }
      this.snapshotSignature = JSON.stringify(session.state_snapshot);
      this.loadCooperativeProgressionEvents(session.state_snapshot);
      if (!this.isOwnHeroAlive()) {
        this.dispose();
        this.onBack();
        return;
      }
    } else if (client.isLeader) {
      await client.initializeSnapshot(campaign.exportSnapshot());
      const initialized = client.session;
      if (!initialized?.state_snapshot || !campaign.restoreSnapshot(initialized.state_snapshot)) {
        throw new Error('O líder não conseguiu publicar ou restaurar o tabuleiro inicial.');
      }
      this.snapshotSignature = JSON.stringify(initialized.state_snapshot);
      this.loadCooperativeProgressionEvents(initialized.state_snapshot);
      if (!this.isOwnHeroAlive()) {
        this.dispose();
        this.onBack();
        return;
      }
    } else {
      throw new Error('O líder ainda está inicializando o tabuleiro. Volte à sala e tente entrar novamente em alguns segundos.');
    }

    this.mount();
    this.mounted = true;
    if (this.sceneReady) void this.refreshSessionAfterSceneReady();
  }

  private async refreshSessionAfterSceneReady(): Promise<void> {
    const client = this.client;
    if (!client || this.disposed) return;
    const latest = await client.refresh();
    if (latest) await this.handleSessionUpdate(latest);
  }

  private configureRoster(members: readonly RuntimeMember[]): void {
    if (!this.campaign) throw new Error('Campanha cooperativa indisponível.');
    const roster = members.map((member) => {
      if (!member.character_id || !member.class_id) throw new Error('Todos os participantes precisam ter um personagem selecionado.');
      return {
        user_id: member.user_id,
        character_id: member.character_id,
        class_id: member.class_id,
        character_level: member.character_level ?? 1,
        character_xp: member.character_xp ?? 0,
        unspent_attribute_points: member.unspent_attribute_points ?? 0,
        strength: member.strength ?? 0,
        vitality: member.vitality ?? 0,
        defense: member.defense ?? 0,
        equipment: member.equipment ?? [],
      };
    });
    if (!this.campaign.configureCooperativeParty(roster, this.characterId)) {
      throw new Error('Não foi possível montar os heróis da equipe. Confira os personagens selecionados.');
    }
  }

  private mount(): void {
    if (!this.campaign || !this.client) return;
    this.panelRoot.replaceChildren();
    this.gameRoot.hidden = false;
    this.gameRoot.style.display = '';
    this.sidePanel = new SidePanel(
      this.panelRoot,
      this.campaign,
      () => this.leaveToLobby(),
      undefined,
      (floor) => { void this.publishFloorTransition(floor); },
      undefined,
      undefined,
      undefined,
      false,
      (action) => { void this.submitAction(action); },
      true,
    );
    this.scene = new BattleScene(
      this.campaign,
      false,
      (action) => { void this.submitAction(action); },
      () => Boolean(this.client?.canAct && this.campaign?.status === 'fighting'),
      () => { void this.finishResolvedRound(); },
      () => {
        this.sceneReady = true;
        if (this.mounted) void this.refreshSessionAfterSceneReady();
      },
      () => {
        if (this.client?.isLeader && this.campaign) {
          void this.client.broadcastBattleState(this.campaign.exportSnapshot());
        }
      },
    );
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: this.gameRoot,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: 'rgba(0,0,0,0)',
      transparent: true,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [this.scene],
    });
    const back = document.createElement('button');
    back.type = 'button';
    back.textContent = '← Voltar à sala cooperativa';
    back.style.cssText = 'position:fixed;top:10px;left:10px;z-index:2000;padding:8px 11px;border:1px solid #64748b;border-radius:7px;background:#172033;color:#fff;font-weight:700;cursor:pointer;';
    back.addEventListener('click', () => this.leaveToLobby());
    this.panelRoot.append(back);
    this.updateStatus(this.client.session);
  }

  /** Aplica no cliente visitante cada passo enviado pelo líder, preservando a animação das peças. */
  private applyBroadcastBattleState(snapshot: Record<string, unknown>): void {
    const campaign = this.campaign;
    if (!this.mounted || this.disposed || !campaign || this.processingRound) return;
    if (!campaign.restoreSnapshot(snapshot, true)) {
      console.warn('Atualização visual cooperativa ignorada: snapshot incompatível.');
      return;
    }
    this.snapshotSignature = JSON.stringify(snapshot);
    this.loadCooperativeProgressionEvents(snapshot);
    this.updateStatus(this.client?.session);
  }

  private async handleSessionUpdate(session: CooperativeSessionState): Promise<void> {
    const campaign = this.campaign;
    const client = this.client;
    if (!this.mounted || this.disposed || !campaign || !client) return;
    const signature = session.state_snapshot ? JSON.stringify(session.state_snapshot) : '';
    if (signature && signature !== this.snapshotSignature && !this.processingRound) {
      const sameFloor = campaign.floorNumber === session.current_floor;
      if (!campaign.restoreSnapshot(session.state_snapshot, sameFloor)) {
        this.showError('O servidor publicou um estado incompatível. A batalha foi pausada para proteger o progresso.');
        return;
      }
      this.snapshotSignature = signature;
    }
    if (session.state_snapshot) await this.processCooperativeProgressionEvents(session.state_snapshot);
    if (session.status === 'active' && !this.isOwnHeroAlive()) {
      this.leaveToLobby();
      return;
    }

    this.updateStatus(session);
    if (session.status !== 'active') return;
    if (client.isLeader && session.action_processing && !this.processingPlayerAction && !this.processingRound) {
      await this.processSubmittedPlayerAction(session);
      return;
    }
    if (client.isLeader && session.resolution_pending && !this.processingRound) {
      await this.resolveSubmittedActions(session);
    }
  }

  /** O líder executa e anima uma única ação antes de liberar o próximo jogador. */
  private async processSubmittedPlayerAction(session: CooperativeSessionState): Promise<void> {
    const campaign = this.campaign;
    const client = this.client;
    if (!campaign || !client || this.processingPlayerAction || !session.state_snapshot) return;
    const pending = session.submitted_actions.find((action) => !action.processed_at);
    if (!pending) {
      this.showError('O servidor marcou uma ação em processamento, mas não encontrou a ação pendente.');
      return;
    }

    this.processingPlayerAction = true;
    try {
      if (!campaign.restoreSnapshot(session.state_snapshot)) {
        throw new Error('Não foi possível restaurar o estado antes da ação individual.');
      }
      this.snapshotSignature = JSON.stringify(session.state_snapshot);
      const heroUid = Campaign.cooperativeHeroUid(pending.character_id);
      campaign.battle.setCooperativeActor(heroUid);
      const accepted = campaign.battle.applyCooperativeAction(
        heroUid,
        pending.action_payload as CooperativeAction,
      );
      if (!accepted) throw new Error('A ação do jogador não pôde ser aplicada ao herói selecionado.');

      // Aguarda a animação do movimento/efeito terminar antes de liberar o próximo herói.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 560));
      const snapshot = this.exportSharedSnapshot();
      await client.completePlayerAction(pending.character_id, snapshot);
      this.snapshotSignature = JSON.stringify(snapshot);
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Falha ao executar a ação individual.');
    } finally {
      this.processingPlayerAction = false;
    }
  }

  /** Após o último herói agir, começa a fase automática de ataques e resposta dos monstros. */
  private async resolveSubmittedActions(session: CooperativeSessionState): Promise<void> {
    const campaign = this.campaign;
    if (!campaign || !this.client || !session.state_snapshot || this.processingRound) return;
    this.processingRound = true;
    try {
      if (!campaign.restoreSnapshot(session.state_snapshot)) {
        throw new Error('Não foi possível restaurar o estado após as ações individuais.');
      }
      this.snapshotSignature = JSON.stringify(session.state_snapshot);
      this.scene?.markCooperativeResolutionStarted();
      if (!campaign.battle.resolveCooperativeRound()) {
        throw new Error('O motor de batalha não conseguiu iniciar os ataques automáticos.');
      }
    } catch (error) {
      this.processingRound = false;
      this.showError(error instanceof Error ? error.message : 'Falha ao resolver a rodada cooperativa.');
    }
  }

  private async finishResolvedRound(): Promise<void> {
    const campaign = this.campaign;
    const client = this.client;
    if (!this.processingRound || !campaign || !client) return;
    try {
      const result = campaign.status;
      const sessionStatus = result === 'defeated' ? 'defeated' : result === 'completed' ? 'completed' : 'active';
      const snapshot = this.exportSharedSnapshot();
      await client.resolveRound(campaign.floorNumber, snapshot, sessionStatus);
      this.snapshotSignature = JSON.stringify(snapshot);
      await this.processCooperativeProgressionEvents(snapshot);
      this.processingRound = false;
      if (this.disposed) return;
      if (!this.isOwnHeroAlive()) {
        this.leaveToLobby();
        return;
      }

      // Andares comuns avançam automaticamente; nos marcos de extração, o grupo decide continuar.
      if (campaign.status === 'floor-cleared' && !campaign.canExtract) {
        if (campaign.advance()) await this.publishFloorTransition(campaign.floorNumber);
      }
      const latest = client.session;
      this.updateStatus(latest);
    } catch (error) {
      this.processingRound = false;
      this.showError(error instanceof Error ? error.message : 'Não foi possível salvar o resultado da rodada.');
    }
  }

  private async publishFloorTransition(floor: number): Promise<void> {
    const campaign = this.campaign;
    const client = this.client;
    if (!campaign || !client || !client.isLeader) return;
    try {
      const snapshot = this.exportSharedSnapshot();
      await client.advanceFloor(floor, snapshot);
      this.snapshotSignature = JSON.stringify(snapshot);
      this.updateStatus(client.session);
    } catch (error) {
      const latest = await client.refresh().catch(() => null);
      if (latest?.state_snapshot) {
        campaign.restoreSnapshot(latest.state_snapshot);
        this.snapshotSignature = JSON.stringify(latest.state_snapshot);
      }
      this.showError(error instanceof Error ? error.message : 'Não foi possível avançar o grupo.');
    }
  }

  private exportSharedSnapshot(): Record<string, unknown> {
    const campaign = this.campaign;
    if (!campaign) throw new Error('Campanha cooperativa indisponível.');
    return {
      ...campaign.exportSnapshot(),
      cooperativeProgressionEvents: [...this.progressionEvents],
    };
  }

  private loadCooperativeProgressionEvents(snapshot: Record<string, unknown>): void {
    const saved = snapshot.cooperativeProgressionEvents;
    if (!Array.isArray(saved)) return;
    for (const raw of saved) {
      if (!raw || typeof raw !== 'object') continue;
      const event = raw as CooperativeProgressionEvent;
      if (typeof event.eventId !== 'string' || typeof event.character_id !== 'string') continue;
      if (!this.progressionEvents.some((queued) => queued.eventId === event.eventId)) {
        this.progressionEvents.push(event);
      }
    }
  }

  private async processCooperativeProgressionEvents(snapshot: Record<string, unknown>): Promise<void> {
    if (!supabase || this.disposed) return;
    this.loadCooperativeProgressionEvents(snapshot);
    const ownEvents = this.progressionEvents.filter((event) => event.character_id === this.characterId);
    for (const event of ownEvents) {
      if (this.processedProgressionEvents.has(event.eventId) || this.progressionEventsInFlight.has(event.eventId)) continue;
      this.progressionEventsInFlight.add(event.eventId);
      try {
        const { error } = await supabase.rpc('apply_character_xp_event', {
          p_character_id: this.characterId,
          p_event_id: event.eventId,
          p_event_kind: event.kind,
          p_monster_max_hp: event.kind === 'kill' ? event.monsterMaxHp : null,
          p_monster_damage: event.kind === 'kill' ? event.monsterDamage : null,
          p_monster_rank: event.kind === 'kill' ? event.monsterRank : null,
        });
        if (error) throw new Error(error.message);
        this.processedProgressionEvents.add(event.eventId);
      } catch (error) {
        console.error('Falha ao persistir progressão cooperativa; o evento será tentado novamente:', error);
      } finally {
        this.progressionEventsInFlight.delete(event.eventId);
      }
    }
  }

  private async submitAction(action: CooperativeBattleAction): Promise<void> {
    const client = this.client;
    if (!client || !client.canAct || this.disposed || this.submittingAction) return;
    this.submittingAction = true;
    this.sidePanel?.updateCooperativeStatus(false, 'Enviando sua ação ao servidor...');
    try {
      await client.submitAction(action as CooperativeAction);
      this.updateStatus(client.session);
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Não foi possível enviar sua ação.');
    } finally {
      this.submittingAction = false;
      this.updateStatus(client.session);
    }
  }

  private isOwnHeroAlive(): boolean {
    const heroUid = Campaign.cooperativeHeroUid(this.characterId);
    const hero = this.campaign?.battle.roster.find((unit) => unit.uid === heroUid);
    return Boolean(hero && hero.hp > 0);
  }

  private updateStatus(session: CooperativeSessionState | null | undefined): void {
    const sidePanel = this.sidePanel;
    const client = this.client;
    if (!sidePanel || !session || !client) return;
    const actor = session.members.find((member) => member.user_id === session.current_turn_user_id);
    const pendingAction = session.submitted_actions.find((action) => !action.processed_at);
    const animatingMember = pendingAction
      ? session.members.find((member) => member.character_id === pendingAction.character_id)
      : undefined;
    const livingMembers = session.members.filter((member) => !member.is_eliminated);
    const turnPosition = Math.min(session.submitted_actions.filter((action) => action.processed_at).length + 1, Math.max(1, livingMembers.length));
    const classLabels: Record<string, string> = {
      warrior: 'Guerreiro',
      mage: 'Mago',
      cleric: 'Clérigo',
      assassin: 'Assassino',
      archer: 'Arqueiro',
    };
    const actorClass = actor?.class_id
      ? classLabels[actor.class_id] ?? actor.class_id
      : 'Herói';
    const campaignStatus = this.campaign?.status;
    const canAct = client.canAct && campaignStatus === 'fighting';
    const status = campaignStatus === 'floor-cleared'
      ? (client.isLeader ? 'Andar concluído. O líder pode avançar o grupo.' : 'Andar concluído. Aguardando o líder avançar o grupo.')
      : campaignStatus === 'completed'
        ? 'Expedição concluída! O grupo venceu o último andar.'
        : campaignStatus === 'defeated'
          ? 'Derrota. Todos os heróis foram derrotados.'
          : session.resolution_pending
            ? 'Todos os heróis agiram. Ataques automáticos dos heróis; depois os monstros se movimentam e atacam.'
            : session.action_processing
              ? `Animação do turno de ${animatingMember?.class_id ? classLabels[animatingMember.class_id] ?? animatingMember.class_id : 'herói'}. Aguarde a liberação do próximo.`
              : canAct
                ? `TURNO ${turnPosition}/${livingMembers.length} — ${actorClass}. Sua vez: escolha uma ação ou passe.`
                : `TURNO ${turnPosition}/${livingMembers.length} — ${actorClass} (${actor?.nickname ?? 'outro jogador'}).`;
    sidePanel.updateCooperativeStatus(
      canAct,
      status,
      client.isLeader && campaignStatus === 'floor-cleared',
    );
  }

  private message(text: string): HTMLElement {
    const node = document.createElement('main');
    node.style.cssText = 'min-height:100dvh;display:grid;place-items:center;padding:24px;background:#10131d;color:#fff;font-family:Arial,sans-serif;text-align:center;';
    node.textContent = text;
    return node;
  }

  private showError(message: string): void {
    console.error(message);
    const notice = document.createElement('p');
    notice.textContent = message;
    notice.style.cssText = 'position:fixed;z-index:3000;left:12px;right:12px;bottom:12px;padding:12px;background:#7f1d1d;color:#fff;border:1px solid #fca5a5;border-radius:8px;';
    this.panelRoot.append(notice);
  }

  private leaveToLobby(): void {
    this.dispose();
    this.onBack();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.client?.dispose();
    this.sidePanel?.destroy();
    this.sidePanel = null;
    this.game?.destroy(true);
    this.game = null;
    this.scene = null;
    this.gameRoot.hidden = true;
    this.gameRoot.style.display = 'none';
  }
}
