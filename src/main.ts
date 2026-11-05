import './style.css';
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './game/config';
import { Campaign } from './game/core/Campaign';
import type { ProgressionPersistenceEvent } from './game/core/GameState';
import { BattleScene } from './game/scenes/BattleScene';
import { SidePanel } from './ui/SidePanel';
import { PreparationScreen } from './ui/PreparationScreen';
import { AuthScreen } from './ui/AuthScreen';
import { GuildScreen } from './ui/GuildScreen';
import { ExpeditionLobbyScreen } from './ui/ExpeditionLobbyScreen';
import { CooperativeBattleRuntime } from './game/core/CooperativeBattleRuntime';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { loadPlayerData } from './lib/playerData';

const gameContainer = document.getElementById('game-container');
const panelRoot = document.getElementById('panel');

if (!gameContainer || !panelRoot) {
  throw new Error('Elementos #game-container e #panel não encontrados no index.html');
}

const gameRoot: HTMLElement = gameContainer;
const panel: HTMLElement = panelRoot;

let campaign: Campaign | null = null;
let game: Phaser.Game | null = null;
let sidePanel: SidePanel | null = null;
let cooperativeBattle: CooperativeBattleRuntime | null = null;
let activeUserId: string | null = null;
let loadingUserId: string | null = null;
let playerNickname = 'JOGADOR';
let playerHighestFloor = 1;
let isGameMaster = false;
let progressionSaveWarningShown = false;
let activeExpeditionId: string | null = null;
let expeditionFinishPending = false;
let lastExpeditionActivitySyncAt = 0;
let snapshotSaveTimer: number | null = null;
let snapshotSaveChain: Promise<void> = Promise.resolve();
let unsubscribeSnapshot: (() => void) | null = null;

function destroyGame(): void {
  cooperativeBattle?.dispose();
  cooperativeBattle = null;
  unsubscribeSnapshot?.();
  unsubscribeSnapshot = null;
  if (snapshotSaveTimer !== null) window.clearTimeout(snapshotSaveTimer);
  snapshotSaveTimer = null;
  sidePanel?.destroy();
  sidePanel = null;
  game?.destroy(true);
  game = null;
  campaign = null;
}

function showAuth(): void {
  destroyGame();
  activeExpeditionId = null;
  activeUserId = null;
  isGameMaster = false;
  playerHighestFloor = 1;
  gameRoot.hidden = true;
  gameRoot.style.display = 'none';
  if (!isSupabaseConfigured) {
    const notice = document.createElement('main');
    notice.style.cssText = 'min-height:100dvh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#10131d;color:#fff;font-family:Arial,sans-serif;text-align:center;';
    notice.textContent = 'Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local e nas variáveis da Vercel.';
    panel.replaceChildren(notice);
    return;
  }
  new AuthScreen(panel);
}

async function persistEquipmentChange(): Promise<boolean> {
  if (!supabase || !campaign) return false;
  const { error } = await supabase.rpc('save_player_equipment', {
    p_equipment: campaign.getPersistedEquipment(),
  });
  if (error) {
    console.error('Falha ao salvar equipamentos:', error);
    return false;
  }
  return true;
}

async function persistInventorySale(instanceId: string): Promise<number> {
  if (!supabase || !campaign) return 0;
  const inventoryItemId = campaign.inventory.persistentIdOf(instanceId);
  if (!inventoryItemId) {
    window.alert('Este item ainda não está registrado no inventário permanente e não pode ser vendido.');
    return 0;
  }

  const { data, error } = await supabase.rpc('sell_player_inventory_item', {
    p_inventory_item_id: inventoryItemId,
  });
  if (error) {
    console.error('Falha ao vender item:', error);
    window.alert(error.message.includes('Remova o equipamento')
      ? 'Remova o item do personagem antes de vendê-lo.'
      : 'O servidor não conseguiu concluir a venda. O item foi mantido no inventário.');
    return 0;
  }

  const serverGold = Number((data as { gold_credited?: number } | null)?.gold_credited ?? 0);
  const localGold = campaign.sellInventoryItem(instanceId);
  if (localGold !== serverGold) {
    console.error('Divergência entre preço local e preço confirmado pelo servidor.', { localGold, serverGold });
    window.alert('A venda foi registrada, mas o catálogo local está desatualizado. A página será recarregada para sincronizar o inventário.');
    window.location.reload();
    return 0;
  }
  return serverGold;
}

