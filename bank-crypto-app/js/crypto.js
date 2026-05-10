// crypto.js

const cryptoForm = document.getElementById('crypto-trade-form');
window.currentCryptoSymbol = 'BTCUSDT';

cryptoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get type robustly: from modern e.submitter or fallback to the onclick dataset trick
    let type = e.submitter ? e.submitter.dataset.type : cryptoForm.dataset.type;
    
    if(!type) {
        return showNotification('Lỗi', 'Không thể xác định hướng giao dịch (Long/Short).', 'error');
    }
    const marginAmount = parseFloat(document.getElementById('trade-amount').value);
    const leverage = parseInt(document.getElementById('trade-leverage').value);
    
    let priceData = cryptoPrices[currentCryptoSymbol];
    
    if(!priceData || !priceData.price) {
        try {
            // Fallback fetch if WS fails or is slow
            const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${currentCryptoSymbol}`);
            const data = await res.json();
            if(data && data.price) {
                priceData = { price: parseFloat(data.price) };
                cryptoPrices[currentCryptoSymbol] = priceData;
            }
        } catch(err) {
            console.error('REST API fallback failed:', err);
        }
    }
    
    if(!priceData || !priceData.price) {
        return showNotification('Lỗi', 'Đang tải dữ liệu giá, vui lòng kiểm tra mạng...', 'warning');
    }
    const entryPrice = priceData.price;
    
    if(marginAmount <= 0) {
        return showNotification('Lỗi', 'Số lượng ký quỹ không hợp lệ', 'warning');
    }
    
    // Position details
    const positionSize = marginAmount * leverage;
    const coinAmount = positionSize / entryPrice;
    const fee = positionSize * 0.0005; // 0.05% trading fee
    
    if((marginAmount + fee) > appState.cryptoBalance) {
        return showNotification('Lỗi', `Số dư không đủ. Bạn cần ${(marginAmount + fee).toFixed(2)} USDT (gồm ${fee.toFixed(2)} USDT phí sàn)`, 'error');
    }
    
    appState.cryptoBalance -= (marginAmount + fee);
    appState.cryptoPositions.push({
        id: 'POS-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        symbol: currentCryptoSymbol,
        type: type, // 'buy' (Long) or 'sell' (Short)
        margin: marginAmount,
        leverage: leverage,
        size: positionSize,
        coinAmount: coinAmount,
        entryPrice: entryPrice,
        date: Date.now()
    });
    
    // Log to Order History
    appState.orderHistory.push({
        date: Date.now(),
        symbol: currentCryptoSymbol,
        type: type === 'buy' ? 'Long' : 'Short',
        size: positionSize,
        price: entryPrice,
        status: 'Mở vị thế'
    });
    
    saveState();
    renderPositions();
    
    const typeName = type === 'buy' ? 'Long' : 'Short';
    showNotification('Mở vị thế thành công', `${typeName} ${currentCryptoSymbol} | Phí: ${fee.toFixed(2)} USDT`, 'success');
    
    // Reset input
    document.getElementById('trade-amount').value = '';
});

window.renderPositions = function() {
    const tbody = document.getElementById('positions-tbody');
    tbody.innerHTML = '';
    
    if(appState.cryptoPositions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Chưa có vị thế mở</td></tr>';
        return;
    }

    appState.cryptoPositions.forEach((pos, index) => {
        const currentPriceData = cryptoPrices[pos.symbol];
        const currentPrice = currentPriceData ? currentPriceData.price : pos.entryPrice;
        
        let pnl = 0;
        if(pos.type === 'buy') {
            // Long PnL = (Current - Entry) / Entry * PositionSize
            pnl = (currentPrice - pos.entryPrice) / pos.entryPrice * pos.size;
        } else {
            // Short PnL = (Entry - Current) / Entry * PositionSize
            pnl = (pos.entryPrice - currentPrice) / pos.entryPrice * pos.size;
        }
        
        // Liquidation check (if PnL <= -Margin)
        if(pnl <= -pos.margin) {
            // Liquidated
            showNotification('Thanh lý (Liquidated)', `Vị thế ${pos.type.toUpperCase()} ${pos.symbol} đã bị thanh lý do chạm mức ký quỹ.`, 'error');
            appState.cryptoPositions.splice(index, 1);
            saveState();
            return; // skip rendering this one
        }

        const pnlClass = pnl >= 0 ? 'text-green' : 'text-red';
        const pnlPercentage = (pnl / pos.margin) * 100;
        
        const formatTrade = (num) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(num);
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${pos.symbol.replace('USDT','')}</strong> 
                <span class="badge ${pos.type}">${pos.type === 'buy' ? 'LONG' : 'SHORT'} ${pos.leverage}x</span>
            </td>
            <td>${formatTrade(pos.size)}</td>
            <td>${formatTrade(pos.coinAmount)}</td>
            <td>${formatTrade(pos.entryPrice)}</td>
            <td>${formatTrade(currentPrice)}</td>
            <td class="${pnlClass}">
                <strong>${pnl >= 0 ? '+' : ''}${formatTrade(pnl)} USDT</strong><br>
                <small>(${pnlPercentage >= 0 ? '+' : ''}${formatTrade(pnlPercentage)}%)</small>
            </td>
            <td><button class="btn-sm btn-outline border-red text-red" onclick="closePosition(${index})">Đóng</button></td>
        `;
        tbody.appendChild(tr);
    });
};

