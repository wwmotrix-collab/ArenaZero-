export const TOURNAMENT_MODELS = Object.freeze({
  SINGLE_ELIMINATION: 'single_elimination',
  GROUPS_KNOCKOUT: 'groups_knockout',
  ROUND_ROBIN: 'round_robin',
});

export const TOURNAMENT_STATUS = Object.freeze({
  DRAFT: 'rascunho',
  PUBLISHED: 'publicado',
  IN_PROGRESS: 'em_andamento',
  FINISHED: 'finalizado',
  CANCELLED: 'cancelado',
});

export function nextPowerOfTwo(value) {
  const number = Math.max(1, Number(value) || 1);
  return 2 ** Math.ceil(Math.log2(number));
}

export function shuffleParticipants(participants = [], random = Math.random) {
  const items = [...participants];
  for (let index = items.length - 1; index > 0; index -= 1) {
    const next = Math.floor(random() * (index + 1));
    [items[index], items[next]] = [items[next], items[index]];
  }
  return items;
}

export function seedParticipants(participants = [], mode = 'manual', random = Math.random) {
  const confirmed = participants.filter((participant) => participant.status !== 'removed');
  if (mode === 'random') return shuffleParticipants(confirmed, random).map((item, index) => ({ ...item, seed: index + 1 }));
  if (mode === 'ranking') return [...confirmed].sort((a, b) => Number(a.seed || 9999) - Number(b.seed || 9999));
  return confirmed.map((item, index) => ({ ...item, seed: item.seed || index + 1 }));
}

export function pairFirstRound(seededParticipants = []) {
  const size = nextPowerOfTwo(seededParticipants.length);
  const slots = Array.from({ length: size }, (_, index) => seededParticipants[index] || null);
  const matches = [];
  for (let index = 0; index < size; index += 2) {
    const team1 = slots[index];
    const team2 = slots[index + 1];
    matches.push({
      round: 1,
      matchNumber: matches.length + 1,
      bracketPosition: `R1M${matches.length + 1}`,
      team1ParticipantId: team1?.id || null,
      team2ParticipantId: team2?.id || null,
      team1Name: team1?.name || 'BYE',
      team2Name: team2?.name || 'BYE',
      bye: !team1 || !team2,
      winnerParticipantId: team1 && !team2 ? team1.id : !team1 && team2 ? team2.id : null,
      status: !team1 || !team2 ? 'bye' : 'agendada',
    });
  }
  return matches;
}

export function buildSingleEliminationBracket(participants = [], options = {}) {
  const seeded = seedParticipants(participants, options.seedingMode || 'manual', options.random);
  const size = nextPowerOfTwo(seeded.length);
  const totalRounds = Math.log2(size);
  const rounds = [];
  rounds.push({ round: 1, name: roundName(1, totalRounds), matches: pairFirstRound(seeded) });

  for (let round = 2; round <= totalRounds; round += 1) {
    const matchCount = size / 2 ** round;
    const matches = Array.from({ length: matchCount }, (_, index) => ({
      round,
      matchNumber: index + 1,
      bracketPosition: `R${round}M${index + 1}`,
      team1ParticipantId: null,
      team2ParticipantId: null,
      team1Name: 'Vencedor anterior',
      team2Name: 'Vencedor anterior',
      winnerParticipantId: null,
      status: 'aguardando',
    }));
    rounds.push({ round, name: roundName(round, totalRounds), matches });
  }

  return {
    model: TOURNAMENT_MODELS.SINGLE_ELIMINATION,
    size,
    totalRounds,
    participants: seeded,
    rounds: linkAdvancement(rounds),
  };
}

export function linkAdvancement(rounds = []) {
  return rounds.map((round, roundIndex) => {
    if (roundIndex >= rounds.length - 1) return round;
    return {
      ...round,
      matches: round.matches.map((match, index) => ({
        ...match,
        winnerAdvancesTo: `R${round.round + 1}M${Math.floor(index / 2) + 1}`,
        winnerSlot: index % 2 === 0 ? 'team1' : 'team2',
      })),
    };
  });
}

