import { showModal } from './ui.js';

const PROVIDERS = {
    "smscode": { name: "Code", url: "https://sms.aam-zip.workers.dev" },
    "herosms": { name: "Hero", url: "https://hero.aam-zip.workers.dev" },
    "smsbower": { name: "Bower", url: "https://bower.aam-zip.workers.dev" },
    "otpcepat": { name: "Cepat", url: "https://cepat.aam-zip.workers.dev" },
    "svco": { name: "Svco", url: "https://svco.aam-zip.workers.dev" }
};

let activeProviderKey = localStorage.getItem('xurel_provider') || "smscode";
let BASE_URL = PROVIDERS[activeProviderKey].url;

let currentServerName = ""; 
let smsInitialized = false; 
let isSmsLocked = false;
let pollingInterval = null;
let timerInterval = null;
let isPolling = false;

let activeOrders = [];
let orderStates = {};

// Memuat SMS secara otomatis karena ini single page
document.addEventListener('DOMContentLoaded', () => { if(!smsInitialized) initSms(); });

function formatPrice(price) {
    if (activeProviderKey === "herosms" || activeProviderKey === "svco") return `${price}`;
    if (activeProviderKey === "smsbower") return `$ ${price}`;
    return `Rp ${parseInt(price || 0).toLocaleString('id-ID')}`; 
}

function getOperatorBadge(provider, opCode, rank) {
    if ((provider === "herosms" || provider === "otpcepat" || provider === "svco") && opCode && opCode !== "any") {
        let initial = opCode.substring(0, 2).toUpperCase();
        return `<span style="font-size:11px; font-weight:900; color:#fff; margin-left:8px; background:var(--fb-blue); padding:2px 6px; border-radius:4px;">${initial}</span>`;
    }
    return "";
}

async function initSms() {
    smsInitialized = true;
    const selectHp = document.getElementById('sms-server');

    if (!document.getElementById('sms-provider')) {
        const provSelect = document.createElement('select');
        provSelect.id = 'sms-provider';
        provSelect.className = selectHp.className;
        provSelect.style.marginRight = "10px";
        provSelect.style.fontWeight = "bold";
        provSelect.style.color = "var(--fb-blue)";
        provSelect.onchange = changeSmsProvider;
        provSelect.innerHTML = Object.keys(PROVIDERS).map(k => `<option value="${k}">${PROVIDERS[k].name}</option>`).join('');
        provSelect.value = activeProviderKey;
        selectHp.parentNode.insertBefore(provSelect, selectHp);
    }

    isSmsLocked = localStorage.getItem('xurel_locked') === 'true';
    await loadServersList();
    applySmsLockUI();
    refreshSms();

    if(pollingInterval) clearInterval(pollingInterval);
    if(timerInterval) clearInterval(timerInterval);
    pollingInterval = setInterval(pollSms, 5000);
    timerInterval = setInterval(updateSmsTimers, 1000);
}

export async function changeSmsProvider() {
    if(isSmsLocked) return;
    activeProviderKey = document.getElementById('sms-provider').value;
    BASE_URL = PROVIDERS[activeProviderKey].url;
    localStorage.setItem('xurel_provider', activeProviderKey);
    activeOrders = []; orderStates = {};
    document.getElementById('sms-active-orders').innerHTML = ''; 
    await loadServersList();
    refreshSms();
}
window.changeSmsProvider = changeSmsProvider;

async function loadServersList() {
    const select = document.getElementById('sms-server');
    select.innerHTML = '<option>Memuat...</option>';
    try {
        const res = await apiCall('/api/servers');
        if(res.success && res.servers) select.innerHTML = res.servers.map(k => `<option value="${k}">${k}</option>`).join('');
        else throw new Error("Kosong");
    } catch (e) {
        select.innerHTML = ["HP1", "HP2"].map(k => `<option value="${k}">${k}</option>`).join('');
    }
    const saved = localStorage.getItem(`xurel_hp_${activeProviderKey}`);
    currentServerName = (saved && Array.from(select.options).some(o => o.value === saved)) ? saved : select.options[0].value;
    select.value = currentServerName;
}

export function changeSmsServer() {
    if(isSmsLocked) return;
    currentServerName = document.getElementById('sms-server').value;
    localStorage.setItem(`xurel_hp_${activeProviderKey}`, currentServerName);
    activeOrders = []; orderStates = {};
    document.getElementById('sms-active-orders').innerHTML = '';
    refreshSms();
}
window.changeSmsServer = changeSmsServer;

