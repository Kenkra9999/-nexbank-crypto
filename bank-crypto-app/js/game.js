// game.js

let activeBet = null;
let gameCountdownInterval = null;

document.querySelectorAll('.btn-bet').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        if(activeBet) return showNotification('Cảnh báo', 'Bạn đang có một vé cược chưa kết thúc!', 'warning');
        
        // Find direction correctly (handling icon clicks)
        const target = e.target.closest('.btn-bet');
        const direction = target.dataset.dir; // 'up' or 'down'
        
        const amount = parseFloat(document.getElementById('game-amount').value);
        const timeSeconds = parseInt(document.getElementById('game-time').value);
        
        if(!amount || amount <= 0) {
            return showNotification('Lỗi', 'Vui lòng nhập số tiền cược hợp lệ', 'error');
        }
        
        if(amount > appState.cryptoBalance) {
            return showNotification('Lỗi', 'Số dư USDT không đủ để đặt cược', 'error');
        }
        
        const currentSymbol = window.currentCryptoSymbol || 'BTCUSDT';
        let assetPrice = cryptoPrices[currentSymbol]?.price;
        if(!assetPrice) {
            try {
                // Fallback
                const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${currentSymbol}`);
                const data = await res.json();
                if(data && data.price) {
                    assetPrice = parseFloat(data.price);
                    cryptoPrices[currentSymbol] = { price: assetPrice };
                }
            } catch(err) {
                console.error(err);
            }
        }
        
        if(!assetPrice) {
            return showNotification('Lỗi', `Chưa lấy được giá ${currentSymbol} hiện tại. Vui lòng kiểm tra mạng.`, 'warning');
        }
        
        // Deduct balance
        appState.cryptoBalance -= amount;
        saveState();
        
        activeBet = {
            symbol: currentSymbol,
            direction: direction,
            amount: amount,
            time: timeSeconds,
            entryPrice: assetPrice,
            endTime: Date.now() + (timeSeconds * 1000)
        };
        
        // Update UI
        document.getElementById('game-entry-price').innerText = assetPrice.toFixed(4);
        document.getElementById('game-active-panel').style.display = 'block';
        
        startGameCountdown();
        showNotification('Đặt cược thành công!', `Dự đoán: ${direction === 'up' ? 'TĂNG' : 'GIẢM'} trong ${timeSeconds}s`, 'success');
    });
});

function startGameCountdown() {
    gameCountdownInterval = setInterval(() => {
        if(!activeBet) {
            clearInterval(gameCountdownInterval);
            return;
        }
        
        const timeLeft = Math.max(0, Math.ceil((activeBet.endTime - Date.now()) / 1000));
        document.getElementById('game-timer').innerText = timeLeft + 's';
        
        const livePrice = cryptoPrices[activeBet.symbol]?.price || activeBet.entryPrice;
        const liveEl = document.getElementById('game-live-price');
        liveEl.innerText = livePrice.toFixed(4);
        
        // Color feedback based on current winning state
        let isCurrentlyWinning = false;
        if((activeBet.direction === 'up' && livePrice > activeBet.entryPrice) || 
           (activeBet.direction === 'down' && livePrice < activeBet.entryPrice)) {
            isCurrentlyWinning = true;
        }
        liveEl.className = isCurrentlyWinning ? 'text-bold text-xl text-green flash-green' : 'text-bold text-xl text-red flash-red';
        
        if(timeLeft <= 0) {
            clearInterval(gameCountdownInterval);
            resolveGameBet(livePrice);
        }
    }, 1000);
}

function resolveGameBet(finalPrice) {
    const isUp = finalPrice > activeBet.entryPrice;
    const isDown = finalPrice < activeBet.entryPrice;
    
    let isWin = false;
    if(activeBet.direction === 'up' && isUp) isWin = true;
    if(activeBet.direction === 'down' && isDown) isWin = true;
    
    let reward = 0;
    if(isWin) {
        // 98.5% payout
        reward = activeBet.amount + (activeBet.amount * 0.985);
        appState.cryptoBalance += reward;
        showNotification('CHIẾN THẮNG! 🏆', `Bạn đã nhận được ${reward.toFixed(2)} USDT!`, 'success');
    } else if(finalPrice === activeBet.entryPrice) {
        // Draw, refund
        reward = activeBet.amount;
        appState.cryptoBalance += reward;
        showNotification('HÒA!', `Giá không đổi. Hoàn lại ${reward.toFixed(2)} USDT`, 'warning');
    } else {
        // Lose
        showNotification('THUA CUỘC 😢', `Bạn đã mất ${activeBet.amount} USDT`, 'error');
    }
    
    // Save history
    appState.gameHistory.push({
        date: Date.now(),
        symbol: activeBet.symbol,
        direction: activeBet.direction,
        amount: activeBet.amount,
        entryPrice: activeBet.entryPrice,
        finalPrice: finalPrice,
        result: isWin ? 'WIN' : (finalPrice === activeBet.entryPrice ? 'DRAW' : 'LOSE'),
        payout: isWin ? (activeBet.amount * 0.985) : (finalPrice === activeBet.entryPrice ? 0 : -activeBet.amount)
    });
    
    activeBet = null;
    saveState();
    document.getElementById('game-active-panel').style.display = 'none';
    renderGameHistory();
}

document.getElementById('btn-cancel-bet').addEventListener('click', () => {
    if(!activeBet) return;
    clearInterval(gameCountdownInterval);
    
    // 5% cancellation fee
    const refund = activeBet.amount * 0.95; 
    appState.cryptoBalance += refund;
    
    showNotification('Đã hủy cược', `Hoàn lại ${refund.toFixed(2)} USDT (Phí 5%)`, 'warning');
    
    activeBet = null;
    saveState();
    document.getElementById('game-active-panel').style.display = 'none';
});

function renderGameHistory() {
    const list = document.getElementById('game-history-list');
    list.innerHTML = '';
    
    if(appState.gameHistory.length === 0) {
        list.innerHTML = '<li class="text-muted text-center">Chưa có lịch sử chơi</li>';
        return;
    }
    
    appState.gameHistory.slice(-20).reverse().forEach(h => {
        const li = document.createElement('li');
        
        let colorClass = 'text-muted';
        if(h.result === 'WIN') colorClass = 'text-green text-bold';
        if(h.result === 'LOSE') colorClass = 'text-red';
        
        const dirText = h.direction === 'up' ? '<i class="fas fa-arrow-up"></i> LONG' : '<i class="fas fa-arrow-down"></i> SHORT';
        
        li.innerHTML = `
            <div class="d-flex justify-content-between w-100" style="display:flex; justify-content:space-between; width:100%;">
                <div>
                    <small class="text-muted">${new Date(h.date).toLocaleTimeString()} - <strong>${(h.symbol || 'BTCUSDT').replace('USDT','')}</strong></small><br>
                    <span>${dirText} ${h.amount} USDT</span>
                </div>
                <div class="text-right ${colorClass}" style="text-align:right;">
                    ${h.result}<br>
                    <small>${h.payout > 0 ? '+' : ''}${h.payout.toFixed(2)}</small>
                </div>
            </div>
        `;
        list.appendChild(li);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    renderGameHistory();
});
