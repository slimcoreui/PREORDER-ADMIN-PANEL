/**
 * PREORDER ADMIN PANEL - Frontend Logic
 * Senior Frontend Architect Refactor
 */

// -----------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbynVAVZNZHJqvDmydLrLipd55YXkQGBlgvJsfzqyg6Hx1dlfN4W8hIxBjuxelvukqqlDA/exec"; 
// -----------------------------------------------------------------

// Global State
let allData = [];
let filteredData = [];
let currentEditId = null;
let visionModeActive = false;
let visionGroups = {};
let carouselData = [];
let carouselIndex = 0;

// --- INITIALIZATION ---
window.onload = function() {
    fetchData();
    setupEventListeners();
    setInterval(() => { apiCall('serverPing').catch(e => console.log("Ping failed")); }, 180000);
};

function setupEventListeners() {
    // Scroll handling for Bottom Nav
    let lastScrollTop = 0;
    const navBar = document.getElementById('mainNavBar');
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if (Math.abs(scrollTop - lastScrollTop) < 10) return;
        if (scrollTop > lastScrollTop && scrollTop > 100) navBar.classList.add('nav-hidden');
        else navBar.classList.remove('nav-hidden');
        lastScrollTop = scrollTop;
    });

    // Carousel Touch
    const stage = document.getElementById('vision-carousel-stage');
    let touchStartX = 0;
    stage.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
    stage.addEventListener('touchend', e => {
        const touchEndX = e.changedTouches[0].screenX;
        if (touchEndX < touchStartX - 50) moveCarousel(1); 
        if (touchEndX > touchStartX + 50) moveCarousel(-1); 
    }, {passive: true});
}

// --- DATA LAYER ---
async function apiCall(action, payload = null) {
  try {
    const response = await fetch(WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify({ action: action, payload: payload })
    });
    return await response.json();
  } catch (e) {
    console.error("API Error:", e);
    throw e;
  }
}

function fetchData() {
  document.getElementById('loader').style.display = 'flex';
  const safetyTimer = setTimeout(() => { processData([]); }, 15000); 
  apiCall('getData')
    .then(data => { clearTimeout(safetyTimer); processData(data); })
    .catch(e => { clearTimeout(safetyTimer); processData([]); });
}

function processData(data) {
  if(!data || data.length === 0) data = [];
  allData = data.map(item => { return { ...item, logicStatus: getLogicStatus(item) }; });
  populateDropdowns();
  applyFilters(); 
  document.getElementById('loader').style.display = 'none';
}

function getLogicStatus(item) {
    let logicStatus = "VALID";
    if (item.paidDate && item.status !== "PAID") logicStatus = "ERROR";
    if (!item.filledDate && item.status === "PAID" && logicStatus !== "ERROR") logicStatus = "WARNING";
    return logicStatus;
}

// --- UI RENDERING CORE ---
function renderCards() {
    const isListView = document.getElementById('view-list').style.display !== 'none';
    const targetGridId = isListView ? 'ordersGridList' : 'ordersGridHome';
    const grid = document.getElementById(targetGridId);
    if (!grid) return; 

    grid.innerHTML = "";
    if(filteredData.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#999;font-weight:700;">No Orders Found</div>`;
        return;
    }
  
    // Use DocumentFragment for performance
    const fragment = document.createDocumentFragment();
    filteredData.forEach((item, index) => {
        const div = document.createElement('div');
        div.innerHTML = generateCardHTML(item, index);
        fragment.appendChild(div.firstChild);
    });
    grid.appendChild(fragment);
}

