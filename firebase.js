import { showModal } from './ui.js';

// Konfigurasi Firebase Anda yang baru (sms-xurel)
const firebaseConfig = {
  apiKey: "AIzaSyCSjZ7ay8kUYXJ_3Jqnke3uvTRtwpgCws0",
  authDomain: "sms-xurel.firebaseapp.com",
  databaseURL: "https://sms-xurel-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sms-xurel",
  storageBucket: "sms-xurel.firebasestorage.app",
  messagingSenderId: "486134590584",
  appId: "1:486134590584:web:cac02f4429e0432c05518d",
  measurementId: "G-RV5ZSH1EG6"
};

// Inisialisasi Firebase menggunakan metode Compat (agar web tidak rusak)
firebase.initializeApp(firebaseConfig);
export const db = firebase.database(); 
export const auth = firebase.auth();

export function masukSistem() {
    const e = document.getElementById('global-email').value; 
    const p = document.getElementById('global-pass').value;
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => auth.signInWithEmailAndPassword(e, p))
    .then(() => document.getElementById('main-menu-popup').classList.remove('active'))
    .catch(() => showModal("Gagal Login", "Periksa kembali Email atau Password Anda.", "alert"));
}

export function keluarSistem() { 
    auth.signOut(); 
    document.getElementById('main-menu-popup').classList.remove('active'); 
}