export function toggleSmsLock() {
    isSmsLocked = !isSmsLocked; localStorage.setItem('xurel_locked', isSmsLocked); applySmsLockUI();
}
window.toggleSmsLock = toggleSmsLock;

function applySmsLockUI() {
    const sHp = document.getElementById('sms-server');
    const sProv = document.getElementById('sms-provider');
    const icon = document.getElementById('sms-lock-icon');
    if(sHp) sHp.disabled = isSmsLocked;
    if(sProv) sProv.disabled = isSmsLocked;
    if(icon) {
        icon.className = isSmsLocked ? 'fa-solid fa-lock' : 'fa-solid fa-unlock';
        icon.style.color = isSmsLocked ? 'var(--fb-red)' : 'var(--fb-muted)';
    }
}

export function refreshSms() {
    document.getElementById('sms-prices').innerHTML = '<div style="padding:30px; text-align:center; color:#888;">Mengambil Data...</div>';
    updateSmsBal(); loadSmsPrices(); pollSms();
}
window.refreshSms = refreshSms;

async function apiCall(endpoint, method = "GET", body = null) {
    const options = { method, headers: { "Content-Type": "application/json", "X-Server-Name": currentServerName } };
    if (body) options.body = JSON.stringify(body);
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); 
        options.signal = controller.signal;
        const res = await fetch(`${BASE_URL}${endpoint}`, options);
        clearTimeout(timeoutId); 
        const text = await res.text(); 
        try { return JSON.parse(text); } 
        catch(e) { return { success: res.ok, status: res.ok ? "success" : "failed", error: { message: text || "Format server tidak sesuai" } }; }
    } catch(err) {
        return { success: false, error: { message: "Jaringan terputus / Server Sibuk" } };
    }
}

async function updateSmsBal() {
    const json = await apiCall('/get-balance');
    const isSuccess = json.success === true || json.status === "success";
    if(isSuccess && json.data) document.getElementById('sms-balance').innerText = formatPrice(json.data.balance);
    else document.getElementById('sms-balance').innerText = "Offline";
}

async function loadSmsPrices() {
    const json = await apiCall('/get-prices');
    const box = document.getElementById('sms-prices');
    const isSuccess = json.success === true || json.status === "success";
    
    if (isSuccess && json.data && json.data.length > 0) {
        box.innerHTML = json.data.map(i => {
            let shortName = (i.name || "Shopee").replace(/Indonesia/ig, '').replace(/\s+/g, ' ').trim();
            let rankBadge = getOperatorBadge(activeProviderKey, i.operator, i.rank);
            let extra = activeProviderKey === "smsbower" ? i.operator : (i.available || "~");

            return `<div class="price-item" onclick="executeBuySms('${i.id || i.serviceId || 'ka'}', ${i.price}, '${shortName}', '${extra}', '')">
                        <div style="flex: 1; min-width: 0; padding-right: 10px; display:flex; align-items:center;">
                            <div style="font-weight:bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${shortName}</div>
                            ${rankBadge}
                        </div>
                        <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                            <div style="min-width: 85px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900;">${formatPrice(i.price)}</div>
                            <div style="min-width: 70px; text-align: right; font-size:12px; color:var(--fb-muted);">${i.available || '~'} stok</div>
                        </div>
                    </div>`;
        }).join('');
    } else { 
        box.innerHTML = `<div style="padding:30px; text-align:center; color:var(--fb-red); font-weight:bold;">Stok Kosong</div>`;
    }
}

export async function buySms(pid, price, name, extra = "~", rank = "S") {
    let operator = extra === "~" ? "any" : extra;
    executeBuySms(pid, price, name, operator, rank);
}
window.buySms = buySms;

export async function executeBuySms(pid, price, name, operator, rank = "") {
    const pText = formatPrice(price);
    if(!await showModal("Pesan Baru", `Beli nomor untuk ${name} seharga ${pText}?`, "confirm")) return;

    let payload = { product_id: String(pid), price: price, operator: operator };
    const j = await apiCall('/create-order', 'POST', payload);
    const isSuccess = j.success === true || j.status === "success";

    if(isSuccess && j.data) {
        pollSms(); updateSmsBal();
    } else {
        showModal("Gagal", j.error?.message || j.message || j.error || "Gagal memesan stok.", "alert");
    }
}
window.executeBuySms = executeBuySms;