function generateCardHTML(item, index) {
    let themeClass = "card-queues"; 
    let textClass = "text-queues";
    let displayStatus = item.status || "QUEUES";

    if (item.status === "PAID") { themeClass = "card-paid"; textClass = "text-paid"; } 
    else if (item.status === "PENDING") { themeClass = "card-pending"; textClass = "text-pend"; } 
    else if (item.status === "WARNING") { themeClass = "card-error"; textClass = "text-err"; }
    if (item.logicStatus === "ERROR") { themeClass = "card-error"; textClass = "text-err"; displayStatus = "ERROR (Check)"; }

    const idLen = item.id.length;
    let idFontSize = "1rem"; 
    if (idLen > 25) idFontSize = "0.75rem";
    else if (idLen > 18) idFontSize = "0.85rem";

    let middleRow = "";
    if (item.deducted > 0) middleRow = `<div class="money-row"><span>Deducted</span><span style="color:#ff7675; font-weight:700;">-${fmt(item.deducted)}</span></div>`;
    else if (item.commission > 0) middleRow = `<div class="money-row"><span>Commission</span><span style="color:#00b894; font-weight:700;">+${fmt(item.commission)}</span></div>`;
    
    let formBtn = "";
    if(item.formLink && item.formLink.trim().length > 5){
        formBtn = `<a href="${item.formLink}" target="_blank" class="btn-icon" title="Open Form"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>`;
    }

    let waBtn = "";
    if(item.phone && item.phone.trim().length > 5) {
        const msg = `Hi _${item.mediator}_, \uD83D\uDC4B\n\n\uD83D\uDCC3 Refund Reminder for Order: *${item.id}*\nTotal Refund Due: ${fmt(item.refundable)}`;
        const waLink = `https://wa.me/${item.phone}?text=${encodeURIComponent(msg)}`;
        waBtn = `<a href="${waLink}" target="_blank" class="btn-icon" title="WhatsApp"><i class="fa-brands fa-whatsapp" style="color:#25D366;"></i></a>`;
    }
    
    return `
    <div id="card-wrapper-${item.id}" class="order-card ${themeClass}">
      <div class="card-content">
        <div class="card-head">
          <div style="width:100%; overflow:hidden;">
            <div class="card-id" onclick="copy('${item.id}')" style="font-size:${idFontSize};">
                ${item.id} <i class="fa-regular fa-copy" style="font-size:0.8em; opacity:0.6;"></i>
            </div>
            <span class="deal-tag">${item.dealType}</span>
          </div>
          <div style="text-align:right;">
             <div class="status-pill-card" style="color:${getColorForStatus(item.status)}">${displayStatus}</div>
          </div>
        </div>
        
        <div class="glass-panel">
          <div class="prod-name"><i class="fa-solid fa-mobile-screen"></i> &nbsp; ${item.product}</div>
        </div>

        <div class="glass-panel">
          <div class="money-row"><span>Total</span><span>${fmt(item.total)}</span></div>
          ${middleRow}
          <div class="total-row"><span>REFUNDABLE</span><span>${fmt(item.refundable)}</span></div>
        </div>

        <div class="glass-panel">
          <div class="date-grid">
            <div class="date-item"><span>DELIVERED</span><div>${item.deliveryDate||'-'}</div></div>
            <div class="date-item"><span>FILLED</span><div>${item.filledDate||'-'}</div></div>
            <div class="date-item"><span>REFUND</span><div>${item.refundDate||'-'}</div></div>
            <div class="date-item"><span>PAID</span><div>${item.paidDate||'-'}</div></div>
          </div>
        </div>
        
        <div class="action-row">
            <div style="font-size:0.7rem; font-weight:700; opacity:0.8;"><i class="fa-solid fa-user"></i> ${item.mediator}</div>
            <div style="display:flex; gap:8px;">
                ${waBtn}
                ${formBtn}
                <button class="btn-icon" onclick="openEditModal('${item.id}')"><i class="fa-solid fa-pen"></i></button>
            </div>
        </div>
      </div>
    </div>`;
}

function getColorForStatus(status) {
    if(status === 'PAID') return '#00b894';
    if(status === 'PENDING') return '#E91E63';
    return '#636e72';
}

// --- FILTERING LOGIC ---
function populateDropdowns() {
    const mediators = [...new Set(allData.map(d => d.mediator))].sort();
    const medSelect = document.getElementById('mediatorSelect');
    medSelect.innerHTML = '<option value="All">All Mediators</option>';
    mediators.forEach(m => { if(m && m!="N/A") { let opt = document.createElement('option'); opt.value = m; opt.textContent = m; medSelect.appendChild(opt); }});

    const months = new Set();
    allData.forEach(d => { const m = getCleanMonth(d.deliveryDate); if (m !== "Invalid") months.add(m); });
    const sortedMonths = [...months].sort(); 
    const monSelect = document.getElementById('monthSelect');
    monSelect.innerHTML = '<option value="All">All Months</option>';
    sortedMonths.forEach(m => { let opt = document.createElement('option'); opt.value = m; opt.textContent = m; monSelect.appendChild(opt); });
}

function applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const mediator = document.getElementById('mediatorSelect').value;
    const status = document.getElementById('statusSelect').value;
    const month = document.getElementById('monthSelect').value;
    const type = document.getElementById('typeSelect').value; 
    const sortOrder = document.getElementById('sortSelect').value;

    filteredData = allData.filter(item => {
        const mSearch = item.id.toLowerCase().includes(search) || item.reviewer.toLowerCase().includes(search) || item.product.toLowerCase().includes(search);
        const mMediator = (mediator === "All") || (item.mediator === mediator);
        let mStatus = true;
        if(status !== "All") {
            if(status === "QUEUES") mStatus = (item.status === "" || item.status === "WARNING"); 
            else mStatus = (item.status === status);
        }
        const mMonth = (month === "All") || (getCleanMonth(item.deliveryDate) === month);
        let mType = true;
        if(type === "LESS") mType = (item.deducted > 0);
        else if (type === "COMMISSION") mType = (item.commission > 0);
        else if (type === "FULL") mType = (item.deducted === 0 && item.commission === 0);

        return mSearch && mMediator && mStatus && mMonth && mType;
    });

    filteredData.sort((a, b) => {
        const dateA = parseDateToTs(a.deliveryDate);
        const dateB = parseDateToTs(b.deliveryDate);
        if (sortOrder === 'DESC') return dateB - dateA; 
        return dateA - dateB; 
    });

    renderStats();
    renderCards();
    renderLeaderboard();
    if(visionModeActive) renderVisionClusters(); 
}

function renderStats() {
    let tVal=0, tRef=0, tComm=0, tDed=0;
    filteredData.forEach(d => { tVal += d.total; tRef += d.refundable; tComm += d.commission; tDed += d.deducted; });
    document.getElementById("statOrders").innerText = filteredData.length;
    document.getElementById("statTotalValue").innerText = fmt(tVal);
    document.getElementById("statRefundable").innerText = fmt(tRef);
    document.getElementById("statCommission").innerText = fmt(tComm);
    document.getElementById("statDeducted").innerText = fmt(tDed);
}

function renderLeaderboard() {
    const map = {};
    filteredData.forEach(d => { if(d.mediator && d.mediator !== "N/A") { if(!map[d.mediator]) map[d.mediator]=0; map[d.mediator]++; }});
    const sorted = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5);
    document.getElementById('leaderboardList').innerHTML = sorted.map((i,x)=>
        `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.1); font-size:0.8rem;">
            <span style="opacity:0.8;">#${x+1} ${i[0]}</span>
            <span style="font-weight:700;">${i[1]}</span>
        </div>`
    ).join('');
}

// --- ACTIONS & UTILS ---
function handleSearchKey() {
    const val = document.getElementById('searchInput').value;
    document.getElementById('searchClearBtn').style.display = val.length > 0 ? 'block' : 'none';
    applyFilters();
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClearBtn').style.display = 'none';
    applyFilters();
}

function copy(text) {
    navigator.clipboard.writeText(text).then(() => showToast("Copied ID: " + text));
}

function showToast(msg) {
    const t = document.getElementById('toastNotification'); 
    document.getElementById('toastMessage').innerText = msg; 
    t.classList.add('active');
    setTimeout(() => { t.classList.remove('active'); }, 3000); 
}

function fmt(n) { return n.toLocaleString('en-IN', {style:'currency', currency:'INR', minimumFractionDigits:0}); }
function getCleanMonth(dateStr) {
    if (!dateStr || dateStr.length < 5) return "Invalid";
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const d = new Date(parts[2], parts[1]-1, parts[0]);
      if(isNaN(d.getTime())) return "Invalid";
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    }
    return "Invalid";
}
function parseDateToTs(str) { if(!str) return 0; const parts = str.trim().split('/'); if(parts.length !== 3) return 0; return new Date(parts[2], parts[1] - 1, parts[0]).getTime(); }

// --- EDIT MODAL & SAVE ---
function openEditModal(id) {
    const order = allData.find(d => d.id === id);
    if(!order) return;
    currentEditId = id;
    document.getElementById('editStatus').value = order.status;
    document.getElementById('editFilled').value = order.filledDate;
    document.getElementById('editPaid').value = order.paidDate; 
    document.getElementById('editRemarks').value = order.remarks;
    document.getElementById('editModal').classList.add('active');
    
    // Auto-fill date listener is handled manually here for simplicity
    document.getElementById('editStatus').onchange = function() {
        const val = this.value;
        if (val === "PAID" || val === "PENDING") {
            const d = new Date();
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0'); 
            const year = d.getFullYear();
            document.getElementById('editPaid').value = `${day}/${month}/${year}`;
        }
    };
}

