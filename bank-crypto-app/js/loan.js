// loan.js

const loanForm = document.getElementById('loan-form');
const loanList = document.getElementById('loan-list');

window.renderLoans = function() {
    loanList.innerHTML = '';
    
    if(appState.loans.length === 0) {
        loanList.innerHTML = '<p class="text-muted text-center p-2">Bạn chưa có khoản vay nào.</p>';
        return;
    }

    appState.loans.forEach((loan, index) => {
        const item = document.createElement('div');
        item.className = 'loan-item glass-panel p-2 mb-2';
        
        let paidAmount = loan.total - loan.remaining;
        let scheduleHTML = '<div class="loan-schedule mt-3" style="max-height: 400px; overflow-y: auto; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">';
        
        let tempPaid = paidAmount;
        for(let i = 1; i <= loan.months; i++) {
            let monthAmount = loan.monthlyPay;
            let isPaid = false;
            let isPartial = false;
            let amountLeft = monthAmount;
            
            if (tempPaid + 0.1 >= monthAmount) {
                isPaid = true;
                tempPaid -= monthAmount;
                amountLeft = 0;
            } else if (tempPaid > 0.1) {
                isPartial = true;
                amountLeft = monthAmount - tempPaid;
                tempPaid = 0;
            }
            
            scheduleHTML += `<div style="display:flex; justify-content:space-between; align-items:center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem;">
                <span>Tháng ${i}: <strong class="text-yellow">${formatVND(monthAmount)}</strong></span>`;
                
            if (isPaid) {
                scheduleHTML += `<span class="text-green"><i class="fas fa-check-circle"></i> Đã thanh toán</span>`;
            } else {
                let displayAmount = isPartial ? amountLeft : monthAmount;
                scheduleHTML += `<button class="btn-primary btn-sm" style="padding: 4px 10px; font-size: 0.8rem;" onclick="payExactAmount(${index}, ${displayAmount}, 'Thanh toán Tháng ${i}')">Thanh toán${isPartial ? ' (Còn '+formatVND(displayAmount)+')' : ''}</button>`;
            }
            scheduleHTML += `</div>`;
        }
        scheduleHTML += '</div>';

        let payAllBtn = '';
        if (loan.remaining > 0) {
            let currentPaid = loan.total - loan.remaining;
            let paidMonths = currentPaid / loan.monthlyPay;
            let remainingPrincipal = loan.amount - (loan.amount / loan.months) * paidMonths;
            if (remainingPrincipal < 0) remainingPrincipal = 0;
            
            const fee = remainingPrincipal * 0.05;
            const payAllAmount = remainingPrincipal + fee;
            payAllBtn = `<button onclick="payExactAmount(${index}, ${payAllAmount}, 'Tất toán (Gốc + Phí 5%)')" class="btn-outline btn-sm w-100 mt-2 border-red text-red"><i class="fas fa-bolt"></i> Tất toán trước hạn (Gốc còn lại + Phí 5%: ${formatVND(payAllAmount)})</button>`;
        }

        item.innerHTML = `
            <div class="loan-header">
                <h4 class="text-blue">Khoản vay #${index + 1}</h4>
                <strong class="${loan.remaining > 0 ? 'text-red' : 'text-green'}">
                    Dư nợ: ${formatVND(loan.remaining)}
                </strong>
            </div>
            <p>Gốc: ${formatVND(loan.amount)}</p>
            <div style="display:flex; align-items:center; gap:10px; margin: 4px 0;">
                <label style="color:var(--text-muted); font-size:0.9rem;">Kỳ hạn:</label>
                <select class="bg-dark text-white border-radius p-1" style="border: 1px solid rgba(255,255,255,0.2); font-size:0.9rem;" onchange="adjustLoanMonths(${index}, this.value)" ${loan.remaining <= 0 ? 'disabled' : ''}>
                    ${[1,3,5,7,9,12,24,26,48].map(m => `<option value="${m}" ${loan.months === m ? 'selected' : ''}>${m} tháng</option>`).join('')}
                </select>
                <span class="text-muted" style="font-size:0.8rem;">(2%/tháng)</span>
            </div>
            <p>Tổng (Gốc + Lãi): ${formatVND(loan.total)}</p>
            <p class="text-yellow">Trả góp hàng tháng: <strong>${formatVND(loan.monthlyPay)}</strong></p>
            <p>Trạng thái: <span class="badge ${loan.remaining > 0 ? 'sell' : 'buy'}">${loan.remaining > 0 ? 'Đang trả nợ' : 'Đã tất toán'}</span></p>
            ${loan.remaining > 0 ? scheduleHTML : ''}
            ${payAllBtn}
        `;
        loanList.appendChild(item);
    });
};

loanForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const amountStr = document.getElementById('loan-amount').value || '0';
    const amount = parseFloat(amountStr.replace(/,/g, ''));
    const months = parseInt(document.getElementById('loan-months').value);
    
    if(amount < 1000000) {
        return showNotification('Lỗi', 'Số tiền vay tối thiểu 1,000,000 VND', 'warning');
    }

    // Disable button to prevent multiple clicks
    const submitBtn = document.getElementById('loan-submit-btn');
    if(submitBtn) submitBtn.disabled = true;
    document.getElementById('loan-loading').style.display = 'block';
    
    setTimeout(() => {
        document.getElementById('loan-loading').style.display = 'none';
        if(submitBtn) submitBtn.disabled = false;
        
        // Fix: 100% approval chance for better user experience
        const isApproved = true; 
        
        if(isApproved) {
            const interestRate = 0.02; // 2% per month
            const interestAmount = amount * interestRate * months;
            const total = amount + interestAmount;
            
            appState.fiatBalance += amount;
            appState.loans.push({
                amount: amount,
                total: total,
                remaining: total,
                months: months,
                monthlyPay: total / months,
                date: Date.now()
            });
            appState.transactions.push({
                type: 'loan',
                title: `Giải ngân khoản vay (${months} tháng)`,
                amount: amount,
                date: Date.now()
            });
            
            saveState();
            renderTransactions();
            renderLoans();
            loanForm.reset();
            showNotification('Khoản vay được duyệt!', `Đã giải ngân ${formatVND(amount)} vào tài khoản`, 'success');
        } else {
            showNotification('Từ chối cho vay', 'Rất tiếc, điểm tín dụng của bạn chưa đủ để duyệt khoản vay này.', 'error');
        }
    }, 2500); // Simulate API latency
});

window.payExactAmount = function(index, payAmount, titleStr) {
    const loan = appState.loans[index];
    
    if(payAmount > appState.fiatBalance) {
        return showNotification('Lỗi', 'Số dư tài khoản không đủ', 'error');
    }
    
    let actualDeductionFromRemaining = payAmount;
    let isTatToan = titleStr.includes('Tất toán');
    if (isTatToan) {
        actualDeductionFromRemaining = loan.remaining;
    } else {
        if(actualDeductionFromRemaining > loan.remaining) {
            actualDeductionFromRemaining = loan.remaining;
        }
    }
    
    requireFullScreenPIN('Xác nhận Thanh toán', 'Thanh Toán Ngay', () => {
        appState.fiatBalance -= payAmount;
        loan.remaining -= actualDeductionFromRemaining;
        
        appState.transactions.push({
            type: 'loan_pay',
            title: `${titleStr} - Khoản vay #${index+1}`,
            amount: -payAmount,
            date: Date.now()
        });
        
        saveState();
        renderTransactions();
        renderLoans();
        updateGlobalUI();
        
        if(loan.remaining <= 0) {
            showNotification('Tất toán thành công', 'Chúc mừng bạn đã trả hết khoản vay!', 'success');
        } else {
            showNotification('Thanh toán thành công', `Đã thanh toán ${formatVND(payAmount)}`, 'success');
        }
    });
};

window.adjustLoanMonths = function(index, newMonthsStr) {
    const newMonths = parseInt(newMonthsStr);
    const loan = appState.loans[index];
    
    // Check how much they have already paid
    const paidAmount = loan.total - loan.remaining;
    
    // Calculate new total
    const interestRate = 0.02; // 2%
    const newInterest = loan.amount * interestRate * newMonths;
    const newTotal = loan.amount + newInterest;
    
    // Update loan details
    loan.months = newMonths;
    loan.total = newTotal;
    loan.remaining = newTotal - paidAmount;
    
    // If they overpaid compared to the new total
    if(loan.remaining < 0) {
        const refund = Math.abs(loan.remaining);
        appState.fiatBalance += refund;
        appState.transactions.push({
            type: 'loan',
            title: `Hoàn tiền dư khoản vay #${index+1} (Giảm kỳ hạn)`,
            amount: refund,
            date: Date.now()
        });
        loan.remaining = 0;
        showNotification('Cập nhật kỳ hạn', `Đã tất toán khoản vay, hoàn lại ${formatVND(refund)}`, 'success');
    } else {
        showNotification('Cập nhật kỳ hạn', `Đã chuyển sang ${newMonths} tháng. Dư nợ mới: ${formatVND(loan.remaining)}`, 'success');
    }
    
    loan.monthlyPay = loan.total / loan.months;
    
    saveState();
    renderLoans();
    updateGlobalUI();
};

document.addEventListener('DOMContentLoaded', () => {
    renderLoans();
    
    document.querySelectorAll('.month-option').forEach(opt => {
        opt.addEventListener('click', function() {
            document.querySelectorAll('.month-option').forEach(o => o.classList.remove('selected'));
            this.classList.add('selected');
            document.getElementById('loan-months').value = this.dataset.val;
        });
    });
});
