import { firebaseConfig } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, limit } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { shouldOpenPostgame, buildPostgameTasksForMatch, taskKey, normalizeScoreAnswer, evaluatePostgameConsensus } from './postgame-tasks.js';
import { showPendingXpLayer, showPlayerEvolutionLayer } from './player-evolution-layer.js';

const hasFirebase = firebaseConfig?.projectId && !String(firebaseConfig.projectId).includes('COLE_');
const app = hasFirebase ? (getApps()[0] || initializeApp(firebaseConfig)) : null;
const db = hasFirebase ? getFirestore(app) : null;

function cleanPhone(value = '') {
  return String(value).replace(/\D/g, '').slice(-11);
}

function cleanTokenFromUrl() {
  const hash = decodeURIComponent(location.hash || '');
  const params = new URLSearchParams(location.search);
  return params.get('partida') || params.get('token') || (hash.includes('partida=') ? hash.split('partida=')[1] : '');
}

async function findMatch(token = '') {
  if (!db || !token) return null;
  const clean = String(token || '').trim().replace(/^.*partida=/, '').replace(/^.*token=/, '').replace(/^#/, '');
  const snap = await getDocs(query(collection(db, 'matches'), where('token', '==', clean), limit(1)));
  if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  const docSnap = await getDoc(doc(db, 'matches', clean));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

function eligibleStatus(match) {
  return match && match.status !== 'finalizada' && match.status !== 'cancelada' && match.status !== 'contestada';
}

async function createMissingPostgameTasks(match) {
  if (!db || !match?.id) return [];
  const tasks = buildPostgameTasksForMatch(match);
  const created = [];
  for (const task of tasks) {
    const id = taskKey(match.id, task.playerId);
    const ref = doc(db, 'postgameTasks', id);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, task, { merge: true });
      created.push(task);
    }
  }
  return created;
}

async function markMatchWaitingResult(match) {
  if (!db || !match?.id || match.status === 'aguardando_resultado') return;
  await updateDoc(doc(db, 'matches', match.id), {
    status: 'aguardando_resultado',
    postgameOpenedAt: new Date().toISOString(),
    postgameOpenedBy: 'picoclaw-client-phase-2',
    updatedAt: new Date().toISOString(),
  });
}

async function findTaskForPlayer(match, phone) {
  const player = (match.players || []).find((entry) => cleanPhone(entry.phone) === phone);
  if (player?.playerId) {
    const ref = doc(db, 'postgameTasks', taskKey(match.id, player.playerId));
    const snap = await getDoc(ref);
    if (snap.exists()) return { ref, task: { id: snap.id, ...snap.data() }, player };
  }
  const snap = await getDocs(query(collection(db, 'postgameTasks'), where('matchId', '==', match.id), where('playerPhone', '==', phone), limit(1)));
  if (!snap.empty) return { ref: snap.docs[0].ref, task: { id: snap.docs[0].id, ...snap.docs[0].data() }, player };
  return { ref: null, task: null, player };
}

async function updateMatchConsensus(match) {
  const snap = await getDocs(query(collection(db, 'postgameTasks'), where('matchId', '==', match.id)));
  const tasks = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  const total = (match.players || []).filter((player) => player.team === 'team1' || player.team === 'team2').length;
  const consensus = evaluatePostgameConsensus(tasks, total);
  const patch = {
    postgameConsensus: consensus,
    updatedAt: new Date().toISOString(),
  };
  if (consensus.status === 'consensus') patch.status = 'aguardando_confirmacao_resultado';
  if (consensus.status === 'divergent') patch.status = 'contestada';
  await updateDoc(doc(db, 'matches', match.id), patch);
  return consensus;
}

async function collectScoreFromPlayer(match) {
  const phone = cleanPhone(window.prompt('WhatsApp usado na convocação:') || '');
  if (phone.length < 10) return showPlayerEvolutionLayer({
    kicker: 'PÓS-JOGO',
    title: 'WhatsApp inválido',
    body: 'Informe o WhatsApp usado para entrar na partida para localizar seu XP pendente.',
    primaryLabel: 'Tentar de novo',
    onPrimary: () => collectScoreFromPlayer(match),
  });

  const team1Score = window.prompt('Placar do Time 1:');
  const team2Score = window.prompt('Placar do Time 2:');
  const bestPlayerId = window.prompt('Melhor jogador: deixe em branco por enquanto, ou informe o ID se souber.') || null;
  const answer = normalizeScoreAnswer({ team1Score, team2Score, bestPlayerId, played: true });
  if (!answer) return showPlayerEvolutionLayer({
    kicker: 'PÓS-JOGO',
    title: 'Placar inválido',
    body: 'Use apenas números para o placar dos dois times.',
    primaryLabel: 'Corrigir placar',
    onPrimary: () => collectScoreFromPlayer(match),
  });

  const located = await findTaskForPlayer(match, phone);
  if (!located.ref) return showPlayerEvolutionLayer({
    kicker: 'XP PENDENTE',
    title: 'Jogador não encontrado',
    body: 'Não encontrei uma pendência para esse WhatsApp nesta partida. A arena ainda pode lançar o resultado manualmente.',
    primaryLabel: 'Fechar',
  });

  await updateDoc(located.ref, {
    status: 'answered',
    answer,
    answeredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const consensus = await updateMatchConsensus(match);
  const body = consensus.status === 'consensus'
    ? 'Placar recebido. O lobby chegou a um consenso e a arena pode finalizar a pontuação.'
    : consensus.status === 'divergent'
      ? 'Placar recebido. Há divergência no lobby; a arena vai validar antes de liberar XP.'
      : 'Placar recebido. Aguardando mais confirmações do lobby para liberar XP.';

  showPlayerEvolutionLayer({
    kicker: 'RESULTADO ENVIADO',
    title: 'XP ainda pendente',
    body,
    progressLabel: 'Confirmações do lobby',
    progressPercent: consensus.requiredCount ? Math.min((consensus.answeredCount / consensus.requiredCount) * 100, 100) : 50,
    badges: ['pós-jogo', 'colaboração'],
    primaryLabel: 'OK',
  });
}

async function maybeOpenPendingXpLayer() {
  if (!hasFirebase || !db) return;
  const token = cleanTokenFromUrl();
  if (!token) return;
  const match = await findMatch(token);
  if (!eligibleStatus(match)) return;
  if (!shouldOpenPostgame(match)) return;

  await markMatchWaitingResult(match);
  await createMissingPostgameTasks(match);

  showPendingXpLayer({
    match,
    onConfirm: () => collectScoreFromPlayer(match),
  });
}

window.addEventListener('load', () => {
  window.setTimeout(() => {
    maybeOpenPendingXpLayer().catch((error) => {
      console.warn('[Arena Zerø postgame client]', error);
    });
  }, 900);
});
