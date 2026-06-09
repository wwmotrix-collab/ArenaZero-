export const POSTGAME_RULES_VERSION = 'arena-zero-postgame-1.0.0';

export const XP_RULES = Object.freeze({
  win: 10,
  loss: 6,
  draw: 8,
  captainBonus: 2,
  antiAbuseRepeatedOnce: 0.5,
  antiAbuseRepeatedTwice: 0.2,
});

export const MMR_RULES = Object.freeze({
  initial: 1000,
  kFactor: 32,
});

export function expectedScore(ownAverageMmr = MMR_RULES.initial, opponentAverageMmr = MMR_RULES.initial) {
  return 1 / (1 + Math.pow(10, (opponentAverageMmr - ownAverageMmr) / 400));
}

export function bestPlayerBonus(previousBestPlayerCount = 0) {
  return Math.round(4 + Math.log1p(Math.max(Number(previousBestPlayerCount) || 0, 0)) * 2);
}

export function resultLabelForTeam(winner, team) {
  if (winner === 'draw') return 'draw';
  return winner === team ? 'win' : 'loss';
}

export function baseXpForResult(result) {
  if (result === 'win') return XP_RULES.win;
  if (result === 'draw') return XP_RULES.draw;
  return XP_RULES.loss;
}

export function calculateXp({ result, isCaptain = false, isBestPlayer = false, previousBestPlayerCount = 0, antiAbuseFactor = 1 }) {
  const base = baseXpForResult(result);
  const captain = isCaptain ? XP_RULES.captainBonus : 0;
  const best = isBestPlayer ? bestPlayerBonus(previousBestPlayerCount) : 0;
  return Math.max(0, Math.round((base + captain + best) * Number(antiAbuseFactor || 0)));
}

export function calculateMmrDelta({ ownAverageMmr = MMR_RULES.initial, opponentAverageMmr = MMR_RULES.initial, result, kFactor = MMR_RULES.kFactor }) {
  const actual = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  const expected = expectedScore(ownAverageMmr, opponentAverageMmr);
  return Math.round(kFactor * (actual - expected));
}

export function averageMmr(entries = [], playerById = new Map()) {
  if (!entries.length) return MMR_RULES.initial;
  const sum = entries.reduce((total, entry) => {
    const player = playerById.get(entry.playerId) || {};
    return total + Number(player.mmr || MMR_RULES.initial);
  }, 0);
  return sum / entries.length;
}

export function buildPostgameSnapshot({ match, playerData = [], team1Score, team2Score, bestPlayerId = null, antiAbuseFactor = 1 }) {
  const winner = Number(team1Score) === Number(team2Score) ? 'draw' : Number(team1Score) > Number(team2Score) ? 'team1' : 'team2';
  const activePlayers = (match.players || []).filter((player) => player.team === 'team1' || player.team === 'team2');
  const playerById = new Map(playerData.map((player) => [player.id, player]));
  const team1 = activePlayers.filter((player) => player.team === 'team1');
  const team2 = activePlayers.filter((player) => player.team === 'team2');
  const team1AverageMmr = averageMmr(team1, playerById);
  const team2AverageMmr = averageMmr(team2, playerById);

  return activePlayers.map((entry) => {
    const current = playerById.get(entry.playerId) || {};
    const result = resultLabelForTeam(winner, entry.team);
    const opponentAverageMmr = entry.team === 'team1' ? team2AverageMmr : team1AverageMmr;
    const ownAverageMmr = entry.team === 'team1' ? team1AverageMmr : team2AverageMmr;
    const isBestPlayer = bestPlayerId === entry.playerId;
    return {
      ...entry,
      result,
      bestPlayer: isBestPlayer,
      xpEarned: calculateXp({
        result,
        isCaptain: entry.role === 'capitao',
        isBestPlayer,
        previousBestPlayerCount: current.bestPlayerCount || 0,
        antiAbuseFactor,
      }),
      mmrDelta: calculateMmrDelta({ ownAverageMmr, opponentAverageMmr, result }),
    };
  });
}

export function buildResultPayload({ team1Score, team2Score, bestPlayerId = null, antiAbuseFactor = 1 }) {
  const winner = Number(team1Score) === Number(team2Score) ? 'draw' : Number(team1Score) > Number(team2Score) ? 'team1' : 'team2';
  return {
    team1Score: Number(team1Score),
    team2Score: Number(team2Score),
    winner,
    bestPlayerId,
    antiAbuseFactor,
    xpRulesVersion: POSTGAME_RULES_VERSION,
    mmrRulesVersion: POSTGAME_RULES_VERSION,
    submittedAt: new Date().toISOString(),
    xpApplied: true,
  };
}
