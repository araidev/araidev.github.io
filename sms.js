import { showModal } from './ui.js';
import { db } from './firebase.js'; 

// ==========================================
// 1. KONFIGURASI PROVIDER & STATE
// ==========================================
const PROVIDERS = {
    "smscode": { name: "COD", url: "https://sms.aam-zip.workers.dev" },
    "herosms": { name: "HER", url: "https://hero.aam-zip.workers.dev" },
    "otpcepat": { name: "OTC", url: "https://cepat.aam-zip.workers.dev" },
    "svco": { name: "SVC", url: "https://svco.aam-zip.workers.dev" }
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
let cachedProductsData = []; 

// Setup Suara Notifikasi
let audioCtx;
function playSimpleSound(type) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'otp') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, audioCtx.currentTime); 
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime); 
            osc.start();
            osc.stop(audioCtx.currentTime + 0.15); 
        } else if (type === 'recycled') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(300, audioCtx.currentTime); 
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime); 
            osc.start();
            osc.stop(audioCtx.currentTime + 0.2); 
        }
    } catch (e) { console.log("Audio tidak didukung", e); }
}

function tryInitSms() {
    if (!smsInitialized) initSms();
}
if (document.readyState === "loading") {
    document.addEventListener('DOMContentLoaded', tryInitSms);
} else {
    tryInitSms();
}

function formatPrice(price) {
    if (activeProviderKey === "herosms") return `${price}`;
    if (activeProviderKey === "smsbower") return `$ ${price}`;
    if (activeProviderKey === "svco") return `${price}`; 
    return `Rp ${parseInt(price || 0).toLocaleString('id-ID')}`; 
}

function getOperatorBadge(provider, opCode, rank) {
    if ((provider === "herosms" || provider === "otpcepat" || provider === "svco" || provider === "nixpoin" || provider === "smscode") && opCode && opCode !== "any") {
        const opMap = { "telkomsel": "TL", "indosat": "ST", "axis": "XS", "three": "TR", "xl": "XL", "smartfren": "SM" };
        let initial = opMap[opCode.toLowerCase()] || opCode.substring(0, 2).toUpperCase();
        return `<span style="font-size:11px; font-family:sans-serif; font-weight:900; color:#fff; margin-left:8px; background:var(--fb-blue); padding:2px 6px; border-radius:4px; box-shadow:0 1px 2px rgba(0,0,0,0.2);">${initial}</span>`;
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
        provSelect.style.fontWeight = "900";
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
    activeOrders = []; orderStates = {}; cachedSvcoData = null; cachedProductsData = [];
    document.getElementById('sms-active-orders').innerHTML = ''; 
    await loadServersList();
    refreshSms();
}
window.changeSmsProvider = changeSmsProvider;

async function loadServersList() {
    const select = document.getElementById('sms-server');
    if(!select) return;
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
    const box = document.getElementById('sms-prices');
    if(box) box.innerHTML = '<div style="padding:30px; text-align:center; color:#888;">Mengambil Data...</div>';
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
        if (err.name === 'AbortError') return { success: false, error: { message: "Koneksi Timeout" } };
        return { success: false, error: { message: "Jaringan terputus / Server Sibuk" } };
    }
}

async function updateSmsBal() {
    const json = await apiCall('/get-balance');
    const isSuccess = json.success === true || json.status === "success";
    const elBal = document.getElementById('sms-balance');
    if(!elBal) return;
    if(isSuccess && json.data) elBal.innerText = formatPrice(json.data.balance);
    else elBal.innerText = "Offline";
}

