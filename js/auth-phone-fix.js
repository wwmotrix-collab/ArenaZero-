import { firebaseConfig } from './firebase-config.js';
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  limit,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const cleanPhone = (value = '') => String(value).replace(/\D/g, '').slice(-11);
const normalizeName = (value = '') => String(value).trim().replace(/\s+/g, ' ');
const nowIso = () => new Date().toISOString();

function toast(message) {
  const box = $('toast');
  if (!box) return alert(message);

  box.textContent = message;
  box.classList.remove('hidden');

  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.add('hidden'), 4600);
}

function phoneToAuthEmail(phone) {
  const clean = cleanPhone(phone);
  return `${clean}@arena-zero.local`;
}

function authMessage(error) {
  const code = error?.code || '';

  if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password')) {
    return 'Senha incorreta para este WhatsApp.';
  }

  if (code.includes('auth/user-not-found')) {
    return 'Arena não encontrada. Use Criar arena.';
  }

  if (code.includes('auth/email-already-in-use')) {
    return 'Este WhatsApp já tem conta. Entre no painel com a senha.';
  }

  if (code.includes('auth/weak-password')) {
    return 'Senha fraca. Use pelo menos 6 caracteres.';
  }

  if (code.includes('permission-denied')) {
    return 'Firebase bloqueou a gravação. Verifique as regras do Firestore.';
  }

  return `Erro de autenticação: ${error?.message || error}`;
}

async function findArenaByPhone(phone) {
  const clean = cleanPhone(phone);

  const snap = await getDocs(
    query(
      collection(db, 'arenas'),
      where('phone', '==', clean),
      limit(1)
    )
  );

  if (snap.empty) return null;

  return {
    id: snap.docs[0].id,
    ref: snap.docs[0].ref,
    ...snap.docs[0].data()
  };
}

async function registerArenaWithAuth() {
  const name = normalizeName($('reg-arena-name')?.value || '');
  const phone = cleanPhone($('reg-arena-phone')?.value || '');
  const password = ($('reg-arena-password')?.value || '').trim();

  if (!name || phone.length < 10 || password.length < 6) {
    toast('Preencha nome, WhatsApp válido e senha com 6+ caracteres.');
    return;
  }

  const email = phoneToAuthEmail(phone);

  try {
    let credential;

    try {
      credential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (String(error?.code || '').includes('auth/email-already-in-use')) {
        credential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        throw error;
      }
    }

    const uid = credential.user.uid;
    const existing = await findArenaByPhone(phone);

    if (existing) {
      if (existing.ownerUid && existing.ownerUid !== uid) {
        toast('Este WhatsApp pertence a outra conta autenticada.');
        return;
      }

      await updateDoc(existing.ref, {
        name,
        phone,
        ownerUid: uid,
        updatedAt: nowIso()
      });

      sessionStorage.setItem('arenaZeroArenaId', existing.id);
      toast('Arena autenticada. Abrindo painel...');
      setTimeout(() => location.reload(), 500);
      return;
    }

    const arena = {
      name,
      phone,
      ownerUid: uid,
      courts: [],
      sports: [],
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    const ref = await addDoc(collection(db, 'arenas'), arena);

    sessionStorage.setItem('arenaZeroArenaId', ref.id);
    toast('Arena criada. Abrindo painel...');
    setTimeout(() => location.reload(), 500);
  } catch (error) {
    console.error(error);
    toast(authMessage(error));
  }
}

async function loginArenaWithAuth() {
  const phone = cleanPhone($('arena-phone')?.value || '');
  const password = ($('arena-password')?.value || '').trim();

  if (phone.length < 10 || !password) {
    toast('Informe WhatsApp e senha.');
    return;
  }

  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      phoneToAuthEmail(phone),
      password
    );

    const arena = await findArenaByPhone(phone);

    if (!arena) {
      toast('Login autenticado, mas o cadastro da arena não foi encontrado. Use Criar arena uma vez para vincular.');
      return;
    }

    if (arena.ownerUid && arena.ownerUid !== credential.user.uid) {
      toast('Este WhatsApp pertence a outra conta autenticada.');
      return;
    }

    if (!arena.ownerUid) {
      await updateDoc(arena.ref, {
        ownerUid: credential.user.uid,
        updatedAt: nowIso()
      });
    }

    sessionStorage.setItem('arenaZeroArenaId', arena.id);
    location.reload();
  } catch (error) {
    console.error(error);
    toast(authMessage(error));
  }
}

function installAuthPhoneFix() {
  if (!window.ArenaApp) {
    setTimeout(installAuthPhoneFix, 80);
    return;
  }

  window.ArenaApp.registerArena = registerArenaWithAuth;
  window.ArenaApp.loginArena = loginArenaWithAuth;
}

installAuthPhoneFix();
