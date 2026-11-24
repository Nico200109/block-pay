// ============================================================
// Block&Pay – vente réelle : code commun (salle + administration)
// ============================================================

firebase.initializeApp({
  apiKey: "AIzaSyApJMMo39Hq3TsnS1_hbeX4Y9ZW03kHI2k",
  authDomain: "clicwin-856cb.firebaseapp.com",
  databaseURL: "https://clicwin-856cb-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "clicwin-856cb",
  storageBucket: "clicwin-856cb.firebasestorage.app",
  messagingSenderId: "572637939152",
  appId: "1:572637939152:web:0d2ca138d70c6ce0f725d5"
});

// Tests sur l'ordinateur (http://localhost) : on utilise l'émulateur Firebase, jamais la vraie base.
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  firebase.database().useEmulator('127.0.0.1', 9000);
  if (firebase.auth) firebase.auth().useEmulator('http://127.0.0.1:9099');
}

const db = firebase.database();
const V = 'vente';              // toutes les données de la vente réelle sont sous /vente
const DELAI_PAIEMENT = 180;     // 3 minutes pour payer (CGV)
const PALIER_MIN = 60;          // une fois le prix minimum atteint, l'article reste 60 s
const TICK = 200;               // le prix bouge toutes les 200 ms

// Heure du serveur Firebase (évite les écarts d'horloge entre téléphones)
let ecartServeur = 0;
db.ref('.info/serverTimeOffset').on('value', s => { ecartServeur = s.val() || 0; });
function maintenant() { return Date.now() + ecartServeur; }

// Prix à l'instant t : baisse de 0,05 € toutes les 200 ms (duree = temps pour atteindre le minimum).
function prixA(article, etat, t) {
  const dep = Number(article.prixDepart), min = Number(article.prixMin);
  if (!etat || !etat.debut) return dep;
  const dureeMs = Number(article.duree) * 1000;
  const ecoule = Math.max(0, t - etat.debut);
  if (ecoule >= dureeMs) return min;
  const pas = Math.floor(ecoule / TICK) * TICK;
  const p = dep - (dep - min) * pas / dureeMs;
  return Math.max(min, Math.round(p * 100) / 100);
}

// Vitesse fixe, la même pour tous les articles : 0,05 € toutes les 200 ms (soit 0,25 €/s).
// La durée de la baisse se déduit des prix : (départ - minimum) / 0,25 € par seconde.
const PAS_EUROS = 0.05;
function dureeBaisse(dep, min) { return Math.round((dep - min) / PAS_EUROS * TICK) / 1000; }
function dureeTexte(sec) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return ((m ? m + ' min ' : '') + (s || !m ? s + ' s' : '')).trim();
}

// Fin de la baisse (prix minimum atteint + palier)
function finBaisse(article, etat) {
  return etat.debut + Number(article.duree) * 1000 + PALIER_MIN * 1000;
}


function euros(n) {
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function cleAleatoire(n) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const a = new Uint32Array(n); crypto.getRandomValues(a);
  return Array.from(a, x => abc[x % abc.length]).join('');
}

function dateLongue(ms) {
  const d = new Date(ms);
  const j = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const h = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  return j + ' à ' + h;
}

function lireLocal(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function ecrireLocal(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

// État affiché d'un article (calculé, sans écriture)
//  attente | en_baisse | termine | bloque | paye | delai_depasse | vendu | retire
function statutAffiche(article, etat, paye, t) {
  const s = etat && etat.statut;
  if (!s || s === 'attente') return 'attente';
  if (s === 'vendu') return 'vendu';
  if (s === 'retire') return 'retire';
  if (s === 'en_baisse') return t > finBaisse(article, etat) ? 'termine' : 'en_baisse';
  if (s === 'bloque') {
    if (paye) return 'paye';
    return t > etat.blocageA + DELAI_PAIEMENT * 1000 ? 'delai_depasse' : 'bloque';
  }
  return 'attente';
}
