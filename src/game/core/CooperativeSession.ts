import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export type CooperativeAction =
  | { type: 'move'; destination: { col: number; row: number } }
  | { type: 'attack' }
  | { type: 'ability'; abilityId: string; target?: { col: number; row: number }; destination?: { col: number; row: number }; targetUid?: string }
  | { type: 'pass' };

export type CooperativeSubmittedAction = {
  actor_user_id: string;
  character_id: string;
  action_payload: CooperativeAction;
  created_at: string;
};

export type CooperativeEquippedItem = {
  slot: string;
  item_definition_id: string;
};

export type CooperativeSessionMember = {
  user_id: string;
  nickname: string;
  character_id: string | null;
  class_id: string | null;
  character_level: number | null;
  character_xp: number | null;
  unspent_attribute_points: number | null;
  strength: number | null;
  vitality: number | null;
  defense: number | null;
  equipment: CooperativeEquippedItem[];
  is_ready: boolean;
  is_eliminated?: boolean;
};

export type CooperativeSessionState = {
  id: string;
  room_id: string;
  leader_user_id: string;
  status: 'active' | 'completed' | 'defeated' | 'abandoned';
  current_floor: number;
  turn_number: number;
  current_turn_user_id: string | null;
  resolution_pending: boolean;
  state_snapshot: Record<string, unknown> | null;
  state_version: number;
  submitted_actions: CooperativeSubmittedAction[];
  members: CooperativeSessionMember[];
};

type SubmitResult = {
  session_id: string;
  round_number: number;
  state_version: number;
  current_turn_user_id: string | null;
  resolution_pending: boolean;
  submitted_count: number;
  member_count: number;
};

/**
 * Transporte da sessão cooperativa. O banco decide a ordem e valida o dono da ação;
 * o líder é o único cliente autorizado a publicar o snapshot após resolver a rodada.
 * A classe não simula combate: ela transporta ações e estado entre os clientes.
 */
export class CooperativeSessionClient {
  private channel: RealtimeChannel | null = null;
  private disposed = false;
  private refreshInFlight: Promise<CooperativeSessionState | null> | null = null;
  private current: CooperativeSessionState | null = null;

  readonly sessionId: string;
  readonly userId: string;
  readonly characterId: string;
  private readonly onUpdate: (session: CooperativeSessionState) => void;
  private readonly onBattleState: (snapshot: Record<string, unknown>) => void;
  private readonly onError: (message: string) => void;