// ==========================================
// SVCO RENDERER (ALUR BARU: PROVIDER -> HARGA)
// ==========================================
export function renderSvcoOperatorListFirst() {
    const box = document.getElementById('sms-prices');
    if (!cachedSvcoData || !box) return;

    let { operators } = cachedSvcoData;
    let htmlList = operators.map(op => {
        let displayName = op.name.toUpperCase();
        return `<div class="price-item" onclick="renderSvcoPricesForOperator('${op.code}', '${displayName}')">
                    <div style="flex: 1; min-width: 0; padding-right: 10px; display:flex; align-items:center;">
                        <div style="font-weight:900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color:var(--fb-text);">${displayName}</div>
                    </div>
                    <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                        <div style="min-width: 30px; text-align: right; font-size:12px; color:var(--fb-blue); white-space: nowrap;"><i class="fa-solid fa-chevron-right"></i></div>
                    </div>
                </div>`;
    });

    box.innerHTML = htmlList.join('');
}
window.renderSvcoOperatorListFirst = renderSvcoOperatorListFirst;

export function renderSvcoPricesForOperator(opCode, opName) {
    const box = document.getElementById('sms-prices');
    if (!cachedSvcoData || !box) return;

    let { pid, countryId, prices } = cachedSvcoData;
    let htmlList = prices.map(p => {
        let st = p.count !== undefined ? p.count : "~";
        let displayPrice = formatPrice(p.price);

        return `<div class="price-item" onclick="executeBuySms('${pid}', ${p.price}, '${opName}', '${opCode}', '${countryId}')">
                    <div style="flex: 1; min-width: 0; padding-right: 10px; display:flex; align-items:center;">
                        <div style="font-weight:900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color:var(--fb-text);">${opName}</div>
                    </div>
                    <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                        <div style="min-width: 85px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900; white-space: nowrap;">${displayPrice}</div>
                        <div style="min-width: 70px; text-align: right; font-size:12px; color:var(--fb-muted); white-space: nowrap;">${st} stok</div>
                    </div>
                </div>`;
    });

    htmlList.push(`
        <div onclick="renderSvcoOperatorListFirst()" style="margin-top: 15px; padding: 12px; background: #e9ecef; border-radius: 8px; text-align: center; cursor: pointer; font-weight: 900; color: #495057; border: 1px solid #ced4da;">
            <i class="fa-solid fa-arrow-left"></i> Kembali Pilih Operator
        </div>
    `);
    
    box.innerHTML = htmlList.join('');
}
window.renderSvcoPricesForOperator = renderSvcoPricesForOperator;

// ==========================================
// SMSCODE RENDERER (PROVIDER -> HARGA)
// ==========================================
export function renderOperatorListFirst() {
    const box = document.getElementById('sms-prices');
    if(!box) return;

    const ops = [
        { id: "any", label: "ANY (ACAK)" },
        { id: "telkomsel", label: "TELKOMSEL" },
        { id: "indosat", label: "INDOSAT" },
        { id: "axis", label: "AXIS" },
        { id: "three", label: "THREE" },
        { id: "xl", label: "XL" },
        { id: "smartfren", label: "SMARTFREN" }
    ];

    box.innerHTML = ops.map(op => {
        return `<div class="price-item" onclick="renderPricesForOperator('${op.id}')">
                    <div style="flex: 1; min-width: 0; padding-right: 10px; display:flex; align-items:center;">
                        <div style="font-weight:900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color:var(--fb-text);">${op.label}</div>
                    </div>
                    <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                        <div style="min-width: 30px; text-align: right; font-size:12px; color:var(--fb-blue); white-space: nowrap;"><i class="fa-solid fa-chevron-right"></i></div>
                    </div>
                </div>`;
    }).join('');
}
window.renderOperatorListFirst = renderOperatorListFirst;

