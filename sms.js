import { showModal } from './ui.js';
import { db } from './firebase.js'; 

// ==========================================
// 1. KONFIGURASI PROVIDER & STATE
// ==========================================
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
let cachedSvcoData = null; 

document.addEventListener('DOMContentLoaded', () => { if(!smsInitialized) initSms(); });

function formatPrice(price) {
    if (activeProviderKey === "herosms") return `${price}`;
    if (activeProviderKey === "smsbower") return `$ ${price}`;
    if (activeProviderKey === "svco") return `${price}`; 
    return `Rp ${parseInt(price || 0).toLocaleString('id-ID')}`; 
}

function getOperatorBadge(provider, opCode, rank) {
    if ((provider === "herosms" || provider === "otpcepat" || provider === "svco") && opCode && opCode !== "any") {
        const opMap = { "telkomsel": "TL", "indosat": "ST", "axis": "XS", "three": "TR", "xl": "XL", "smartfren": "SM" };
        let initial = opMap[opCode.toLowerCase()] || opCode.substring(0, 2).toUpperCase();
        return `<span style="font-size:11px; font-family:sans-serif; font-weight:900; color:#fff; margin-left:8px; background:var(--fb-blue); padding:2px 6px; border-radius:4px; box-shadow:0 1px 2px rgba(0,0,0,0.2);">${initial}</span>`;
    } else if (provider === "smsbower" && rank) {
        if (rank === "G") return `<span style="background: linear-gradient(135deg, #f1c40f, #f39c12); font-family:sans-serif; color: white; padding: 1px 6px; border-radius: 4px; font-weight: 900; font-size: 11px; margin-left:8px; border:1px solid #d35400;">G</span>`;
        if (rank === "S") return `<span style="background: linear-gradient(135deg, #bdc3c7, #95a5a6); font-family:sans-serif; color: white; padding: 1px 6px; border-radius: 4px; font-weight: 900; font-size: 11px; margin-left:8px; border:1px solid #7f8c8d;">S</span>`;
        if (rank === "B") return `<span style="background: linear-gradient(135deg, #e67e22, #d35400); font-family:sans-serif; color: white; padding: 1px 6px; border-radius: 4px; font-weight: 900; font-size: 11px; margin-left:8px; border:1px solid #a04000;">B</span>`;
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
    activeOrders = []; orderStates = {}; cachedSvcoData = null;
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
        if (err.name === 'AbortError') return { success: false, error: { message: "Koneksi Timeout (Lebih 10 Detik)" } };
        return { success: false, error: { message: "Jaringan terputus / Server Sibuk" } };
    }
}

async function updateSmsBal() {
    const json = await apiCall('/get-balance');
    const isSuccess = json.success === true || json.status === "success";
    if(isSuccess && json.data) document.getElementById('sms-balance').innerText = formatPrice(json.data.balance);
    else document.getElementById('sms-balance').innerText = "Offline";
}

export function renderSvcoPriceList() {
    const box = document.getElementById('sms-prices');
    if (!cachedSvcoData) return;

    let { prices } = cachedSvcoData;
    let htmlList = prices.map(p => {
        return `<div class="price-item" onclick="renderSvcoOperatorList('${p.price}')">
            <div style="flex: 1; min-width: 0; padding-right: 10px; display:flex; align-items:center;">
                <div style="font-weight:900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Shopee - 🇮🇩</div>
            </div>
            <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                <div style="min-width: 85px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900; white-space: nowrap;">${formatPrice(p.price)}</div>
                <div style="min-width: 70px; text-align: right; font-size:12px; color:var(--fb-muted); white-space: nowrap;">${p.available} stok</div>
            </div>
        </div>`;
    });
    box.innerHTML = htmlList.join('');
}
window.renderSvcoPriceList = renderSvcoPriceList;