function showGuilds(): void {
  if (!campaign || !activeUserId) return;
  new GuildScreen(panel, campaign, () => showPreparation(), () => showExpeditions(() => showGuilds()));
}

function showExpeditions(onBack: () => void = () => showPreparation()): void {
  if (!campaign || !activeUserId) return;
  new ExpeditionLobbyScreen(
    panel,
    activeUserId,
    onBack,
    (sessionId, characterId) => {
      if (!activeUserId) return;
      cooperativeBattle?.dispose();
      const userId = activeUserId;
      cooperativeBattle = new CooperativeBattleRuntime(
        gameRoot,
        panel,
        userId,
        sessionId,
        characterId,
        () => {
          cooperativeBattle = null;
          showExpeditions(onBack);
        },
      );
      void cooperativeBattle.start().catch((error) => {
        console.error('Falha ao abrir batalha cooperativa:', error);
        cooperativeBattle?.dispose();
        cooperativeBattle = null;
        window.alert(error instanceof Error ? error.message : 'Não foi possível entrar no combate cooperativo.');
        showExpeditions(onBack);
      });
    },
  );
}

function showPreparation(resetCampaign = false): void {
  if (!campaign) return;
  sidePanel?.destroy();
  sidePanel = null;
  game?.destroy(true);
  game = null;
  if (resetCampaign) campaign.restart(false);
  unsubscribeSnapshot?.();
  unsubscribeSnapshot = null;
  if (snapshotSaveTimer !== null) window.clearTimeout(snapshotSaveTimer);
  snapshotSaveTimer = null;
  gameRoot.hidden = true;
  gameRoot.style.display = 'none';
  new PreparationScreen(panel, campaign, startExpedition, playerNickname, persistEquipmentChange, persistInventorySale, async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) window.alert('Não foi possível sair: ' + error.message);
  }, 0, undefined, isGameMaster, async (classId, attribute) => { const saved = await persistAttributeAllocation(classId, attribute, 1); return saved; }, resetBaseAttributes, buyBaseAttributePoint, playerHighestFloor, showGuilds, showExpeditions);
}

const PROGRESSION_QUEUE_PREFIX = 'killcult:pending-progression:';
let progressionSyncPromise: Promise<void> | null = null;

function readPendingProgressionEvents(userId: string): ProgressionPersistenceEvent[] {
  try {
    const raw = window.localStorage.getItem(PROGRESSION_QUEUE_PREFIX + userId);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((event): event is ProgressionPersistenceEvent =>
      event !== null &&
      typeof event === 'object' &&
      typeof event.eventId === 'string' &&
      typeof event.classId === 'string' &&
      (event.kind === 'death' || (
        event.kind === 'kill' &&
        typeof event.monsterMaxHp === 'number' &&
        typeof event.monsterDamage === 'number' &&
        (event.monsterRank === 'normal' || event.monsterRank === 'mini-boss' || event.monsterRank === 'boss')
      ))
    );
  } catch (error) {
    console.error('Não foi possível ler a fila local de progressão:', error);
    return [];
  }
}

function writePendingProgressionEvents(userId: string, events: ProgressionPersistenceEvent[]): boolean {
  try {
    const key = PROGRESSION_QUEUE_PREFIX + userId;
    if (events.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(events));
    return true;
  } catch (error) {
    console.error('Não foi possível guardar a fila local de progressão:', error);
    return false;
  }
}

