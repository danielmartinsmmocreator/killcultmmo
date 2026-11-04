import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type CoopCharacter = { id: string; class_id: string; level: number };
type CoopMember = {
  user_id: string;
  nickname: string;
  character_id: string | null;
  class_id: string | null;
  character_level: number | null;
  is_ready: boolean;
  joined_at: string;
};
type CoopInvite = {
  id: string;
  room_id: string;
  guild_name: string;
  guild_tag: string;
  inviter_nickname: string;
  created_at: string;
};
type CoopRoom = {
  id: string;
  guild_id: string;
  guild_name: string;
  guild_tag: string;
  leader_user_id: string;
  status: 'lobby' | 'prepared' | 'cancelled';
  max_players: number;
  created_at: string;
  members: CoopMember[];
};
type CoopSession = { id: string; room_id: string; leader_user_id: string; status: 'active' | 'completed' | 'defeated' | 'abandoned'; current_floor: number; turn_number: number; current_turn_user_id: string | null; state_snapshot: Record<string, unknown> | null; state_version: number; members: CoopMember[] };
type CoopPayload = { room: CoopRoom | null; invites: CoopInvite[]; characters: CoopCharacter[] };

const CLASS_NAMES: Record<string, string> = {
  warrior: 'Guerreiro',
  mage: 'Mago',
  cleric: 'Clérigo',
  assassin: 'Assassino',
  archer: 'Arqueiro',
};
const cardStyle = 'padding:14px;border:1px solid #394150;border-radius:10px;background:#151d2b;color:#f3f4f6;';
const buttonStyle = 'padding:9px 12px;border:1px solid #64748b;border-radius:7px;background:#202b3d;color:#f8fafc;cursor:pointer;font-weight:700;';
const inputStyle = 'box-sizing:border-box;width:100%;padding:10px;border:1px solid #475569;border-radius:7px;background:#0f172a;color:#f8fafc;';

export class ExpeditionLobbyScreen {
  private readonly root: HTMLElement;
  private readonly userId: string;
  private readonly onBack: () => void;
  private payload: CoopPayload = { room: null, invites: [], characters: [] };
  private session: CoopSession | null = null;
  private busy = false;
  private message = '';
  private channel: RealtimeChannel | null = null;
  private channelKey = '';

  constructor(root: HTMLElement, userId: string, onBack: () => void) {
    this.root = root;
    this.userId = userId;
    this.onBack = onBack;
    void this.refresh();
  }

  dispose(): void {
    if (this.channel && supabase) void supabase.removeChannel(this.channel);
    this.channel = null;
    this.channelKey = '';
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

  private section(title: string): HTMLElement {
    const section = document.createElement('section');
    section.style.cssText = cardStyle + 'display:grid;gap:12px;';
    const heading = document.createElement('h2');
    heading.textContent = title;
    heading.style.cssText = 'font-size:1.08rem;margin:0;color:#f8fafc;';
    section.append(heading);
    return section;
  }

  private async rpc<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    if (!supabase) throw new Error('Supabase não está configurado.');
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw new Error(error.message);
    return data as T;
  }