export async function renderPricesForOperator(op) {
    const box = document.getElementById('sms-prices');
    if(!box) return;

    if (op === "any") {
        let htmlList = cachedProductsData.map(item => {
            let exactId = item.id; 
            let displayPrice = formatPrice(item.price);
            let currentStock = item.available !== undefined ? item.available : "~";
            
            return `<div class="price-item" onclick="executeBuySms('${exactId}', ${item.price}, 'Acak', 'any', '')">
                        <div style="flex: 1; min-width: 0; padding-right: 10px; display:flex; align-items:center;">
                            <div style="font-weight:900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color:var(--fb-text);">ANY (ACAK)</div>
                        </div>
                        <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                            <div style="min-width: 85px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900; white-space: nowrap;">${displayPrice}</div>
                            <div style="min-width: 70px; text-align: right; font-size:12px; color:var(--fb-muted); white-space: nowrap;">${currentStock} stok</div>
                        </div>
                    </div>`;
        });

        htmlList.push(`
            <div onclick="renderOperatorListFirst()" style="margin-top: 15px; padding: 12px; background: #e9ecef; border-radius: 8px; text-align: center; cursor: pointer; font-weight: 900; color: #495057; border: 1px solid #ced4da;">
                <i class="fa-solid fa-arrow-left"></i> Kembali
            </div>
        `);
        box.innerHTML = htmlList.join('');
        return;
    }

    box.innerHTML = `<div style="padding:30px; text-align:center; color:var(--fb-blue); font-weight:900;">
                        <div class="loader-bars" style="margin:0 auto 10px auto;"><span></span><span></span><span></span></div>
                        Mencari stok ${op.toUpperCase()}...
                    </div>`;
    
    const res = await apiCall(`/get-prices?operator=${op}`);
    
    if (res.success && res.data && res.data.length > 0) {
        let htmlList = res.data.map(item => {
            // Kita bungkus ID Katalog Produk ke dalam variabel `catalogId`
            let catalogId = item.catalog_product_id || item.id; 
            let numOpId = item.injected_operator_id; 
            let displayPrice = formatPrice(item.price);
            let currentStock = item.available !== undefined ? item.available : "~";
            
            // Perhatikan pengiriman variabel: catalogId, item.price, name, operator text, dan operator ID (numOpId)
            return `<div class="price-item" onclick="executeBuySms('${catalogId}', ${item.price}, '${op.toUpperCase()}', '${op}', '${numOpId}')">
                        <div style="flex: 1; min-width: 0; padding-right: 10px; display:flex; align-items:center;">
                            <div style="font-weight:900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color:var(--fb-text);">${op.toUpperCase()}</div>
                        </div>
                        <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                            <div style="min-width: 85px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900; white-space: nowrap;">${displayPrice}</div>
                            <div style="min-width: 70px; text-align: right; font-size:12px; color:var(--fb-muted); white-space: nowrap;">${currentStock} stok</div>
                        </div>
                    </div>`;
        });

        htmlList.push(`
            <div onclick="renderOperatorListFirst()" style="margin-top: 15px; padding: 12px; background: #e9ecef; border-radius: 8px; text-align: center; cursor: pointer; font-weight: 900; color: #495057; border: 1px solid #ced4da;">
                <i class="fa-solid fa-arrow-left"></i> Kembali
            </div>
        `);
        box.innerHTML = htmlList.join('');
    } else {
        box.innerHTML = `
            <div style="padding:30px; text-align:center; color:var(--fb-red); font-weight:900;">
                Maaf, saat ini tidak ada stok harga untuk ${op.toUpperCase()}.
            </div>
            <div onclick="renderOperatorListFirst()" style="margin-top: 15px; padding: 12px; background: #e9ecef; border-radius: 8px; text-align: center; cursor: pointer; font-weight: 900; color: #495057; border: 1px solid #ced4da;">
                <i class="fa-solid fa-arrow-left"></i> Kembali
            </div>`;
    }
}
window.renderPricesForOperator = renderPricesForOperator;

