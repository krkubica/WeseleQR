import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, addDoc, collection, query, orderBy, limit, onSnapshot, deleteDoc, increment } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js';
import { firebaseConfig } from './firebase-config.js';

const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('WKLEJ_');
let auth, db, storage, participantRef, publicProfileRef;
const payload = state => ({ nickname: state.nickname || 'Gość', completedTaskIds: state.completed || [], achievements: state.achievements || [], points: state.points || 0, hasGuestbook: Boolean(state.hasGuestbook), updatedAt: serverTimestamp() });
const profilePayload = state => ({ nickname: state.nickname || 'Gość', points: state.points || 0, completed: (state.completed || []).length, updatedAt: serverTimestamp() });

export async function connectGuest(state) {
  if (!configured) return { mode: 'local', state };
  const app = initializeApp(firebaseConfig); auth = getAuth(app); db = getFirestore(app); storage = getStorage(app);
  if (!auth.currentUser) await signInAnonymously(auth);
  participantRef = doc(db, 'participants', auth.currentUser.uid); publicProfileRef = doc(db, 'publicProfiles', auth.currentUser.uid);
  const snapshot = await getDoc(participantRef);
  if (snapshot.exists()) { const remote=snapshot.data(), completed=remote.completedTaskIds||[]; state={...state,nickname:remote.nickname||state.nickname,completed,achievements:remote.achievements||[],points:typeof remote.points==='number'?remote.points:completed.length*10,hasGuestbook:Boolean(remote.hasGuestbook)}; }
  const participantData = payload(state);
  if (!snapshot.exists()) participantData.createdAt = serverTimestamp();
  await Promise.all([setDoc(participantRef,participantData,{merge:true}),setDoc(publicProfileRef,profilePayload(state),{merge:true})]);
  const statsRef=doc(db,'stats','global'); if(!(await getDoc(statsRef)).exists()) await setDoc(statsRef,{completedTasks:0});
  return { mode:'cloud', state };
}
export async function saveGuest(state) { if (!participantRef) return; await Promise.all([setDoc(participantRef,payload(state),{merge:true}),setDoc(publicProfileRef,profilePayload(state),{merge:true})]); }
export async function addCompletedTask() { if (db) await setDoc(doc(db,'stats','global'),{completedTasks:increment(1)},{merge:true}); }
export async function uploadPhoto(file,state,task,caption='',category='parkiet') { if(!auth?.currentUser||!storage||!db)throw new Error('Brak połączenia z galerią.');const safeCategory=task?'misje':category,ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg',path=`photos/${safeCategory}/${auth.currentUser.uid}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;const storageRef=ref(storage,path);await uploadBytes(storageRef,file,{contentType:file.type});const imageUrl=await getDownloadURL(storageRef);await addDoc(collection(db,'photos'),{imageUrl,storagePath:path,category:safeCategory,nickname:state.nickname||'Gość',caption,taskId:task?.id||null,taskText:task?.text||'',ownerId:auth.currentUser.uid,createdAt:serverTimestamp()}); }
export function listenPhotos(callback,onError){return db?onSnapshot(query(collection(db,'photos'),orderBy('createdAt','desc'),limit(100)),s=>callback(s.docs.map(d=>({id:d.id,...d.data()}))),onError):()=>{};}
export function ownPhoto(photo){return Boolean(auth?.currentUser&&photo.ownerId===auth.currentUser.uid);}
export async function deletePhoto(photo){if(!ownPhoto(photo))throw new Error('Nie możesz usunąć tego zdjęcia.');if(photo.storagePath)await deleteObject(ref(storage,photo.storagePath));await deleteDoc(doc(db,'photos',photo.id));}
export async function saveGuestbook(message,nickname){if(!auth?.currentUser||!db)throw new Error('Brak połączenia.');const wishRef=doc(db,'guestbook',auth.currentUser.uid),exists=(await getDoc(wishRef)).exists();await setDoc(wishRef,{nickname:nickname||'Gość',message,ownerId:auth.currentUser.uid,updatedAt:serverTimestamp(),createdAt:serverTimestamp()},{merge:true});return !exists;}
export function listenGuestbook(callback,onError){return db?onSnapshot(query(collection(db,'guestbook'),orderBy('updatedAt','desc'),limit(40)),s=>callback(s.docs.map(d=>({id:d.id,...d.data()}))),onError):()=>{};}
export async function likePhoto(photoId){if(!auth?.currentUser||!db)throw new Error('Brak połączenia.');const likeRef=doc(db,'photoLikes',`${photoId}_${auth.currentUser.uid}`);if((await getDoc(likeRef)).exists())return false;await setDoc(likeRef,{photoId,ownerId:auth.currentUser.uid,createdAt:serverTimestamp()});return true;}
export function listenLikes(callback,onError){return db?onSnapshot(collection(db,'photoLikes'),s=>callback(s.docs.map(d=>d.data())),onError):()=>{};}
export function listenRanking(callback,onError){return db?onSnapshot(query(collection(db,'publicProfiles'),orderBy('points','desc'),limit(100)),s=>callback(s.docs.map(d=>({id:d.id,...d.data()}))),onError):()=>{};}
export function listenStats(callback,onError){return db?onSnapshot(doc(db,'stats','global'),s=>callback(s.data()||{completedTasks:0}),onError):()=>{};}
