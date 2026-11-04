import type { Campaign } from '../game/core/Campaign';
import { ITEM_DEFINITIONS } from '../game/data/items';
import { supabase } from '../lib/supabase';

type GuildMember = {
  user_id: string;
  nickname: string;
  role: 'leader' | 'admin' | 'member';
  global_level: number;
  joined_at: string;
};

type GuildInvite = {
  id: string;
  guild_id?: string;
  guild_name?: string;
  guild_tag?: string;
  invited_by_nickname?: string;
  nickname?: string;
  created_at: string;
};

type GuildData = {
  id: string;
  name: string;
  tag: string;
  description: string;
  leader_user_id: string;
  member_count: number;
  global_level: number;
  my_role: 'leader' | 'admin' | 'member';
  bank_view_access: 'leader_admins' | 'all_members';
  bank_deposit_access: 'leader_admins' | 'all_members';
  bank_withdraw_access: 'leader_admins' | 'all_members';
  members: GuildMember[];
  invites: GuildInvite[];
};

type GuildPayload = { guild: GuildData | null; invites: GuildInvite[] };
type BankItem = { id: string; item_definition_id: string; obtained_at_floor: number | null; deposited_at: string };

const cardStyle = 'padding:14px;border:1px solid #394150;border-radius:10px;background:#151d2b;color:#f3f4f6;';
const buttonStyle = 'padding:9px 12px;border:1px solid #64748b;border-radius:7px;background:#202b3d;color:#f8fafc;cursor:pointer;font-weight:700;';
const inputStyle = 'box-sizing:border-box;width:100%;padding:10px;border:1px solid #475569;border-radius:7px;background:#0f172a;color:#f8fafc;';
const labelStyle = 'display:grid;gap:5px;color:#cbd5e1;font-size:.86rem;';

export class GuildScreen {
  private readonly root: HTMLElement;
  private readonly campaign: Campaign;
  private readonly onBack: () => void;
  private payload: GuildPayload = { guild: null, invites: [] };
  private bankItems: BankItem[] = [];
  private busy = false;
  private message = '';

  constructor(root: HTMLElement, campaign: Campaign, onBack: () => void) {
    this.root = root;
    this.campaign = campaign;
    this.onBack = onBack;
    void this.refresh();
  }

  private button(label: string, action: () => void | Promise<void>, disabled = false): HTMLButtonElement {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.style.cssText = buttonStyle;
    element.disabled = disabled || this.busy;
    element.addEventListener('click', () => { void action(); });
    return element;
  }

  private input(label: string, placeholder: string, value = ''): { wrapper: HTMLLabelElement; field: HTMLInputElement } {
    const wrapper = document.createElement('label');
    wrapper.style.cssText = labelStyle;
    wrapper.append(document.createTextNode(label));
    const field = document.createElement('input');
    field.placeholder = placeholder;
    field.value = value;
    field.style.cssText = inputStyle;
    wrapper.append(field);
    return { wrapper, field };
  }

  private select(label: string, value: string, options: Array<{ value: string; label: string }>): { wrapper: HTMLLabelElement; field: HTMLSelectElement } {
    const wrapper = document.createElement('label');
    wrapper.style.cssText = labelStyle;
    wrapper.append(document.createTextNode(label));
    const field = document.createElement('select');
    field.style.cssText = inputStyle;
    for (const option of options) {
      const item = document.createElement('option');
      item.value = option.value;
      item.textContent = option.label;
      item.selected = option.value === value;
      field.append(item);
    }
    wrapper.append(field);
    return { wrapper, field };
  }

  private section(title: string): HTMLElement {
    const section = document.createElement('section');
    section.style.cssText = cardStyle + 'display:grid;gap:12px;';
    const heading = document.createElement('h2');
    heading.textContent = title;
    heading.style.cssText = 'font-size:1.1rem;margin:0;color:#f8fafc;';
    section.append(heading);
    return section;
  }

