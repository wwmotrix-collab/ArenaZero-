import { firebaseConfig } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, limit } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { shouldOpenPostgame, buildPostgameTasksForMatch, taskKey } from './postgame-tasks.js';
import { showPendingXpLayer } from './player-evolution-layer.js';

const hasFirebase = firebaseConfig?.projectId && !String(firebaseConfig.projectId).includes('COLE_');
const app = hasFirebase ? (getApps()[0] || initializeApp(firebaseConfig)) : null;
const db = hasFirebase ? getFirestore(app) : null;

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

function openResultFromPlayer(match) {
  if (window.ArenaApp?.showScreen && window.ArenaApp?.saveResult) {
    window.ArenaApp.showScreen('arena-dashboard');
  }
  window.setTimeout(() => {
    const resultButton = document.querySelector(`[data-result="${match.id}"]`);
    if (resultButton) {
      resultButton.click();
      return;
    }
    if (window.ArenaApp?.showScreen) {
      window.ArenaApp.showScreen('result');
      const info = document.getElementById('result-match-info');
      if (info) info.textContent = 'Resultado aberto pelo pós-jogo. Use o painel da arena se os dados não carregarem automaticamente.';
    }
  }, 250);
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
    onConfirm: () => openResultFromPlayer(match),
  });
}

window.addEventListener('load', () => {
  window.setTimeout(() => {
    maybeOpenPendingXpLayer().catch((error) => {
      console.warn('[Arena Zerø postgame client]', error);
    });
  }, 900);
});