export function renderSvcoOperatorList(selectedPrice) {
    const box = document.getElementById('sms-prices');
    if (!cachedSvcoData) return;

    let { pid, countryId, operators } = cachedSvcoData;
    
    let htmlList = operators.map(op => {
        return `<div class="price-item" onclick="executeBuySms('${pid}', ${selectedPrice}, 'Shopee', '${op.code}', '${countryId}')">
            <div style="flex: 1; min-width: 0; padding-right: 10px; display:flex; align-items:center;">
                <div style="font-weight:900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-left:5px;">${op.name.toUpperCase()}</div>
            </div>
            <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                <div style="min-width: 85px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900; white-space: nowrap;">${formatPrice(selectedPrice)}</div>
                <div style="min-width: 70px; text-align: right; font-size:12px; color:var(--fb-muted); white-space: nowrap;">~ stok</div>
            </div>
        </div>`;
    });

    htmlList.push(`
        <div onclick="renderSvcoPriceList()" style="margin-top: 15px; padding: 12px; background: #e9ecef; border-radius: 8px; text-align: center; cursor: pointer; font-weight: 900; color: #495057; border: 1px solid #ced4da; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <i class="fa-solid fa-arrow-left"></i> Kembali ke Daftar Harga
        </div>
    `);

    box.innerHTML = htmlList.join('');
}
window.renderSvcoOperatorList = renderSvcoOperatorList;

async function loadSmsPrices() {
    const json = await apiCall('/get-prices');
    const box = document.getElementById('sms-prices');
    const isSuccess = json.success === true || json.status === "success";
    
    if (isSuccess && json.data && json.data.length > 0) {
        
        if (activeProviderKey === "herosms" || activeProviderKey === "otpcepat") {
            let item = json.data.find(x => x.name && x.name.toLowerCase().includes("shope")) || json.data[0];
            let pid = item ? item.id : "ka";
            let name = "Shopee";
            let basePrice = item ? item.price : 0;

            let sendPrice = activeProviderKey === "otpcepat" ? 1100 : basePrice;
            let displayPrice = formatPrice(sendPrice);

            const ops = [
                { id: "telkomsel", label: "TELKOMSEL" },
                { id: "indosat", label: "INDOSAT" },
                { id: "axis", label: "AXIS" },
                { id: "three", label: "THREE" },
                { id: "xl", label: "XL" },
                { id: "smartfren", label: "SMARTFREN" }
            ];

            box.innerHTML = ops.map(op => {
                return `<div class="price-item" onclick="executeBuySms('${pid}', ${sendPrice}, '${name}', '${op.id}', '')">
                            <div style="flex: 1; min-width: 0; padding-right: 10px; display:flex; align-items:center;">
                                <div style="font-weight:900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color:var(--fb-text);">${op.label}</div>
                            </div>
                            <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                                <div style="min-width: 85px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900; white-space: nowrap;">${displayPrice}</div>
                                <div style="min-width: 70px; text-align: right; font-size:12px; color:var(--fb-muted); white-space: nowrap;">~ stok</div>
                            </div>
                        </div>`;
            }).join('');
        } 
        else if (activeProviderKey === "svco") {
            let shopeeData = json.data.find(x => x.country === 1 || (x.countryName || "").toLowerCase() === "indonesia") || json.data[0];
            
            if (shopeeData) {
                let pid = shopeeData.serviceId || "1"; 
                let countryId = shopeeData.country || 1; 

                let prices = (shopeeData.customPrice || [])
                    .filter(p => parseFloat(p.price) <= 0.06885) 
                    .sort((a, b) => parseFloat(b.price) - parseFloat(a.price)); 
                
                let operators = (shopeeData.operators || []).filter(o => o.code && o.code.toLowerCase() !== 'any' && o.name && o.name.toLowerCase() !== 'any');
                
                cachedSvcoData = { pid, countryId, prices, operators };
                
                if (prices.length > 0) {
                    renderSvcoPriceList();
                } else {
                    box.innerHTML = `<div style="padding:30px; text-align:center; color:var(--fb-red); font-weight:900;">Fitur Pilih Provider Belum Tersedia Pada Harga Saat Ini</div>`;
                }

            } else {
                box.innerHTML = `<div style="padding:30px; text-align:center; color:var(--fb-red); font-weight:900;">Stok Kosong / Tidak Masuk Filter</div>`;
            }
        } 
        else {
            box.innerHTML = json.data.map(i => {
                let shortName = i.name.replace(/Indonesia/ig, '').replace(/\s+/g, ' ').trim();
                let rankBadge = getOperatorBadge(activeProviderKey, i.operator, i.rank);
                let idLabel = (activeProviderKey === "smsbower" && i.operator !== "any") ? ` <span style="color:#aaa;">(ID: ${i.operator})</span>` : "";
                let extra = activeProviderKey === "smsbower" ? i.operator : (i.available || "~");
                let rankParam = i.rank || "S";

                return `<div class="price-item" onclick="executeBuySms('${i.id}', ${i.price}, '${shortName}', '${extra}', '${rankParam}')">
                            <div style="flex: 1; min-width: 0; padding-right: 10px; display:flex; align-items:center;">
                                <div style="font-weight:900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${shortName}${idLabel}</div>
                                ${rankBadge}
                            </div>
                            <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                                <div style="min-width: 85px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900; white-space: nowrap;">${formatPrice(i.price)}</div>
                                <div style="min-width: 70px; text-align: right; font-size:12px; color:var(--fb-muted); white-space: nowrap;">${i.available || '~'} stok</div>
                            </div>
                        </div>`;
            }).join('');
        }
    } else { 
        box.innerHTML = `<div style="padding:30px; text-align:center; color:var(--fb-red); font-weight:900;">${json.error?.message || json.message || json.error || 'Stok Kosong'}</div>`;
    }
}