async function flushPendingProgressionEvents(): Promise<void> {
  if (!supabase || !campaign || !activeUserId || progressionSyncPromise) return progressionSyncPromise ?? Promise.resolve();
  const userId = activeUserId;
  progressionSyncPromise = (async () => {
    while (activeUserId === userId && campaign) {
      const pending = readPendingProgressionEvents(userId);
      const event = pending[0];
      if (!event) break;
      const characterId = campaign.getPersistedCharacterId(event.classId);
      if (!characterId) {
        console.error('Personagem sem ID persistido; evento de XP permanece na fila.');
        break;
      }
      const { error } = await supabase!.rpc('apply_character_xp_event', {
        p_character_id: characterId,
        p_event_id: event.eventId,
        p_event_kind: event.kind,
        p_monster_max_hp: event.kind === 'kill' ? event.monsterMaxHp : null,
        p_monster_damage: event.kind === 'kill' ? event.monsterDamage : null,
        p_monster_rank: event.kind === 'kill' ? event.monsterRank : null,
      });
      if (error) {
        console.error('Falha ao sincronizar evento de progressão; ele foi mantido na fila:', error);
        if (!progressionSaveWarningShown) {
          progressionSaveWarningShown = true;
          window.alert('Uma alteração de XP ainda não foi sincronizada. Ela ficou guardada neste navegador e será reenviada quando a conexão voltar. Evite limpar os dados do navegador.');
        }
        break;
      }
      // Rele a fila após a resposta para não apagar eventos adicionados durante a requisição.
      const latest = readPendingProgressionEvents(userId).filter((queued) => queued.eventId !== event.eventId);
      if (!writePendingProgressionEvents(userId, latest)) break;
    }
  })().finally(() => {
    progressionSyncPromise = null;
  });
  return progressionSyncPromise;
}

async function persistProgressionEvent(event: ProgressionPersistenceEvent): Promise<void> {
  if (!activeUserId || !campaign) return;
  const pending = readPendingProgressionEvents(activeUserId);
  if (!pending.some((queued) => queued.eventId === event.eventId)) pending.push(event);
  if (!writePendingProgressionEvents(activeUserId, pending)) {
    console.error('O evento de progressão não pôde ser armazenado localmente.');
    if (!progressionSaveWarningShown) {
      progressionSaveWarningShown = true;
      window.alert('Não foi possível guardar uma alteração de XP neste navegador. Verifique o armazenamento e a conexão antes de continuar.');
    }
    return;
  }
  await flushPendingProgressionEvents();
}

async function persistAttributeAllocation(classId: string, attribute: 'strength' | 'vitality' | 'defense', points: number): Promise<boolean> {
  if (!supabase || !campaign) return false;
  const characterId = campaign.getPersistedCharacterId(classId);
  if (!characterId) {
    window.alert('Não foi possível identificar o personagem no banco de dados.');
    return false;
  }

  const { error } = await supabase.rpc('allocate_character_attribute', {
    p_character_id: characterId,
    p_attribute: attribute,
    p_points: points,
  });

  if (error) {
    console.error('Falha ao persistir atributos:', error.message);
    window.alert(error.message.includes('pontos insuficientes')
      ? 'Esse personagem não possui pontos suficientes para essa distribuição.'
      : 'O Supabase recusou a distribuição de atributos. Tente novamente.');
    return false;
  }

  return true;
}

async function buyBaseAttributePoint(classId: string): Promise<boolean> {
  if (!supabase || !campaign || activeExpeditionId) return false;
  const characterId = campaign.getPersistedCharacterId(classId);
  if (!characterId) { window.alert('Não foi possível identificar o personagem no banco de dados.'); return false; }
  const { error } = await supabase.rpc('buy_character_attribute_point', { p_character_id: characterId });
  if (error) {
    console.error('Falha ao comprar ponto de atributo:', error);
    window.alert(error.message.includes('Ouro insuficiente')
      ? 'Você precisa de 10.000 de ouro permanente para comprar esse ponto.'
      : 'Não foi possível comprar o ponto de atributo. Tente novamente.');
    return false;
  }
  return true;
}