// ==========================================
// MASTER LOAD PRICES
// ==========================================
async function loadSmsPrices() {
    const json = await apiCall('/get-prices');
    const box = document.getElementById('sms-prices');
    if(!box) return;
    const isSuccess = json.success === true || json.status === "success";
    
    if (isSuccess && json.data && json.data.length > 0) {
        if (activeProviderKey === "smscode") {
            cachedProductsData = json.data;
            renderOperatorListFirst(); 
        }
        else if (["herosms", "otpcepat", "nixpoin"].includes(activeProviderKey)) {
            let item = json.data.find(x => x.name && x.name.toLowerCase().includes("shope")) || json.data[0];
            let pid = item ? (item.catalog_product_id || item.id) : "ka";
            let name = "Shopee";
            let basePrice = item ? item.price : 0;
            let opStockMap = item && item.operatorStock ? item.operatorStock : {};
            let displayPrice = formatPrice(basePrice);

            const ops = [
                { id: "any", label: "ANY (ACAK)" },
                { id: "telkomsel", label: "TELKOMSEL" },
                { id: "indosat", label: "INDOSAT" },
                { id: "axis", label: "AXIS" },
                { id: "three", label: "THREE" },
                { id: "xl", label: "XL" },
                { id: "smartfren", label: "SMARTFREN" }
            ];

            box.innerHTML = ops.map(op => {
                let currentStock = (activeProviderKey === "herosms" && opStockMap[op.id] !== undefined) ? opStockMap[op.id] : "~";
                return `<div class="price-item" onclick="executeBuySms('${pid}', ${basePrice}, '${name}', '${op.id}', '')">
                            <div style="flex: 1; min-width: 0; padding-right: 10px; display:flex; align-items:center;">
                                <div style="font-weight:900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color:var(--fb-text);">${op.label}</div>
                            </div>
                            <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                                <div style="min-width: 85px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900; white-space: nowrap;">${displayPrice}</div>
                                <div style="min-width: 70px; text-align: right; font-size:12px; color:var(--fb-muted); white-space: nowrap;">${currentStock} stok</div>
                            </div>
                        </div>`;
            }).join('');
        } 
        else if (activeProviderKey === "svco") {
            let shopeeData = json.data.find(x => x.country === 1 || (x.countryName || "").toLowerCase() === "indonesia") || json.data[0];
            if (shopeeData) {
                let pid = shopeeData.serviceId || "1"; 
                let countryId = shopeeData.country || 1; 
                let prices = (shopeeData.customPrice || []).filter(p => parseFloat(p.price) <= 0.06885).sort((a, b) => parseFloat(b.price) - parseFloat(a.price)); 
                
                let operators = (shopeeData.operators || []).filter(o => o.code && o.code.toLowerCase() !== 'any');
                operators.unshift({ name: "ANY (ACAK)", code: "any" });

                cachedSvcoData = { pid, countryId, prices, operators };
                
                if (prices.length > 0) renderSvcoOperatorListFirst();
                else box.innerHTML = `<div style="padding:30px; text-align:center; color:var(--fb-red); font-weight:900;">Stok Tidak Tersedia</div>`;
            } else {
                box.innerHTML = `<div style="padding:30px; text-align:center; color:var(--fb-red); font-weight:900;">Stok Kosong</div>`;
            }
        } 
        else {
            box.innerHTML = json.data.map(i => {
                let shortName = i.name.replace(/Indonesia/ig, '').trim();
                let rankBadge = getOperatorBadge(activeProviderKey, i.operator, i.rank);
                let currentStock = i.available !== undefined ? i.available : "~";
                return `<div class="price-item" onclick="executeBuySms('${i.id}', ${i.price}, '${shortName}', '${i.operator || "~"}', '${i.rank || "S"}')">
                            <div style="flex: 1; min-width: 0; padding-right: 10px; display:flex; align-items:center;">
                                <div style="font-weight:900;">${shortName}</div>
                                ${rankBadge}
                            </div>
                            <div style="display: flex; align-items: center; flex-shrink: 0; gap: 8px;">
                                <div style="min-width: 85px; text-align: right; color:var(--fb-red); font-family:monospace; font-size:14px; font-weight: 900;">${formatPrice(i.price)}</div>
                                <div style="min-width: 70px; text-align: right; font-size:12px; color:var(--fb-muted);">${currentStock} stok</div>
                            </div>
                        </div>`;
            }).join('');
        }
    } else { 
        box.innerHTML = `<div style="padding:30px; text-align:center; color:var(--fb-red); font-weight:900;">${json.error?.message || 'Stok Kosong'}</div>`;
    }
}