function closeModal() { document.getElementById('editModal').classList.remove('active'); currentEditId = null; }

function saveChanges() {
    if(!currentEditId) return;
    const btn = document.getElementById('saveBtn');
    const oldText = btn.innerText;
    btn.innerText = "Saving...";
    
    const newStatus = document.getElementById('editStatus').value;
    const newFilled = document.getElementById('editFilled').value;
    const newPaid = document.getElementById('editPaid').value;
    const newRemarks = document.getElementById('editRemarks').value;

    const updates = { id: currentEditId, status: newStatus, filledDate: newFilled, paidDate: newPaid, remarks: newRemarks };
    
    // Optimistic UI Update
    const idx = allData.findIndex(d => d.id === currentEditId);
    if(idx > -1) {
        Object.assign(allData[idx], { status: newStatus, filledDate: newFilled, paidDate: newPaid, remarks: newRemarks });
        allData[idx].logicStatus = getLogicStatus(allData[idx]);
    }
    closeModal(); 
    applyFilters();
    showToast("Order Updated (Syncing...)"); 
    btn.innerText = oldText;

    apiCall('updateOrder', updates).then(res => {
        if(res !== "SUCCESS") showToast("Sync Warning: " + res);
        else showToast("Synced Successfully!");
    });
}

// --- DOWNLOAD CSV ---
function downloadCSV() {
    const btn = document.querySelector('.btn-gold');
    const orgText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PREPARING...';
    apiCall('getCsvData').then(csvContent => {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url); link.setAttribute("download", "PreorderData.csv");
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        btn.innerHTML = orgText; showToast("CSV Downloaded!");
    }).catch(e => { alert("Export Failed"); btn.innerHTML = orgText; });
}

// --- NOTIFICATIONS ---
function toggleNotifs() {
    const p = document.getElementById('notifPanel');
    if(!p.classList.contains('active')) { 
        p.classList.add('active'); 
        apiCall('getRecentLogs').then(logs => {
            const list = document.getElementById('notifList');
            if(!logs || logs.length === 0) { list.innerHTML = '<div style="padding:20px; text-align:center; color:#b2bec3;">No recent edits.</div>'; return; }
            list.innerHTML = logs.map(l => `<div class="notif-item"><div class="notif-time">${l[0]}</div><div class="notif-id">${l[1]}</div><div class="notif-detail">${l[2]}</div></div>`).join('');
        });
        document.getElementById('notifBadge').classList.remove('show'); 
    } else { p.classList.remove('active'); }
}