async function resetBaseAttributes(classId: string): Promise<boolean> {
  if (!supabase || !campaign || activeExpeditionId) return false;
  const characterId = campaign.getPersistedCharacterId(classId);
  if (!characterId) { window.alert('Não foi possível identificar o personagem no banco de dados.'); return false; }
  const { error } = await supabase.rpc('reset_character_attributes', { p_character_id: characterId });
  if (error) {
    console.error('Falha ao redefinir atributos:', error);
    window.alert(error.message.includes('Ouro insuficiente')
      ? 'Ouro permanente insuficiente para redefinir os atributos desse personagem.'
      : 'Não foi possível redefinir os atributos. Tente novamente.');
    return false;
  }
  return true;
}

const EXPEDITION_PROGRESS_PREFIX = 'killcult:pending-expedition-progress:';
let expeditionProgressSyncPromise: Promise<void> | null = null;

function expeditionProgressKey(userId: string, expeditionId: string): string {
  return EXPEDITION_PROGRESS_PREFIX + userId + ':' + expeditionId;
}

function readPendingExpeditionFloor(userId: string, expeditionId: string): number | null {
  try {
    const value = Number(window.localStorage.getItem(expeditionProgressKey(userId, expeditionId)));
    return Number.isInteger(value) && value >= 1 && value <= 100 ? value : null;
  } catch (error) {
    console.error('Não foi possível ler o progresso pendente da expedição:', error);
    return null;
  }
}

function storePendingExpeditionFloor(userId: string, expeditionId: string, floor: number): boolean {
  try {
    const key = expeditionProgressKey(userId, expeditionId);
    const previous = readPendingExpeditionFloor(userId, expeditionId) ?? 0;
    window.localStorage.setItem(key, String(Math.max(previous, floor)));
    return true;
  } catch (error) {
    console.error('Não foi possível guardar o progresso pendente da expedição:', error);
    return false;
  }
}

function clearPendingExpeditionFloor(userId: string, expeditionId: string): void {
  try {
    window.localStorage.removeItem(expeditionProgressKey(userId, expeditionId));
  } catch (error) {
    console.error('Não foi possível limpar o progresso local da expedição:', error);
  }
}

async function flushPendingExpeditionProgress(): Promise<void> {
  if (!supabase || !activeUserId || !activeExpeditionId || expeditionProgressSyncPromise) {
    return expeditionProgressSyncPromise ?? Promise.resolve();
  }
  const userId = activeUserId;
  const expeditionId = activeExpeditionId;
  expeditionProgressSyncPromise = (async () => {
    while (activeUserId === userId && activeExpeditionId === expeditionId) {
      const floor = readPendingExpeditionFloor(userId, expeditionId);
      if (floor === null) break;
      const { error } = await supabase!.rpc('update_player_expedition_progress', {
        p_expedition_id: expeditionId,
        p_current_floor: floor,
      });
      if (error) {
        console.error('Falha ao sincronizar progresso da expedição; o último andar foi mantido localmente:', error);
        break;
      }
      // Só remove o valor confirmado se nenhum andar mais recente foi enfileirado durante a requisição.
      if (readPendingExpeditionFloor(userId, expeditionId) === floor) {
        clearPendingExpeditionFloor(userId, expeditionId);
      }
    }
  })().finally(() => {
    expeditionProgressSyncPromise = null;
  });
  return expeditionProgressSyncPromise;
}

async function persistExpeditionFloor(floor: number): Promise<void> {
  if (!activeUserId || !activeExpeditionId) return;
  if (!storePendingExpeditionFloor(activeUserId, activeExpeditionId, floor)) {
    console.error('O progresso da expedição não pôde ser armazenado localmente.');
    return;
  }
  await flushPendingExpeditionProgress();
}

