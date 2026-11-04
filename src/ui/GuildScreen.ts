import type { Campaign } from '../game/core/Campaign';
import type { RealtimeChannel } from '@supabase/supabase-js';
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

type GuildActivity = { id: number; actor_nickname: string; event_type: string; details: Record<string, unknown>; created_at: string };
type GuildJoinRequest = { id: string; user_id: string; nickname: string; global_level: number; created_at: string };
type PublicGuild = { id: string; name: string; tag: string; description: string; member_count: number; global_level: number; leader_nickname: string; has_requested: boolean };
type GuildPayload = { guild: GuildData | null; invites: GuildInvite[]; join_requests?: GuildJoinRequest[] };
type BankItem = { id: string; item_definition_id: string; obtained_at_floor: number | null; deposited_at: string };
type GuildChatMessage = { id: string; guild_id: string; sender_user_id: string | null; sender_nickname: string; sender_role: 'leader' | 'admin' | 'member'; content: string; created_at: string };

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
  private publicGuilds: PublicGuild[] = [];
  private joinRequests: GuildJoinRequest[] = [];
  private activity: GuildActivity[] = [];
  private busy = false;
  private message = '';
  private chatChannel: RealtimeChannel | null = null;
  private chatGuildId: string | null = null;
  private chatMessages: GuildChatMessage[] = [];
  private chatMessagesRoot: HTMLElement | null = null;

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
      this.publicGuilds = [];
      this.joinRequests = this.payload.guild ? await this.rpc<GuildJoinRequest[]>('get_guild_join_requests') : [];
      this.activity = this.payload.guild ? await this.rpc<GuildActivity[]>('get_guild_activity', { p_limit: 50 }) : [];
      if (this.payload.guild) {
        const { data: items, error } = await supabase
          .from('guild_bank_items')
          .select('id,item_definition_id,obtained_at_floor,deposited_at')
          .eq('guild_id', this.payload.guild.id)
          .order('deposited_at', { ascending: false });
        if (error && !error.message.toLowerCase().includes('permission')) throw error;
        this.bankItems = (items ?? []) as BankItem[];
        await this.loadChatMessages();
        this.ensureChatSubscription(this.payload.guild.id);
      } else {
        this.publicGuilds = await this.rpc<PublicGuild[]>('get_public_guilds', { p_search: '', p_limit: 30 });
        this.chatMessages = [];
        this.chatMessagesRoot = null;
        this.disposeChatSubscription();
      }
      this.message = '';
    } catch (error) {
      this.message = error instanceof Error ? error.message : 'Não foi possível carregar as guildas.';
    }
    this.render();
  }

  private disposeChatSubscription(): void {
    if (this.chatChannel && supabase) void supabase.removeChannel(this.chatChannel);
    this.chatChannel = null;
    this.chatGuildId = null;
  }

  dispose(): void {
    this.disposeChatSubscription();
    this.chatMessagesRoot = null;
  }

  private ensureChatSubscription(guildId: string): void {
    if (!supabase || this.chatGuildId === guildId) return;
    this.disposeChatSubscription();
    this.chatGuildId = guildId;
    this.chatChannel = supabase
      .channel('guild-chat-' + guildId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'guild_chat_messages',
        filter: 'guild_id=eq.' + guildId,
      }, () => { void this.loadChatMessages(); })
      .subscribe();
  }

  private async loadChatMessages(): Promise<void> {
    if (!supabase || !this.payload.guild) return;
    const { data, error } = await supabase
      .from('guild_chat_messages')
      .select('id,guild_id,sender_user_id,sender_nickname,sender_role,content,created_at')
      .eq('guild_id', this.payload.guild.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      console.error('Falha ao carregar chat da guilda:', error);
      return;
    }
    this.chatMessages = ((data ?? []) as GuildChatMessage[]).reverse();
    if (this.chatMessagesRoot) this.renderChatMessages(this.chatMessagesRoot);
  }

  private renderChatMessages(container: HTMLElement): void {
    container.replaceChildren();
    if (!this.chatMessages.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Nenhuma mensagem ainda. Comece a conversa com sua guilda!';
      empty.style.cssText = 'margin:0;color:#94a3b8;text-align:center;padding:16px 6px;';
      container.append(empty);
      return;
    }
    for (const message of this.chatMessages) {
      const row = document.createElement('article');
      row.style.cssText = 'padding:8px 10px;border-radius:8px;background:#0f172a;overflow-wrap:anywhere;';
      const meta = document.createElement('div');
      meta.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px;';
      const author = document.createElement('strong');
      author.textContent = message.sender_nickname;
      author.style.cssText = 'color:#e2e8f0;font-size:.88rem;';
      const role = document.createElement('small');
      role.textContent = message.sender_role === 'leader' ? '👑 LÍDER' : message.sender_role === 'admin' ? '◆ ADMIN' : 'MEMBRO';
      role.style.cssText = 'color:' + (message.sender_role === 'leader' ? '#facc15' : message.sender_role === 'admin' ? '#a78bfa' : '#94a3b8') + ';font-size:.65rem;font-weight:800;';
      const time = document.createElement('time');
      const date = new Date(message.created_at);
      time.textContent = Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      time.style.cssText = 'margin-left:auto;color:#64748b;font-size:.68rem;';
      const body = document.createElement('p');
      body.textContent = message.content;
      body.style.cssText = 'margin:0;color:#f1f5f9;font-size:.9rem;white-space:pre-wrap;';
      meta.append(author, role, time);
      row.append(meta, body);
      container.append(row);
    }
    container.scrollTop = container.scrollHeight;
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
    header.append(titleWrap, this.button('← Voltar à base', () => { this.dispose(); this.onBack(); }));
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

      const discovery = this.section('Encontrar uma guilda');
      const search = this.input('Buscar por nome ou tag', 'Digite o nome ou a tag');
      const results = document.createElement('div');
      results.style.cssText = 'display:grid;gap:8px;';
      const renderResults = (guilds: PublicGuild[]): void => {
        results.replaceChildren();
        if (!guilds.length) {
          const empty = document.createElement('p');
          empty.textContent = 'Nenhuma guilda encontrada.';
          empty.style.cssText = 'margin:0;color:#94a3b8;';
          results.append(empty);
        }
        for (const item of guilds) {
          const row = document.createElement('article');
          row.style.cssText = 'display:grid;gap:7px;padding:11px;border-radius:8px;background:#0f172a;border:1px solid #334155;';
          const heading = document.createElement('strong');
          heading.textContent = '[' + item.tag + '] ' + item.name;
          const details = document.createElement('small');
          details.textContent = item.member_count + ' membros · nível ' + item.global_level + ' · líder: ' + item.leader_nickname;
          details.style.cssText = 'color:#94a3b8;';
          const about = document.createElement('p');
          about.textContent = item.description || 'Sem descrição.';
          about.style.cssText = 'margin:0;color:#cbd5e1;font-size:.88rem;';
          const action = this.button(item.has_requested ? 'Solicitação enviada' : 'Solicitar entrada', () => this.perform(async () => {
            await this.rpc('request_guild_join', { p_guild_id: item.id });
          }, 'Solicitação enviada à liderança.'), item.has_requested);
          row.append(heading, details, about, action);
          results.append(row);
        }
      };
      renderResults(this.publicGuilds);
      const searchButton = this.button('Buscar', async () => {
        try {
          const found = await this.rpc<PublicGuild[]>('get_public_guilds', { p_search: search.field.value, p_limit: 30 });
          this.publicGuilds = found ?? [];
          renderResults(this.publicGuilds);
        } catch (error) {
          this.message = error instanceof Error ? error.message : 'Falha ao buscar guildas.';
          this.render();
        }
      });
      search.field.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); searchButton.click(); }
      });
      discovery.append(search.wrapper, searchButton, results);
      page.append(discovery);

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
        caption.textContent = String(label);
        caption.style.cssText = 'display:block;color:#94a3b8;font-size:.68rem;font-weight:700;';
        const valueText = document.createElement('strong');
        valueText.textContent = String(value);
        valueText.style.cssText = 'display:block;margin-top:4px;color:#facc15;';
        metric.append(caption, valueText);
        stats.append(metric);
      }
      summary.append(description, stats);
      page.append(summary);

      const chat = this.section('Chat da guilda');
      const chatMessages = document.createElement('div');
      chatMessages.style.cssText = 'display:grid;gap:7px;max-height:340px;overflow-y:auto;padding:4px;';
      this.chatMessagesRoot = chatMessages;
      this.renderChatMessages(chatMessages);
      const composer = document.createElement('form');
      composer.style.cssText = 'display:flex;gap:8px;align-items:stretch;';
      const messageInput = document.createElement('input');
      messageInput.type = 'text';
      messageInput.maxLength = 500;
      messageInput.placeholder = 'Escreva uma mensagem...';
      messageInput.style.cssText = inputStyle + 'flex:1;min-width:0;';
      const send = document.createElement('button');
      send.type = 'submit';
      send.textContent = 'Enviar';
      send.style.cssText = buttonStyle;
      composer.addEventListener('submit', async (event) => {
        event.preventDefault();
        const text = messageInput.value.trim();
        if (!text || this.busy || !supabase) return;
        send.disabled = true;
        try {
          const { error } = await supabase.from('guild_chat_messages').insert({
            guild_id: guild.id,
            content: text,
          });
          if (error) throw error;
          messageInput.value = '';
          await this.loadChatMessages();
        } catch (error) {
          this.message = error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.';
          this.render();
        } finally {
          send.disabled = false;
          messageInput.focus();
        }
      });
      composer.append(messageInput, send);
      const hint = document.createElement('small');
      hint.textContent = 'Mensagens visíveis somente para membros da guilda · até 500 caracteres';
      hint.style.cssText = 'color:#64748b;';
      chat.append(chatMessages, composer, hint);
      page.append(chat);

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

      if (guild.my_role !== 'member' && this.joinRequests.length) {
        const requests = this.section('Solicitações para entrar');
        for (const request of this.joinRequests) {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px;border-radius:8px;background:#0f172a;';
          const info = document.createElement('span');
          info.textContent = request.nickname + ' · nível global ' + request.global_level;
          row.append(info,
            this.button('Aceitar', () => this.perform(async () => {
              await this.rpc('respond_guild_join_request', { p_request_id: request.id, p_approve: true });
            }, 'Jogador aceito na guilda!')),
            this.button('Recusar', () => this.perform(async () => {
              await this.rpc('respond_guild_join_request', { p_request_id: request.id, p_approve: false });
            }, 'Solicitação recusada.'))
          );
          requests.append(row);
        }
        page.append(requests);
      }

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

      const activitySection = this.section('Histórico da guilda');
      const activityLabels: Record<string, string> = {
        member_joined: 'entrou na guilda',
        member_left: 'saiu da guilda',
        member_removed: 'removeu um membro',
        role_changed: 'alterou um cargo',
        bank_deposit: 'depositou um item no cofre',
        bank_withdraw: 'retirou um item do cofre',
      };
      if (!this.activity.length) {
        const empty = document.createElement('p');
        empty.textContent = 'Ainda não há atividades registradas.';
        empty.style.cssText = 'margin:0;color:#94a3b8;';
        activitySection.append(empty);
      }
      for (const event of this.activity) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:9px;border-radius:8px;background:#0f172a;';
        const description = document.createElement('span');
        let detail = '';
        if (event.event_type === 'role_changed') {
          detail = ' (' + String(event.details.old_role ?? '') + ' → ' + String(event.details.new_role ?? '') + ')';
        } else if (event.event_type === 'bank_deposit' || event.event_type === 'bank_withdraw') {
          const itemId = String(event.details.item_definition_id ?? '');
          detail = ': ' + (ITEM_DEFINITIONS[itemId]?.name ?? itemId);
        }
        description.textContent = event.actor_nickname + ' ' + (activityLabels[event.event_type] ?? 'realizou uma atividade') + detail;
        const time = document.createElement('time');
        const date = new Date(event.created_at);
        time.textContent = Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        time.style.cssText = 'flex-shrink:0;color:#64748b;font-size:.7rem;';
        row.append(description, time);
        activitySection.append(row);
      }
      page.append(activitySection);

      if (guild.my_role !== 'leader') {
        page.append(this.button('Sair da guilda', () => this.perform(async () => {
          await this.rpc('leave_guild');
        }, 'Você saiu da guilda.')));
      }
    }
    this.root.replaceChildren(page);
  }
}