export function roundName(round, totalRounds) {
  if (round === totalRounds) return 'Final';
  if (round === totalRounds - 1) return 'Semifinal';
  if (round === totalRounds - 2) return 'Quartas de final';
  return `Rodada ${round}`;
}

export function scheduleTournamentMatches(bracket, options = {}) {
  const courts = options.courts || [];
  const startsAt = new Date(options.startsAt || Date.now());
  const duration = Number(options.matchDurationMinutes || 20);
  const breakDuration = Number(options.breakDurationMinutes || 5);
  if (!courts.length) throw new Error('Informe pelo menos uma quadra para gerar horários.');

  const interval = (duration + breakDuration) * 60_000;
  let slotIndex = 0;

  return {
    ...bracket,
    rounds: bracket.rounds.map((round) => ({
      ...round,
      matches: round.matches.map((match) => {
        if (match.bye) return match;
        const court = courts[slotIndex % courts.length];
        const timeOffset = Math.floor(slotIndex / courts.length) * interval;
        const scheduledAt = new Date(startsAt.getTime() + timeOffset);
        slotIndex += 1;
        return {
          ...match,
          scheduledCourtId: court.id || court,
          scheduledCourtName: court.name || court,
          scheduledAt: scheduledAt.toISOString(),
          matchDurationMinutes: duration,
        };
      }),
    })),
  };
}

export function createTournamentMatchesPayload(tournament = {}, bracket = {}) {
  const matches = [];
  for (const round of bracket.rounds || []) {
    for (const match of round.matches || []) {
      matches.push({
        tournamentId: tournament.id || null,
        tournamentName: tournament.name || '',
        arenaId: tournament.arenaId,
        sportId: tournament.sportId,
        sport: tournament.sport || null,
        courtId: match.scheduledCourtId || null,
        court: match.scheduledCourtName ? { id: match.scheduledCourtId, name: match.scheduledCourtName } : null,
        date: match.scheduledAt ? match.scheduledAt.slice(0, 10) : null,
        time: match.scheduledAt ? match.scheduledAt.slice(11, 16) : null,
        status: match.status === 'bye' ? 'finalizada' : 'aberta',
        context: 'tournament',
        tournamentRound: round.round,
        tournamentRoundName: round.name,
        tournamentMatchNumber: match.matchNumber,
        bracketPosition: match.bracketPosition,
        team1ParticipantId: match.team1ParticipantId,
        team2ParticipantId: match.team2ParticipantId,
        winnerParticipantId: match.winnerParticipantId || null,
        winnerAdvancesTo: match.winnerAdvancesTo || null,
        winnerSlot: match.winnerSlot || null,
        result: match.bye ? { source: 'bye', winnerParticipantId: match.winnerParticipantId, xpApplied: false } : null,
        players: [],
        required: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
  return matches;
}

export function advanceWinner(bracket = {}, bracketPosition, winnerParticipantId) {
  const nextBracket = structuredCloneSafe(bracket);
  let target = null;
  for (const round of nextBracket.rounds || []) {
    for (const match of round.matches || []) {
      if (match.bracketPosition === bracketPosition) {
        match.winnerParticipantId = winnerParticipantId;
        match.status = 'finalizada';
        target = { advancesTo: match.winnerAdvancesTo, slot: match.winnerSlot };
      }
    }
  }
  if (!target?.advancesTo) return nextBracket;
  for (const round of nextBracket.rounds || []) {
    for (const match of round.matches || []) {
      if (match.bracketPosition === target.advancesTo) {
        if (target.slot === 'team1') match.team1ParticipantId = winnerParticipantId;
        if (target.slot === 'team2') match.team2ParticipantId = winnerParticipantId;
        if (match.team1ParticipantId && match.team2ParticipantId && match.status === 'aguardando') match.status = 'agendada';
      }
    }
  }
  return nextBracket;
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
