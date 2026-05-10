// transfer.js

const transferForm = document.getElementById('transfer-form');
let pendingTransfer = null;

transferForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const account = document.getElementById('transfer-account').value;
    const amountStr = document.getElementById('transfer-amount').value || '0';
    const amount = parseFloat(amountStr.replace(/,/g, ''));
    
    if(amount <= 0) {
        return showNotification('Lỗi', 'Số tiền phải lớn hơn 0', 'warning');
    }

    if(amount > appState.fiatBalance) {
        return showNotification('Lỗi', 'Số dư tài khoản không đủ để thực hiện giao dịch', 'error');
    }
    
    // Simulate lookup name
    const mockNames = ['NGUYEN VAN B', 'TRAN THI C', 'LE VAN D', 'CONG TY TNHH X'];
    const receiverName = mockNames[Math.floor(Math.random() * mockNames.length)];
    
    pendingTransfer = { account, amount, name: receiverName };
    
    // Open PIN Modal
    document.getElementById('pin-modal').style.display = 'flex';
    document.getElementById('transfer-pin').focus();
});

document.getElementById('confirm-pin-btn').addEventListener('click', processTransfer);

document.getElementById('transfer-pin').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') processTransfer();
});

function processTransfer() {
    const pin = document.getElementById('transfer-pin').value;
    if(pin === appState.user.pin) {
        // Execute transfer
        appState.fiatBalance -= pendingTransfer.amount;
        appState.transactions.push({
            type: 'transfer',
            title: `Chuyển khoản tới ${pendingTransfer.name} (${pendingTransfer.account})`,
            amount: -pendingTransfer.amount,
            date: Date.now()
        });
        saveState();
        renderTransactions();
        
        // Clean up
        closePinModal();
        transferForm.reset();
        
        showNotification('Chuyển tiền thành công', `Đã chuyển ${formatVND(pendingTransfer.amount)} tới ${pendingTransfer.name}`, 'success');
    } else {
        showNotification('Xác thực thất bại', 'Mã PIN không chính xác', 'error');
        document.getElementById('transfer-pin').value = '';
    }
}

document.getElementById('close-pin-modal').addEventListener('click', closePinModal);

function closePinModal() {
    document.getElementById('pin-modal').style.display = 'none';
    document.getElementById('transfer-pin').value = '';
    pendingTransfer = null;
}