  private async rpc<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    if (!supabase) throw new Error('Supabase não está configurado.');
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw new Error(error.message);
    return data as T;
  }

  private async refresh(): Promise<void> {
    if (!supabase) {
      this.message = 'Supabase não está configurado.';
      this.render();
      return;
    }
    try {
      const data = await this.rpc<GuildPayload>('get_my_guild_data');
      this.payload = data ?? { guild: null, invites: [] };
      this.bankItems = [];
      if (this.payload.guild) {
        const { data: items, error } = await supabase
          .from('guild_bank_items')
          .select('id,item_definition_id,obtained_at_floor,deposited_at')
          .eq('guild_id', this.payload.guild.id)
          .order('deposited_at', { ascending: false });
        if (error && !error.message.toLowerCase().includes('permission')) throw error;
        this.bankItems = (items ?? []) as BankItem[];
      }
      this.message = '';
    } catch (error) {
      this.message = error instanceof Error ? error.message : 'Não foi possível carregar as guildas.';
    }
    this.render();
  }

  private async perform(action: () => Promise<void>, successMessage = 'Operação concluída.'): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.render();
    try {
      await action();
      this.message = successMessage;
      await this.refresh();
    } catch (error) {
      this.message = error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
      this.render();
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private render(): void {
    const page = document.createElement('main');
    page.style.cssText = 'min-height:100dvh;box-sizing:border-box;padding:clamp(14px,3vw,30px);background:#10131d;color:#f8fafc;font-family:Arial,sans-serif;display:grid;align-content:start;gap:14px;';
    const header = document.createElement('header');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;';
    const titleWrap = document.createElement('div');
    const eyebrow = document.createElement('p');
    eyebrow.textContent = 'KILLCULT MMO · COMUNIDADE';
    eyebrow.style.cssText = 'margin:0 0 5px;color:#a78bfa;font-size:.72rem;font-weight:800;letter-spacing:.15em;';
    const title = document.createElement('h1');
    title.textContent = 'GUILDAS';
    title.style.cssText = 'margin:0;font-size:clamp(1.7rem,4vw,2.5rem);';
    titleWrap.append(eyebrow, title);
    header.append(titleWrap, this.button('← Voltar à base', this.onBack));
    page.append(header);

    if (this.message) {
      const notice = document.createElement('p');
      notice.textContent = this.message;
      notice.style.cssText = 'margin:0;padding:10px 12px;border:1px solid #475569;border-radius:8px;background:#1e293b;color:#e2e8f0;';
      page.append(notice);
    }

    const guild = this.payload.guild;
    if (!guild) {
      const create = this.section('Fundar uma guilda');
      const name = this.input('Nome da guilda', 'Ex.: Filhos do Abismo');
      const tag = this.input('Tag (2 a 5 letras ou números)', 'Ex.: KCL');
      tag.field.maxLength = 5;
      tag.field.addEventListener('input', () => { tag.field.value = tag.field.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
      const description = this.input('Descrição (opcional)', 'Apresente sua guilda');
      create.append(name.wrapper, tag.wrapper, description.wrapper, this.button('Criar guilda', () => this.perform(async () => {
        await this.rpc('create_guild', {
          p_name: name.field.value,
          p_tag: tag.field.value,
          p_description: description.field.value,
        });
      }, 'Guilda criada!')));
      page.append(create);

      if (this.payload.invites.length) {
        const invites = this.section('Convites recebidos');
        for (const invite of this.payload.invites) {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px;border-radius:8px;background:#0f172a;';
          const info = document.createElement('span');
          info.textContent = '[' + (invite.guild_tag ?? '') + '] ' + (invite.guild_name ?? 'Guilda') + ' · convite de ' + (invite.invited_by_nickname ?? 'jogador');
          const actions = document.createElement('div');
          actions.style.cssText = 'display:flex;gap:7px;flex-wrap:wrap;';
          actions.append(
            this.button('Aceitar', () => this.perform(async () => { await this.rpc('respond_guild_invite', { p_invite_id: invite.id, p_accept: true }); }, 'Você entrou na guilda!')),
            this.button('Recusar', () => this.perform(async () => { await this.rpc('respond_guild_invite', { p_invite_id: invite.id, p_accept: false }); }, 'Convite recusado.')),
          );
          row.append(info, actions);
          invites.append(row);
        }
        page.append(invites);
      }
    } else {
      const summary = this.section('[' + guild.tag + '] ' + guild.name);
      const description = document.createElement('p');
      description.textContent = guild.description || 'Sem descrição definida.';
      description.style.cssText = 'margin:0;color:#cbd5e1;';
      const stats = document.createElement('div');
      stats.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;';
      for (const [label, value] of [['NÍVEL GLOBAL', guild.global_level], ['MEMBROS', guild.member_count], ['SEU CARGO', guild.my_role === 'leader' ? 'LÍDER' : guild.my_role === 'admin' ? 'ADMINISTRADOR' : 'MEMBRO']]) {
        const metric = document.createElement('div');
        metric.style.cssText = 'padding:9px 12px;border:1px solid #475569;border-radius:8px;background:#0f172a;';
        const caption = document.createElement('small');
        caption.textContent = label;
        caption.style.cssText = 'display:block;color:#94a3b8;font-size:.68rem;font-weight:700;';
        const valueText = document.createElement('strong');
        valueText.textContent = String(value);
        valueText.style.cssText = 'display:block;margin-top:4px;color:#facc15;';
        metric.append(caption, valueText);
        stats.append(metric);
      }
      summary.append(description, stats);
      page.append(summary);

      const roster = this.section('Membros');
      for (const member of guild.members) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px;border-radius:8px;background:#0f172a;';
        const info = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = member.nickname + (member.role === 'leader' ? '  👑 LÍDER' : member.role === 'admin' ? '  ◆ ADMIN' : '');
        const level = document.createElement('small');
        level.textContent = 'Nível global: ' + member.global_level;
        level.style.cssText = 'display:block;margin-top:3px;color:#94a3b8;';
        info.append(name, level);
        row.append(info);
        if (guild.my_role === 'leader' && member.role !== 'leader') {
          row.append(this.button(member.role === 'admin' ? 'Remover admin' : 'Promover admin', () => this.perform(async () => {
            await this.rpc('set_guild_member_role', {
              p_target_user_id: member.user_id,
              p_role: member.role === 'admin' ? 'member' : 'admin',
            });
          })));
        }
        if (member.role !== 'leader' && (guild.my_role === 'leader' || (guild.my_role === 'admin' && member.role === 'member'))) {
          row.append(this.button('Expulsar', () => this.perform(async () => {
            await this.rpc('remove_guild_member', { p_target_user_id: member.user_id });
          }, 'Membro removido.')));
        }
        if (guild.my_role === 'leader' && member.role !== 'leader') {
          row.append(this.button('Transferir liderança', () => this.perform(async () => {
            await this.rpc('transfer_guild_leadership', { p_target_user_id: member.user_id });
          }, 'Liderança transferida.')));
        }
        roster.append(row);
      }
      page.append(roster);

      if (guild.my_role !== 'member') {
        const invite = this.section('Convidar jogador');
        const nickname = this.input('Nickname exato', 'Digite o nickname do jogador');
        invite.append(nickname.wrapper, this.button('Enviar convite', () => this.perform(async () => {
          await this.rpc('invite_guild_member', { p_nickname: nickname.field.value });
        }, 'Convite enviado.')));
        const pending = guild.invites ?? [];
        if (pending.length) {
          const list = document.createElement('p');
          list.textContent = 'Convites pendentes: ' + pending.map((entry) => entry.nickname).join(', ');
          list.style.cssText = 'margin:0;color:#94a3b8;font-size:.85rem;';
          invite.append(list);
        }
        page.append(invite);
      }

      const bank = this.section('Cofre comunitário');
      const isOfficer = guild.my_role === 'leader' || guild.my_role === 'admin';
      const canView = guild.bank_view_access === 'all_members' || isOfficer;
      const canDeposit = guild.bank_deposit_access === 'all_members' || isOfficer;
      const canWithdraw = guild.bank_withdraw_access === 'all_members' || isOfficer;
      if (guild.my_role === 'leader') {
        const view = this.select('Quem pode visualizar', guild.bank_view_access, [
          { value: 'leader_admins', label: 'Líder e administradores' },
          { value: 'all_members', label: 'Todos os membros' },
        ]);
        const deposit = this.select('Quem pode depositar', guild.bank_deposit_access, [
          { value: 'leader_admins', label: 'Líder e administradores' },
          { value: 'all_members', label: 'Todos os membros' },
        ]);
        const withdraw = this.select('Quem pode retirar', guild.bank_withdraw_access, [
          { value: 'leader_admins', label: 'Líder e administradores' },
          { value: 'all_members', label: 'Todos os membros' },
        ]);
        bank.append(view.wrapper, deposit.wrapper, withdraw.wrapper, this.button('Salvar permissões do cofre', () => this.perform(async () => {
          await this.rpc('update_guild_bank_permissions', {
            p_view_access: view.field.value,
            p_deposit_access: deposit.field.value,
            p_withdraw_access: withdraw.field.value,
          });
        }, 'Permissões do cofre atualizadas.')));
      }
      if (!canView) {
        const locked = document.createElement('p');
        locked.textContent = 'O líder restringiu a visualização do cofre à liderança.';
        locked.style.cssText = 'margin:0;color:#fbbf24;';
        bank.append(locked);
      } else {
        const bankList = document.createElement('div');
        bankList.style.cssText = 'display:grid;gap:7px;';
        if (!this.bankItems.length) {
          const empty = document.createElement('p');
          empty.textContent = 'O cofre ainda está vazio.';
          empty.style.cssText = 'margin:0;color:#94a3b8;';
          bankList.append(empty);
        }
        for (const item of this.bankItems) {
          const definition = ITEM_DEFINITIONS[item.item_definition_id];
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px;border-radius:8px;background:#0f172a;';
          const label = document.createElement('span');
          label.textContent = (definition?.name ?? item.item_definition_id) + (item.obtained_at_floor ? ' · Andar ' + item.obtained_at_floor : '');
          row.append(label);
          if (canWithdraw) row.append(this.button('Retirar', () => this.perform(async () => {
            const inventoryId = await this.rpc<string>('withdraw_guild_bank_item', { p_bank_item_id: item.id });
            this.campaign.inventory.add(item.item_definition_id, item.obtained_at_floor ?? undefined, inventoryId);
          }, 'Item transferido para seu inventário.')));
          bankList.append(row);
        }
        bank.append(bankList);
      }
      if (canDeposit) {
        const depositTitle = document.createElement('strong');
        depositTitle.textContent = 'Depositar do inventário permanente';
        const availableItems = this.campaign.inventory.items.filter((item) => Boolean(item.persistentId));
        if (!availableItems.length) {
          const empty = document.createElement('p');
          empty.textContent = 'Não há itens disponíveis para depósito. Itens equipados e itens temporários não podem ser depositados.';
          empty.style.cssText = 'margin:0;color:#94a3b8;font-size:.85rem;';
          bank.append(depositTitle, empty);
        } else {
          bank.append(depositTitle);
          for (const item of availableItems) {
            const definition = ITEM_DEFINITIONS[item.definitionId];
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px;border-radius:8px;background:#0f172a;';
            const label = document.createElement('span');
            label.textContent = (definition?.name ?? item.definitionId) + (item.obtainedAtFloor ? ' · Andar ' + item.obtainedAtFloor : '');
            row.append(label, this.button('Depositar', () => this.perform(async () => {
              if (!item.persistentId) throw new Error('Esse item ainda não foi salvo no inventário permanente.');
              await this.rpc('deposit_guild_bank_item', { p_inventory_item_id: item.persistentId });
              this.campaign.inventory.sell(item.instanceId);
            }, 'Item depositado no cofre.')));
            bank.append(row);
          }
        }
      }
      page.append(bank);

      if (guild.my_role !== 'leader') {
        page.append(this.button('Sair da guilda', () => this.perform(async () => {
          await this.rpc('leave_guild');
        }, 'Você saiu da guilda.')));
      }
    }
    this.root.replaceChildren(page);
  }
}
