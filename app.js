import { municipalities } from './municipalities.js';
import { mapView, mapRegions } from './mapdata.js';
import { groups, vault, salt, iterations } from './gamedata.js';
import { firebaseConfig, questionSeconds, maxLives } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, doc, getDoc, setDoc, increment, addDoc, collection,
  query, orderBy, limit, getDocs, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const $ = (id) => document.getElementById(id);
const screens = ['start', 'game', 'lost', 'won', 'scores'];
const nameOf = Object.fromEntries(municipalities.map((m) => [m.id, m.name]));

let db = null;
try { db = getFirestore(initializeApp(firebaseConfig)); } catch (e) { console.warn('Firebase ikke sat op', e); }

let playerName = localStorage.getItem('hpfName') || '';
let game = null; // { lives, solved:Set, answers, question, town, startedAt, deadline, over }
let map, regions = {}, labels = {};
let tick = null;
let totalTick = null;

function show(name) {
  screens.forEach((s) => ($('screen-' + s).hidden = s !== name));
  $('topbar').hidden = name !== 'game';
  if (name === 'game' && !map) initMap();
}

function setFeedback(text, cls) {
  $('feedback').textContent = text;
  $('feedback').className = cls || '';
}

const clock = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const formatTime = (sec) => `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, '0')} sek`;

// ---- Firebase ----
async function bump(field) {
  if (!db) return;
  try { await setDoc(doc(db, 'hpf_stats', 'counters'), { [field]: increment(1) }, { merge: true }); } catch (e) { console.warn(e); }
}

async function loadStats() {
  if (!db) return;
  try {
    const d = await getDoc(doc(db, 'hpf_stats', 'counters'));
    const { attempts = 0, completed = 0 } = d.exists() ? d.data() : {};
    $('stats').textContent = `${completed} har gennemført spillet ud af ${attempts} forsøg`;
  } catch (e) { console.warn(e); }
}

async function showScores() {
  stopTimers();
  const body = $('score-body');
  body.replaceChildren();
  show('scores');
  if (!db) return;
  try {
    const snap = await getDocs(query(collection(db, 'hpf_scores'), orderBy('seconds', 'asc'), limit(50)));
    snap.docs.forEach((d, i) => {
      const r = d.data();
      const t = r.createdAt?.toDate ? r.createdAt.toDate() : null;
      const row = [
        i + 1, r.name, formatTime(r.seconds), r.lives == null ? '–' : `❤️ ${r.lives}`,
        t ? t.toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–',
        t ? t.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }) : '–',
      ];
      const tr = document.createElement('tr');
      row.forEach((v) => tr.appendChild(Object.assign(document.createElement('td'), { textContent: v })));
      body.appendChild(tr);
    });
  } catch (e) { console.warn(e); }
}

// ---- Kryptering (svar er kun gemt som hash, koordinaten er krypteret) ----
const enc = new TextEncoder();
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

async function pbkdf2(password, bits = 256) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromB64(salt), iterations, hash: 'SHA-256' }, base, bits);
}

async function isCorrect(groupIndex, regionId) {
  return toB64(await pbkdf2(`${groupIndex}:${regionId}`)) === groups[groupIndex].check;
}

async function openVault(answers) {
  const key = await crypto.subtle.importKey('raw', await pbkdf2([...answers].sort().join('|')), 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(vault.iv) }, key, fromB64(vault.data));
  return new TextDecoder().decode(plain);
}

// ---- Kort (indbygget SVG, ingen eksterne korttjenester) ----
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (name, attrs) => {
  const el = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
};

function initMap() {
  map = $('map');
  map.setAttribute('viewBox', `0 0 ${mapView.width} ${mapView.height}`);
  mapRegions.forEach(({ id, d, c }) => {
    const p = svgEl('path', { d, class: 'land', 'fill-rule': 'evenodd', fill: c });
    p.addEventListener('click', () => guess(id));
    map.appendChild(p);
    regions[id] = p;
  });
  municipalities.forEach((m) => {
    const t = svgEl('text', {
      x: (m.lng - mapView.lng0) * mapView.cos * mapView.scale,
      y: (mapView.lat1 - m.lat) * mapView.scale, class: 'label',
    });
    t.textContent = m.name;
    t.setAttribute('visibility', 'hidden');
    map.appendChild(t);
    labels[m.id] = t;
  });
}

function styleMap() {
  Object.entries(regions).forEach(([id, p]) => {
    const done = game.solved.has(id);
    p.classList.toggle('done', done);
    labels[id].setAttribute('visibility', done ? 'visible' : 'hidden');
  });
  $('done-list').textContent = game.solved.size ? [...game.solved].map((id) => nameOf[id]).join(', ') : 'ingen endnu';
}