function syncExpeditionActivity(floor: number): void {
  const now = Date.now();
  if (now - lastExpeditionActivitySyncAt < 60_000) return;
  lastExpeditionActivitySyncAt = now;
  void persistExpeditionFloor(floor);
}

async function extractExpeditionAndReturn(): Promise<void> {
  if (!campaign || !supabase || !activeExpeditionId || expeditionFinishPending || !campaign.canExtract) return;
  const rewards = campaign.getPendingExtractionRewards();
  expeditionFinishPending = true;
  const { error } = await supabase.rpc('extract_player_expedition', {
    p_expedition_id: activeExpeditionId,
    p_gold: rewards.gold,
    p_items: rewards.items,
  });

  if (error) {
    console.error('Falha ao consolidar recompensas:', error);
    expeditionFinishPending = false;
    window.alert('A extração não foi salva no servidor. Seus itens e ouro continuam temporários. Não atualize a página; tente extrair novamente após verificar a conexão.');
    return;
  }

  if (activeUserId) clearPendingExpeditionFloor(activeUserId, activeExpeditionId);
  activeExpeditionId = null;
  expeditionFinishPending = false;
  // A recarga recupera os IDs definitivos dos itens recém-inseridos e os equipamentos do banco.
  window.location.reload();
}

async function retreatExpeditionAndReturn(): Promise<void> {
  if (!campaign || !supabase || !activeExpeditionId || expeditionFinishPending) return;
  const userId = activeUserId;
  const expeditionId = activeExpeditionId;
  if (!userId || !expeditionId) return;

  expeditionFinishPending = true;
  try {
    // Garante que o último andar alcançado seja registrado antes de encerrar a incursão.
    await flushPendingExpeditionProgress();
    const { error } = await supabase.rpc('finish_player_expedition', {
      p_expedition_id: expeditionId,
      p_result: 'retreat',
    });
    if (error) throw error;

    clearPendingExpeditionFloor(userId, expeditionId);
    activeExpeditionId = null;
    expeditionFinishPending = false;
    showPreparation(true);
  } catch (error) {
    console.error('Falha ao bater em retirada:', error);
    expeditionFinishPending = false;
    window.alert('Não foi possível registrar a retirada. Seus itens e ouro temporários continuam protegidos. Verifique a conexão e tente novamente.');
  }
}

async function finishExpeditionAndReturn(): Promise<void> {
  if (!campaign || !supabase || !activeExpeditionId || expeditionFinishPending) return;
  if (campaign.status !== 'defeated' || campaign.lastExpeditionResult !== 'combat_defeat') {
    window.alert('Não foi possível identificar o resultado da expedição. Seus dados não foram encerrados.');
    return;
  }

  const userId = activeUserId;
  const expeditionId = activeExpeditionId;
  if (!userId || !expeditionId) return;

  expeditionFinishPending = true;
  while (true) {
    const { error } = await supabase.rpc('finish_player_expedition', {
      p_expedition_id: expeditionId,
      p_result: 'combat_defeat',
    });
    if (!error) break;
    console.error('Falha ao encerrar expedição:', error);
    const retry = window.confirm('Não foi possível registrar o encerramento da expedição. Verifique sua conexão e tente novamente. Deseja tentar de novo?');
    if (!retry) {
      expeditionFinishPending = false;
      return;
    }
  }

  clearPendingExpeditionFloor(userId, expeditionId);
  activeExpeditionId = null;
  expeditionFinishPending = false;
  showPreparation(true);
}

function persistCampaignSnapshot(): void {
  if (!supabase || !campaign || !activeExpeditionId) return;
  if (snapshotSaveTimer !== null) window.clearTimeout(snapshotSaveTimer);
  snapshotSaveTimer = window.setTimeout(() => {
    snapshotSaveTimer = null;
    const expeditionId = activeExpeditionId;
    const currentCampaign = campaign;
    if (!expeditionId || !currentCampaign) return;
    snapshotSaveChain = snapshotSaveChain.then(async () => {
      if (!supabase || activeExpeditionId !== expeditionId || campaign !== currentCampaign) return;
      const snapshot = currentCampaign.exportSnapshot();
      const { error } = await supabase.rpc('save_player_expedition_snapshot', {
        p_expedition_id: expeditionId,
        p_current_floor: currentCampaign.floorNumber,
        p_state_snapshot: snapshot,
      });
      if (error) {
        console.error('Falha ao salvar o estado da expedição:', error);
      }
    }).catch((error) => console.error('Falha na fila de snapshots:', error));
  }, 250);
}

