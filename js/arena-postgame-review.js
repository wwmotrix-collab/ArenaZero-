import { firebaseConfig } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, limit } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { buildPostgameSnapshot, buildResultPayload } from './postgame-engine.js';

const hasFirebase = firebaseConfig?.projectId && !String(firebaseConfig.projectId).includes('COLE_');
const app = hasFirebase ? (getApps()[0] || initializeApp(firebaseConfig)) : null;
const db = hasFirebase ? getFirestore(app) : null;

function sessionArenaId() {
  return sessionStorage.getItem('arenaZeroArenaId');
}

function nowIso() {
  return new Date().toISOString();
}

function ensurePanel() {
  const matchesList = document.getElementById('matches-list');
  if (!matchesList) return null;
  let panel = document.getElementById('arena-postgame-review-panel');
  if (panel) return panel;
  panel = document.createElement('div');
  panel.id = 'arena-postgame-review-panel';
  panel.className = 'arena-postgame-review-panel hidden';
  panel.innerHTML = `
    <div class="apgr-head">
      <div>
        <span>PÓS-JOGO</span>
        <h3>Resultados aguardando validação</h3>
      </div>
      <button type="button" data-apgr-refresh>Atualizar</button>
    </div>
    <div class="apgr-list" data-apgr-list></div>
  `;
  matchesList.parentNode.insertBefore(panel, matchesList);
  panel.querySelector('[data-apgr-refresh]')?.addEventListener('click', () => renderArenaPostgameReview());
  return panel;
}

function matchTitle(match = {}) {
  const sport = match.sport?.name || 'Partida';
  const court = match.court?.name || 'Quadra';
  const date = [match.date, match.time].filter(Boolean).join(' · ');
  return `${sport} · ${court}${date ? ` · ${date}` : ''}`;
}

async function loadPendingMatches(arenaId) {
  const statuses = ['aguardando_confirmacao_resultado', 'contestada'];
  const found = [];
  for (const status of statuses) {
    const snap = await getDocs(query(collection(db, 'matches'), where('arenaId', '==', arenaId), where('status', '==', status), limit(20)));
    snap.docs.forEach((item) => found.push({ id: item.id, ...item.data() }));
  }
  return found.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}

async function loadPlayerDocs(entries = []) {
  const docs = [];
  for (const entry of entries) {
    const snap = await getDoc(doc(db, 'players', entry.playerId));
    docs.push(snap.exists() ? { id: snap.id, ...snap.data() } : { id: entry.playerId, name: entry.name, phone: entry.phone, xp: 0, mmr: 1000, matches: 0, wins: 0, draws: 0, losses: 0, bestPlayerCount: 0, statsBySport: {} });
  }
  return docs;
}

function resultStats(result) {
  return {
    win: result === 'win' ? 1 : 0,
    draw: result === 'draw' ? 1 : 0,
    loss: result === 'loss' ? 1 : 0,
  };
}