window.closePosition = function(index) {
    const pos = appState.cryptoPositions[index];
    const currentPriceData = cryptoPrices[pos.symbol];
    const currentPrice = currentPriceData ? currentPriceData.price : pos.entryPrice;
    
    let pnl = 0;
    if(pos.type === 'buy') {
        pnl = (currentPrice - pos.entryPrice) / pos.entryPrice * pos.size;
    } else {
        pnl = (pos.entryPrice - currentPrice) / pos.entryPrice * pos.size;
    }
    
    // Add margin and PnL back to balance
    appState.cryptoBalance += (pos.margin + pnl);
    
    // Log to Order History
    appState.orderHistory.push({
        date: Date.now(),
        symbol: pos.symbol,
        type: pos.type === 'buy' ? 'Đóng Long' : 'Đóng Short',
        size: pos.size,
        price: currentPrice,
        status: 'Thành công'
    });
    
    // Log to Position History
    appState.positionHistory.push({
        date: Date.now(),
        symbol: pos.symbol,
        type: pos.type === 'buy' ? 'Long' : 'Short',
        leverage: pos.leverage,
        size: pos.size,
        entryPrice: pos.entryPrice,
        closePrice: currentPrice,
        pnl: pnl
    });
    
    // Remove position
    appState.cryptoPositions.splice(index, 1);
    
    saveState();
    renderPositions();
    
    const typeName = pnl >= 0 ? 'Chốt lời' : 'Cắt lỗ';
    const notifType = pnl >= 0 ? 'success' : 'warning';
    showNotification(`Đóng vị thế (${typeName})`, `PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`, notifType);
};

// Update Positions PnL in Real-time continuously (every second)
setInterval(() => {
    if(document.getElementById('crypto-section').classList.contains('active')) {
        renderPositions();
        updateCryptoAssets();
    }
}, 1000);

document.addEventListener('DOMContentLoaded', () => {
    renderPositions();
    renderCryptoHistory();
    updateCryptoAssets();
});

// --- Tab Switching Logic (Margin Panel) ---
const cryptoTabs = document.querySelectorAll('#crypto-trade-tabs .tab-item');
const cryptoTabContents = document.querySelectorAll('.crypto-tab-content');

cryptoTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs
        cryptoTabs.forEach(t => t.classList.remove('active'));
        cryptoTabContents.forEach(c => c.style.display = 'none');
        
        // Add active class to clicked tab
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-target');
        document.getElementById(targetId).style.display = 'block';
        
        // Re-render data when tab is opened
        if (targetId === 'tab-order-history' || targetId === 'tab-position-history') {
            renderCryptoHistory();
        } else if (targetId === 'tab-assets') {
            updateCryptoAssets();
        } else if (targetId === 'tab-bot-trading') {
            document.getElementById('bot-active-coin').innerText = window.currentCryptoSymbol;
            const livePrice = cryptoPrices[window.currentCryptoSymbol] ? cryptoPrices[window.currentCryptoSymbol].price : 0;
            document.getElementById('bot-live-price').innerText = new Intl.NumberFormat('en-US').format(livePrice);
        }
    });
});

// --- Render History ---
window.renderCryptoHistory = function() {
    const formatDate = (ts) => {
        const d = new Date(ts);
        return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')} ${d.getDate()}/${d.getMonth()+1}`;
    };
    const formatNum = (num) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(num);
    
    // Order History
    const orderTbody = document.getElementById('order-history-tbody');
    if (orderTbody) {
        orderTbody.innerHTML = '';
        if (appState.orderHistory.length === 0) {
            orderTbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Chưa có lịch sử lệnh</td></tr>';
        } else {
            // Reverse to show newest first
            [...appState.orderHistory].reverse().forEach(o => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatDate(o.date)}</td>
                    <td><strong>${o.symbol.replace('USDT','')}</strong></td>
                    <td class="${o.type.includes('Long') ? 'text-green' : 'text-red'}">${o.type}</td>
                    <td>${formatNum(o.size)} USDT</td>
                    <td>${formatNum(o.price)}</td>
                    <td class="text-green">${o.status}</td>
                `;
                orderTbody.appendChild(tr);
            });
        }
    }
    
    // Position History
    const posTbody = document.getElementById('position-history-tbody');
    if (posTbody) {
        posTbody.innerHTML = '';
        if (appState.positionHistory.length === 0) {
            posTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Chưa có lịch sử vị thế</td></tr>';
        } else {
            [...appState.positionHistory].reverse().forEach(p => {
                const pnlClass = p.pnl >= 0 ? 'text-green' : 'text-red';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatDate(p.date)}</td>
                    <td><strong>${p.symbol.replace('USDT','')}</strong></td>
                    <td class="${p.type === 'Long' ? 'text-green' : 'text-red'}">${p.type}</td>
                    <td>${p.leverage}x</td>
                    <td>${formatNum(p.size)}</td>
                    <td>${formatNum(p.entryPrice)} / ${formatNum(p.closePrice)}</td>
                    <td class="${pnlClass}"><strong>${p.pnl >= 0 ? '+' : ''}${formatNum(p.pnl)}</strong></td>
                `;
                posTbody.appendChild(tr);
            });
        }
    }
};