// --- TAB SWITCHING ---
function switchTab(tabName) {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    document.querySelectorAll('.view-section').forEach(el => {
        el.classList.add('hidden-view');
        el.classList.remove('active-view');
    });

    const target = document.getElementById('view-' + tabName);
    target.classList.remove('hidden-view');
    target.classList.add('active-view');
    
    if (tabName === 'home' || tabName === 'list') applyFilters();
    
    // Reset Vision if leaving vision tab
    if(visionModeActive && tabName !== 'vision') {
        visionModeActive = false;
        document.body.classList.remove('vision-active');
        const btn = document.querySelector('.btn-vision');
        btn.style.background = '#2d3436';
        document.getElementById('visionBtnText').innerHTML = '<i class="fa-solid fa-eye"></i> &nbsp; VISION VIEW';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// -----------------------------------------------------------------
// VISION VIEW CONTROLLER (Cinematic Engine)
// -----------------------------------------------------------------
function toggleVisionView() {
    const btn = document.querySelector('.btn-vision');
    visionModeActive = !visionModeActive;
    
    const normalViews = ['view-home', 'view-graph', 'view-list'];
    const visionView = document.getElementById('view-vision');
    const body = document.body;
    
    if (visionModeActive) {
        normalViews.forEach(id => document.getElementById(id).classList.add('hidden-view'));
        visionView.classList.remove('hidden-view');
        
        body.classList.add('vision-active'); // Triggers Vignette & Blur
        
        btn.style.background = 'var(--brand-grad)'; 
        document.getElementById('visionBtnText').innerHTML = '<i class="fa-solid fa-xmark"></i> &nbsp; EXIT VISION';
        renderVisionClusters();
    } else {
        visionView.classList.add('hidden-view');
        body.classList.remove('vision-active');
        switchTab('home'); 
        
        btn.style.background = '#2d3436';
        document.getElementById('visionBtnText').innerHTML = '<i class="fa-solid fa-eye"></i> &nbsp; VISION VIEW';
    }
}

function renderVisionClusters() {
    visionGroups = {};
    filteredData.forEach(item => {
        const key = (item.mediator && item.mediator !== "N/A") ? item.mediator : "Unassigned";
        if (!visionGroups[key]) visionGroups[key] = [];
        visionGroups[key].push(item);
    });
    
    const sortedKeys = Object.keys(visionGroups).sort((a,b) => visionGroups[b].length - visionGroups[a].length);
    const grid = document.getElementById('cluster-grid');
    grid.innerHTML = "";
    
    const fragment = document.createDocumentFragment();
    sortedKeys.forEach((key, i) => {
        const count = visionGroups[key].length;
        const initial = key.charAt(0).toUpperCase();
        const delay = i * 50; 
        
        const div = document.createElement('div');
        div.className = 'cluster-stack';
        div.onclick = () => enterCarousel(key);
        div.style.animation = `fadeIn 0.5s ease forwards ${delay}ms`;
        div.style.opacity = '0';
        
        div.innerHTML = `
            <div class="stack-card"><div class="cluster-avatar">${initial}</div><div class="cluster-name">${key}</div><div class="cluster-count">${count} Orders</div></div>
            <div class="stack-card"></div>
            <div class="stack-card"></div>
        `;
        fragment.appendChild(div);
    });
    grid.appendChild(fragment);
}

function enterCarousel(mediatorName) {
    carouselData = visionGroups[mediatorName];
    carouselIndex = 0;
    
    document.getElementById('vision-cluster-stage').classList.add('hidden-view');
    const stage = document.getElementById('vision-carousel-stage');
    stage.classList.remove('hidden-view');
    
    document.getElementById('carousel-title').innerText = mediatorName;
    renderCarouselFrame();
    document.addEventListener('keydown', handleCarouselKey);
}

function exitCarousel() {
    document.getElementById('vision-carousel-stage').classList.add('hidden-view');
    document.getElementById('vision-cluster-stage').classList.remove('hidden-view');
    document.removeEventListener('keydown', handleCarouselKey);
}

function renderCarouselFrame() {
    const track = document.getElementById('carousel-track');
    track.innerHTML = ""; 
    document.getElementById('carousel-counter').innerText = `${carouselIndex + 1} / ${carouselData.length}`;
    
    const windowSize = 2; 
    const start = Math.max(0, carouselIndex - windowSize);
    const end = Math.min(carouselData.length - 1, carouselIndex + windowSize);

    for (let i = start; i <= end; i++) {
        const item = carouselData[i];
        const offset = i - carouselIndex; 
        
        const el = document.createElement('div');
        el.className = 'c-card';
        const zIndex = 100 - Math.abs(offset);
        const opacity = 1 - (Math.abs(offset) * 0.3);
        const pointerEvents = offset === 0 ? 'auto' : 'none';
        
        let transform = '';
        if (offset === 0) { 
            transform = `translateX(0) translateZ(200px) rotateY(0deg) scale(1.1)`; 
        } else {
            const xDir = offset * 360; // Wider gap for cinematic feel
            const zDir = -200 - (Math.abs(offset) * 100); 
            const rot = offset > 0 ? -10 : 10; 
            transform = `translateX(${xDir}px) translateZ(${zDir}px) rotateY(${rot}deg)`;
        }
        
        el.style.transform = transform; 
        el.style.zIndex = zIndex; 
        el.style.opacity = opacity; 
        el.style.pointerEvents = pointerEvents;
        
        el.innerHTML = generateCardHTML(item, i); 
        track.appendChild(el);
    }
}

function moveCarousel(direction) {
    const newIndex = carouselIndex + direction;
    if (newIndex < 0 || newIndex >= carouselData.length) return;
    carouselIndex = newIndex;
    requestAnimationFrame(renderCarouselFrame);
}

function handleCarouselKey(e) {
    if (e.key === 'ArrowLeft') moveCarousel(-1);
    if (e.key === 'ArrowRight') moveCarousel(1);
    if (e.key === 'Escape') exitCarousel();
}
