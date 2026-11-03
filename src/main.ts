import './style.css';
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './game/config';
import { Campaign } from './game/core/Campaign';
import type { ProgressionPersistenceEvent } from './game/core/GameState';
import { BattleScene } from './game/scenes/BattleScene';
import { SidePanel } from './ui/SidePanel';
import { PreparationScreen } from './ui/PreparationScreen';
import { AuthScreen } from './ui/AuthScreen';
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
let activeUserId: string | null = null;
let loadingUserId: string | null = null;
let playerNickname = 'JOGADOR';
let progressionSaveWarningShown = false;
let activeExpeditionId: string | null = null;
let expeditionFinishPending = false;
let lastExpeditionActivitySyncAt = 0;

const sessionControls = document.createElement('div');
sessionControls.style.cssText = 'position:fixed;top:10px;right:12px;z-index:3000;';
const signOutButton = document.createElement('button');
signOutButton.type = 'button';
signOutButton.textContent = 'Sair da conta';
signOutButton.style.cssText = 'padding:8px 12px;border:1px solid #8b7be8;border-radius:8px;background:#201a32;color:#fff;font-weight:700;cursor:pointer;';
signOutButton.addEventListener('click', async () => {
  if (!supabase) return;
  signOutButton.disabled = true;
  const { error } = await supabase.auth.signOut();
  if (error) {
    signOutButton.disabled = false;
    window.alert('Não foi possível sair: ' + error.message);
  }
});
sessionControls.append(signOutButton);
document.body.append(sessionControls);
sessionControls.hidden = true;

function destroyGame(): void {
  sidePanel?.destroy();
  sidePanel = null;
  game?.destroy(true);
  game = null;
  campaign = null;
}

function showAuth(): void {
  destroyGame();
  activeUserId = null;
  sessionControls.hidden = true;
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

function showPreparation(resetCampaign = false): void {
  if (!campaign) return;
  sidePanel?.destroy();
  sidePanel = null;
  game?.destroy(true);
  game = null;
  if (resetCampaign) campaign.restart(false);
  gameRoot.hidden = true;
  gameRoot.style.display = 'none';
  new PreparationScreen(panel, campaign, startExpedition, playerNickname, persistEquipmentChange);
  sessionControls.hidden = false;
}

async function persistProgressionEvent(event: ProgressionPersistenceEvent): Promise<void> {
  if (!supabase || !campaign) return;
  const characterId = campaign.getPersistedCharacterId(event.classId);
  if (!characterId) {
    console.error('Personagem sem ID persistido; evento de XP não foi salvo.');
    return;
  }

  try {
    const { error } = await supabase.rpc('apply_character_xp_event', {
      p_character_id: characterId,
      p_event_id: event.eventId,
      p_event_kind: event.kind,
      p_monster_max_hp: event.kind === 'kill' ? event.monsterMaxHp : null,
      p_monster_damage: event.kind === 'kill' ? event.monsterDamage : null,
      p_monster_rank: event.kind === 'kill' ? event.monsterRank : null,
    });
    if (error) throw error;
  } catch (error) {
    console.error('Falha ao salvar evento de progressão:', error);
    if (!progressionSaveWarningShown) {
      progressionSaveWarningShown = true;
      window.alert('Não foi possível salvar uma alteração de XP no servidor. Evite atualizar ou fechar o jogo até verificar sua conexão; o progresso desta sessão pode não ter sido sincronizado.');
    }
  }
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

async function persistExpeditionFloor(floor: number): Promise<void> {
  if (!supabase || !activeExpeditionId) return;
  const { error } = await supabase.rpc('update_player_expedition_progress', {
    p_expedition_id: activeExpeditionId,
    p_current_floor: floor,
  });
  if (error) {
    console.error('Falha ao atualizar o andar da expedição:', error);
    window.alert('Não foi possível sincronizar o andamento da expedição. Verifique sua conexão.');
  }
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

  if (!campaign.extract()) {
    expeditionFinishPending = false;
    window.alert('O servidor registrou a extração, mas o estado local não conseguiu concluir o retorno. Recarregue a página para sincronizar seus dados.');
    return;
  }

  activeExpeditionId = null;
  expeditionFinishPending = false;
  showPreparation(true);
}

async function finishExpeditionAndReturn(): Promise<void> {
  if (!campaign || !supabase || !activeExpeditionId || expeditionFinishPending) return;
  if (campaign.status !== 'defeated' || campaign.lastExpeditionResult !== 'combat_defeat') {
    window.alert('Não foi possível identificar o resultado da expedição. Seus dados não foram encerrados.');
    return;
  }

  expeditionFinishPending = true;
  while (activeExpeditionId) {
    const { error } = await supabase.rpc('finish_player_expedition', {
      p_expedition_id: activeExpeditionId,
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

  activeExpeditionId = null;
  expeditionFinishPending = false;
  showPreparation(true);
}

async function startExpedition(): Promise<void> {
  if (!campaign || !supabase || activeExpeditionId) return;
  const characterIds = campaign.getActivePersistedCharacterIds();
  if (characterIds.length !== campaign.activeParty.length) {
    window.alert('Não foi possível identificar todos os personagens selecionados no banco de dados.');
    return;
  }

  const { data: expeditionId, error } = await supabase.rpc('start_player_expedition', {
    p_character_ids: characterIds,
  });
  if (error || !expeditionId) {
    console.error('Falha ao iniciar expedição:', error);
    window.alert(error?.message.includes('expedição ativa')
      ? 'Sua conta já possui uma expedição ativa. Atualize a página ou entre em contato com o suporte.'
      : 'Não foi possível registrar sua expedição no servidor. Tente novamente.');
    return;
  }

  activeExpeditionId = expeditionId as string;
  expeditionFinishPending = false;
  lastExpeditionActivitySyncAt = 0;
  panel.replaceChildren();
  gameRoot.hidden = false;
  gameRoot.style.display = '';
  sidePanel = new SidePanel(panel, campaign, () => { void finishExpeditionAndReturn(); }, persistAttributeAllocation, (floor) => { void persistExpeditionFloor(floor); }, syncExpeditionActivity, extractExpeditionAndReturn);
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
    scene: [new BattleScene(campaign)],
  });
}

function showPlayerDataError(userId: string, message: string): void {
  destroyGame();
  activeUserId = null;
  sessionControls.hidden = true;
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
  loadingUserId = userId;
  activeUserId = userId;
  destroyGame();
  sessionControls.hidden = true;
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
    campaign = new Campaign(undefined, (event) => { void persistProgressionEvent(event); });
    campaign.loadPersistedCharacters(playerData.characters);
    campaign.loadPersistedInventory(playerData.inventory, playerData.gold, playerData.equipped);
    showPreparation();
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
      sessionControls.remove();
    });
  }
}

// Evita jogos duplicados quando o Vite recarrega o módulo (HMR).
if (import.meta.hot && !supabase) {
  import.meta.hot.dispose(() => {
    destroyGame();
    sessionControls.remove();
  });
}