  constructor(
    sessionId: string,
    userId: string,
    characterId: string,
    onUpdate: (session: CooperativeSessionState) => void,
    onError: (message: string) => void = console.error,
    onBattleState: (snapshot: Record<string, unknown>) => void = () => undefined,
  ) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.characterId = characterId;
    this.onUpdate = onUpdate;
    this.onError = onError;
    this.onBattleState = onBattleState;
  }

  get session(): CooperativeSessionState | null {
    return this.current;
  }

  get isLeader(): boolean {
    return this.current?.leader_user_id === this.userId;
  }

  get canAct(): boolean {
    return Boolean(
      this.current?.status === 'active' &&
      !this.current.resolution_pending &&
      this.current.current_turn_user_id === this.userId &&
      !this.current.submitted_actions.some((action) => action.actor_user_id === this.userId),
    );
  }

  async connect(): Promise<CooperativeSessionState> {
    if (!supabase) throw new Error('Supabase não está configurado.');
    if (this.disposed) throw new Error('Esta conexão cooperativa já foi encerrada.');
    if (!this.channel) {
      this.channel = supabase
        .channel('coop-session-' + this.sessionId)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'coop_expedition_sessions',
          filter: 'id=eq.' + this.sessionId,
        }, () => { void this.refresh(); })
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'coop_expedition_actions',
          filter: 'session_id=eq.' + this.sessionId,
        }, () => { void this.refresh(); })
        .on('broadcast', { event: 'battle_state' }, ({ payload }) => {
          if (!this.isLeader && payload && typeof payload === 'object') {
            const snapshot = (payload as { snapshot?: unknown }).snapshot;
            if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
              this.onBattleState(snapshot as Record<string, unknown>);
            }
          }
        })
        .subscribe();
    }
    const session = await this.refresh();
    if (!session) throw new Error('A sessão cooperativa não foi encontrada ou não está mais ativa.');
    return session;
  }

  async refresh(): Promise<CooperativeSessionState | null> {
    if (!supabase || this.disposed) return null;
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = (async () => {
      const { data, error } = await supabase!.rpc('get_my_coop_expedition_session');
      if (error) throw new Error(error.message);
      const session = data as CooperativeSessionState | null;
      if (!session || session.id !== this.sessionId) return null;
      this.current = session;
      this.onUpdate(session);
      return session;
    })().catch((error) => {
      const message = error instanceof Error ? error.message : 'Falha ao sincronizar a sessão cooperativa.';
      this.onError(message);
      throw error;
    }).finally(() => { this.refreshInFlight = null; });
    return this.refreshInFlight;
  }

  /** Envia estados transitórios da simulação para que os demais clientes animem cada passo. */
  async broadcastBattleState(snapshot: Record<string, unknown>): Promise<void> {
    if (!this.channel || this.disposed || !this.isLeader) return;
    const result = await this.channel.send({
      type: 'broadcast',
      event: 'battle_state',
      payload: { snapshot },
    });
    if (result !== 'ok') this.onError('Não foi possível transmitir uma atualização visual da batalha.');
  }

  async submitAction(action: CooperativeAction): Promise<SubmitResult> {
    if (!supabase) throw new Error('Supabase não está configurado.');
    const session = this.current ?? await this.refresh();
    if (!session) throw new Error('Sessão cooperativa indisponível.');
    if (!this.canAct) throw new Error('Ainda não é sua vez de agir ou a rodada está sendo resolvida.');
    const { data, error } = await supabase.rpc('submit_coop_expedition_action', {
      p_session_id: this.sessionId,
      p_expected_version: session.state_version,
      p_character_id: this.characterId,
      p_action: action,
    });
    if (error) throw new Error(error.message);
    const result = data as SubmitResult;
    await this.refresh();
    return result;
  }

  /** Publica o estado inicial uma única vez, antes de qualquer ação da primeira rodada. */
  async initializeSnapshot(snapshot: Record<string, unknown>): Promise<number> {
    if (!supabase) throw new Error('Supabase não está configurado.');
    const session = this.current ?? await this.refresh();
    if (!session) throw new Error('Sessão cooperativa indisponível.');
    if (!this.isLeader) throw new Error('Somente o líder pode inicializar o tabuleiro compartilhado.');
    if (session.state_snapshot) throw new Error('O tabuleiro compartilhado já foi inicializado.');
    const { data, error } = await supabase.rpc('initialize_coop_expedition_snapshot', {
      p_session_id: this.sessionId,
      p_expected_version: session.state_version,
      p_state_snapshot: snapshot,
    });
    if (error) throw new Error(error.message);
    await this.refresh();
    return Number(data);
  }

  async resolveRound(
    floor: number,
    snapshot: Record<string, unknown>,
    status: 'active' | 'completed' | 'defeated' = 'active',
  ): Promise<number> {
    if (!supabase) throw new Error('Supabase não está configurado.');
    const session = this.current ?? await this.refresh();
    if (!session) throw new Error('Sessão cooperativa indisponível.');
    if (!this.isLeader) throw new Error('Somente o líder pode resolver a rodada compartilhada.');
    if (!session.resolution_pending) throw new Error('A rodada ainda não recebeu todas as ações.');
    const { data, error } = await supabase.rpc('resolve_coop_expedition_round', {
      p_session_id: this.sessionId,
      p_expected_version: session.state_version,
      p_current_floor: floor,
      p_state_snapshot: snapshot,
      p_status: status,
    });
    if (error) throw new Error(error.message);
    await this.refresh();
    return Number(data);
  }

  async advanceFloor(floor: number, snapshot: Record<string, unknown>): Promise<number> {
    if (!supabase) throw new Error('Supabase não está configurado.');
    const session = this.current ?? await this.refresh();
    if (!session) throw new Error('Sessão cooperativa indisponível.');
    if (!this.isLeader) throw new Error('Somente o líder pode avançar o andar.');
    const { data, error } = await supabase.rpc('advance_coop_expedition_floor', {
      p_session_id: this.sessionId,
      p_expected_version: session.state_version,
      p_current_floor: floor,
      p_state_snapshot: snapshot,
    });
    if (error) throw new Error(error.message);
    await this.refresh();
    return Number(data);
  }

  dispose(): void {
    this.disposed = true;
    if (this.channel && supabase) void supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
