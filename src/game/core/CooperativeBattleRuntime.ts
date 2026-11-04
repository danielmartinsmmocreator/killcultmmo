import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Campaign } from './Campaign';
import { CooperativeSessionClient } from './CooperativeSession';
import type { CooperativeAction, CooperativeSessionState } from './CooperativeSession';
import type { CooperativeBattleAction } from './GameState';
import { BattleScene } from '../scenes/BattleScene';
import { SidePanel } from '../../ui/SidePanel';

type RuntimeMember = CooperativeSessionState['members'][number];

export class CooperativeBattleRuntime {
  private campaign: Campaign | null = null;
  private client: CooperativeSessionClient | null = null;
  private game: Phaser.Game | null = null;
  private sidePanel: SidePanel | null = null;
  private scene: BattleScene | null = null;
  private mounted = false;
  private disposed = false;
  private processingRound = false;
  private snapshotSignature = '';
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
    const campaign = new Campaign(undefined, undefined, true);
    this.campaign = campaign;
    const client = new CooperativeSessionClient(
      this.sessionId,
      this.userId,
      this.characterId,
      (session) => { void this.handleSessionUpdate(session); },
      (message) => console.error('Sessão cooperativa:', message),
    );
    this.client = client;

    const session = await client.connect();
    this.configureRoster(session.members);
    if (session.state_snapshot) {
      if (!campaign.restoreSnapshot(session.state_snapshot)) {
        throw new Error('O estado compartilhado não corresponde aos personagens desta sala. A sessão foi mantida intacta.');
      }
      this.snapshotSignature = JSON.stringify(session.state_snapshot);
    } else if (client.isLeader) {
      await client.initializeSnapshot(campaign.exportSnapshot());
      const initialized = client.session;
      if (!initialized?.state_snapshot || !campaign.restoreSnapshot(initialized.state_snapshot)) {
        throw new Error('O líder não conseguiu publicar ou restaurar o tabuleiro inicial.');
      }
      this.snapshotSignature = JSON.stringify(initialized.state_snapshot);
    } else {
      throw new Error('O líder ainda está inicializando o tabuleiro. Volte à sala e tente entrar novamente em alguns segundos.');
    }

    this.mount();
    this.mounted = true;
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

  private async handleSessionUpdate(session: CooperativeSessionState): Promise<void> {
    const campaign = this.campaign;
    const client = this.client;
    if (!this.mounted || this.disposed || !campaign || !client) return;
    if (session.status !== 'active') {
      this.updateStatus(session);
      return;
    }

    const signature = session.state_snapshot ? JSON.stringify(session.state_snapshot) : '';
    if (signature && signature !== this.snapshotSignature && !this.processingRound) {
      if (!campaign.restoreSnapshot(session.state_snapshot)) {
        this.showError('O servidor publicou um estado incompatível. A batalha foi pausada para proteger o progresso.');
        return;
      }
      this.snapshotSignature = signature;
    }

    this.updateStatus(session);
    if (client.isLeader && session.resolution_pending && !this.processingRound) {
      await this.resolveSubmittedActions(session);
    }
  }

  private async resolveSubmittedActions(session: CooperativeSessionState): Promise<void> {
    const campaign = this.campaign;
    if (!campaign || !this.client || !session.state_snapshot || this.processingRound) return;
    this.processingRound = true;
    try {
      if (!campaign.restoreSnapshot(session.state_snapshot)) {
        throw new Error('Não foi possível restaurar o estado anterior à rodada.');
      }
      this.snapshotSignature = JSON.stringify(session.state_snapshot);

      const actions = [...session.submitted_actions];
      if (actions.length !== session.members.length) {
        throw new Error('A rodada foi marcada como completa, mas a lista de ações está incompleta.');
      }
      for (const submitted of actions) {
        const heroUid = Campaign.cooperativeHeroUid(submitted.character_id);
        const accepted = campaign.battle.applyCooperativeAction(
          heroUid,
          submitted.action_payload as CooperativeAction,
        );
        if (!accepted) console.warn('Ação cooperativa não aplicada (herói indisponível ou ação inválida):', submitted);
      }

      // A simulação percorre os heróis de todos os participantes; ao terminar,
      // devolve a seleção local ao personagem que pertence a este cliente.
      campaign.battle.setCooperativeActor(Campaign.cooperativeHeroUid(this.characterId));
      this.scene?.markCooperativeResolutionStarted();
      if (!campaign.battle.resolveCooperativeRound()) {
        throw new Error('O motor de batalha não conseguiu iniciar a fase dos monstros.');
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
      const snapshot = campaign.exportSnapshot();
      await client.resolveRound(campaign.floorNumber, snapshot, sessionStatus);
      this.snapshotSignature = JSON.stringify(snapshot);
      this.processingRound = false;

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
      const snapshot = campaign.exportSnapshot();
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

  private async submitAction(action: CooperativeBattleAction): Promise<void> {
    const client = this.client;
    if (!client || !client.canAct || this.disposed) return;
    try {
      await client.submitAction(action as CooperativeAction);
      this.updateStatus(client.session);
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Não foi possível enviar sua ação.');
    }
  }

  private updateStatus(session: CooperativeSessionState | null | undefined): void {
    const sidePanel = this.sidePanel;
    const client = this.client;
    if (!sidePanel || !session || !client) return;
    const actor = session.members.find((member) => member.user_id === session.current_turn_user_id);
    const acted = session.submitted_actions.some((action) => action.actor_user_id === this.userId);
    const campaignStatus = this.campaign?.status;
    const canAct = client.canAct && campaignStatus === 'fighting';
    const status = campaignStatus === 'floor-cleared'
      ? (client.isLeader ? 'Andar concluído. O líder pode avançar o grupo.' : 'Andar concluído. Aguardando o líder avançar o grupo.')
      : campaignStatus === 'completed'
        ? 'Expedição concluída! O grupo venceu o último andar.'
        : campaignStatus === 'defeated'
          ? 'Derrota. Todos os heróis foram derrotados.'
          : session.resolution_pending
            ? 'Todos enviaram suas ações. O líder está resolvendo os monstros.'
            : canAct
              ? 'Sua vez: escolha mover, atacar, usar a habilidade ou passar.'
              : acted
                ? 'Ação recebida. Aguarde os demais jogadores.'
                : 'Vez de ' + (actor?.nickname ?? 'outro participante') + '.';
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
