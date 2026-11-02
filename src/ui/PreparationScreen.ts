import type { Campaign } from '../game/core/Campaign';
import type { EquipmentSlot, Position, Unit } from '../game/types';
import { ITEM_DEFINITIONS } from '../game/data/items';
import { MONSTER_DEFINITIONS, HARPY, SATYR, CYCLOPS, GORGON, MINOTAUR, UNDERWORLD_HOUND, UNDERWORLD_WRAITH, CARD_SOLDIER, WHITE_RABBIT, GIANT_CATERPILLAR, MAD_MUSHROOM, THORN_PLANT } from '../game/data/monsters';
import { GOBLIN_CHIEF, ABYSS_IDOL, CRIMSON_COUNTESS, DRACULA, MEDUSA, HADES, CHESHIRE_CAT, QUEEN_OF_HEARTS } from '../game/data/bosses';
import warriorSprite from '../assets/sprites/warrior.png';
import assassinSprite from '../assets/sprites/assassin.png';
import archerSprite from '../assets/sprites/archer.png';
import mageSprite from '../assets/sprites/mage.png';
import clericSprite from '../assets/sprites/cleric.png';
const PORTRAITS = import.meta.glob('../assets/portraits/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const PLAYER_ICONS = import.meta.glob('../assets/icons/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const CLASS_PORTRAITS: Record<string, string> = Object.fromEntries(Object.entries(PORTRAITS).map(([path, url]) => [path.split('/').pop()?.replace(/^portrait-/, '').replace(/\.[^.]+$/, ''), url]));

const HERO_SPRITES: Record<string, string> = {
  warrior: warriorSprite,
  assassin: assassinSprite,
  archer: archerSprite,
  mage: mageSprite,
  cleric: clericSprite,
};


const SLOTS: Array<{ id: EquipmentSlot; label: string }> = [
  { id: 'chest', label: 'Peitoral' }, { id: 'boots', label: 'Bota' },
  { id: 'helmet', label: 'Capacete' }, { id: 'amulet', label: 'Amuleto' },
  { id: 'weapon', label: 'Arma' }, { id: 'off-hand', label: 'Mão secundária' },
  { id: 'ring', label: 'Anel' },
];
const STYLE = {
  card: 'padding:12px;border:1px solid #394150;border-radius:10px;background:#151d2b;color:#f3f4f6;',
  button: 'padding:10px;border:1px solid #475569;border-radius:8px;background:#202b3d;color:#f3f4f6;cursor:pointer;',
};

export class PreparationScreen {
  private selectedHero: Unit;
  private readonly selectedUids = new Set<string>();
  private readonly positions = new Map<string, Position>();
  private readonly root: HTMLElement;
  private readonly campaign: Campaign;
  private readonly onStart: () => void;
  private message = '';
  private inventoryOpen = false;
  private inventoryRangeFilter: number | null | 'unknown' = null;
  private inventorySlotFilter: EquipmentSlot | 'all' = 'all';
  private inventoryClassFilter: 'all' | 'warrior' | 'assassin' | 'mage' | 'cleric' | 'archer' = 'all';
  private inventoryRarityFilter: 'all' | 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' = 'all';
  private inventorySort: 'floor-asc' | 'floor-desc' | 'rarity-desc' | 'rarity-asc' = 'floor-desc';
  private devUnlocked = false;
  private devPanelOpen = false;

  constructor(root: HTMLElement, campaign: Campaign, onStart: () => void) {
    this.root = root;
    this.campaign = campaign;
    this.onStart = onStart;
    const available = campaign.party.filter((hero) => hero.hp > 0);
    const initialParty = campaign.activeParty.filter((hero) => hero.hp > 0).slice(0, 3);
    for (const hero of initialParty) this.selectedUids.add(hero.uid);
    if (this.selectedUids.size === 0) available.slice(0, 3).forEach((hero) => this.selectedUids.add(hero.uid));
    this.selectedHero = available.find((hero) => this.selectedUids.has(hero.uid)) ?? available[0] ?? campaign.party[0];
    available.forEach((hero, index) => this.positions.set(hero.uid, { col: index % 6, row: 2 }));
    this.render();
  }

  private render(): void {
    const page = document.createElement('main');
    page.className = 'preparation-screen';
    page.style.cssText = '';
    const eyebrow = document.createElement('p');
    eyebrow.textContent = 'KILL CULT MMO · BASE DE OPERAÇÕES';
    eyebrow.style.cssText = 'color:#a78bfa;font-weight:800;letter-spacing:.16em;font-size:.75rem;margin:0 0 8px;';
    const headingRow = document.createElement('div');
    headingRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;';
    const heading = document.createElement('h1');
    heading.textContent = 'BASE DE OPERAÇÕES';
    heading.style.cssText = 'font-size:clamp(2rem,4vw,3rem);margin:0;';
    const devButton = document.createElement('button');
    devButton.type = 'button';
    devButton.textContent = '⚙ Dev Mode';
    devButton.style.cssText = 'padding:9px 13px;border:1px solid #8b7be8;border-radius:8px;background:#25233d;color:#fff;font-weight:800;cursor:pointer;';
    headingRow.append(heading, devButton);
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Monte sua equipe, prepare os equipamentos e escolha sua formação.';
    subtitle.style.cssText = 'color:#aeb8c8;line-height:1.4;margin:6px 0 12px;max-width:760px;';
    const goldBalance = document.createElement('div');
    goldBalance.textContent = `🪙 Ouro disponível: ${this.campaign.gold}`;
    goldBalance.style.cssText = 'display:inline-flex;align-items:center;padding:8px 12px;margin:0 0 12px;border:1px solid #a16207;border-radius:9px;background:#422006;color:#fde68a;font-weight:800;';
    const profile=document.createElement('section'); profile.className='prep-profile';
    const iconFiles=Object.entries(PLAYER_ICONS).sort(([a],[b])=>a.localeCompare(b, undefined, { numeric: true }));
    const chosenIcon=Number(localStorage.getItem('killcult-player-icon')||'1');
    const avatar=document.createElement('img'); avatar.className='prep-avatar'; avatar.alt='Ícone do jogador'; avatar.src=iconFiles[Math.max(0,Math.min(iconFiles.length-1,chosenIcon-1))]?.[1]||'';
    const profileInfo=document.createElement('div'); const playerName=document.createElement('strong'); playerName.textContent='NOME DO JOGADOR · EM BREVE'; playerName.style.cssText='display:block;color:#ffe16b;font-size:clamp(1.1rem,2vw,1.8rem);letter-spacing:.08em;';
    const worldLevel=this.campaign.party.reduce((sum,hero)=>sum+(hero.progression?.level??1),0); const levelLine=document.createElement('div'); levelLine.textContent=`ANDAR ${this.campaign.floorNumber} · NÍVEL MUNDIAL ${worldLevel}`; levelLine.style.cssText='color:#ffe16b;font-size:.75rem;margin-top:5px;';
    const settings=document.createElement('button'); settings.type='button'; settings.textContent='⚙ Configurações'; settings.style.cssText=STYLE.button+'margin-top:6px;padding:5px 10px;';
    const settingsModal=document.createElement('div'); settingsModal.className='prep-modal'; settingsModal.hidden=true; const settingsCard=document.createElement('div'); settingsCard.className='prep-modal-card'; const settingsTitle=document.createElement('h2'); settingsTitle.textContent='Escolha seu ícone'; const iconGrid=document.createElement('div'); iconGrid.className='prep-icons';
    iconFiles.forEach(([,url],index)=>{const img=document.createElement('img');img.src=url;img.alt='Ícone '+(index+1);img.title='Selecionar ícone '+(index+1);img.addEventListener('click',()=>{localStorage.setItem('killcult-player-icon',String(index+1));avatar.src=url;settingsModal.hidden=true;});iconGrid.append(img);});
    const closeSettings=document.createElement('button');closeSettings.type='button';closeSettings.textContent='Fechar';closeSettings.style.cssText=STYLE.button+'margin-top:12px;';closeSettings.addEventListener('click',()=>settingsModal.hidden=true);settingsModal.addEventListener('click',e=>{if(e.target===settingsModal)settingsModal.hidden=true;});settings.addEventListener('click',()=>settingsModal.hidden=false);
    settingsCard.append(settingsTitle,iconGrid,closeSettings);settingsModal.append(settingsCard);profileInfo.append(playerName,levelLine,settings);profile.append(avatar,profileInfo);
    page.append(profile,settingsModal);

    const devPanel = document.createElement('section');
    devPanel.hidden = true;
    devPanel.style.cssText = 'display:none;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin:0 0 14px;padding:12px;border:1px solid #8b7be8;border-radius:10px;background:#111827;';
    const devFeedback = document.createElement('p');
    devFeedback.style.cssText = 'grid-column:1/-1;margin:0;color:#c4b5fd;font-size:.85rem;';
    const devDialog = document.createElement('div');
    devDialog.style.cssText = 'position:fixed;inset:0;z-index:2000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(2,6,23,.82);';
    const devDialogCard = document.createElement('form');
    devDialogCard.style.cssText = 'width:min(520px,100%);padding:16px;border:1px solid #8b7be8;border-radius:10px;background:#0f172a;color:#f8fafc;box-shadow:0 20px 70px #000a;';
    const devDialogTitle = document.createElement('h2');
    devDialogTitle.style.cssText = 'margin:0 0 10px;font-size:1.1rem;';
    const devDialogHint = document.createElement('p');
    devDialogHint.style.cssText = 'margin:0 0 10px;color:#cbd5e1;font-size:.85rem;white-space:pre-wrap;max-height:35vh;overflow:auto;';
    const devDialogInput = document.createElement('input');
    devDialogInput.style.cssText = 'box-sizing:border-box;width:100%;padding:10px;border:1px solid #64748b;border-radius:7px;background:#111827;color:white;margin-bottom:12px;';
    const devDialogActions = document.createElement('div');
    devDialogActions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';
    const devCancel = document.createElement('button');
    devCancel.type = 'button'; devCancel.textContent = 'Cancelar'; devCancel.style.cssText = STYLE.button;
    const devConfirm = document.createElement('button');
    devConfirm.type = 'submit'; devConfirm.textContent = 'Confirmar'; devConfirm.style.cssText = STYLE.button + 'background:#5b21b6;';
    devDialogActions.append(devCancel, devConfirm);
    devDialogCard.append(devDialogTitle, devDialogHint, devDialogInput, devDialogActions);
    devDialog.append(devDialogCard);
    page.append(devPanel, devDialog);
    let dialogCallback: ((value: string) => void) | null = null;
    const askDev = (title: string, initial: string, callback: (value: string) => void, hint = '', inputType = 'text'): void => {
      devDialogTitle.textContent = title;
      devDialogHint.textContent = hint;
      devDialogHint.hidden = !hint;
      devDialogInput.type = inputType;
      devDialogInput.value = initial;
      dialogCallback = callback;
      devDialog.style.display = 'flex';
      devDialogInput.focus();
      devDialogInput.select();
    };
    const closeDevDialog = (): void => { devDialog.style.display = 'none'; dialogCallback = null; };
    devCancel.addEventListener('click', closeDevDialog);
    devDialog.addEventListener('click', (event) => { if (event.target === devDialog) closeDevDialog(); });
    devDialogCard.addEventListener('submit', (event) => {
      event.preventDefault();
      const callback = dialogCallback;
      const value = devDialogInput.value;
      closeDevDialog();
      callback?.(value);
    });
    devButton.addEventListener('click', () => {
      if (!this.devUnlocked) {
        askDev('Acesso ao Dev Mode', '', (password) => {
          if (password !== 'BeatrizL@nd1s!') {
            devFeedback.textContent = 'Senha incorreta.';
            return;
          }
          this.devUnlocked = true;
          this.devPanelOpen = true;
          devPanel.hidden = false;
          devPanel.style.display = 'grid';
          devFeedback.textContent = 'Dev Mode desbloqueado.';
        }, 'Digite a senha de desenvolvedor.', 'password');
        return;
      }
      this.devPanelOpen = !this.devPanelOpen;
      devPanel.hidden = !this.devPanelOpen;
      devPanel.style.display = this.devPanelOpen ? 'grid' : 'none';
    });
    const devAction = (label: string, action: () => void): void => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.style.cssText = STYLE.button + 'text-align:left;font-weight:700;';
      button.addEventListener('click', action);
      devPanel.append(button);
    };
    devAction('Pular para andar…', () => askDev('Pular para andar', String(this.campaign.floorNumber), (raw) => {
      const floor = Number(raw);
      if (!this.campaign.debugJumpToFloor(floor)) devFeedback.textContent = 'Número de andar inválido.';
      else { devFeedback.textContent = `Campanha movida para o andar ${floor}.`; this.render(); }
    }, `Informe um andar entre 1 e ${this.campaign.totalFloors}.`, 'number'));
    devAction('Adicionar ouro…', () => askDev('Adicionar ou remover ouro', '100', (raw) => {
      const amount = Number(raw);
      if (!Number.isFinite(amount)) { devFeedback.textContent = 'Quantidade inválida.'; return; }
      this.campaign.debugAddGold(amount);
      devFeedback.textContent = `Ajuste de ouro aplicado: ${amount}.`;
      this.render();
    }, 'Use um número negativo para remover ouro.', 'number'));
    devAction('Adicionar item…', () => askDev('Adicionar item ao inventário', '', (id) => {
      if (!id.trim()) return;
      if (!this.campaign.debugAddItem(id.trim())) devFeedback.textContent = 'ID de item inválido.';
      else { devFeedback.textContent = `Item ${id.trim()} adicionado.`; this.render(); }
    }, 'IDs disponíveis:\\n' + Object.keys(ITEM_DEFINITIONS).join(', ')));
    devAction('Curar todos os heróis', () => { this.campaign.battle.debugHealHeroes(); devFeedback.textContent = 'Heróis curados.'; this.render(); });
    devAction('Definir nível do herói…', () => {
      const hero = this.campaign.party.find((unit) => unit.uid === this.selectedHero.uid);
      if (!hero) return;
      askDev(`Nível de ${hero.definition.name}`, String(hero.progression?.level ?? 1), (raw) => {
        const level = Number(raw);
        if (!this.campaign.debugSetHeroLevel(hero.uid, level)) devFeedback.textContent = 'Nível inválido.';
        else { devFeedback.textContent = `Nível de ${hero.definition.name} atualizado.`; this.render(); }
      }, 'Informe um nível entre 1 e 999.', 'number');
    });
    devAction('Escolher monstros/chefes…', () => {
      const catalog = [...MONSTER_DEFINITIONS, HARPY, SATYR, CYCLOPS, GORGON, MINOTAUR, UNDERWORLD_HOUND, UNDERWORLD_WRAITH, CARD_SOLDIER, WHITE_RABBIT, GIANT_CATERPILLAR, MAD_MUSHROOM, THORN_PLANT, GOBLIN_CHIEF, ABYSS_IDOL, CRIMSON_COUNTESS, DRACULA, MEDUSA, HADES, CHESHIRE_CAT, QUEEN_OF_HEARTS];
      askDev('Escolher monstros e chefes', this.campaign.floor.monsters.map((m) => m.id).join(','), (raw) => {
        const selected = raw.split(',').map((id) => catalog.find((m) => m.id === id.trim())).filter((m): m is typeof catalog[number] => Boolean(m));
        if (!this.campaign.debugSetMonsters(selected)) devFeedback.textContent = 'Seleção inválida. Confira os IDs e a quantidade (1–12).';
        else { devFeedback.textContent = 'Encontro personalizado aplicado.'; this.render(); }
      }, 'Digite IDs separados por vírgula:\\n' + catalog.map((m) => `${m.id} — ${m.name}`).join('\\n'));
    });
    devAction('Forçar vitória', () => { this.campaign.battle.debugSetOutcome('victory'); devFeedback.textContent = 'Vitória forçada.'; this.render(); });
    devAction('Forçar derrota', () => { this.campaign.battle.debugSetOutcome('defeat'); devFeedback.textContent = 'Derrota forçada.'; this.render(); });
    const extractionLabel = document.createElement('label');
    extractionLabel.style.cssText = 'display:flex;align-items:center;gap:8px;color:#e2e8f0;font-size:.9rem;';
    const extractionToggle = document.createElement('input');
    extractionToggle.type = 'checkbox';
    extractionToggle.checked = this.campaign.debugExtractionEnabled;
    extractionToggle.addEventListener('change', () => this.campaign.debugToggleExtraction(extractionToggle.checked));
    extractionLabel.append(extractionToggle, document.createTextNode('Permitir extração fora dos marcos'));
    devPanel.append(extractionLabel, devFeedback);
    page.append(devPanel);

    const columns = document.createElement('div');
    columns.className='prep-layout'; columns.style.cssText='';
    const left = document.createElement('section');
    left.className='prep-menu'; left.style.cssText='';
    const gameTitle = document.createElement('h1');
    gameTitle.className = 'prep-game-title';
    gameTitle.textContent = 'KILLcult MMO';
    const rosterTitle = document.createElement('h2');
    rosterTitle.textContent = 'MENU';
    rosterTitle.style.cssText = 'margin:0 0 6px;font-size:1.15rem;';
    const rosterHint = document.createElement('p');
    rosterHint.textContent = '';
    rosterHint.style.cssText = 'color:#94a3b8;font-size:.85rem;line-height:1.4;margin:0 0 12px;';
    const roster = document.createElement('div');
    roster.style.cssText='display:grid;gap:10px;';
    for (const label of ['Guildas','Itens','PVP','Mercado Global','Eventos','Configuração']) { const button=document.createElement('button'); button.type='button'; button.textContent=label; button.addEventListener('click',()=>{if(label==='Itens'){this.inventoryOpen=true;this.render();}else if(label==='Configuração'){settingsModal.hidden=false;}else{this.message=label+' · EM BREVE';this.render();}}); roster.append(button); }
    left.append(gameTitle, rosterTitle, roster, devButton); devButton.className='prep-dev-button';

    const right = document.createElement('div');
    right.className='prep-right'; right.style.cssText='';
    const boardCard = document.createElement('section');
    boardCard.style.cssText=''; boardCard.className='prep-board';
    const board = document.createElement('div');
    board.className = 'prep-board-grid';
    board.style.cssText='';
    for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++) {
      const occupant = [...this.selectedUids].map((uid) => this.campaign.party.find((hero) => hero.uid === uid)!).find((hero) => {
        const pos = this.positions.get(hero.uid);
        return pos?.col === col && pos?.row === row;
      });
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.title = occupant ? `${occupant.definition.name} · clique para ver equipamentos e inventário` : `Coluna ${col + 1}, linha ${row + 1}`;
      cell.style.cssText = `display:flex;align-items:center;justify-content:center;aspect-ratio:1;overflow:hidden;padding:2px;border:1px solid ${occupant?.uid === this.selectedHero.uid ? '#facc15' : occupant ? '#8b5cf6' : '#394150'};border-radius:6px;background:${occupant ? '#293449' : row >= 3 ? '#263244' : '#101723'};color:white;font-weight:800;cursor:pointer;`;
      if (occupant) {
        const sprite = HERO_SPRITES[occupant.definition.id];
        if (sprite) {
          const image = document.createElement('img');
          image.src = sprite;
          image.alt = occupant.definition.name;
          image.draggable = false;
          image.style.cssText = 'display:block;width:100%;height:100%;max-width:64px;max-height:64px;object-fit:contain;pointer-events:none;image-rendering:pixelated;';
          cell.append(image);
        } else {
          cell.textContent = occupant.definition.name.slice(0, 2).toUpperCase();
        }
      } else {
        cell.textContent = '·';
      }
      cell.disabled = false;
      cell.addEventListener('click', () => {
        // Clicar no sprite seleciona esse herói; o painel de equipamento/inventário acompanha a seleção.
        if (occupant) {
          this.selectedHero = occupant;
          this.message = '';
          this.render();
          return;
        }
        const collision = [...this.selectedUids].map((uid) => this.positions.get(uid)).some((pos) => pos && pos.col === col && pos.row === row && !(pos.col === this.positions.get(this.selectedHero.uid)?.col && pos.row === this.positions.get(this.selectedHero.uid)?.row));
        if (collision) { this.message = 'Essa casa já está ocupada por outro herói.'; this.render(); return; }
        this.positions.set(this.selectedHero.uid, { col, row });
        this.message = '';
        this.render();
      });
      board.append(cell);
    }
    boardCard.append(board);
    right.append(boardCard);
    const heroStrip=document.createElement('section');heroStrip.className='prep-heroes';
    for(const hero of this.campaign.party){const chosen=this.selectedUids.has(hero.uid);const card=document.createElement('article');card.className='prep-hero';card.style.borderColor=chosen?'#ffe16b':'#80664e';
      const portrait=document.createElement('img');portrait.src=CLASS_PORTRAITS[hero.definition.id]||HERO_SPRITES[hero.definition.id];portrait.alt=hero.definition.name;portrait.title=hero.definition.name;portrait.addEventListener('click',()=>{this.selectedHero=hero;this.render();});card.append(portrait);
      const title=document.createElement('div');title.textContent=hero.definition.name+' · Nv. '+(hero.progression?.level??1);title.style.cssText='font-size:.75rem;color:#ffe16b;padding:4px;';card.append(title);
      const actions=document.createElement('div');actions.className='prep-hero-actions';
      const add=document.createElement('button');add.type='button';add.textContent=chosen?'Remover':'Adicionar';add.style.cssText=STYLE.button;add.disabled=hero.hp<=0||(!chosen&&this.selectedUids.size>=3);add.addEventListener('click',()=>{if(chosen){if(this.selectedUids.size>1)this.selectedUids.delete(hero.uid);else this.message='A equipe precisa ter pelo menos um herói.';}else{this.selectedUids.add(hero.uid);this.selectedHero=hero;const pos=this.findFreePosition();if(pos)this.positions.set(hero.uid,pos);}this.render();});
      const inv=document.createElement('button');inv.type='button';inv.textContent='Inventário';inv.style.cssText=STYLE.button;inv.addEventListener('click',()=>{this.selectedHero=hero;this.inventoryOpen=true;this.render();});
      const attrs=document.createElement('button');attrs.type='button';attrs.textContent='Atributos';attrs.style.cssText=STYLE.button;attrs.addEventListener('click',()=>{this.selectedHero=hero;const p=hero.progression;const modal=document.createElement('div');modal.className='prep-modal';const dialog=document.createElement('div');dialog.className='prep-modal-card';const title=document.createElement('h2');title.textContent='Atributos · '+hero.definition.name;const level=document.createElement('p');level.textContent='Nível '+(p?.level??1)+' · '+(p?.unspentAttributePoints??0)+' ponto(s) disponíveis';const stats=document.createElement('div');stats.style.cssText='display:grid;gap:8px;margin:14px 0;';for(const [label,value] of [['Força',p?.attributes.strength??0],['Vitalidade',p?.attributes.vitality??0],['Defesa',p?.attributes.defense??0],['Vida',hero.hp+'/'+hero.maxHp],['Dano',String(hero.damage)]]){const row=document.createElement('div');row.style.cssText='display:flex;justify-content:space-between;padding:9px;background:#101723;border-radius:6px;';const a=document.createElement('span');a.textContent=String(label);const b=document.createElement('strong');b.textContent=String(value);row.append(a,b);stats.append(row);}const note=document.createElement('p');note.textContent='A distribuição de pontos continua disponível durante a expedição, pelo painel de atributos do combate.';note.style.cssText='color:#cbd5e1;font-size:.85rem;';const close=document.createElement('button');close.type='button';close.textContent='Fechar';close.style.cssText=STYLE.button;close.addEventListener('click',()=>modal.remove());dialog.append(title,level,stats,note,close);modal.append(dialog);modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});document.body.append(modal);});
      actions.append(add,inv,attrs);card.append(actions);heroStrip.append(card);
    }
    right.append(heroStrip);

    const equipmentCard = document.createElement('section');
    equipmentCard.className = 'inventory-window-content';
    equipmentCard.style.cssText = STYLE.card;
    const equipmentTitle = document.createElement('h2');
    equipmentTitle.textContent = `Equipamentos · ${this.selectedHero.definition.name}`;
    equipmentTitle.style.cssText = 'margin:0 0 10px;font-size:1.15rem;';
    const slots = document.createElement('div');
    slots.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;';
    for (const slot of SLOTS) {
      const card = document.createElement('div');
      card.style.cssText = 'padding:8px;border:1px dashed #475569;border-radius:7px;background:#101723;';
      const equippedId = this.selectedHero.equipment?.[slot.id];
      const name = equippedId ? (ITEM_DEFINITIONS[this.campaign.inventory.definitionOf(equippedId) ?? '']?.name ?? 'Item') : 'Vazio';
      const label = document.createElement('div');
      label.textContent = slot.label;
      label.style.cssText = 'font-size:.75rem;color:#94a3b8;';
      const value = document.createElement('strong');
      value.textContent = name;
      value.style.cssText = 'font-size:.85rem;';
      card.append(label, value);
      if (equippedId) {
        const remove = document.createElement('button');
        remove.type = 'button'; remove.textContent = 'Remover'; remove.style.cssText = STYLE.button + 'display:block;margin-top:6px;padding:5px 8px;font-size:.75rem;';
        remove.addEventListener('click', () => { this.campaign.inventory.unequip(this.selectedHero, slot.id); this.render(); });
        card.append(remove);
      }
      slots.append(card);
    }
    const inventoryTitle = document.createElement('h3');
    inventoryTitle.textContent = 'Inventário disponível';
    inventoryTitle.style.cssText = 'font-size:.9rem;margin:14px 0 8px;color:#cbd5e1;';
    const filterGrid = document.createElement('div');
    filterGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:7px;margin-bottom:10px;';
    const makeFilter = (label: string, value: string, options: Array<{ value: string; label: string }>, onChange: (value: string) => void): HTMLSelectElement => {
      const wrapper = document.createElement('label');
      wrapper.style.cssText = 'display:grid;gap:4px;color:#94a3b8;font-size:.72rem;font-weight:700;';
      const caption = document.createElement('span');
      caption.textContent = label;
      const select = document.createElement('select');
      select.setAttribute('aria-label', label);
      select.style.cssText = STYLE.button + 'width:100%;min-width:0;padding:8px;font-size:.78rem;';
      for (const option of options) {
        const element = document.createElement('option');
        element.value = option.value;
        element.textContent = option.label;
        select.append(element);
      }
      select.value = value;
      select.addEventListener('change', () => onChange(select.value));
      wrapper.append(caption, select);
      filterGrid.append(wrapper);
      return select;
    };
    makeFilter('Tipo de equipamento', this.inventorySlotFilter, [
      { value: 'all', label: 'Todos os tipos' },
      ...SLOTS.map((slot) => ({ value: slot.id, label: slot.label })),
    ], (value) => {
      this.inventorySlotFilter = value === 'all' ? 'all' : value as EquipmentSlot;
      this.render();
    });
    makeFilter('Classe compatível', this.inventoryClassFilter, [
      { value: 'all', label: 'Todas as classes' },
      { value: 'warrior', label: 'Guerreiro' },
      { value: 'assassin', label: 'Assassino' },
      { value: 'mage', label: 'Mago' },
      { value: 'cleric', label: 'Clérigo' },
      { value: 'archer', label: 'Arqueiro' },
    ], (value) => {
      this.inventoryClassFilter = value as typeof this.inventoryClassFilter;
      this.render();
    });
    makeFilter('Faixa de obtenção', this.inventoryRangeFilter === null ? 'all' : String(this.inventoryRangeFilter), [
      { value: 'all', label: 'Todas as faixas' },
      ...Array.from({ length: 10 }, (_, index) => ({
        value: String(index + 1),
        label: `Faixa ${index + 1} · Andares ${index * 10 + 1}–${(index + 1) * 10}`,
      })),
      { value: 'unknown', label: 'Origem desconhecida' },
    ], (value) => {
      this.inventoryRangeFilter = value === 'all' ? null : value === 'unknown' ? 'unknown' : Number(value);
      this.render();
    });
    makeFilter('Raridade', this.inventoryRarityFilter, [
      { value: 'all', label: 'Todas as raridades' },
      { value: 'common', label: 'Comum' },
      { value: 'rare', label: 'Raro' },
      { value: 'epic', label: 'Épico' },
      { value: 'legendary', label: 'Lendário' },
      { value: 'mythic', label: 'Mítico' },
    ], (value) => {
      this.inventoryRarityFilter = value as typeof this.inventoryRarityFilter;
      this.render();
    });
    makeFilter('Organizar por', this.inventorySort, [
      { value: 'floor-desc', label: 'Faixa: mais recente' },
      { value: 'floor-asc', label: 'Faixa: mais antiga' },
      { value: 'rarity-desc', label: 'Raridade: melhores primeiro' },
      { value: 'rarity-asc', label: 'Raridade: comuns primeiro' },
    ], (value) => {
      this.inventorySort = value as typeof this.inventorySort;
      this.render();
    });
    const items = document.createElement('div');
    items.style.cssText = 'display:grid;gap:6px;';
    const filteredItems = [...this.campaign.inventory.items]
      .filter((item) => {
        const def = ITEM_DEFINITIONS[item.definitionId];
        if (!def) return false;
        if ((this.selectedHero.progression?.level ?? 1) < (def.minLevel ?? 1)) return false;
        if (def.allowedClasses && !def.allowedClasses.includes(this.selectedHero.definition.id as 'warrior'|'assassin'|'mage'|'cleric'|'archer')) return false;
        if (this.inventorySlotFilter !== 'all' && def.slot !== this.inventorySlotFilter) return false;
        if (this.inventoryRarityFilter !== 'all' && (def.rarity ?? 'common') !== this.inventoryRarityFilter) return false;
        if (this.inventoryClassFilter !== 'all' && def.allowedClasses && !def.allowedClasses.includes(this.inventoryClassFilter)) return false;
        if (this.inventoryClassFilter !== 'all' && !def.allowedClasses && def.slot === 'off-hand' && this.inventoryClassFilter === 'archer') return false;
        if (this.inventoryRangeFilter === 'unknown' && item.obtainedAtFloor !== undefined) return false;
        if (typeof this.inventoryRangeFilter === 'number') {
          if (item.obtainedAtFloor === undefined) return false;
          const firstFloor = (this.inventoryRangeFilter - 1) * 10 + 1;
          if (item.obtainedAtFloor < firstFloor || item.obtainedAtFloor > firstFloor + 9) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const floorA = a.obtainedAtFloor ?? 0;
        const floorB = b.obtainedAtFloor ?? 0;
        const rarityOrder: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
        const rarityA = rarityOrder[ITEM_DEFINITIONS[a.definitionId]?.rarity ?? 'common'] ?? 0;
        const rarityB = rarityOrder[ITEM_DEFINITIONS[b.definitionId]?.rarity ?? 'common'] ?? 0;
        if (this.inventorySort === 'rarity-desc') return rarityB - rarityA || floorB - floorA;
        if (this.inventorySort === 'rarity-asc') return rarityA - rarityB || floorB - floorA;
        return this.inventorySort === 'floor-asc' ? floorA - floorB : floorB - floorA;
      });
    for (const item of filteredItems) {
      const def = ITEM_DEFINITIONS[item.definitionId];
      if (!def) continue;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;align-items:stretch;';
      const button = document.createElement('button');
      button.type = 'button';
      const bonus = Object.entries(def.bonuses).map(([key, amount]) => `${key === 'strength' ? 'Força' : key === 'vitality' ? 'Vitalidade' : 'Defesa'} +${amount}`).join(' · ');
      const special = def.defensePercent ? `Defesa +${def.defensePercent}%` : def.lifestealPercent ? `Vampirismo ${def.lifestealPercent}%` : '';
      const origin = item.obtainedAtFloor === undefined ? 'Origem antiga/desconhecida' : `Obtido no andar ${item.obtainedAtFloor}`;
      const rarity = def.rarity ?? 'common';
      const rarityLabels: Record<string, string> = { common: 'COMUM', rare: 'RARO', epic: 'ÉPICO', legendary: 'LENDÁRIO', mythic: 'MÍTICO' };
      button.textContent = `[${rarityLabels[rarity] ?? 'COMUM'}] ${def.name} · ${SLOTS.find((s) => s.id === def.slot)?.label ?? def.slot} · ${[bonus, special, origin].filter(Boolean).join(' · ') || 'Sem bônus'}`;
      const rarityStyles: Record<string, string> = { rare: 'border-color:#c084fc;color:#e9d5ff;', epic: 'border-color:#f59e0b;color:#fde68a;', legendary: 'border-color:#f97316;color:#fed7aa;', mythic: 'border-color:#22d3ee;color:#a5f3fc;' };
      button.style.cssText = STYLE.button + `text-align:left;font-size:.8rem;flex:1;${rarityStyles[rarity] ?? ''}`;
      button.disabled = this.selectedHero.hp <= 0 || (this.selectedHero.progression?.level ?? 1) < (def.minLevel ?? 1) || (!!def.allowedClasses && !def.allowedClasses.includes(this.selectedHero.definition.id as 'warrior' | 'assassin' | 'mage' | 'cleric' | 'archer'));
      button.addEventListener('click', () => {
        if (this.campaign.inventory.equip(this.selectedHero, item.instanceId, ITEM_DEFINITIONS)) this.render();
        else { this.message = 'Não foi possível equipar esse item.'; this.render(); }
      });
      const sell = document.createElement('button');
      sell.type = 'button';
      sell.textContent = `Vender drop · ${def.sellPrice} ouro`;
      sell.style.cssText = STYLE.button + 'font-size:.75rem;white-space:nowrap;background:#7f1d1d;';
      sell.addEventListener('click', () => {
        const value = this.campaign.sellInventoryItem(item.instanceId);
        this.message = value > 0 ? `${def.name} vendido por ${value} ouro.` : 'Não foi possível vender esse item.';
        this.render();
      });
      row.append(button, sell);
      items.append(row);
    }
    equipmentCard.append(equipmentTitle, slots, inventoryTitle, filterGrid, items);
    if (filteredItems.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'Nenhum item corresponde aos filtros selecionados.';
      empty.style.cssText = 'color:#94a3b8;font-size:.85rem;margin:4px 0;';
      equipmentCard.append(empty);
    }

    const inventoryButton = document.createElement('button');
    inventoryButton.type = 'button';
    inventoryButton.textContent = 'Inventário e equipamentos';
    inventoryButton.style.cssText = 'width:100%;padding:13px;border:1px solid #8b5cf6;border-radius:8px;background:#2b2341;color:#f5f3ff;font-weight:800;cursor:pointer;';
    const inventoryWindow = document.createElement('div');
    inventoryWindow.className = 'inventory-window';
    inventoryWindow.style.cssText = 'position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(2,6,23,.78);backdrop-filter:blur(5px);';
    const inventoryDialog = document.createElement('div');
    inventoryDialog.style.cssText = 'width:min(760px,100%);max-height:90dvh;overflow:auto;background:#0f172a;border:1px solid #8b5cf6;padding:12px;box-shadow:0 20px 70px #000a;';
    const inventoryHeader = document.createElement('div');
    inventoryHeader.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;';
    const inventoryWindowTitle = document.createElement('strong');
    inventoryWindowTitle.textContent = `Inventário · ${this.selectedHero.definition.name} · Nv. ${this.selectedHero.progression?.level ?? 1}`;
    const closeInventory = document.createElement('button');
    closeInventory.type = 'button';
    closeInventory.textContent = 'Fechar ✕';
    closeInventory.style.cssText = STYLE.button;
    const closeWindow = () => { this.inventoryOpen = false; inventoryWindow.style.display = 'none'; };
    closeInventory.addEventListener('click', closeWindow);
    inventoryWindow.addEventListener('click', (event) => { if (event.target === inventoryWindow) closeWindow(); });
    inventoryHeader.append(inventoryWindowTitle, closeInventory);
    inventoryDialog.append(inventoryHeader, equipmentCard);
    inventoryWindow.append(inventoryDialog);
    inventoryButton.addEventListener('click', () => { this.inventoryOpen = true; inventoryWindow.style.display = 'flex'; });
    inventoryButton.hidden=true; right.append(inventoryButton);
    page.append(inventoryWindow);
    columns.append(left, right);
    page.append(columns);

    const footer = document.createElement('section'); footer.className='prep-footer';
    footer.style.cssText = 'margin-top:12px;padding:16px;border:1px solid #394150;border-radius:10px;background:#111827;';
    const summary = document.createElement('p');
    summary.textContent = `${this.selectedUids.size} herói(s) selecionado(s) · Andar inicial: 1 · Máximo por equipe: 3`;
    summary.style.cssText = 'margin:0 0 10px;color:#cbd5e1;';
    const warning = document.createElement('p');
    warning.textContent = this.message || 'A formação pode ser alterada antes de cada expedição.';
    warning.style.cssText = `margin:0 0 12px;color:${this.message ? '#fca5a5' : '#94a3b8'};font-size:.9rem;`;
    const start = document.createElement('button');
    start.type='button'; start.textContent='EXPEDIÇÃO ➜'; start.className='prep-expedition'; start.style.cssText='';
    start.disabled = this.selectedUids.size < 1 || this.selectedUids.size > 3;
    start.addEventListener('click', () => {
      const positions = Object.fromEntries([...this.positions.entries()]);
      const ok = this.campaign.configureParty([...this.selectedUids], positions);
      if (!ok) { this.message = 'Confira a equipe: selecione de 1 a 3 heróis vivos e deixe cada um em uma casa diferente.'; this.render(); return; }
      this.onStart();
    });
    footer.append(summary, warning);
    right.append(start);
    this.root.replaceChildren(page);
    // Recriar a tela após equipar/vender mantém o inventário aberto até o jogador fechá-lo.
    if (this.inventoryOpen) inventoryWindow.style.display = 'flex';
  }

  private findFreePosition(): Position | null {
    for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++) {
      const used = [...this.selectedUids].some((uid) => {
        if (uid === this.selectedHero.uid) return false;
        const pos = this.positions.get(uid);
        return pos?.col === col && pos?.row === row;
      });
      if (!used) return { col, row };
    }
    return null;
  }
}