function createCardHTML(oId, phone, priceDisplay, resendState, cancelState, replaceState, otpDisplay, isDone = false, isRecycled = false) {
    const doneStyle = isDone ? 'style="background:#e6f4ea; color:var(--fb-green); border-color:var(--fb-green);"' : 'disabled';
    
    let borderColor = "#95a5a6"; 
    if (activeProviderKey === "herosms") borderColor = "#8e44ad";
    if (activeProviderKey === "smsbower") borderColor = "#27ae60";
    if (activeProviderKey === "otpcepat") borderColor = "#e74c3c"; 
    if (activeProviderKey === "svco") borderColor = "#007bff"; 
    
    // PEMOTONGAN ID ORDER JADI 2 DIGIT
    let displayId = "#" + String(oId).slice(-2);
    
    const recycledDot = isRecycled ? `<span class="recycled-dot" style="color: red; margin-left: 5px; font-size: 10px;" title="Nomor Daur Ulang">🔴</span>` : '';

    return `<div class="order-card" id="order-${activeProviderKey}-${oId}" data-created="${Date.now()}" style="border: 2px solid ${borderColor};">
        <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px dashed var(--fb-border); padding-bottom:15px; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="color:var(--fb-blue); font-weight:900; font-family:monospace; font-size:15px;">${displayId}</span>
                <span class="badge-status" style="font-size:10px; color:#fff; font-family:sans-serif; background:${borderColor}; padding:3px 6px; border-radius:4px; font-weight:900;">ACTIVE</span>
                <span class="price-box" style="font-size:16px; font-weight:900; color:var(--fb-red); font-family:monospace; display:flex; align-items:center; white-space: nowrap;">${priceDisplay}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-regular fa-eye-slash hide-btn-icon" onclick="hideSmsCard('${oId}')" style="color: var(--fb-muted); cursor:pointer; font-size:14px; padding: 5px;"></i>
                <span class="sms-timer" data-id="${oId}" style="font-family:monospace; font-weight:900; color:var(--fb-blue);">--:--</span>
            </div>
        </div>
        <div style="font-size:11px; color:var(--fb-muted); margin-bottom:5px; text-transform:uppercase; font-weight:900;">Nomor HP:</div>
        <div class="phone-box" onclick="copyPhoneNumber('${phone}', 'copy-icon-${oId}')" style="font-weight: 900;">
            <span class="phone-text-span">${phone}</span><i id="copy-icon-${oId}" class="fa-regular fa-copy" style="color: var(--fb-muted);"></i>${recycledDot}
        </div>
        <div style="text-align: center; margin: 10px 0 15px 0; padding: 15px 0; background: #fafafa; border-radius: 8px;">
            <div style="font-size:11px; color:var(--fb-muted); font-weight:900; letter-spacing:1px; margin-bottom:5px;">KODE OTP</div>
            <div class="otp-container" style="min-height:35px; display:flex; align-items:center; justify-content:center; font-weight: 900;">${otpDisplay}</div>
        </div>
        <div class="btn-grid-4">
            <button class="sms-btn btn-done" onclick="actSms('finish', '${oId}')" ${doneStyle} style="font-weight: 900;">✓ DONE</button>
            <button class="sms-btn btn-resend" onclick="actSms('resend', '${oId}')" ${resendState} style="font-weight: 900;">↻ RESEND</button>
            <button class="sms-btn btn-cancel" onclick="actSms('cancel', '${oId}')" ${cancelState} style="font-weight: 900;">✕ CANCEL</button>
            <button class="sms-btn btn-replace" onclick="actSms('replace', '${oId}')" ${replaceState} style="font-weight: 900;">⇄ REPLACE</button>
        </div>
    </div>`;
}

