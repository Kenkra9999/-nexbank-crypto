// api.js

// Initialize TradingView Widget
window.initTradingView = function(symbol, isForex = false) {
    try {
        if (typeof TradingView !== 'undefined') {
            document.getElementById('tv_chart_container').innerHTML = ''; // Clear old chart
            new TradingView.widget({
              "autosize": true,
              "symbol": isForex ? symbol : "BINANCE:" + symbol,
              "interval": "15",
              "timezone": "Etc/UTC",
              "theme": "dark",
              "style": "1",
              "locale": "en",
              "enable_publishing": false,
              "backgroundColor": "rgba(24, 26, 32, 0)",
              "gridColor": "rgba(255, 255, 255, 0.06)",
              "hide_top_toolbar": false,
              "hide_legend": false,
              "save_image": false,
              "container_id": "tv_chart_container",
              "toolbar_bg": "transparent"
            });
        } else {
            console.warn("TradingView script not loaded.");
            const container = document.getElementById('tv_chart_container');
            if(container) {
                container.innerHTML = '<div style="color:var(--text-muted); padding: 20px; text-align: center;">TradingView Chart failed to load.<br>Please check your internet connection.</div>';
            }
        }
    } catch(e) {
        console.error("Error initializing TradingView widget:", e);
    }
};

// Initial load
initTradingView('BTCUSDT');

// Real-time Crypto Prices via Binance WebSocket API
const ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');
window.cryptoPrices = {};
const coinListContainer = document.getElementById('crypto-coin-list');

const targetCoins = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'SUIUSDT', 'PEPEUSDT',
    'SHIBUSDT', 'LINKUSDT', 'DOTUSDT', 'MATICUSDT', 'OPUSDT',
    'ARBUSDT', 'APTUSDT', 'WIFUSDT', 'FLOKIUSDT', 'NEARUSDT'
];

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    data.forEach(ticker => {
        if(targetCoins.includes(ticker.s)) {
            const oldPrice = cryptoPrices[ticker.s]?.price || parseFloat(ticker.c);
            const currentPrice = parseFloat(ticker.c);
            
            cryptoPrices[ticker.s] = {
                price: currentPrice,
                change: parseFloat(ticker.P),
                volume: parseFloat(ticker.v),
                high: parseFloat(ticker.h),
                low: parseFloat(ticker.l)
            };
            
            updateCoinUI(ticker.s, oldPrice, currentPrice);
        }
    });
};

// Fetch prices via REST API repeatedly (Fallback if WS is blocked/slow)
async function fetchPricesViaREST() {
    try {
        const symbolsQuery = encodeURIComponent(JSON.stringify(targetCoins));
        const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsQuery}`);
        const data = await res.json();
        if(Array.isArray(data)) {
            data.forEach(ticker => {
                const oldPrice = cryptoPrices[ticker.symbol]?.price || parseFloat(ticker.lastPrice);
                const currentPrice = parseFloat(ticker.lastPrice);
                
                cryptoPrices[ticker.symbol] = {
                    price: currentPrice,
                    change: parseFloat(ticker.priceChangePercent),
                    volume: parseFloat(ticker.volume),
                    high: parseFloat(ticker.highPrice),
                    low: parseFloat(ticker.lowPrice)
                };
                updateCoinUI(ticker.symbol, oldPrice, currentPrice);
            });
        }
    } catch (e) {
        console.error('Failed to fetch prices via REST:', e);
    }
}
// Fetch immediately, then loop every 2.5 seconds
fetchPricesViaREST();
setInterval(fetchPricesViaREST, 2500);

function updateCoinUI(symbol, oldPrice, currentPrice) {
    const data = cryptoPrices[symbol];
    let el = document.getElementById(`coin-${symbol}`);
    
    // Determine color based on 24h change
    const colorClass = data.change >= 0 ? 'text-green' : 'text-red';
    
    // Determine flash color based on tick price difference
    let flashClass = '';
    if(currentPrice > oldPrice) flashClass = 'flash-green';
    else if(currentPrice < oldPrice) flashClass = 'flash-red';
    
    if(!el) {
        el = document.createElement('div');
        el.id = `coin-${symbol}`;
        el.className = `coin-item ${window.currentCryptoSymbol === symbol ? 'active' : ''}`;
        
        // Add click listener to change global symbol
        el.addEventListener('click', () => {
            window.currentCryptoSymbol = symbol;
            
            // Re-render chart
            if(window.initTradingView) {
                window.initTradingView(symbol);
            }
            
            // Update active styling
            document.querySelectorAll('.coin-item').forEach(c => {
                c.classList.remove('active');
                c.style.background = '';
                c.style.borderLeft = '';
            });
            
            el.classList.add('active');
            el.style.background = 'rgba(255, 255, 255, 0.12)';
            el.style.borderLeft = '4px solid var(--color-yellow)';
            
            showNotification('Chuyển đổi cặp', `Đã chọn biểu đồ ${symbol}`, 'success');
        });
        
        coinListContainer.appendChild(el);
    }
    
    // Format display to max 4 decimals outside
    const formatOutside = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(currentPrice);
    
    el.innerHTML = `
        <div class="coin-name">${symbol.replace('USDT','')}</div>
        <div class="coin-price ${flashClass}">${formatOutside}</div>
        <div class="coin-change ${colorClass}">${data.change > 0 ? '+' : ''}${data.change.toFixed(2)}%</div>
    `;
    
    // Remove flash class after a short delay
    if(flashClass) {
        setTimeout(() => {
            const priceEl = el.querySelector('.coin-price');
            if(priceEl) {
                priceEl.classList.remove('flash-green', 'flash-red');
                // Set static color based on 24h change if needed, or leave white
                priceEl.style.color = currentPrice >= oldPrice ? 'var(--color-green)' : 'var(--color-red)';
            }
        }, 300);
    }
}

// Add Custom USDT/VND Pair to Market Watch
function renderUSDTVND() {
    let el = document.getElementById('coin-USDTVND');
    if(!el) {
        el = document.createElement('div');
        el.id = 'coin-USDTVND';
        el.className = `coin-item ${window.currentCryptoSymbol === 'USDTVND' ? 'active' : ''}`;
        
        el.addEventListener('click', () => {
            window.currentCryptoSymbol = 'USDTVND';
            
            if(window.initTradingView) {
                window.initTradingView('FX_IDC:USDVND', true);
            }
            
            document.querySelectorAll('.coin-item').forEach(c => {
                c.classList.remove('active');
                c.style.background = '';
                c.style.borderLeft = '';
            });
            
            el.classList.add('active');
            el.style.background = 'rgba(255, 255, 255, 0.12)';
            el.style.borderLeft = '4px solid var(--color-yellow)';
            
            showNotification('Chuyển đổi cặp', `Đã chọn biểu đồ USDT/VND`, 'success');
        });
        
        coinListContainer.prepend(el); // Put it at the very top!
    }
    
    const currentPrice = window.EXCHANGE_RATE || 25450;
    // Mock a small percentage change based on rate modulo
    const change = ((currentPrice - 25450) / 25450 * 100).toFixed(2);
    const colorClass = change >= 0 ? 'text-green' : 'text-red';
    
    el.innerHTML = `
        <div class="coin-name" style="color:var(--color-yellow)">USDT/VND</div>
        <div class="coin-price" style="color: var(--text-primary);">${new Intl.NumberFormat('vi-VN').format(currentPrice)}</div>
        <div class="coin-change ${colorClass}">${change > 0 ? '+' : ''}${change}%</div>
    `;
}

setInterval(renderUSDTVND, 3000);
setTimeout(renderUSDTVND, 500);
