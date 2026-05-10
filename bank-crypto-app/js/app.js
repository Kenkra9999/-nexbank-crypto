// app.js

// State Management
const currentUser = localStorage.getItem('nexbank_current_user') || 'guest';
window.STATE_KEY = 'nexbank_app_state_v2_' + currentUser;
const DEFAULT_STATE = {
    user: { name: 'Alex Nguyen', pin: '111111' },
    fiatBalance: 0,
    cryptoBalance: 0,
    transactions: [],
    loans: [],
    cryptoPositions: [],
    gameHistory: []
};

// Initialize State
window.appState = JSON.parse(localStorage.getItem(STATE_KEY)) || DEFAULT_STATE;

if (!window.appState.orderHistory) window.appState.orderHistory = [];
if (!window.appState.positionHistory) window.appState.positionHistory = [];

window.saveState = function() {
    localStorage.setItem(STATE_KEY, JSON.stringify(appState));
    updateGlobalUI();
};

window.EXCHANGE_RATE = 25450;

// Simulate real-time fluctuation for USDT/VND
setInterval(() => {
    // Fluctuate between -5 and +5 VND
    const change = Math.floor(Math.random() * 11) - 5;
    window.EXCHANGE_RATE += change;
    updateGlobalUI();
}, 3000);

window.formatVND = function(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

window.formatUSDT = function(amount) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' USDT';
};

