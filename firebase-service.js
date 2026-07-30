import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, addDoc, collection, query, orderBy, limit, onSnapshot, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js';
import { firebaseConfig } from './firebase-config.js';

const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('WKLEJ_');
let auth;
let db;
let storage;
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
  storage = getStorage(app);
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

export async function uploadPhoto(file, state, task, caption = '') {
  if (!auth?.currentUser || !storage || !db) throw new Error('Brak połączenia z galerią.');
  const extension = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
  const path = `photos/${auth.currentUser.uid}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${extension}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  const imageUrl = await getDownloadURL(storageRef);
  await addDoc(collection(db, 'photos'), { imageUrl, storagePath: path, nickname: state.nickname || 'Gość', caption, taskId: task?.id || null, taskText: task?.text || '', ownerId: auth.currentUser.uid, createdAt: serverTimestamp() });
}

export function listenPhotos(callback, onError) {
  if (!db) return () => {};
  return onSnapshot(query(collection(db, 'photos'), orderBy('createdAt', 'desc'), limit(100)), snapshot => callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))), onError);
}

export function ownPhoto(photo) {
  return Boolean(auth?.currentUser && photo.ownerId === auth.currentUser.uid);
}

export async function deletePhoto(photo) {
  if (!ownPhoto(photo)) throw new Error('Nie możesz usunąć tego zdjęcia.');
  if (photo.storagePath) await deleteObject(ref(storage, photo.storagePath));
  await deleteDoc(doc(db, 'photos', photo.id));
}
