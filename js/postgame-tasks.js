export const POSTGAME_TASKS_COLLECTION = 'postgameTasks';
export const POSTGAME_ORCHESTRATOR = 'picoclaw-postgame-orchestrator';
export const DEFAULT_POSTGAME_TOLERANCE_MINUTES = 10;

export const POSTGAME_STATUS = Object.freeze({
  OPEN: 'aberta',
  IN_PROGRESS: 'em_andamento',
  WAITING_RESULT: 'aguardando_resultado',
  WAITING_CONFIRMATION: 'aguardando_confirmacao_resultado',
  FINISHED: 'finalizada',
  CONTESTED: 'contestada',
  CANCELLED: 'cancelada',
});

export function parseMatchStart(match = {}) {
  if (!match.date || !match.time) return null;
  const value = `${match.date}T${match.time}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function estimateMatchEndAt(match = {}) {
  const start = parseMatchStart(match);
  if (!start) return null;
  const duration = Number(match.sport?.duration || match.duration || 0);
  if (!duration) return null;
  return new Date(start.getTime() + duration * 60_000);
}

export function postgameTriggerAt(match = {}, toleranceMinutes = DEFAULT_POSTGAME_TOLERANCE_MINUTES) {
  const estimatedEnd = estimateMatchEndAt(match);
  if (!estimatedEnd) return null;
  return new Date(estimatedEnd.getTime() + Number(toleranceMinutes || 0) * 60_000);
}

export function shouldOpenPostgame(match = {}, now = new Date(), toleranceMinutes = DEFAULT_POSTGAME_TOLERANCE_MINUTES) {
  if (!match || match.status === POSTGAME_STATUS.FINISHED || match.status === POSTGAME_STATUS.CANCELLED) return false;
  const triggerAt = postgameTriggerAt(match, toleranceMinutes);
  if (!triggerAt) return false;
  return new Date(now).getTime() >= triggerAt.getTime();
}

export function eligiblePostgamePlayers(match = {}) {
  return (match.players || []).filter((player) => player.team === 'team1' || player.team === 'team2');
}

export function buildPostgameTask(match = {}, player = {}, options = {}) {
  const nowIso = options.nowIso || new Date().toISOString();
  const trigger = options.triggerAt || postgameTriggerAt(match, options.toleranceMinutes);
  return {
    matchId: match.id,
    arenaId: match.arenaId || match.arena?.id || null,
    sportId: match.sportId || match.sport?.id || null,
    playerId: player.playerId || player.id,
    playerEntryId: player.id || null,
    playerName: player.name || '',
    playerPhone: player.phone || '',
    team: player.team || null,
    status: 'pending',
    triggerAt: trigger ? trigger.toISOString() : nowIso,
    openedAt: nowIso,
    answeredAt: null,
    answer: null,
    xpLocked: true,
    createdBy: POSTGAME_ORCHESTRATOR,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function taskKey(matchId, playerId) {
  return `${matchId}_${playerId}`;
}

export function buildPostgameTasksForMatch(match = {}, options = {}) {
  return eligiblePostgamePlayers(match).map((player) => buildPostgameTask(match, player, options));
}

export function buildPendingXpMessage(match = {}) {
  const sport = match.sport?.name || 'Partida';
  const arena = match.arena?.name || 'Arena Zerø';
  return {
    title: 'XP pendente no lobby',
    body: `${sport} em ${arena}: confirme o resultado para liberar seu XP.`,
    cta: 'Confirmar resultado',
  };
}

export function normalizeScoreAnswer(answer = {}) {
  const team1Score = Number(answer.team1Score);
  const team2Score = Number(answer.team2Score);
  if (!Number.isFinite(team1Score) || !Number.isFinite(team2Score)) return null;
  return {
    team1Score,
    team2Score,
    bestPlayerId: answer.bestPlayerId || null,
    played: answer.played !== false,
    note: String(answer.note || '').slice(0, 280),
  };
}

export function scoreSignature(answer = {}) {
  const normalized = normalizeScoreAnswer(answer);
  if (!normalized) return null;
  return `${normalized.team1Score}x${normalized.team2Score}`;
}

export function evaluatePostgameConsensus(tasks = [], totalEligiblePlayers = 0) {
  const answered = tasks.filter((task) => task.status === 'answered' && task.answer);
  if (!answered.length) return { status: 'pending', consensus: null, answeredCount: 0 };

  const counts = new Map();
  for (const task of answered) {
    const signature = scoreSignature(task.answer);
    if (!signature) continue;
    counts.set(signature, (counts.get(signature) || 0) + 1);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [signature, count] = ranked[0] || [];
  const majority = Math.floor(Number(totalEligiblePlayers || tasks.length) / 2) + 1;

  if (count >= majority) {
    const referenceTask = answered.find((task) => scoreSignature(task.answer) === signature);
    return {
      status: 'consensus',
      consensus: normalizeScoreAnswer(referenceTask.answer),
      signature,
      answeredCount: answered.length,
      consensusCount: count,
      requiredCount: majority,
    };
  }

  if (ranked.length > 1 && answered.length >= Math.min(3, Number(totalEligiblePlayers || tasks.length))) {
    return {
      status: 'divergent',
      consensus: null,
      answeredCount: answered.length,
      options: ranked.map(([optionSignature, optionCount]) => ({ signature: optionSignature, count: optionCount })),
      requiredCount: majority,
    };
  }

  return {
    status: 'waiting_more_answers',
    consensus: null,
    answeredCount: answered.length,
    requiredCount: majority,
  };
}