// ==========================================
// SISTEM PEMBELIAN & KARTU (CARD) UI
// ==========================================
function createCardHTML(oId, phone, priceDisplay, resendState, cancelState, replaceState, otpDisplay, isDone = false, isRecycled = false, expireTime = 0) {
    const doneStyle = isDone ? 'style="background:#e6f4ea; color:var(--fb-green); border-color:var(--fb-green);"' : 'disabled';
    let borderColor = "#95a5a6"; 
    if (activeProviderKey === "herosms") borderColor = "#8e44ad";
    if (activeProviderKey === "smsbower") borderColor = "#27ae60";
    if (activeProviderKey === "otpcepat") borderColor = "#e74c3c"; 
    if (activeProviderKey === "svco") borderColor = "#007bff"; 
    if (activeProviderKey === "nixpoin") borderColor = "#2980b9"; 

    let displayId = "#" + String(oId).slice(-2);
    const phoneColorStyle = isRecycled ? 'color: red;' : '';

    return `<div class="order-card" id="order-${activeProviderKey}-${oId}" style="border: 2px solid ${borderColor};">
        <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px dashed var(--fb-border); padding-bottom:15px; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="color:var(--fb-blue); font-weight:900; font-family:monospace; font-size:15px;">${displayId}</span>
                <span class="badge-status" style="font-size:10px; color:#fff; background:${borderColor}; padding:3px 6px; border-radius:4px; font-weight:900;">ACTIVE</span>
                <span class="price-box" style="font-size:16px; font-weight:900; color:var(--fb-red); font-family:monospace;">${priceDisplay}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-regular fa-eye-slash hide-btn-icon" onclick="hideSmsCard('${oId}')" style="color: var(--fb-muted); cursor:pointer; font-size:14px; padding: 5px;"></i>
                <span class="sms-timer" data-id="${oId}" data-expire="${expireTime}" style="font-family:monospace; font-weight:900; color:var(--fb-blue);">--:--</span>
            </div>
        </div>
        <div style="font-size:11px; color:var(--fb-muted); margin-bottom:5px; text-transform:uppercase; font-weight:900;">Nomor HP:</div>
        <div class="phone-box" onclick="copyPhoneNumber('${phone}', 'copy-icon-${oId}')" style="font-weight: 900;">
            <span class="phone-text-span" style="${phoneColorStyle}">${phone}</span><i id="copy-icon-${oId}" class="fa-regular fa-copy" style="color: var(--fb-muted);"></i>
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
    executeBuySms(pid, price, name, extra === "~" ? "any" : extra, rank);
}
window.buySms = buySms;

export async function executeBuySms(pid, price, name, operator, rank = "") {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}

    const pText = formatPrice(price);
    let opText = "";
    if (["herosms", "otpcepat", "svco", "nixpoin", "smscode"].includes(activeProviderKey) && operator !== "any") {
        opText = ` (Prov: ${operator.toUpperCase()})`;
    }

    if(!await showModal("Konfirmasi", `Beli nomor untuk ${name}${opText} seharga ${pText}?`, "confirm")) return;

    let payload;
    if (activeProviderKey === "svco") {
        payload = { product_id: parseInt(pid), price: Number(price), operator: operator, country: parseInt(rank) || 1 };
    } else if (["herosms", "smsbower", "otpcepat", "nixpoin"].includes(activeProviderKey)) {
        payload = { product_id: String(pid), price: price, operator: operator };
    } else if (activeProviderKey === "smscode") {
        // PEMBAGIAN LOGIKA MUTLAK UNTUK SMSCODE
        if (operator !== "any") {
            // Jika pilih operator spesifik (Routed Order)
            payload = { 
                type: "catalog", 
                catalog_product_id: parseInt(pid), 
                operator_id: parseInt(rank), // Rank di sini adalah ID Angka Server yang diselipkan tadi
                max_price: parseInt(price)
            };
        } else {
            // Jika pilih ACAK (Direct Order)
            payload = { type: "product", product_id: parseInt(pid) };
        }
    } else {
        payload = { product_id: parseInt(pid) };
    }

    const j = await apiCall('/create-order', 'POST', payload);
    if((j.success || j.status === "success") && j.data) {
        const o = j.data.orders[0];
        const newPhone = o.phone || o.phone_number || o.phoneNumber || 'Mencari Nomor...';
        
        const orderTime = o.created_at || Date.now(); 
        const expire = orderTime + 600000; 

        localStorage.setItem(`pid_${activeProviderKey}_${o.id}`, pid);
        localStorage.setItem(`price_${activeProviderKey}_${o.id}`, price);
        if (operator) localStorage.setItem(`op_${activeProviderKey}_${o.id}`, operator);

        const extraBadge = getOperatorBadge(activeProviderKey, operator, rank);
        const container = document.getElementById('sms-active-orders');
        
        const cardHTML = createCardHTML(o.id, newPhone, formatPrice(price) + extraBadge, 'disabled', 'disabled', 'disabled', `<div class="loader-bars"><span></span><span></span><span></span></div>`, false, o.is_recycled, expire);
        container.insertAdjacentHTML('afterbegin', cardHTML);
        
        if(o.is_recycled) playSimpleSound('recycled');
        pollSms(); updateSmsBal();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        showModal("Gagal", j.error?.message || "Stok Sedang Kosong.", "alert");
    }
}
window.executeBuySms = executeBuySms;

// ==========================================
// MANAJEMEN KARTU AKTIF (POLLING)
// ==========================================
async function pollSms() {
    if (isPolling) return;
    isPolling = true;
    try {
        const j = await apiCall('/get-active', 'GET');
        if((j.success || j.status === "success") && j.data) {
            activeOrders = j.data; 
            renderSmsOrders(j.data);
        }
    } catch (e) {} finally { isPolling = false; }
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

export function copyOtpCode(otp, element) {
    if (!otp) return;
    navigator.clipboard.writeText(otp);
    
    if (element.querySelector('.otp-copied-icon')) return;
    const originalHTML = element.innerHTML;
    
    element.innerHTML = originalHTML + '<i class="fa-solid fa-circle-check otp-copied-icon" style="color: var(--fb-green); font-size: 24px; margin-left: 12px; letter-spacing: normal;"></i>';
    
    setTimeout(() => {
        element.innerHTML = originalHTML;
    }, 1500);
}
window.copyOtpCode = copyOtpCode;

function renderSmsOrders(orders) {
    const container = document.getElementById('sms-active-orders');
    if(!container) return;
    
    const activeIds = orders.map(o => String(o.id));
    const currentCards = container.querySelectorAll('.order-card');
    currentCards.forEach(card => {
        const cardId = card.id.replace(`order-${activeProviderKey}-`, '');
        if (!activeIds.includes(cardId)) {
            card.remove(); 
        }
    });

    orders.forEach(o => {
        if (orderStates[o.id]?.isHidden) return;
        const phone = o.phone || o.phone_number || o.phoneNumber || '...';
        const price = o.price || 0;
        const savedOp = o.operator || "any";
        const extraBadge = getOperatorBadge(activeProviderKey, savedOp, "");
        
        const orderTime = o.created_at || Date.now();
        const expire = orderTime + 600000; 
        const passed2Mins = (Date.now() - orderTime) >= 120000; 

        let otpDisplay = o.otp_code ? `<span onclick="copyOtpCode('${o.otp_code}', this)" style="cursor:pointer; color:#00897B; letter-spacing:6px; font-size:32px; font-weight:900; display: inline-flex; align-items: center;" title="Klik untuk menyalin">${o.otp_code.replace(/(\d{3})(?=\d)/g, '$1 ')}</span>` : `<div class="loader-bars"><span></span><span></span><span></span></div>`;
        const resendState = o.otp_code ? '' : 'disabled';
        const cancelState = (passed2Mins || ["smsbower", "otpcepat", "nixpoin"].includes(activeProviderKey)) && !o.otp_code ? '' : 'disabled';
        const replaceState = (passed2Mins && !["smsbower", "otpcepat", "svco", "nixpoin"].includes(activeProviderKey)) && !o.otp_code ? '' : 'disabled';

        const existingCard = document.getElementById(`order-${activeProviderKey}-${o.id}`);
        if (existingCard) {
            const timerSpan = existingCard.querySelector('.sms-timer');
            if (timerSpan) timerSpan.dataset.expire = expire;

            const phoneTextSpan = existingCard.querySelector('.phone-text-span');
            if (phoneTextSpan && phoneTextSpan.innerText.includes('Mencari') && !phone.includes('Mencari')) {
                phoneTextSpan.innerText = phone;
            }

            const otpBox = existingCard.querySelector('.otp-container');
            if (otpBox && otpBox.innerHTML.trim() !== otpDisplay.trim()) {
                otpBox.innerHTML = otpDisplay;
                if(o.otp_code) playSimpleSound('otp');
            }
            const bCancel = existingCard.querySelector('.btn-cancel');
            if(bCancel && cancelState === '') bCancel.disabled = false;
            const bReplace = existingCard.querySelector('.btn-replace');
            if(bReplace && replaceState === '') bReplace.disabled = false;
            if(o.otp_code) {
                const bDone = existingCard.querySelector('.btn-done');
                if(bDone) { bDone.disabled = false; bDone.style.background = "#e6f4ea"; bDone.style.color = "var(--fb-green)"; }
            }
        } else {
            container.insertAdjacentHTML('afterbegin', createCardHTML(o.id, phone, formatPrice(price) + extraBadge, resendState, cancelState, replaceState, otpDisplay, !!o.otp_code, o.is_recycled, expire));
        }
    });
}

function updateSmsTimers() {
    const now = Date.now();
    document.querySelectorAll('.sms-timer').forEach(el => {
        let end = parseInt(el.dataset.expire); 
        if(end && !isNaN(end)) {
            const diff = Math.max(0, Math.floor((end - now)/1000));
            el.innerText = `${Math.floor(diff/60)}:${(diff%60).toString().padStart(2,'0')}`;
            el.style.color = diff < 600 ? "var(--fb-red)" : "var(--fb-blue)"; 
        }
    });
}

export async function actSms(action, id) {
    if (action === 'replace' && ["smsbower", "otpcepat", "svco", "nixpoin"].includes(activeProviderKey)) {
        showModal("Peringatan", "Fitur Replace tidak didukung oleh provider ini.", "alert"); 
        return;
    }
    
    if (!await showModal("Konfirmasi", "Lanjutkan aksi ini?", "confirm")) return;

    if (action === 'replace') {
        const jCancel = await apiCall('/order-action', 'POST', { id, action: 'cancel' });
        
        if (jCancel.success || jCancel.status === "success") {
            const card = document.getElementById(`order-${activeProviderKey}-${id}`);
            if (card) card.remove();
            
            const oldPid = localStorage.getItem(`pid_${activeProviderKey}_${id}`);
            const oldPrice = localStorage.getItem(`price_${activeProviderKey}_${id}`);
            const oldOp = localStorage.getItem(`op_${activeProviderKey}_${id}`) || "any";
            
            if (oldPid && oldPrice) {
                await executeBuySms(oldPid, oldPrice, "Ganti Nomor", oldOp, "");
            } else {
                showModal("Info", "Nomor berhasil dibatalkan, silakan pilih produk ulang di menu.", "alert");
            }
            pollSms(); updateSmsBal();
        } else {
            showModal("Gagal Replace", jCancel.error?.message || "Gagal membatalkan nomor lama dari server.", "alert");
        }
        return; 
    }

    const j = await apiCall('/order-action', 'POST', { id, action });
    
    if (j.success || j.status === "success") {
        if (action === 'cancel' || action === 'finish') {
            const card = document.getElementById(`order-${activeProviderKey}-${id}`);
            if (card) card.remove();
        }
        pollSms(); updateSmsBal();
    } else {
        showModal("Gagal", j.error?.message || "Aksi ditolak server pusat.", "alert");
    }
}
window.actSms = actSms;