  private ensureSubscription(roomId: string | null): void {
    if (!supabase) return;
    const key = roomId ?? 'invites-only';
    if (this.channelKey === key) return;
    if (this.channel) void supabase.removeChannel(this.channel);
    this.channelKey = key;
    let channel = supabase.channel('coop-lobby-' + this.userId);
    channel = channel.on('postgres_changes', {
      event: '*', schema: 'public', table: 'coop_expedition_invites',
      filter: 'invited_user_id=eq.' + this.userId,
    }, () => { void this.refresh(); });
    if (roomId) {
      channel = channel.on('postgres_changes', {
        event: '*', schema: 'public', table: 'coop_expedition_sessions',
      }, () => { void this.refresh(); });
      channel = channel
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'coop_expedition_rooms', filter: 'id=eq.' + roomId,
        }, () => { void this.refresh(); })
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'coop_expedition_room_members', filter: 'room_id=eq.' + roomId,
        }, () => { void this.refresh(); })
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'coop_expedition_invites', filter: 'room_id=eq.' + roomId,
        }, () => { void this.refresh(); });
    }
    this.channel = channel.subscribe();
  }

  private async refresh(): Promise<void> {
    if (!supabase) {
      this.message = 'Supabase não está configurado.';
      this.render();
      return;
    }
    try {
      const data = await this.rpc<CoopPayload>('get_my_coop_lobby');
      this.payload = data ?? { room: null, invites: [], characters: [] };
      this.session = await this.rpc<CoopSession | null>('get_my_coop_expedition_session').catch((error) => {
        console.error('Falha ao consultar sessão cooperativa:', error);
        return null;
      });
      this.ensureSubscription(this.payload.room?.id ?? null);
      this.message = '';
    } catch (error) {
      this.session = null;
      this.message = error instanceof Error ? error.message : 'Não foi possível carregar a sala cooperativa.';
    }
    this.render();
  }

  private async perform(action: () => Promise<void>, successMessage: string): Promise<void> {
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
    eyebrow.textContent = 'KILLCULT MMO · MULTIJOGADOR';
    eyebrow.style.cssText = 'margin:0 0 5px;color:#a78bfa;font-size:.72rem;font-weight:800;letter-spacing:.15em;';
    const title = document.createElement('h1');
    title.textContent = 'EXPEDIÇÕES COOPERATIVAS';
    title.style.cssText = 'margin:0;font-size:clamp(1.45rem,4vw,2.2rem);';
    titleWrap.append(eyebrow, title);
    header.append(titleWrap, this.button('↻ Atualizar', () => this.refresh()), this.button('← Voltar à base', () => {
      this.dispose();
      this.onBack();
    }));
    page.append(header);

    if (this.message) {
      const notice = document.createElement('p');
      notice.textContent = this.message;
      notice.style.cssText = 'margin:0;padding:10px 12px;border:1px solid #475569;border-radius:8px;background:#1e293b;color:#e2e8f0;';
      page.append(notice);
    }

    if (this.payload.invites.length) {
      const invites = this.section('Convites recebidos');
      for (const invite of this.payload.invites) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px;border-radius:8px;background:#0f172a;';
        const info = document.createElement('span');
        info.textContent = '[' + invite.guild_tag + '] ' + invite.guild_name + ' · convite de ' + invite.inviter_nickname;
        row.append(info,
          this.button('Aceitar', () => this.perform(async () => {
            await this.rpc('respond_coop_expedition_invite', { p_invite_id: invite.id, p_accept: true });
          }, 'Você entrou na sala cooperativa.')),
          this.button('Recusar', () => this.perform(async () => {
            await this.rpc('respond_coop_expedition_invite', { p_invite_id: invite.id, p_accept: false });
          }, 'Convite recusado.'))
        );
        invites.append(row);
      }
      page.append(invites);
    }

    const room = this.payload.room;
    if (!room) {
      const create = this.section('Formar um grupo');
      const description = document.createElement('p');
      description.textContent = 'Crie uma sala para convidar membros da sua guilda. Cada jogador escolherá um herói entre seus cinco personagens. O grupo pode ter até 3 jogadores.';
      description.style.cssText = 'margin:0;color:#cbd5e1;line-height:1.5;';
      create.append(description, this.button('Criar sala cooperativa', () => this.perform(async () => {
        await this.rpc('create_coop_expedition_room');
      }, 'Sala criada! Agora convide os membros da sua guilda.')));
      page.append(create);
    } else {
      const isLeader = room.leader_user_id === this.userId;
      const ownMember = room.members.find((member) => member.user_id === this.userId);
      const lobby = this.section('[' + room.guild_tag + '] ' + room.guild_name);
      const status = document.createElement('p');
      status.textContent = this.session
        ? 'SESSÃO COOPERATIVA ATIVA · Andar ' + this.session.current_floor + ' · Turno ' + this.session.turn_number + ' · revisão ' + this.session.state_version
        : room.status === 'prepared'
          ? 'GRUPO PREPARADO · pronto para iniciar a sessão compartilhada.'
          : 'SALA EM PREPARAÇÃO · ' + room.members.length + ' de 3 jogadores';
      status.style.cssText = 'margin:0;color:' + (room.status === 'prepared' ? '#86efac' : '#cbd5e1') + ';font-weight:800;';
      lobby.append(status);

      const roster = document.createElement('div');
      roster.style.cssText = 'display:grid;gap:8px;';
      for (const member of room.members) {
        const row = document.createElement('article');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:11px;border-radius:8px;background:#0f172a;border:1px solid #334155;';
        const info = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = member.nickname + (member.user_id === room.leader_user_id ? ' · LÍDER' : '');
        const hero = document.createElement('small');
        hero.textContent = member.class_id
          ? (CLASS_NAMES[member.class_id] ?? member.class_id) + ' · Nv. ' + (member.character_level ?? 1)
          : 'Ainda não escolheu um herói';
        hero.style.cssText = 'display:block;margin-top:4px;color:#94a3b8;';
        info.append(name, hero);
        const ready = document.createElement('strong');
        ready.textContent = member.is_ready ? '✓ PRONTO' : 'AGUARDANDO';
        ready.style.cssText = 'font-size:.75rem;color:' + (member.is_ready ? '#86efac' : '#fbbf24') + ';';
        row.append(info, ready);
        roster.append(row);
      }
      lobby.append(roster);

      if (room.status === 'lobby' && ownMember) {
        const heroLabel = document.createElement('label');
        heroLabel.textContent = 'Seu herói para esta expedição';
        heroLabel.style.cssText = 'display:grid;gap:6px;color:#cbd5e1;font-size:.88rem;';
        const heroSelect = document.createElement('select');
        heroSelect.style.cssText = inputStyle;
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Selecione um personagem';
        heroSelect.append(emptyOption);
        for (const character of this.payload.characters) {
          const option = document.createElement('option');
          option.value = character.id;
          option.textContent = (CLASS_NAMES[character.class_id] ?? character.class_id) + ' · Nv. ' + character.level;
          option.selected = character.id === ownMember.character_id;
          heroSelect.append(option);
        }
        heroSelect.disabled = this.busy;
        heroSelect.addEventListener('change', () => {
          if (!heroSelect.value) return;
          void this.perform(async () => {
            await this.rpc('set_coop_expedition_hero', { p_character_id: heroSelect.value });
          }, 'Herói selecionado. Todos os jogadores precisarão confirmar prontidão novamente.');
        });
        heroLabel.append(heroSelect);
        lobby.append(heroLabel);

        lobby.append(this.button(ownMember.is_ready ? 'Cancelar prontidão' : 'Estou pronto', () => this.perform(async () => {
          await this.rpc('set_coop_expedition_ready', { p_ready: !ownMember.is_ready });
        }, ownMember.is_ready ? 'Prontidão cancelada.' : 'Prontidão confirmada.')));
      }

      if (isLeader && room.status === 'prepared' && !this.session) {
        const start = this.button('Iniciar expedição cooperativa', () => this.perform(async () => {
          await this.rpc('start_coop_expedition_session');
        }, 'Sessão cooperativa criada no servidor. O tabuleiro compartilhado será conectado na próxima etapa.'));
        start.style.cssText += 'border-color:#16a34a;background:#14532d;';
        lobby.append(start);
      }

      if (isLeader && this.session) {
        lobby.append(this.button('Encerrar sessão de teste', () => this.perform(async () => {
          await this.rpc('abandon_coop_expedition_session');
        }, 'Sessão encerrada.')));
      }

      if (isLeader && room.status === 'lobby') {
        const invite = document.createElement('div');
        invite.style.cssText = 'display:grid;gap:8px;padding-top:8px;border-top:1px solid #334155;';
        const nicknameLabel = document.createElement('label');
        nicknameLabel.textContent = 'Convidar membro da guilda pelo nickname';
        nicknameLabel.style.cssText = 'display:grid;gap:6px;color:#cbd5e1;font-size:.88rem;';
        const nickname = document.createElement('input');
        nickname.placeholder = 'Nickname exato';
        nickname.maxLength = 32;
        nickname.style.cssText = inputStyle;
        nicknameLabel.append(nickname);
        invite.append(nicknameLabel, this.button('Enviar convite', () => this.perform(async () => {
          if (!nickname.value.trim()) throw new Error('Informe o nickname do jogador.');
          await this.rpc('invite_coop_expedition_player', { p_nickname: nickname.value.trim() });
        }, 'Convite enviado.')));
        lobby.append(invite);
        const prepare = this.button('Confirmar grupo preparado', () => this.perform(async () => {
          await this.rpc('prepare_coop_expedition_room');
        }, 'Grupo preparado! A entrada no combate será implementada na próxima etapa.'));
        prepare.style.cssText += 'border-color:#16a34a;background:#14532d;';
        lobby.append(prepare);
      }

      if (!this.session) {
        lobby.append(this.button(isLeader ? 'Cancelar sala' : 'Sair da sala', () => this.perform(async () => {
          await this.rpc('leave_coop_expedition_room');
        }, isLeader ? 'Sala cancelada.' : 'Você saiu da sala.')));
      }
      page.append(lobby);
    }

    const note = document.createElement('p');
    note.textContent = this.session
      ? 'A sessão já possui registro persistente, controle de versão e sincronização em tempo real. O tabuleiro e as ações de combate ainda serão conectados na próxima etapa.'
      : 'As salas, convites, seleção de heróis, prontidão e criação da sessão são persistidos no servidor. O combate será conectado à sessão na próxima etapa.';
    note.style.cssText = 'margin:0;color:#64748b;font-size:.82rem;line-height:1.5;';
    page.append(note);
    this.root.replaceChildren(page);
  }
}