// --- Update Assets ---
window.updateCryptoAssets = function() {
    const totalUsdtSpan = document.getElementById('asset-total-usdt');
    const marginUsdtSpan = document.getElementById('asset-margin-usdt');
    
    // Calculate unrealized PnL
    let unrealizedPnl = 0;
    appState.cryptoPositions.forEach(pos => {
        const currentPriceData = cryptoPrices[pos.symbol];
        const currentPrice = currentPriceData ? currentPriceData.price : pos.entryPrice;
        if(pos.type === 'buy') unrealizedPnl += (currentPrice - pos.entryPrice) / pos.entryPrice * pos.size;
        else unrealizedPnl += (pos.entryPrice - currentPrice) / pos.entryPrice * pos.size;
    });
    
    const totalMargin = appState.cryptoBalance + unrealizedPnl;
    
    if (totalUsdtSpan) totalUsdtSpan.innerText = `${new Intl.NumberFormat('en-US', {maximumFractionDigits:2}).format(totalMargin)} USDT`;
    if (marginUsdtSpan) marginUsdtSpan.innerText = `${new Intl.NumberFormat('en-US', {maximumFractionDigits:2}).format(appState.cryptoBalance)} USDT`;
};

// --- Bot Analytics Logic ---
document.getElementById('btn-analyze-bot').addEventListener('click', () => {
    const btn = document.getElementById('btn-analyze-bot');
    const resultDiv = document.getElementById('bot-analysis-result');
    const symbol = window.currentCryptoSymbol.replace('USDT', '');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang phân tích...';
    resultDiv.innerHTML = `
        <div class="text-center">
            <i class="fas fa-satellite-dish fa-spin fa-3x text-blue mb-3"></i>
            <p class="text-muted">Đang truy xuất dữ liệu Order Book & Khối lượng của ${symbol}...</p>
        </div>
    `;
    
    setTimeout(() => {
        // Fake AI analysis result
        const rand = Math.random();
        let trend = '';
        let confidence = Math.floor(Math.random() * 20) + 75; // 75-95%
        let icon = '';
        let colorClass = '';
        
        if (rand > 0.5) {
            trend = 'TĂNG MẠNH (BULLISH)';
            icon = 'fa-arrow-up';
            colorClass = 'text-green';
        } else {
            trend = 'GIẢM MẠNH (BEARISH)';
            icon = 'fa-arrow-down';
            colorClass = 'text-red';
        }
        
        resultDiv.innerHTML = `
            <div class="text-center fade-in">
                <i class="fas ${icon} fa-3x ${colorClass} mb-2"></i>
                <h3 class="${colorClass}">${trend}</h3>
                <p class="text-white mt-2">Độ tin cậy: <strong class="text-yellow">${confidence}%</strong></p>
                <div style="text-align: left; font-size: 0.85rem; margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                    <p class="mb-1"><i class="fas fa-check text-green"></i> <strong>RSI (14):</strong> Chỉ báo đang cho thấy đà ${rand > 0.5 ? 'mua' : 'bán'} chiếm ưu thế.</p>
                    <p class="mb-1"><i class="fas fa-check text-green"></i> <strong>MACD:</strong> Đường tín hiệu cho thấy xu hướng ${rand > 0.5 ? 'cắt lên' : 'cắt xuống'}.</p>
                    <p class="mb-0"><i class="fas fa-bolt text-yellow"></i> <strong>Khuyến nghị:</strong> Cân nhắc vào lệnh <strong>${rand > 0.5 ? 'LONG' : 'SHORT'}</strong> với đòn bẩy vừa phải.</p>
                </div>
            </div>
        `;
        
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-search-dollar"></i> Cập Nhật Lại Phân Tích';
    }, 2500); // 2.5s analysis delay
});
