import './style.css';
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './game/config';
import { Campaign } from './game/core/Campaign';
import { BattleScene } from './game/scenes/BattleScene';
import { SidePanel } from './ui/SidePanel';
import { PreparationScreen } from './ui/PreparationScreen';
import { AuthScreen } from './ui/AuthScreen';
import { isSupabaseConfigured, supabase } from './lib/supabase';

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
let authScreen: AuthScreen | null = null;
let activeUserId: string | null = null;

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
  authScreen = new AuthScreen(panel);
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
  new PreparationScreen(panel, campaign, startExpedition);
  sessionControls.hidden = false;
}

function startExpedition(): void {
  if (!campaign) return;
  panel.replaceChildren();
  gameRoot.hidden = false;
  gameRoot.style.display = '';
  sidePanel = new SidePanel(panel, campaign, () => showPreparation(true));
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

function enterGame(userId: string): void {
  if (activeUserId === userId && campaign) return;
  activeUserId = userId;
  destroyGame();
  campaign = new Campaign();
  showPreparation();
}

if (!supabase || !isSupabaseConfigured) {
  showAuth();
} else {
  void supabase.auth.getSession().then(({ data, error }) => {
    if (error) console.error('Falha ao recuperar sessão:', error.message);
    if (data.session) enterGame(data.session.user.id);
    else showAuth();
  });

  const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      showAuth();
      return;
    }
    enterGame(session.user.id);
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