function launchExpeditionBattle(restored = false): void {
  if (!campaign || !activeExpeditionId) return;
  // Na campanha nova, aplica a equipe escolhida antes do primeiro snapshot.
  // Na retomada, nunca recria o encontro: mantém o estado restaurado exatamente como salvo.
  if (!restored) campaign.syncActiveEncounter();
  expeditionFinishPending = false;
  lastExpeditionActivitySyncAt = 0;
  panel.replaceChildren();
  gameRoot.hidden = false;
  gameRoot.style.display = '';
  sidePanel = new SidePanel(panel, campaign, () => { void finishExpeditionAndReturn(); }, persistAttributeAllocation, (floor) => { void persistExpeditionFloor(floor); }, syncExpeditionActivity, extractExpeditionAndReturn, retreatExpeditionAndReturn, isGameMaster);
  unsubscribeSnapshot?.();
  unsubscribeSnapshot = campaign.battle.subscribe(() => persistCampaignSnapshot());
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: gameRoot,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: 'rgba(0,0,0,0)',
    transparent: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [new BattleScene(campaign, false)],
  });
  persistCampaignSnapshot();
}

async function startExpedition(): Promise<void> {
  if (!campaign || !supabase || activeExpeditionId) return;
  const characterIds = campaign.getActivePersistedCharacterIds();
  if (characterIds.length !== campaign.activeParty.length) {
    window.alert('Não foi possível identificar todos os personagens selecionados no banco de dados.');
    return;
  }

  const { error: formationError } = await supabase.rpc('save_player_party_formation', {
    p_formation: campaign.exportPartyFormation(),
  });
  if (formationError) {
    console.error('Falha ao salvar a formação:', formationError);
    window.alert('Não foi possível salvar sua formação. A expedição não foi iniciada; tente novamente.');
    return;
  }

  const { data: expeditionId, error } = await supabase.rpc('start_player_expedition', {
    p_character_ids: characterIds,
  });

  if (error?.message.toLowerCase().includes('expedição ativa')) {
    window.alert(
      'Você já possui uma expedição em andamento. Ela não pode ser substituída por uma nova campanha. ' +
      'Ao retornar, você deverá continuar essa mesma expedição; após 10 minutos sem atividade, ela será encerrada como derrota por inatividade.'
    );
    return;
  }

  if (error || !expeditionId) {
    console.error('Falha ao iniciar expedição:', error);
    window.alert('Não foi possível registrar sua expedição no servidor. Tente novamente.');
    return;
  }

  activeExpeditionId = expeditionId as string;
  launchExpeditionBattle(false);
}

function showPlayerDataError(userId: string, message: string): void {
  destroyGame();
  activeUserId = null;
  gameRoot.hidden = true;
  gameRoot.style.display = 'none';
  const screen = document.createElement('main');
  screen.style.cssText = 'min-height:100dvh;display:grid;place-content:center;gap:14px;padding:24px;box-sizing:border-box;background:#10131d;color:#fff;font-family:Arial,sans-serif;text-align:center;';
  const title = document.createElement('h1');
  title.textContent = 'Não foi possível carregar seus dados';
  title.style.cssText = 'margin:0;font-size:1.4rem;';
  const detail = document.createElement('p');
  detail.textContent = message;
  detail.style.cssText = 'max-width:560px;color:#cbd5e1;line-height:1.5;';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Tentar novamente';
  retry.style.cssText = 'padding:11px 16px;border:1px solid #8b7be8;border-radius:8px;background:#35265a;color:#fff;font-weight:700;cursor:pointer;';
  retry.addEventListener('click', () => { void enterGame(userId); });
  screen.append(title, detail, retry);
  panel.replaceChildren(screen);
}