export async function buySms(pid, price, name, extra = "~", rank = "S") {
    let operator = extra === "~" ? "any" : extra;
    executeBuySms(pid, price, name, operator, rank, false); 
}
window.buySms = buySms;

export async function executeBuySms(pid, price, name, operator, rank = "", isAutoRetry = false) {
    const pText = formatPrice(price);
    let opText = "";
    if ((activeProviderKey === "herosms" || activeProviderKey === "otpcepat" || activeProviderKey === "svco") && operator !== "any") opText = ` (Prov: ${operator.toUpperCase()})`;
    else if (activeProviderKey === "smsbower" && operator !== "any") opText = ` (ID: ${operator})`;

    if (!isAutoRetry) {
        if(!await showModal("Pesan Baru", `Beli nomor untuk ${name}${opText} seharga ${pText}?`, "confirm")) {
            return;
        }
    } else {
        document.getElementById('sms-balance').innerText = "Mencari ulang...";
    }

    let payload;
    if (activeProviderKey === "svco") {
        payload = { product_id: parseInt(pid), price: Number(price), operator: operator, country: parseInt(rank) || 1 };
    } else if (activeProviderKey === "herosms" || activeProviderKey === "smsbower" || activeProviderKey === "otpcepat") {
        payload = { product_id: String(pid), price: price, operator: operator };
    } else {
        payload = { product_id: parseInt(pid) };
    }

    const j = await apiCall('/create-order', 'POST', payload);
    const isSuccess = j.success === true || j.status === "success";

    if(isSuccess && j.data) {
        const o = j.data.orders[0];
        const newPhone = o.phone || o.phone_number || o.phoneNumber || 'Mencari Nomor...';

        if (o.is_recycled) {
            await apiCall('/order-action', 'POST', { id: o.id, action: 'cancel' });
            document.getElementById('sms-balance').innerText = "Filter API Aktif...";
            setTimeout(() => { executeBuySms(pid, price, name, operator, rank, true); }, 1500);
            return; 
        }

        let initialExpire = Date.now() + (20 * 60000);
        if (o.expiredAt) {
            let exp = parseInt(o.expiredAt);
            initialExpire = exp < 10000000000 ? exp * 1000 : exp;
        }

        localStorage.setItem(`phone_${activeProviderKey}_${o.id}`, newPhone);
        localStorage.setItem(`price_${activeProviderKey}_${o.id}`, price);
        localStorage.setItem(`pid_${activeProviderKey}_${o.id}`, pid);
        localStorage.setItem(`timer_${activeProviderKey}_${o.id}`, initialExpire);
        
        if (operator) localStorage.setItem(`op_${activeProviderKey}_${o.id}`, operator);
        if (rank) localStorage.setItem(`rank_${activeProviderKey}_${o.id}`, rank);

        const extraBadge = getOperatorBadge(activeProviderKey, operator, rank);
        const priceDisplay = formatPrice(price) + extraBadge;
        
        let cancelState = (["smsbower", "otpcepat"].includes(activeProviderKey)) ? '' : 'disabled';
        let replaceState = 'disabled'; 

        const container = document.getElementById('sms-active-orders');
        const cardHTML = createCardHTML(o.id, newPhone, priceDisplay, 'disabled', cancelState, replaceState, `<div class="loader-bars"><span></span><span></span><span></span></div>`, false, o.is_recycled);
        container.insertAdjacentHTML('afterbegin', cardHTML);

        pollSms(); updateSmsBal();
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 150);
    } else {
        if (!isAutoRetry) {
            showModal("Gagal", j.error?.message || j.message || j.error || "Gagal memesan stok.", "alert");
        }
    }
}
window.executeBuySms = executeBuySms;

