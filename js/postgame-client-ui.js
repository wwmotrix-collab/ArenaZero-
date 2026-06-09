import { firebaseConfig } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, limit } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { shouldOpenPostgame, buildPostgameTasksForMatch, taskKey, normalizeScoreAnswer, evaluatePostgameConsensus } from './postgame-tasks.js';
import { showPendingXpLayer, showPlayerEvolutionLayer } from './player-evolution-layer.js';
import { showPostgameResultModal, hidePostgameResultModal } from './postgame-result-modal.js';

const hasFirebase = firebaseConfig?.projectId && !String(firebaseConfig.projectId).includes('COLE_');
const app = hasFirebase ? (getApps()[0] || initializeApp(firebaseConfig)) : null;
const db = hasFirebase ? getFirestore(app) : null;
const cleanPhone = (value = '') => String(value).replace(/\D/g, '').slice(-11);

function tokenFromUrl() {
  const hash = decodeURIComponent(location.hash || '');
  const params = new URLSearchParams(location.search);
  return params.get('partida') || params.get('token') || (hash.includes('partida=') ? hash.split('partida=')[1] : '');
}

async function findMatch(token = '') {
  if (!db || !token) return null;
  const clean = String(token).trim().replace(/^.*partida=/, '').replace(/^.*token=/, '').replace(/^#/, '');
  const snap = await getDocs(query(collection(db, 'matches'), where('token', '==', clean), limit(1)));
  if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  const direct = await getDoc(doc(db, 'matches', clean));
  return direct.exists() ? { id: direct.id, ...direct.data() } : null;
}

async function openTasks(match) {
  const tasks = buildPostgameTasksForMatch(match);
  for (const task of tasks) {
    const ref = doc(db, 'postgameTasks', taskKey(match.id, task.playerId));
    const existing = await getDoc(ref);
    if (!existing.exists()) await setDoc(ref, task, { merge: true });
  }
}

async function markWaiting(match) {
  if (!match?.id || match.status === 'aguardando_resultado') return;
  await updateDoc(doc(db, 'matches', match.id), {
    status: 'aguardando_resultado',
    postgameOpenedAt: new Date().toISOString(),
    postgameOpenedBy: 'picoclaw-client-ui-phase-2',
    updatedAt: new Date().toISOString(),
  });
}

async function locatePlayerTask(match, phone) {
  const player = (match.players || []).find((entry) => cleanPhone(entry.phone) === phone);
  if (player?.playerId) {
    const ref = doc(db, 'postgameTasks', taskKey(match.id, player.playerId));
    const snap = await getDoc(ref);
    if (snap.exists()) return { ref, player };
  }
  const snap = await getDocs(query(collection(db, 'postgameTasks'), where('matchId', '==', match.id), where('playerPhone', '==', phone), limit(1)));
  if (!snap.empty) return { ref: snap.docs[0].ref, player };
  return { ref: null, player };
}

async function refreshConsensus(match) {
  const snap = await getDocs(query(collection(db, 'postgameTasks'), where('matchId', '==', match.id)));
  const tasks = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  const total = (match.players || []).filter((player) => player.team === 'team1' || player.team === 'team2').length;
  const consensus = evaluatePostgameConsensus(tasks, total);
  const patch = { postgameConsensus: consensus, updatedAt: new Date().toISOString() };
  if (consensus.status === 'consensus') patch.status = 'aguardando_confirmacao_resultado';
  if (consensus.status === 'divergent') patch.status = 'contestada';
  await updateDoc(doc(db, 'matches', match.id), patch);
  return consensus;
}

async function submitResult(match, payload) {
  const phone = cleanPhone(payload.phone || '');
  if (phone.length < 10) {
    showPlayerEvolutionLayer({ kicker: 'PÓS-JOGO', title: 'WhatsApp inválido', body: 'Informe o WhatsApp usado para entrar na partida.', primaryLabel: 'Corrigir', onPrimary: () => openModal(match) });
    return;
  }
  const answer = normalizeScoreAnswer({ team1Score: payload.team1Score, team2Score: payload.team2Score, bestPlayerId: payload.bestPlayerId, played: true, note: payload.note });
  if (!answer) {
    showPlayerEvolutionLayer({ kicker: 'PÓS-JOGO', title: 'Placar inválido', body: 'Use apenas números para o placar dos dois times.', primaryLabel: 'Corrigir', onPrimary: () => openModal(match) });
    return;
  }
  const located = await locatePlayerTask(match, phone);
  if (!located.ref) {
    showPlayerEvolutionLayer({ kicker: 'XP PENDENTE', title: 'Jogador não encontrado', body: 'Não encontrei uma pendência para esse WhatsApp nesta partida.', primaryLabel: 'Fechar' });
    return;
  }
  await updateDoc(located.ref, { status: 'answered', answer, answeredAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  hidePostgameResultModal();
  const consensus = await refreshConsensus(match);
  const body = consensus.status === 'consensus'
    ? 'Placar recebido. O lobby chegou a um consenso e a arena pode finalizar a pontuação.'
    : consensus.status === 'divergent'
      ? 'Placar recebido. Há divergência no lobby; a arena vai validar antes de liberar XP.'
      : 'Placar recebido. Aguardando mais confirmações do lobby para liberar XP.';
  showPlayerEvolutionLayer({ kicker: 'RESULTADO ENVIADO', title: 'XP ainda pendente', body, progressLabel: 'Confirmações do lobby', progressPercent: consensus.requiredCount ? Math.min((consensus.answeredCount / consensus.requiredCount) * 100, 100) : 50, badges: ['pós-jogo', 'colaboração'], primaryLabel: 'OK' });
}

function openModal(match) {
  showPostgameResultModal({ match, onSubmit: (payload) => submitResult(match, payload) });
}

async function bootPostgameUi() {
  if (!hasFirebase || !db) return;
  const token = tokenFromUrl();
  if (!token) return;
  const match = await findMatch(token);
  if (!match || ['finalizada', 'cancelada', 'contestada'].includes(match.status)) return;
  if (!shouldOpenPostgame(match)) return;
  await markWaiting(match);
  await openTasks(match);
  showPendingXpLayer({ match, onConfirm: () => openModal(match) });
}

window.addEventListener('load', () => {
  window.setTimeout(() => bootPostgameUi().catch((error) => console.warn('[Arena Zerø postgame UI]', error)), 900);
});