async function pollSms() {
    if (isPolling) return;
    isPolling = true;

    try {
        let localIds = [];
        for(let i=0; i<localStorage.length; i++) {
            let k = localStorage.key(i);
            if(k && k.startsWith(`phone_${activeProviderKey}_`)) {
                localIds.push(k.split('_')[2]);
            }
        }

        const j = await apiCall('/get-active', 'POST', { ids: localIds });
        const isSuccess = j.success === true || j.status === "success";
        if(isSuccess && j.data) {
            activeOrders = j.data; 
            renderSmsOrders(j.data);
        }
    } catch (e) {
    } finally {
        isPolling = false; 
    }
}

export function copyPhoneNumber(txt, iconId) {
    if(txt.includes('Mencari')) return;
    navigator.clipboard.writeText(txt);
    const icon = document.getElementById(iconId);
    if(icon) {
        icon.className = "fa-solid fa-circle-check"; icon.style.color = "var(--fb-green)";
        setTimeout(() => { icon.className = "fa-regular fa-copy"; icon.style.color = "var(--fb-muted)"; }, 1500);
    }
}
window.copyPhoneNumber = copyPhoneNumber;

function renderSmsOrders(orders) {
    const container = document.getElementById('sms-active-orders');
    if(!orders || !orders.length) return;

    orders.forEach(o => {
        const phone = o.phone || o.phone_number || o.phoneNumber || 'Mencari Nomor...';
        const priceDisplay = formatPrice(o.price || 0);
        let otpDisplay = o.otp_code ? `<span style="color:var(--fb-green); font-size:26px; font-weight:bold; font-family:monospace;">${o.otp_code}</span>` : `Menunggu OTP...`;
        
        const cardId = `order-${activeProviderKey}-${o.id}`;
        let existingCard = document.getElementById(cardId);

        if (!existingCard) {
            const cardHTML = `<div class="order-card" id="${cardId}" style="border: 2px solid #ccc; padding: 15px; margin-bottom: 10px; border-radius: 8px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span style="font-weight:bold;">#${o.id}</span>
                    <span style="color:var(--fb-red); font-weight:bold;">${priceDisplay}</span>
                </div>
                <div style="margin-bottom:10px; font-size: 18px; cursor: pointer;" onclick="copyPhoneNumber('${phone}', 'copy-${o.id}')">
                    ${phone} <i id="copy-${o.id}" class="fa-regular fa-copy"></i>
                </div>
                <div style="background: #f9f9f9; padding: 10px; text-align: center; border-radius: 4px; font-weight:bold;">
                    ${otpDisplay}
                </div>
                <div style="display:flex; gap: 10px; margin-top: 10px;">
                    <button onclick="actSms('finish', '${o.id}')" style="flex:1; padding:8px; background:var(--fb-green); color:#fff; border:none; border-radius:4px;">DONE</button>
                    <button onclick="actSms('cancel', '${o.id}')" style="flex:1; padding:8px; background:var(--fb-red); color:#fff; border:none; border-radius:4px;">CANCEL</button>
                </div>
            </div>`;
            container.insertAdjacentHTML('afterbegin', cardHTML);
        } else {
            existingCard.innerHTML = `<div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span style="font-weight:bold;">#${o.id}</span>
                    <span style="color:var(--fb-red); font-weight:bold;">${priceDisplay}</span>
                </div>
                <div style="margin-bottom:10px; font-size: 18px; cursor: pointer;" onclick="copyPhoneNumber('${phone}', 'copy-${o.id}')">
                    ${phone} <i id="copy-${o.id}" class="fa-regular fa-copy"></i>
                </div>
                <div style="background: #f9f9f9; padding: 10px; text-align: center; border-radius: 4px; font-weight:bold;">
                    ${otpDisplay}
                </div>
                <div style="display:flex; gap: 10px; margin-top: 10px;">
                    <button onclick="actSms('finish', '${o.id}')" style="flex:1; padding:8px; background:var(--fb-green); color:#fff; border:none; border-radius:4px;">DONE</button>
                    <button onclick="actSms('cancel', '${o.id}')" style="flex:1; padding:8px; background:var(--fb-red); color:#fff; border:none; border-radius:4px;">CANCEL</button>
                </div>`;
        }
    });
}

function updateSmsTimers() {}

export async function actSms(action, id) {
    if(!await showModal("Konfirmasi", "Lanjutkan aksi ini?", "confirm")) return;

    const j = await apiCall('/order-action', 'POST', { id, action });
    if(j.success === true || j.status === "success") {
        pollSms(); updateSmsBal();
        if (action === 'cancel' || action === 'finish') {
            const oldCard = document.getElementById(`order-${activeProviderKey}-${id}`);
            if (oldCard) oldCard.remove();
        }
    } else { 
        showModal("Gagal", "Ditolak oleh server API.", "alert"); 
    }
}
window.actSms = actSms;
