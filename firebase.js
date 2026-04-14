import { showModal } from './ui.js';

const configMaster = { 
    apiKey: "AIzaSyDX5o3n7iQjqcS0ZJsbir_35JOpG7jqkPA", 
    authDomain: "link-shopee-bc394.firebaseapp.com", 
    databaseURL: "https://link-shopee-bc394-default-rtdb.asia-southeast1.firebasedatabase.app", 
    projectId: "link-shopee-bc394" 
};

firebase.initializeApp(configMaster);
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