// ==========================================
// FIX FINAL: POLLING KARTU ABADI
// ==========================================
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

        const container = document.getElementById('sms-active-orders');
        localIds.forEach(id => {
            const cardId = `order-${activeProviderKey}-${id}`;
            if (!document.getElementById(cardId)) {
                const phone = localStorage.getItem(`phone_${activeProviderKey}_${id}`) || 'Mencari Nomor...';
                const price = localStorage.getItem(`price_${activeProviderKey}_${id}`);
                const op = localStorage.getItem(`op_${activeProviderKey}_${id}`) || "";
                const rank = localStorage.getItem(`rank_${activeProviderKey}_${id}`) || "";
                const priceDisplay = formatPrice(price) + getOperatorBadge(activeProviderKey, op, rank);
                const otpDisplay = `<div class="loader-bars"><span></span><span></span><span></span></div>`;
                
                const cardHTML = createCardHTML(id, phone, priceDisplay, 'disabled', 'disabled', 'disabled', otpDisplay, false, false);
                container.insertAdjacentHTML('afterbegin', cardHTML);
            }
        });

        if (localIds.length === 0) { isPolling = false; return; }

        const j = await apiCall('/get-active', 'POST', { ids: localIds });
        const isSuccess = j.success === true || j.status === "success";
        
        if(isSuccess && j.data) {
            activeOrders = j.data; 
            renderSmsOrders(j.data);
        }
    } catch (e) {
        console.error("Poll Error: ", e);
    } finally {
        isPolling = false; 
    }
}

export function hideSmsCard(id) {
    if (!orderStates[id]) orderStates[id] = {};
    orderStates[id].isHidden = true; 
    const card = document.getElementById(`order-${activeProviderKey}-${id}`);
    if (card) card.remove(); 
}
window.hideSmsCard = hideSmsCard;

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
    if(!orders || !orders.length) return;

    orders.forEach(o => {
        if (orderStates[o.id] && orderStates[o.id].isHidden) return;

        const serverPhone = o.phone || o.phone_number || o.phoneNumber;
        const phone = serverPhone || localStorage.getItem(`phone_${activeProviderKey}_${o.id}`) || 'Mencari Nomor...';
        if(serverPhone) localStorage.setItem(`phone_${activeProviderKey}_${o.id}`, serverPhone);

        const serverPrice = o.price || o.cost || localStorage.getItem(`price_${activeProviderKey}_${o.id}`);
        if(serverPrice) localStorage.setItem(`price_${activeProviderKey}_${o.id}`, serverPrice);

        const savedOp = localStorage.getItem(`op_${activeProviderKey}_${o.id}`) || "";
        const savedRank = localStorage.getItem(`rank_${activeProviderKey}_${o.id}`) || "";
        const priceDisplay = formatPrice(serverPrice) + getOperatorBadge(activeProviderKey, savedOp, savedRank);
        
        // OTP BIRU, SPASI DI TENGAH, FONT TEBAL 900
        let otpDisplay = o.otp_code ? `<span style="color:var(--fb-blue); letter-spacing:4px; font-size:26px; font-weight:900; font-family:monospace;">${o.otp_code.replace(/(\d{3})(?=\d)/g, '$1 ')}</span>` : `<div class="loader-bars"><span></span><span></span><span></span></div>`;

        const cardId = `order-${activeProviderKey}-${o.id}`;
        let existingCard = document.getElementById(cardId);

        if (existingCard) {
            existingCard.querySelector('.phone-text-span').innerText = phone;
            existingCard.querySelector('.otp-container').innerHTML = otpDisplay;
            existingCard.querySelector('.price-box').innerHTML = priceDisplay;

            // Pastikan ID tetap 2 Digit saat dirender ulang
            let displayNewId = String(o.id).slice(-2);
            const spans = existingCard.querySelectorAll('span');
            spans.forEach(sp => { 
                if (sp.innerText.trim().startsWith('#')) sp.innerText = `#${displayNewId}`; 
            });

            if (o.otp_code) {
                const btnDone = existingCard.querySelector('.btn-done');
                if(btnDone) { btnDone.disabled = false; btnDone.style.background = "#e6f4ea"; btnDone.style.color = "var(--fb-green)"; btnDone.style.borderColor = "var(--fb-green)"; }
                const btnResend = existingCard.querySelector('.btn-resend');
                if(btnResend) btnResend.disabled = false;
                const btnCancel = existingCard.querySelector('.btn-cancel');
                if(btnCancel) btnCancel.disabled = true;
                const btnReplace = existingCard.querySelector('.btn-replace');
                if(btnReplace) btnReplace.disabled = true;
            }
            
            const phoneBox = existingCard.querySelector('.phone-box');
            if (phoneBox && o.is_recycled && !existingCard.querySelector('.recycled-dot')) {
                phoneBox.insertAdjacentHTML('beforeend', `<span class="recycled-dot" style="color: red; margin-left: 5px; font-size: 10px;" title="Nomor Daur Ulang">🔴</span>`);
            }
        }
    });
}

