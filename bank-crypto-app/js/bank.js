// bank.js

window.renderTransactions = function() {
    const list = document.getElementById('transaction-list');
    list.innerHTML = '';
    
    if(appState.transactions.length === 0) {
        list.innerHTML = '<p class="text-muted text-center p-2">Chưa có giao dịch nào.</p>';
        return;
    }

    // Display last 50 transactions
    appState.transactions.slice(-50).reverse().forEach(tx => {
        const item = document.createElement('div');
        item.className = 'tx-item';
        
        let iconClass = 'exchange-alt';
        if(tx.type === 'transfer') iconClass = 'paper-plane';
        if(tx.type === 'loan' || tx.type === 'loan_pay') iconClass = 'hand-holding-usd';
        
        item.innerHTML = `
            <div class="tx-info">
                <div class="tx-icon"><i class="fas fa-${iconClass}"></i></div>
                <div>
                    <h4>${tx.title}</h4>
                    <small>${new Date(tx.date).toLocaleString()}</small>
                </div>
            </div>
            <div class="tx-amount ${tx.amount < 0 ? 'negative' : 'positive'}">
                ${tx.amount < 0 ? '' : '+'}${formatVND(tx.amount)}
            </div>
        `;
        list.appendChild(item);
    });
};

// Deposit Crypto
document.getElementById('btn-deposit-crypto').addEventListener('click', () => {
    const promptStr = `Tỷ giá hiện tại:\n1 USDT = ${window.EXCHANGE_RATE.toLocaleString('vi-VN')} VND\n\nNhập số lượng USDT muốn nạp từ ngân hàng:`;
    
    requireCustomPrompt('Nạp Crypto (USDT)', promptStr, 'Số lượng USDT...', (val) => {
        const usdt = parseFloat(val);
        if(usdt && usdt > 0) {
            const vndNeeded = usdt * window.EXCHANGE_RATE;
            if(appState.fiatBalance >= vndNeeded) {
                requireFullScreenPIN('Xác nhận Nạp Crypto', 'Hoàn Tất Nạp', () => {
                    appState.fiatBalance -= vndNeeded;
                    appState.cryptoBalance += usdt;
                    appState.transactions.push({
                        type: 'exchange', 
                        title: `Mua ${usdt} USDT`, 
                        amount: -vndNeeded, 
                        date: Date.now()
                    });
                    saveState();
                    renderTransactions();
                    updateGlobalUI();
                    showNotification('Giao dịch thành công', `Đã nạp ${usdt} USDT vào ví Crypto`, 'success');
                });
            } else {
                showNotification('Thất bại', `Số dư VND không đủ. Cần: ${formatVND(vndNeeded)}`, 'error');
            }
        }
    });
});

// --- CRYPTO WITHDRAW & CROSS-TAB TRANSFER LOGIC ---
let activeWithdrawTab = 'fiat';
let currentCryptoAddress = '';
let addressTimerInt = null;

// Generate 20-char random address
function generateAddress() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let addr = 'T'; // TRC20 usually starts with T
    for (let i = 0; i < 19; i++) {
        addr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return addr;
}

// Refresh Address logic
function refreshCryptoAddress() {
    currentCryptoAddress = generateAddress();
    document.getElementById('my-crypto-address').value = currentCryptoAddress;
    
    // Register address globally for cross-tab transfers
    const globalAddresses = JSON.parse(localStorage.getItem('nexbank_active_addresses') || '{}');
    globalAddresses[currentCryptoAddress] = window.STATE_KEY; // Map this address to this user's state key
    localStorage.setItem('nexbank_active_addresses', JSON.stringify(globalAddresses));
    
    let timeLeft = 60;
    if(addressTimerInt) clearInterval(addressTimerInt);
    
    addressTimerInt = setInterval(() => {
        timeLeft--;
        document.getElementById('address-timer').innerText = timeLeft;
        if(timeLeft <= 0) {
            refreshCryptoAddress();
        }
    }, 1000);
}

// Copy Address
window.copyMyAddress = function() {
    const input = document.getElementById('my-crypto-address');
    input.select();
    document.execCommand('copy');
    
    const btn = document.getElementById('btn-copy-address');
    btn.innerHTML = '<i class="fas fa-check text-green"></i>';
    showNotification('Đã sao chép', 'Địa chỉ ví đã được lưu vào khay nhớ tạm.', 'success');
    
    setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-copy"></i>';
    }, 2000);
};

// Open Withdraw Modal
document.getElementById('btn-withdraw-crypto').addEventListener('click', () => {
    document.getElementById('crypto-action-modal').style.display = 'flex';
    document.getElementById('withdraw-available-balance').innerText = `${new Intl.NumberFormat('en-US').format(appState.cryptoBalance)} USDT`;
    document.getElementById('wd-rate-text').innerText = `Tỷ giá: 1 USDT = ${window.EXCHANGE_RATE.toLocaleString('vi-VN')} VND`;
    
    refreshCryptoAddress();
    
    // Auto calculate fiat receive
    document.getElementById('wd-fiat-amount').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        document.getElementById('wd-fiat-receive').innerText = formatVND(val * window.EXCHANGE_RATE);
    });
});

