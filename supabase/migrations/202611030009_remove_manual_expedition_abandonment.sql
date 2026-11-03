-- O jogador não pode abandonar manualmente uma expedição ativa.
-- Expedições só terminam por extração, derrota em combate ou inatividade.
drop function if exists public.abandon_player_expedition();