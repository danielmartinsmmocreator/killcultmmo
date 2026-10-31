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
  private inventoryRangeFilter: 1 | 2 | 3 | null = null;
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
    available.forEach((hero, index) => this.positions.set(hero.uid, { col: index % 6, row: 5 }));
    this.render();
  }

  private render(): void {
    const page = document.createElement('main');
    page.className = 'preparation-screen';
    page.style.cssText = 'width:min(100%,1180px);margin:auto;padding:clamp(12px,2vw,24px);color:#f3f4f6;font-family:system-ui,sans-serif;';
    const eyebrow = document.createElement('p');
    eyebrow.textContent = 'ROGUELIKE ALFA · BASE DE OPERAÇÕES';
    eyebrow.style.cssText = 'color:#a78bfa;font-weight:800;letter-spacing:.16em;font-size:.75rem;margin:0 0 8px;';
    const headingRow = document.createElement('div');
    headingRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;';
    const heading = document.createElement('h1');
    heading.textContent = 'Preparar expedição';
    heading.style.cssText = 'font-size:clamp(2rem,4vw,3rem);margin:0;';
    const devButton = document.createElement('button');
    devButton.type = 'button';
    devButton.textContent = '⚙ Dev Mode';
    devButton.style.cssText = 'padding:9px 13px;border:1px solid #8b7be8;border-radius:8px;background:#25233d;color:#fff;font-weight:800;cursor:pointer;';
    devButton.addEventListener('click', () => {
      if (!this.devUnlocked) {
        const password = window.prompt('Senha de desenvolvedor:');
        if (password !== 'BeatrizL@nd1s!') { window.alert('Senha incorreta.'); return; }
        this.devUnlocked = true;
      }
      this.devPanelOpen = !this.devPanelOpen;
      devPanel.hidden = !this.devPanelOpen;
      devPanel.style.display = this.devPanelOpen ? 'grid' : 'none';
    });
    headingRow.append(heading, devButton);
    const subtitle = document.createElement('p');
    subtitle.textContent = 'Monte sua equipe, posicione os heróis e confira seus equipamentos antes de entrar na masmorra.';
    subtitle.style.cssText = 'color:#aeb8c8;line-height:1.4;margin:6px 0 12px;max-width:760px;';
    const goldBalance = document.createElement('div');
    goldBalance.textContent = `🪙 Ouro disponível: ${this.campaign.gold}`;
    goldBalance.style.cssText = 'display:inline-flex;align-items:center;padding:8px 12px;margin:0 0 12px;border:1px solid #a16207;border-radius:9px;background:#422006;color:#fde68a;font-weight:800;';
    page.append(eyebrow, headingRow, subtitle, goldBalance);

    const devPanel = document.createElement('section');
    devPanel.hidden = true;
    devPanel.style.cssText = 'display:none;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin:0 0 14px;padding:12px;border:1px solid #8b7be8;border-radius:10px;background:#111827;';
    const devAction = (label: string, action: () => void): void => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.style.cssText = STYLE.button + 'text-align:left;font-weight:700;';
      button.addEventListener('click', () => { action(); this.render(); });
      devPanel.append(button);
    };
    devAction('Pular para andar…', () => {
      const floor = Number(window.prompt(`Andar desejado (1–${this.campaign.totalFloors}):`, String(this.campaign.floorNumber)));
      if (!this.campaign.debugJumpToFloor(floor)) window.alert('Número de andar inválido.');
    });
    devAction('Adicionar ouro…', () => {
      const amount = Number(window.prompt('Quantidade de ouro (use negativo para remover):', '100'));
      if (Number.isFinite(amount)) this.campaign.debugAddGold(amount);
    });
    devAction('Adicionar item…', () => {
      const ids = Object.keys(ITEM_DEFINITIONS);
      const id = window.prompt('ID do item:\\n' + ids.join(', '));
      if (id && !this.campaign.debugAddItem(id.trim())) window.alert('ID de item inválido.');
    });
    devAction('Curar todos os heróis', () => this.campaign.battle.debugHealHeroes());
    devAction('Definir nível do herói…', () => {
      const hero = this.campaign.party.find((unit) => unit.uid === this.selectedHero.uid);
      if (!hero) return;
      const level = Number(window.prompt(`Novo nível para ${hero.definition.name} (1–999):`, String(hero.progression?.level ?? 1)));
      if (!this.campaign.debugSetHeroLevel(hero.uid, level)) window.alert('Nível inválido.');
    });
    devAction('Escolher monstros/chefes…', () => {
      const catalog = [...MONSTER_DEFINITIONS, HARPY, SATYR, CYCLOPS, GORGON, MINOTAUR, UNDERWORLD_HOUND, UNDERWORLD_WRAITH, CARD_SOLDIER, WHITE_RABBIT, GIANT_CATERPILLAR, MAD_MUSHROOM, THORN_PLANT, GOBLIN_CHIEF, ABYSS_IDOL, CRIMSON_COUNTESS, DRACULA, MEDUSA, HADES, CHESHIRE_CAT, QUEEN_OF_HEARTS];
      const value = window.prompt('IDs separados por vírgula:\\n' + catalog.map((m) => `${m.id} — ${m.name}`).join('\\n'), this.campaign.floor.monsters.map((m) => m.id).join(','));
      if (value === null) return;
      const selected = value.split(',').map((id) => catalog.find((m) => m.id === id.trim())).filter((m): m is typeof catalog[number] => Boolean(m));
      if (!this.campaign.debugSetMonsters(selected)) window.alert('Seleção inválida. Verifique IDs e quantidade (1–12).');
    });
    devAction('Forçar vitória', () => this.campaign.battle.debugSetOutcome('victory'));
    devAction('Forçar derrota', () => this.campaign.battle.debugSetOutcome('defeat'));
    const extractionLabel = document.createElement('label');
    extractionLabel.style.cssText = 'display:flex;align-items:center;gap:8px;color:#e2e8f0;font-size:.9rem;';
    const extractionToggle = document.createElement('input');
    extractionToggle.type = 'checkbox';
    extractionToggle.checked = this.campaign.debugExtractionEnabled;
    extractionToggle.addEventListener('change', () => this.campaign.debugToggleExtraction(extractionToggle.checked));
    extractionLabel.append(extractionToggle, document.createTextNode('Permitir extração fora dos marcos'));
    devPanel.append(extractionLabel);
    page.append(devPanel);

    const columns = document.createElement('div');
    columns.style.cssText = 'display:grid;grid-template-columns:minmax(220px,.8fr) minmax(0,1.2fr);gap:12px;align-items:start;';
    const left = document.createElement('section');
    left.style.cssText = STYLE.card;
    const rosterTitle = document.createElement('h2');
    rosterTitle.textContent = `Sua equipe · ${this.selectedUids.size}/3`;
    rosterTitle.style.cssText = 'margin:0 0 6px;font-size:1.15rem;';
    const rosterHint = document.createElement('p');
    rosterHint.textContent = 'Escolha de 1 a 3 personagens. Clique no nome para selecionar e no botão para incluir/remover.';
    rosterHint.style.cssText = 'color:#94a3b8;font-size:.85rem;line-height:1.4;margin:0 0 12px;';
    const roster = document.createElement('div');
    roster.style.cssText = 'display:grid;gap:8px;';
    for (const hero of this.campaign.party) {
      const chosen = this.selectedUids.has(hero.uid);
      const row = document.createElement('div');
      row.style.cssText = `display:flex;gap:8px;align-items:center;padding:10px;border:1px solid ${chosen ? '#8b5cf6' : '#394150'};border-radius:8px;background:${chosen ? '#2b2341' : '#101723'};opacity:${hero.hp > 0 ? '1' : '.55'};`;
      const select = document.createElement('button');
      select.type = 'button';
      select.textContent = `${hero.definition.name} · Nv. ${hero.progression?.level ?? 1}${hero.hp <= 0 ? ' · Caído' : ''}`;
      select.style.cssText = 'flex:1;text-align:left;border:0;background:transparent;color:#fff;cursor:pointer;padding:4px;';
      select.disabled = hero.hp <= 0;
      select.addEventListener('click', () => { this.selectedHero = hero; this.message = ''; this.render(); });
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.textContent = chosen ? 'Remover' : 'Adicionar';
      toggle.style.cssText = STYLE.button;
      toggle.disabled = hero.hp <= 0 || (!chosen && this.selectedUids.size >= 3);
      toggle.addEventListener('click', () => {
        if (chosen) {
          if (this.selectedUids.size <= 1) { this.message = 'A equipe precisa ter pelo menos um herói.'; }
          else { this.selectedUids.delete(hero.uid); this.message = ''; }
        } else {
          this.selectedUids.add(hero.uid); this.selectedHero = hero; this.message = '';
          const used = [...this.selectedUids].map((uid) => this.positions.get(uid)).filter(Boolean) as Position[];
          const pos = this.positions.get(hero.uid)!;
          if (used.filter((p) => p.col === pos.col && p.row === pos.row).length > 1) {
            const free = this.findFreePosition();
            if (free) this.positions.set(hero.uid, free);
          }
        }
        this.render();
      });
      row.append(select, toggle);
      roster.append(row);
    }
    left.append(rosterTitle, rosterHint, roster);

    const right = document.createElement('div');
    right.style.cssText = 'display:grid;gap:12px;';
    const boardCard = document.createElement('section');
    boardCard.style.cssText = STYLE.card;
    const boardTitle = document.createElement('h2');
    boardTitle.textContent = 'Formação inicial';
    boardTitle.style.cssText = 'margin:0 0 5px;font-size:1.15rem;';
    const boardHint = document.createElement('p');
    boardHint.textContent = `Personagem selecionado: ${this.selectedHero.definition.name}. Clique em uma casa livre das três linhas inferiores para posicioná-lo.`;
    boardHint.style.cssText = 'color:#94a3b8;font-size:.83rem;line-height:1.4;margin:0 0 12px;';
    const board = document.createElement('div');
    board.style.cssText = 'display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px;max-width:540px;margin:auto;';
    for (let row = 0; row < 6; row++) for (let col = 0; col < 6; col++) {
      const occupant = [...this.selectedUids].map((uid) => this.campaign.party.find((hero) => hero.uid === uid)!).find((hero) => {
        const pos = this.positions.get(hero.uid);
        return pos?.col === col && pos?.row === row;
      });
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.title = occupant ? `${occupant.definition.name} · clique para ver equipamentos e inventário` : `Coluna ${col + 1}, linha ${row + 1}`;
      cell.style.cssText = `display:flex;align-items:center;justify-content:center;aspect-ratio:1;overflow:hidden;padding:2px;border:1px solid ${occupant?.uid === this.selectedHero.uid ? '#facc15' : occupant ? '#8b5cf6' : '#394150'};border-radius:6px;background:${occupant ? '#293449' : row >= 3 ? '#263244' : '#101723'};color:white;font-weight:800;cursor:${occupant || row >= 3 ? 'pointer' : 'not-allowed'};`;
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
        cell.textContent = row >= 3 ? '·' : '';
      }
      cell.disabled = row < 3 && !occupant;
      cell.addEventListener('click', () => {
        // Clicar no sprite seleciona esse herói; o painel de equipamento/inventário acompanha a seleção.
        if (occupant) {
          this.selectedHero = occupant;
          this.message = '';
          this.render();
          return;
        }
        if (row < 3) return;
        const collision = [...this.selectedUids].map((uid) => this.positions.get(uid)).some((pos) => pos && pos.col === col && pos.row === row && !(pos.col === this.positions.get(this.selectedHero.uid)?.col && pos.row === this.positions.get(this.selectedHero.uid)?.row));
        if (collision) { this.message = 'Essa casa já está ocupada por outro herói.'; this.render(); return; }
        this.positions.set(this.selectedHero.uid, { col, row });
        this.message = '';
        this.render();
      });
      board.append(cell);
    }
    boardCard.append(boardTitle, boardHint, board);
    right.append(boardCard);

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
    const rangeFilter = document.createElement('select');
    rangeFilter.setAttribute('aria-label', 'Filtrar inventário por faixa de obtenção');
    rangeFilter.style.cssText = STYLE.button + 'width:100%;margin:0 0 8px;';
    const rangeOptions: Array<{ value: string; label: string }> = [
      { value: '', label: 'Todas as faixas' },
      { value: '1', label: 'Faixa 1 · Andares 1–10' },
      { value: '2', label: 'Faixa 2 · Andares 11–20' },
      { value: '3', label: 'Faixa 3 · Andares 21–30' },
    ];
    for (const option of rangeOptions) {
      const element = document.createElement('option');
      element.value = option.value;
      element.textContent = option.label;
      rangeFilter.append(element);
    }
    rangeFilter.value = this.inventoryRangeFilter === null ? '' : String(this.inventoryRangeFilter);
    rangeFilter.addEventListener('change', () => {
      this.inventoryRangeFilter = rangeFilter.value === '' ? null : Number(rangeFilter.value) as 1 | 2 | 3;
      this.render();
    });
    const items = document.createElement('div');
    items.style.cssText = 'display:grid;gap:6px;';
    const filteredItems = this.campaign.inventory.filterByRange(this.inventoryRangeFilter);
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
      button.textContent = `${def.name} · ${SLOTS.find((s) => s.id === def.slot)?.label ?? def.slot} · ${[bonus, special, origin].filter(Boolean).join(' · ') || 'Sem bônus'}`;
      button.style.cssText = STYLE.button + 'text-align:left;font-size:.8rem;flex:1;';
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
    equipmentCard.append(equipmentTitle, slots, inventoryTitle, rangeFilter, items);
    if (filteredItems.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'Nenhum item disponível nesta faixa.';
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
    inventoryWindowTitle.textContent = 'Inventário do personagem';
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
    right.append(inventoryButton);
    page.append(inventoryWindow);
    columns.append(left, right);
    page.append(columns);

    const footer = document.createElement('section');
    footer.style.cssText = 'margin-top:12px;padding:16px;border:1px solid #394150;border-radius:10px;background:#111827;';
    const summary = document.createElement('p');
    summary.textContent = `${this.selectedUids.size} herói(s) selecionado(s) · Andar inicial: 1 · Máximo por equipe: 3`;
    summary.style.cssText = 'margin:0 0 10px;color:#cbd5e1;';
    const warning = document.createElement('p');
    warning.textContent = this.message || 'A formação pode ser alterada antes de cada expedição.';
    warning.style.cssText = `margin:0 0 12px;color:${this.message ? '#fca5a5' : '#94a3b8'};font-size:.9rem;`;
    const start = document.createElement('button');
    start.type = 'button'; start.textContent = 'Entrar na masmorra'; start.style.cssText = 'width:100%;padding:14px;border:0;border-radius:8px;background:#7c3aed;color:white;font-weight:800;font-size:1rem;cursor:pointer;';
    start.disabled = this.selectedUids.size < 1 || this.selectedUids.size > 3;
    start.addEventListener('click', () => {
      const positions = Object.fromEntries([...this.positions.entries()]);
      const ok = this.campaign.configureParty([...this.selectedUids], positions);
      if (!ok) { this.message = 'Confira a equipe: selecione de 1 a 3 heróis vivos e deixe cada um em uma casa diferente.'; this.render(); return; }
      this.onStart();
    });
    footer.append(summary, warning, start);
    page.append(footer);
    this.root.replaceChildren(page);
    // Recriar a tela após equipar/vender mantém o inventário aberto até o jogador fechá-lo.
    if (this.inventoryOpen) inventoryWindow.style.display = 'flex';
  }

  private findFreePosition(): Position | null {
    for (let row = 3; row < 6; row++) for (let col = 0; col < 6; col++) {
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
