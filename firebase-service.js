import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('WKLEJ_');
let auth;
let db;
let participantRef;

function payload(state) {
  return {
    nickname: state.nickname || 'Gość',
    completedTaskIds: state.completed || [],
    achievements: state.achievements || [],
    updatedAt: serverTimestamp()
  };
}

export async function connectGuest(state) {
  if (!configured) return { mode: 'local', state };
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  if (!auth.currentUser) await signInAnonymously(auth);
  participantRef = doc(db, 'participants', auth.currentUser.uid);
  const snapshot = await getDoc(participantRef);
  if (snapshot.exists()) {
    const remote = snapshot.data();
    return { mode: 'cloud', state: { ...state, nickname: remote.nickname || state.nickname, completed: remote.completedTaskIds || [], achievements: remote.achievements || [] } };
  }
  await setDoc(participantRef, { ...payload(state), createdAt: serverTimestamp() });
  return { mode: 'cloud', state };
}

export async function saveGuest(state) {
  if (!participantRef) return;
  await setDoc(participantRef, payload(state), { merge: true });
}
