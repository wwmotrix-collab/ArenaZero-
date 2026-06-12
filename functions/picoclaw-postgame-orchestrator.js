/*
 * PicoClaw Postgame Orchestrator — Firebase scheduled function skeleton
 *
 * This file is intentionally isolated from the current frontend bundle.
 * It documents and prepares the backend version of Phase 2.
 *
 * Expected runtime:
 * - Firebase Functions v2
 * - Firebase Admin SDK
 * - Cloud Scheduler
 */

const DEFAULT_TOLERANCE_MINUTES = 10;
const ORCHESTRATOR = 'picoclaw-postgame-orchestrator';

function parseMatchStart(match = {}) {
  if (!match.date || !match.time) return null;
  const date = new Date(`${match.date}T${match.time}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function estimateTriggerAt(match = {}, toleranceMinutes = DEFAULT_TOLERANCE_MINUTES) {
  const start = parseMatchStart(match);
  const duration = Number(match.sport?.duration || match.duration || 0);
  if (!start || !duration) return null;
  return new Date(start.getTime() + (duration + toleranceMinutes) * 60_000);
}

function eligiblePlayers(match = {}) {
  return (match.players || []).filter((player) => player.team === 'team1' || player.team === 'team2');
}

function taskId(matchId, playerId) {
  return `${matchId}_${playerId}`;
}

function buildTask(matchId, match, player, triggerAt, nowIso) {
  return {
    matchId,
    arenaId: match.arenaId || match.arena?.id || null,
    sportId: match.sportId || match.sport?.id || null,
    playerId: player.playerId || player.id,
    playerEntryId: player.id || null,
    playerName: player.name || '',
    playerPhone: player.phone || '',
    team: player.team || null,
    status: 'pending',
    triggerAt: triggerAt.toISOString(),
    openedAt: nowIso,
    answeredAt: null,
    answer: null,
    xpLocked: true,
    createdBy: ORCHESTRATOR,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

async function openPostgameForMatch({ db, matchDoc, toleranceMinutes = DEFAULT_TOLERANCE_MINUTES }) {
  const match = matchDoc.data();
  const matchId = matchDoc.id;
  if (match.status === 'finalizada' || match.status === 'cancelada') return { opened: false, reason: 'closed' };

  const triggerAt = estimateTriggerAt(match, toleranceMinutes);
  if (!triggerAt) return { opened: false, reason: 'missing-date-time-or-duration' };
  if (Date.now() < triggerAt.getTime()) return { opened: false, reason: 'not-due' };

  const players = eligiblePlayers(match);
  if (!players.length) return { opened: false, reason: 'no-eligible-players' };

  const batch = db.batch();
  batch.update(matchDoc.ref, {
    status: 'aguardando_resultado',
    postgameOpenedAt: new Date().toISOString(),
    postgameOpenedBy: ORCHESTRATOR,
    updatedAt: new Date().toISOString(),
  });

  const nowIso = new Date().toISOString();
  for (const player of players) {
    const playerId = player.playerId || player.id;
    const ref = db.collection('postgameTasks').doc(taskId(matchId, playerId));
    batch.set(ref, buildTask(matchId, match, player, triggerAt, nowIso), { merge: true });
  }

  await batch.commit();
  return { opened: true, tasks: players.length };
}

/*
 * Example Firebase Functions v2 wiring:
 *
 * const { onSchedule } = require('firebase-functions/v2/scheduler');
 * const admin = require('firebase-admin');
 * admin.initializeApp();
 * const db = admin.firestore();
 *
 * exports.picoclawPostgameOrchestrator = onSchedule('every 10 minutes', async () => {
 *   const snap = await db.collection('matches')
 *     .where('status', 'in', ['em_andamento', 'aguardando_resultado'])
 *     .get();
 *
 *   const results = [];
 *   for (const matchDoc of snap.docs) {
 *     results.push(await openPostgameForMatch({ db, matchDoc }));
 *   }
 *   console.log('[PicoClaw postgame]', results);
 * });
 */

module.exports = {
  DEFAULT_TOLERANCE_MINUTES,
  ORCHESTRATOR,
  estimateTriggerAt,
  openPostgameForMatch,
};