function updateSmsTimers() {
    const now = Date.now();
    document.querySelectorAll('.sms-timer').forEach(el => {
        const id = el.dataset.id;
        const end = parseInt(localStorage.getItem(`timer_${activeProviderKey}_${id}`));
        
        if(end) {
            const diff = Math.max(0, Math.floor((end - now)/1000));
            el.innerText = `${Math.floor(diff/60)}:${(diff%60).toString().padStart(2,'0')}`;
            
            const card = document.getElementById(`order-${activeProviderKey}-${id}`);
            if(card) {
                const isOtpReady = card.querySelector('.otp-container span');
                if(!isOtpReady) {
                    if (diff <= 1080 || ["smsbower", "otpcepat"].includes(activeProviderKey)) {
                        const btnCancel = card.querySelector('.btn-cancel');
                        if(btnCancel) btnCancel.disabled = false;
                    }
                    if (diff <= 1080 && !["smsbower", "otpcepat", "svco"].includes(activeProviderKey)) {
                        const btnReplace = card.querySelector('.btn-replace');
                        if(btnReplace) btnReplace.disabled = false;
                    }
                }

                if (diff <= 0) {
                    localStorage.removeItem(`phone_${activeProviderKey}_${id}`);
                    localStorage.removeItem(`timer_${activeProviderKey}_${id}`);
                    localStorage.removeItem(`price_${activeProviderKey}_${id}`);
                    localStorage.removeItem(`pid_${activeProviderKey}_${id}`);
                    localStorage.removeItem(`op_${activeProviderKey}_${id}`);
                    localStorage.removeItem(`rank_${activeProviderKey}_${id}`);
                    card.remove();
                }
            }
        }
    });
}

export async function actSms(action, id) {
    if (action === 'replace' && ["smsbower", "otpcepat", "svco"].includes(activeProviderKey)) {
        showModal("Peringatan", "Fitur Replace tidak didukung oleh provider ini.", "alert"); return;
    }

    if(!await showModal(action.toUpperCase(), "Lanjutkan aksi?", "confirm")) return;

    const j = await apiCall('/order-action', 'POST', { id, action: (action === 'replace' ? 'cancel' : action) });
    
    if(j.success || JSON.stringify(j).toUpperCase().includes("SUCCESS") || JSON.stringify(j).toUpperCase().includes("OK") || JSON.stringify(j).toUpperCase().includes("NOT FOUND")) {
        
        if(action === 'finish') {
            const phoneStr = localStorage.getItem(`phone_${activeProviderKey}_${id}`);
            const price = localStorage.getItem(`price_${activeProviderKey}_${id}`);
            
            try {
                const oldCard = document.getElementById(`order-${activeProviderKey}-${id}`);
                let finalOtp = "Selesai";
                if (oldCard) {
                    const otpSpan = oldCard.querySelector('.otp-container span');
                    if (otpSpan) finalOtp = otpSpan.innerText.replace(/\s+/g, '').trim();
                }
                
                db.ref('sms_history').push({ 
                    provider: activeProviderKey, 
                    phone: phoneStr || "08XXX", 
                    otp: finalOtp,
                    price: price || 0, 
                    timestamp: Date.now() 
                });
                console.log("Berhasil mencatat histori ke Firebase.");
            } catch(e) {
                console.error("Gagal simpan histori", e);
            }
        }
        
        if (action !== 'resend') {
            localStorage.removeItem(`phone_${activeProviderKey}_${id}`);
            localStorage.removeItem(`timer_${activeProviderKey}_${id}`);
            localStorage.removeItem(`price_${activeProviderKey}_${id}`);
            localStorage.removeItem(`pid_${activeProviderKey}_${id}`);
            localStorage.removeItem(`op_${activeProviderKey}_${id}`);
            localStorage.removeItem(`rank_${activeProviderKey}_${id}`);
            
            const card = document.getElementById(`order-${activeProviderKey}-${id}`);
            if(card) card.remove();
            
            if(action === 'replace') {
                const pid = localStorage.getItem(`pid_${activeProviderKey}_${id}`);
                const price = localStorage.getItem(`price_${activeProviderKey}_${id}`);
                const op = localStorage.getItem(`op_${activeProviderKey}_${id}`);
                executeBuySms(pid, price, "Replace", op, "", true);
            }
        }
        pollSms(); updateSmsBal();
    } else {
        showModal("Gagal", j.message || j.error?.message || j.error || "Ditolak oleh server API.", "alert"); 
    }
}
window.actSms = actSms;