function flashWrong(id) {
  const p = regions[id];
  if (!p) return;
  p.classList.add('flash-bad');
  setTimeout(() => p.classList.remove('flash-bad'), 700);
}

// ---- Spil ----
function nextQuestion() {
  const open = groups.map((g, i) => i).filter((i) => game.answers[i] === undefined);
  game.question = open[Math.floor(Math.random() * open.length)];
  const towns = groups[game.question].towns;
  game.town = towns[Math.floor(Math.random() * towns.length)];
  game.deadline = Date.now() + questionSeconds * 1000;
}

function renderGame(keepFeedback) {
  $('player').textContent = playerName;
  $('lives').textContent = `❤️ ${game.lives}/${maxLives}`;
  $('progress').textContent = `${game.solved.size}/${groups.length}`;
  $('town').textContent = game.town;
  if (!keepFeedback) setFeedback('Tryk på den rigtige kommune på kortet.');
  show('game');
  styleMap();
  startTimers();
}

// Et liv mistes, og rækken nulstilles (den samlede tid løber videre).
function loseLife() {
  game.lives--;
  if (game.lives <= 0) {
    game.over = true;
    stopTimers();
    show('lost');
    return true;
  }
  game.solved = new Set();
  game.answers = [];
  return false;
}

async function guess(id) {
  if (!game || game.over || game.busy || game.solved.has(id)) return;
  game.busy = true;
  const current = game;
  const qi = game.question;
  const correct = await isCorrect(qi, id);
  current.busy = false;
  if (game !== current || game.over || game.question !== qi) return;
  if (correct) {
    game.solved.add(id);
    game.answers[qi] = id;
    if (game.solved.size === groups.length) return win();
    nextQuestion();
    renderGame();
    setFeedback('Rigtigt! Her er næste by.', 'good');
  } else {
    if (loseLife()) return;
    nextQuestion();
    renderGame(true);
    flashWrong(id);
    setFeedback('Forkert – du mistede et liv og starter forfra med en ny række byer.', 'bad');
  }
}

function startTimers() {
  stopTimers();
  const update = () => {
    const left = Math.max(0, game.deadline - Date.now());
    const sec = Math.ceil(left / 1000);
    $('timer').textContent = clock(sec);
    $('timer').className = sec <= 20 ? 'low' : '';
    if (left <= 0) {
      stopTimers();
      if (loseLife()) return;
      nextQuestion();
      renderGame(true);
      setFeedback('Tiden løb ud – du mistede et liv og starter forfra med en ny række byer.', 'bad');
    }
  };
  const updateTotal = () => { $('total').textContent = clock(Math.floor((Date.now() - game.startedAt) / 1000)); };
  update();
  updateTotal();
  tick = setInterval(update, 250);
  totalTick = setInterval(updateTotal, 500);
}

function stopTimers() {
  clearInterval(tick);
  clearInterval(totalTick);
  tick = totalTick = null;
}

async function win() {
  game.over = true;
  stopTimers();
  const seconds = Math.round((Date.now() - game.startedAt) / 1000);
  $('won-time').textContent = formatTime(seconds);
  try { $('final-coord').textContent = await openVault(game.answers); } catch { $('final-coord').textContent = 'Fejl – kontakt cache-ejeren'; }
  show('won');
  bump('completed');
  if (db) {
    try { await addDoc(collection(db, 'hpf_scores'), { name: playerName, seconds, lives: game.lives, createdAt: serverTimestamp() }); } catch (e) { console.warn(e); }
  }
  loadStats();
}

function start(name) {
  playerName = name.replace(/\s+/g, ' ').trim().slice(0, 20);
  if (!playerName) return;
  localStorage.setItem('hpfName', playerName);
  game = { lives: maxLives, solved: new Set(), answers: [], startedAt: Date.now(), over: false };
  nextQuestion();
  renderGame();
  bump('attempts').then(loadStats);
}

$('start-form').addEventListener('submit', (e) => { e.preventDefault(); start($('name').value); });
$('retry').addEventListener('click', () => { $('name').value = playerName; show('start'); });
$('to-scores-start').addEventListener('click', (e) => { e.preventDefault(); showScores(); });
$('to-scores-won').addEventListener('click', showScores);
$('back').addEventListener('click', () => {
  if (game && !game.over) renderGame(true);
  else show('start');
});

$('name').value = playerName;
loadStats();
show('start');
