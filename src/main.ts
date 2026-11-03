import './style.css';
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './game/config';
import { Campaign } from './game/core/Campaign';
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

function showPreparation(resetCampaign = false): void {
  if (!campaign) return;
  sidePanel?.destroy();
  sidePanel = null;
  game?.destroy(true);
  game = null;
  if (resetCampaign) campaign.restart(false);
  gameRoot.hidden = true;
  gameRoot.style.display = 'none';
  new PreparationScreen(panel, campaign, startExpedition, playerNickname);
  sessionControls.hidden = false;
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

function startExpedition(): void {
  if (!campaign) return;
  panel.replaceChildren();
  gameRoot.hidden = false;
  gameRoot.style.display = '';
  sidePanel = new SidePanel(panel, campaign, () => showPreparation(true), persistAttributeAllocation);
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
    campaign = new Campaign();
    campaign.loadPersistedCharacters(playerData.characters);
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