async function enterGame(userId: string): Promise<void> {
  if ((activeUserId === userId && campaign) || loadingUserId === userId) return;
  activeExpeditionId = null;
  loadingUserId = userId;
  activeUserId = userId;
  destroyGame();
  gameRoot.hidden = true;
  gameRoot.style.display = 'none';
  const loading = document.createElement('main');
  loading.style.cssText = 'min-height:100dvh;display:grid;place-items:center;padding:24px;box-sizing:border-box;background:#10131d;color:#fff;font-family:Arial,sans-serif;text-align:center;';
  loading.textContent = 'Carregando seus personagens...';
  panel.replaceChildren(loading);

  try {
    const playerData = await loadPlayerData(userId);
    if (activeUserId !== userId) return;
    playerNickname = playerData.nickname;
    playerHighestFloor = Math.max(1, playerData.highestFloor);
    const { data: gameMasterData, error: gameMasterError } = await supabase!.rpc('is_current_user_game_master');
    if (gameMasterError) throw new Error('Não foi possível verificar as permissões de Game Master. Confira se a migration de permissões GM foi aplicada: ' + gameMasterError.message);
    isGameMaster = gameMasterData === true;
    campaign = new Campaign(undefined, (event) => { void persistProgressionEvent(event); });
    campaign.loadPersistedCharacters(playerData.characters);
    campaign.loadPersistedInventory(playerData.inventory, playerData.gold, playerData.equipped);
    campaign.restorePartyFormation(playerData.partyFormation);
    void flushPendingProgressionEvents();

    const { data: activeData, error: activeError } = await supabase!.rpc('get_active_player_expedition');
    if (activeError) throw new Error('Não foi possível verificar sua expedição ativa: ' + activeError.message);
    const active = activeData as {
      active?: boolean;
      expired?: boolean;
      expedition_id?: string;
      state_snapshot?: unknown;
      snapshot_version?: number;
    } | null;

    if (active?.active && active.expedition_id) {
      if (active.snapshot_version !== 1 || !active.state_snapshot || !campaign.restoreSnapshot(active.state_snapshot)) {
        throw new Error('Existe uma expedição ativa, mas seu estado salvo está ausente ou incompatível. Nenhuma nova campanha foi iniciada para evitar apagar seu progresso.');
      }
      activeExpeditionId = active.expedition_id;
      launchExpeditionBattle(true);
      return;
    }

    activeExpeditionId = null;
    showPreparation();
    if (active?.expired) {
      window.alert('Sua expedição anterior foi encerrada como derrota por inatividade (mais de 10 minutos sem atividade). Agora você pode iniciar uma nova campanha.');
    }
  } catch (error) {
    if (activeUserId !== userId) return;
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao consultar o banco de dados.';
    showPlayerDataError(userId, message);
  } finally {
    if (loadingUserId === userId) loadingUserId = null;
  }
}

if (!supabase || !isSupabaseConfigured) {
  showAuth();
} else {
  void supabase.auth.getSession().then(({ data, error }) => {
    if (error) console.error('Falha ao recuperar sessão:', error.message);
    if (data.session) void enterGame(data.session.user.id);
    else showAuth();
  });

  const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      showAuth();
      return;
    }
    void enterGame(session.user.id);
  });

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      authListener.subscription.unsubscribe();
      destroyGame();
    });
  }
}

window.addEventListener('online', () => {
  void flushPendingProgressionEvents();
  void flushPendingExpeditionProgress();
});

// Evita jogos duplicados quando o Vite recarrega o módulo (HMR).
if (import.meta.hot && !supabase) {
  import.meta.hot.dispose(() => {
    destroyGame();
  });
}