window.switchWithdrawTab = function(tab) {
    activeWithdrawTab = tab;
    document.getElementById('tab-wd-fiat').classList.remove('active');
    document.getElementById('tab-wd-crypto').classList.remove('active');
    document.getElementById('wd-content-fiat').style.display = 'none';
    document.getElementById('wd-content-crypto').style.display = 'none';
    
    document.getElementById('tab-wd-' + tab).classList.add('active');
    document.getElementById('wd-content-' + tab).style.display = 'block';
};

// Confirm Withdraw
document.getElementById('btn-wd-confirm').addEventListener('click', () => {
    if(activeWithdrawTab === 'fiat') {
        const usdt = parseFloat(document.getElementById('wd-fiat-amount').value);
        if(usdt && usdt > 0) {
            if(appState.cryptoBalance >= usdt) {
                const vndGot = usdt * window.EXCHANGE_RATE;
                document.getElementById('crypto-action-modal').style.display = 'none';
                requireFullScreenPIN('Xác nhận Bán USDT', 'Hoàn Tất Rút', () => {
                    appState.cryptoBalance -= usdt;
                    appState.fiatBalance += vndGot;
                    appState.transactions.push({
                        type: 'exchange', 
                        title: `Bán ${usdt} USDT`, 
                        amount: vndGot, 
                        date: Date.now()
                    });
                    saveState();
                    renderTransactions();
                    updateGlobalUI();
                    showNotification('Thành công', `Đã bán ${usdt} USDT lấy ${formatVND(vndGot)}`, 'success');
                });
            } else {
                showNotification('Lỗi', 'Số dư USDT không đủ.', 'error');
            }
        }
    } else {
        // Crypto Transfer
        const address = document.getElementById('wd-crypto-address').value.trim();
        const amount = parseFloat(document.getElementById('wd-crypto-amount').value);
        
        if(address.length !== 20) return showNotification('Lỗi', 'Địa chỉ ví phải đúng 20 ký tự', 'error');
        if(!amount || amount <= 0) return showNotification('Lỗi', 'Số lượng không hợp lệ', 'error');
        if((amount + 1) > appState.cryptoBalance) return showNotification('Lỗi', 'Số dư không đủ (Cần thêm 1 USDT phí)', 'error');
        
        document.getElementById('crypto-action-modal').style.display = 'none';
        requireFullScreenPIN('Xác nhận Chuyển USDT', 'Hoàn Tất Chuyển', () => {
            // Deduct from sender
            appState.cryptoBalance -= (amount + 1); // +1 fee
            saveState();
            updateGlobalUI();
            
            showNotification('Đang xử lý mạng...', `Chuyển ${amount} USDT đến ${address.substr(0,5)}...`, 'warning');
            
            // Push to global transfers pool
            const globalTransfers = JSON.parse(localStorage.getItem('nexbank_pending_transfers') || '[]');
            globalTransfers.push({
                toAddress: address,
                amount: amount,
                timestamp: Date.now()
            });
            localStorage.setItem('nexbank_pending_transfers', JSON.stringify(globalTransfers));
            
            setTimeout(() => {
                showNotification('Chuyển Thành Công', `Đã hoàn tất chuyển ${amount} USDT!`, 'success');
            }, 2000);
        });
    }
});

// Polling to receive cross-tab transfers
setInterval(() => {
    if(!currentCryptoAddress) return;
    
    let globalTransfers = JSON.parse(localStorage.getItem('nexbank_pending_transfers') || '[]');
    let remainingTransfers = [];
    let receivedAmount = 0;
    
    globalTransfers.forEach(tx => {
        if(tx.toAddress === currentCryptoAddress) {
            receivedAmount += tx.amount;
        } else {
            // Keep it for other tabs/users to process
            // Unless it's older than 2 minutes, then clean it up to prevent bloat
            if(Date.now() - tx.timestamp < 120000) {
                remainingTransfers.push(tx);
            }
        }
    });
    
    if(receivedAmount > 0) {
        // We got money!
        appState.cryptoBalance += receivedAmount;
        saveState();
        updateGlobalUI();
        showNotification('🚀 Nạp USDT Thành Công', `Bạn vừa nhận được ${receivedAmount} USDT từ ví khác!`, 'success');
        
        // Update remaining transfers pool
        localStorage.setItem('nexbank_pending_transfers', JSON.stringify(remainingTransfers));
    }
}, 1000);

// Initial render
document.addEventListener('DOMContentLoaded', () => {
    renderTransactions();
});