async function applyConsensusResult(matchId) {
  const matchSnap = await getDoc(doc(db, 'matches', matchId));
  if (!matchSnap.exists()) return alert('Partida não encontrada.');
  const match = { id: matchSnap.id, ...matchSnap.data() };
  if (match.status === 'finalizada' || match.result?.xpApplied) return alert('Resultado já finalizado.');

  const consensus = match.postgameConsensus?.consensus;
  if (!consensus) return alert('Ainda não há consenso de placar para aplicar.');

  const activeEntries = (match.players || []).filter((player) => player.team === 'team1' || player.team === 'team2');
  if (!activeEntries.length) return alert('Sem titulares para pontuar.');

  const playerDocs = await loadPlayerDocs(activeEntries);
  const snapshot = buildPostgameSnapshot({
    match,
    playerData: playerDocs,
    team1Score: consensus.team1Score,
    team2Score: consensus.team2Score,
    bestPlayerId: consensus.bestPlayerId || null,
    antiAbuseFactor: 1,
  });

  for (const entry of snapshot) {
    const current = playerDocs.find((player) => player.id === entry.playerId) || {};
    const stats = resultStats(entry.result);
    const sportId = match.sportId || match.sport?.id || 'geral';
    const oldSport = current.statsBySport?.[sportId] || { xp: 0, mmr: current.mmr || 1000, matches: 0, wins: 0, draws: 0, losses: 0, bestPlayerCount: 0 };
    const patch = {
      name: current.name || entry.name,
      phone: current.phone || entry.phone,
      xp: Number(current.xp || 0) + Number(entry.xpEarned || 0),
      mmr: Math.round(Number(current.mmr || 1000) + Number(entry.mmrDelta || 0)),
      matches: Number(current.matches || 0) + 1,
      wins: Number(current.wins || 0) + stats.win,
      draws: Number(current.draws || 0) + stats.draw,
      losses: Number(current.losses || 0) + stats.loss,
      bestPlayerCount: Number(current.bestPlayerCount || 0) + (entry.bestPlayer ? 1 : 0),
      lastEvolution: {
        matchId,
        xpEarned: entry.xpEarned || 0,
        mmrDelta: entry.mmrDelta || 0,
        bestPlayer: Boolean(entry.bestPlayer),
        createdAt: nowIso(),
      },
      updatedAt: nowIso(),
      statsBySport: {
        ...(current.statsBySport || {}),
        [sportId]: {
          xp: Number(oldSport.xp || 0) + Number(entry.xpEarned || 0),
          mmr: Math.round(Number(oldSport.mmr || current.mmr || 1000) + Number(entry.mmrDelta || 0)),
          matches: Number(oldSport.matches || 0) + 1,
          wins: Number(oldSport.wins || 0) + stats.win,
          draws: Number(oldSport.draws || 0) + stats.draw,
          losses: Number(oldSport.losses || 0) + stats.loss,
          bestPlayerCount: Number(oldSport.bestPlayerCount || 0) + (entry.bestPlayer ? 1 : 0),
        },
      },
    };
    await setDoc(doc(db, 'players', entry.playerId), patch, { merge: true });
  }

  const result = buildResultPayload({
    team1Score: consensus.team1Score,
    team2Score: consensus.team2Score,
    bestPlayerId: consensus.bestPlayerId || null,
    antiAbuseFactor: 1,
  });

  await updateDoc(doc(db, 'matches', matchId), {
    players: snapshot,
    result: {
      ...result,
      source: 'postgame_consensus',
      appliedBy: 'arena-postgame-review',
      consensus: match.postgameConsensus || null,
    },
    status: 'finalizada',
    postgameFinalizedAt: nowIso(),
    updatedAt: nowIso(),
  });

  alert('Resultado consensual aplicado. XP/MMR liberados.');
  await renderArenaPostgameReview();
  window.ArenaApp?.showScreen?.('arena-dashboard');
}

function renderMatchCard(match) {
  const consensus = match.postgameConsensus || {};
  const score = consensus.consensus ? `${consensus.consensus.team1Score} x ${consensus.consensus.team2Score}` : 'sem consenso';
  const statusText = consensus.status === 'divergent' ? 'Divergência' : consensus.status === 'consensus' ? 'Consenso' : 'Aguardando respostas';
  const canApply = Boolean(consensus.consensus) && match.status === 'aguardando_confirmacao_resultado';
  return `
    <div class="apgr-card" data-match-id="${match.id}">
      <div class="apgr-card-top">
        <strong>${matchTitle(match)}</strong>
        <span class="${consensus.status === 'divergent' ? 'danger' : 'ok'}">${statusText}</span>
      </div>
      <p>Placar sugerido: <b>${score}</b> · respostas: ${consensus.answeredCount || 0}/${consensus.requiredCount || '-'}</p>
      <div class="apgr-actions">
        <button type="button" data-apply-consensus="${match.id}" ${canApply ? '' : 'disabled'}>Aplicar consenso e liberar XP/MMR</button>
        <button type="button" data-open-manual="${match.id}">Abrir resultado manual</button>
      </div>
    </div>
  `;
}

export async function renderArenaPostgameReview() {
  if (!hasFirebase || !db) return;
  const arenaId = sessionArenaId();
  const panel = ensurePanel();
  if (!panel || !arenaId) return;
  const list = panel.querySelector('[data-apgr-list]');
  const matches = await loadPendingMatches(arenaId);
  panel.classList.toggle('hidden', !matches.length);
  if (!matches.length) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = matches.map(renderMatchCard).join('');
  list.querySelectorAll('[data-apply-consensus]').forEach((button) => {
    button.addEventListener('click', () => applyConsensusResult(button.dataset.applyConsensus).catch((error) => {
      console.warn('[Arena Zerø apply consensus]', error);
      alert('Erro ao aplicar consenso. Veja o console.');
    }));
  });
  list.querySelectorAll('[data-open-manual]').forEach((button) => {
    button.addEventListener('click', () => window.ArenaApp?.showScreen?.('arena-dashboard') || null);
  });
}

window.addEventListener('load', () => {
  window.setInterval(() => renderArenaPostgameReview().catch(() => {}), 8000);
  window.setTimeout(() => renderArenaPostgameReview().catch(() => {}), 1200);
});
