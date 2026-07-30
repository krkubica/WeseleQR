import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { firebaseConfig, ADMIN_EMAIL } from './firebase-config.js';

const $ = id => document.getElementById(id);
const isConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('WKLEJ_');
let auth, db;
function show(id) { ['loginPanel','dashboardPanel'].forEach(name => { const el=$(name), active=name===id; el.classList.toggle('is-active', active); el.setAttribute('aria-hidden', String(!active)); }); }
function safe(text) { const node=document.createElement('span'); node.textContent=text; return node.textContent; }
async function loadDashboard() {
  $('dashboardStatus').textContent='Pobieranie wyników…';
  const snapshot=await getDocs(collection(db,'participants'));
  const users=snapshot.docs.map(d=>d.data()).sort((a,b)=>(b.completedTaskIds?.length||0)-(a.completedTaskIds?.length||0));
  const total=users.reduce((sum,user)=>sum+(user.completedTaskIds?.length||0),0);
  $('guestCount').textContent=users.length; $('missionCount').textContent=total; $('averageCount').textContent=users.length?(total/users.length).toFixed(1):'0';
  $('ranking').innerHTML=users.length?users.map((user,index)=>`<article class="rank-row"><b>${index+1}</b><span>${safe(user.nickname||'Gość')}</span><strong>${user.completedTaskIds?.length||0} / 35</strong></article>`).join(''):'<p class="task-hint">Jeszcze nikt nie rozpoczął misji.</p>';
  $('dashboardStatus').textContent=`Ostatnie odświeżenie: ${new Date().toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})}`;
}
async function login() {
  const email=$('adminEmail').value.trim(), password=$('adminPassword').value;
  $('loginError').textContent='';
  try { const credential=await signInWithEmailAndPassword(auth,email,password); if(credential.user.email?.toLowerCase()!==ADMIN_EMAIL.toLowerCase()){await signOut(auth);throw new Error('To konto nie ma dostępu administratora.');} show('dashboardPanel'); await loadDashboard(); } catch(error) { $('loginError').textContent=error.message==='To konto nie ma dostępu administratora.'?error.message:'Nie udało się zalogować. Sprawdź e-mail i hasło.'; }
}
if (!isConfigured) $('loginError').textContent='Najpierw uzupełnij firebase-config.js zgodnie z instrukcją.';
else { const app=initializeApp(firebaseConfig); auth=getAuth(app); db=getFirestore(app); }
$('loginButton').addEventListener('click',login); $('adminPassword').addEventListener('keydown',event=>{if(event.key==='Enter')login();}); $('refreshButton').addEventListener('click',loadDashboard); $('logoutButton').addEventListener('click',async()=>{await signOut(auth);show('loginPanel');});