window.showNotification = function(title, message, type = 'success') {
    const container = document.getElementById('notification-container');
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    let icon = 'check-circle';
    if(type === 'error') icon = 'exclamation-circle';
    if(type === 'warning') icon = 'exclamation-triangle';
    
    notif.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:10px;">
            <i class="fas fa-${icon}" style="margin-top:2px; font-size:1.2rem;"></i>
            <div>
                <h4>${title}</h4>
                <p>${message}</p>
            </div>
        </div>
    `;
    container.appendChild(notif);
    
    // Play sound based on type (simulated)
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='); // Silent wav just for structure, real app uses sound file
        audio.play().catch(e=>e);
    } catch(e) {}
    
    setTimeout(() => {
        notif.style.animation = 'slideIn 0.3s reverse forwards';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
};

// Navigation Logic
document.querySelectorAll('.sidebar-menu li').forEach(item => {
    item.addEventListener('click', () => {
        // Remove active class from all
        document.querySelectorAll('.sidebar-menu li').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.app-section').forEach(sec => {
            sec.classList.remove('active');
            sec.classList.remove('fade-in');
        });
        
        // Add active class to clicked
        item.classList.add('active');
        const target = item.getAttribute('data-target');
        const section = document.getElementById(`${target}-section`);
        
        // Handle sub-modes for crypto
        const mode = item.getAttribute('data-mode');
        if (mode === 'trade') {
            document.getElementById('margin-order-panel').style.display = 'block';
            document.getElementById('predict-order-panel').style.display = 'none';
            document.getElementById('trade-positions-table').style.display = 'flex';
            document.getElementById('predict-history-table').style.display = 'none';
        } else if (mode === 'predict') {
            document.getElementById('margin-order-panel').style.display = 'none';
            document.getElementById('predict-order-panel').style.display = 'block';
            document.getElementById('trade-positions-table').style.display = 'none';
            document.getElementById('predict-history-table').style.display = 'flex';
        }
        
        // Slight delay for animation
        setTimeout(() => {
            section.classList.add('active', 'fade-in');
        }, 50);
    });
});

window.setupCurrencyInput = function(id) {
    const input = document.getElementById(id);
    if(!input) return;
    input.addEventListener('input', function(e) {
        let value = this.value.replace(/[^0-9]/g, '');
        if(value) {
            this.value = parseInt(value, 10).toLocaleString('en-US');
        } else {
            this.value = '';
        }
    });
};

// Update Global UI
window.updateGlobalUI = function() {
    document.querySelectorAll('.fiat-balance-display').forEach(el => {
        // Simple counter animation
        const current = parseInt(el.innerText.replace(/[^0-9-]/g, '')) || 0;
        const target = appState.fiatBalance;
        if(current !== target) {
            el.innerText = formatVND(target);
        }
    });
    
    document.querySelectorAll('.crypto-balance-display').forEach(el => {
        el.innerText = formatUSDT(appState.cryptoBalance);
    });
    
    // Update topbar exchange rate if it exists
    let rateEl = document.getElementById('live-usdt-vnd-rate');
    if(!rateEl) {
        const totalAssets = document.querySelector('.total-assets');
        if(totalAssets) {
            const rateDiv = document.createElement('div');
            rateDiv.style.fontSize = '0.85rem';
            rateDiv.style.marginTop = '4px';
            rateDiv.innerHTML = `1 USDT = <span id="live-usdt-vnd-rate" class="text-green"></span>`;
            totalAssets.appendChild(rateDiv);
            rateEl = document.getElementById('live-usdt-vnd-rate');
        }
    }
    if(rateEl) {
        rateEl.innerText = new Intl.NumberFormat('vi-VN').format(window.EXCHANGE_RATE) + ' đ';
        // Add subtle flash
        rateEl.classList.remove('text-green', 'text-red');
        rateEl.classList.add(Math.random() > 0.5 ? 'text-green' : 'text-red');
    }
};

// Full Screen PIN Auth Reusable System (Now shows popup Modal instead of fullscreen)
let currentAuthCallback = null;

window.requireFullScreenPIN = function(title, buttonText, onSuccess) {
    const pinModal = document.getElementById('pin-modal');
    
    document.getElementById('pin-modal-title').innerText = title || 'Xác nhận Thanh toán';
    document.getElementById('pin-modal-confirm').innerText = buttonText || 'Thanh Toán Ngay';
    document.getElementById('pin-modal-input').value = '';
    
    currentAuthCallback = onSuccess;
    
    pinModal.style.display = 'flex';
};

document.getElementById('pin-modal-confirm').addEventListener('click', () => {
    const pin = document.getElementById('pin-modal-input').value;
    if(pin === appState.user.pin) {
        document.getElementById('pin-modal').style.display = 'none';
        if(currentAuthCallback) currentAuthCallback();
        currentAuthCallback = null;
    } else {
        showNotification('Lỗi Xác Thực', 'Mã PIN không chính xác', 'error');
        document.getElementById('pin-modal-input').value = '';
    }
});

document.getElementById('pin-modal-cancel').addEventListener('click', () => {
    document.getElementById('pin-modal').style.display = 'none';
    currentAuthCallback = null;
    showNotification('Đã hủy', 'Giao dịch đã bị hủy', 'warning');
});

// Custom Prompt System
window.requireCustomPrompt = function(title, message, placeholder, onConfirm) {
    const modal = document.getElementById('prompt-modal');
    document.getElementById('prompt-modal-title').innerText = title;
    document.getElementById('prompt-modal-message').innerText = message;
    
    const inputEl = document.getElementById('prompt-modal-input');
    inputEl.placeholder = placeholder || '';
    inputEl.value = '';
    
    modal.style.display = 'flex';
    
    const confirmBtn = document.getElementById('prompt-modal-confirm');
    const cancelBtn = document.getElementById('prompt-modal-cancel');
    
    const newConfirm = confirmBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    
    newConfirm.addEventListener('click', () => {
        const val = document.getElementById('prompt-modal-input').value;
        if(val) {
            modal.style.display = 'none';
            onConfirm(val);
        } else {
            showNotification('Lỗi', 'Vui lòng nhập giá trị hợp lệ', 'error');
        }
    });
    
    newCancel.addEventListener('click', () => {
        modal.style.display = 'none';
    });
};

// Global Enter Key Support
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        // Auth screen
        const authScreen = document.getElementById('auth-screen');
        if (authScreen && authScreen.style.display !== 'none') {
            document.getElementById('btn-do-login').click();
            return;
        }
        
        // PIN Modal
        const pinModal = document.getElementById('pin-modal');
        if (pinModal && pinModal.style.display !== 'none') {
            document.getElementById('pin-modal-confirm').click();
            return;
        }
        
        // Prompt Modal
        const promptModal = document.getElementById('prompt-modal');
        if (promptModal && promptModal.style.display !== 'none') {
            document.getElementById('prompt-modal-confirm').click();
            return;
        }
        
        // Crypto Action Modal
        const cryptoModal = document.getElementById('crypto-action-modal');
        if (cryptoModal && cryptoModal.style.display !== 'none') {
            document.getElementById('btn-wd-confirm').click();
            return;
        }
    }
});

// Splash Screen Logic
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
                const authScreen = document.getElementById('auth-screen');
                if(authScreen) authScreen.style.display = 'flex';
            }, 150);
        }
    }, 200); // make it extremely fast
    
    updateGlobalUI();
    setupCurrencyInput('transfer-amount');
    setupCurrencyInput('loan-amount');
    
    // Resizer Logic
    const initResizer = (resizerId, panelClass, isRight) => {
        const resizer = document.getElementById(resizerId);
        if(!resizer) return;
        const panel = document.querySelector(panelClass);
        let isResizing = false;
        let startX, startWidth;
        
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            resizer.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            startX = e.clientX;
            startWidth = panel.getBoundingClientRect().width;
            e.preventDefault(); // prevent text selection
        });
        
        document.addEventListener('mousemove', (e) => {
            if(!isResizing) return;
            
            if(isRight) {
                // Dragging right resizer (left-wards makes panel wider)
                const newWidth = startWidth - (e.clientX - startX);
                panel.style.width = `${newWidth}px`;
            } else {
                // Dragging left resizer (right-wards makes panel wider)
                const newWidth = startWidth + (e.clientX - startX);
                panel.style.width = `${newWidth}px`;
            }
        });
        
        document.addEventListener('mouseup', () => {
            if(isResizing) {
                isResizing = false;
                resizer.classList.remove('resizing');
                document.body.style.cursor = 'default';
            }
        });
    };
    
    initResizer('resizer-left', '.market-watch', false);
    initResizer('resizer-right', '.order-panel', true);
});
