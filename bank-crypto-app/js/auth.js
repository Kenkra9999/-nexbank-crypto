// auth.js
const API_BASE = 'http://localhost:3000/api';

// Tab switching logic
window.switchAuthTab = function(tab) {
    const btnLogin = document.getElementById('tab-login');
    const btnReg = document.getElementById('tab-register');
    const formLogin = document.getElementById('form-login');
    const formReg = document.getElementById('form-register');
    const formForgot = document.getElementById('form-forgot');
    
    // Reset styles
    btnLogin.style.color = '#8b949e';
    btnLogin.style.borderBottomColor = 'transparent';
    btnReg.style.color = '#8b949e';
    btnReg.style.borderBottomColor = 'transparent';
    
    formLogin.style.display = 'none';
    formReg.style.display = 'none';
    formForgot.style.display = 'none';
    
    if (tab === 'login') {
        btnLogin.style.color = '#fff';
        btnLogin.style.borderBottomColor = 'var(--color-blue)';
        formLogin.style.display = 'block';
    } else if (tab === 'register') {
        btnReg.style.color = '#fff';
        btnReg.style.borderBottomColor = 'var(--color-blue)';
        formReg.style.display = 'block';
    } else if (tab === 'forgot') {
        // Forgot password doesn't highlight any tab
        formForgot.style.display = 'block';
    }
};

// Send OTP Helper
async function sendOTP(email) {
    try {
        const res = await fetch(`${API_BASE}/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.success) {
            showNotification('Thành công', 'Mã OTP đã được gửi đến email của bạn', 'success');
            return true;
        } else {
            showNotification('Lỗi', data.error || 'Không thể gửi email', 'error');
            return false;
        }
    } catch (e) {
        showNotification('Lỗi Server', 'Không thể kết nối đến server. Bạn đã chạy server.js chưa?', 'error');
        return false;
    }
}

// Verify OTP Helper
async function verifyOTP(email, otp) {
    try {
        const res = await fetch(`${API_BASE}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        const data = await res.json();
        if (data.success) {
            return true;
        } else {
            showNotification('Lỗi Xác Thực', data.error || 'Mã OTP không hợp lệ', 'error');
            return false;
        }
    } catch (e) {
        showNotification('Lỗi Server', 'Không thể kết nối đến server.', 'error');
        return false;
    }
}

// Register Flow
document.getElementById('btn-send-reg-otp').addEventListener('click', async () => {
    const email = document.getElementById('reg-email').value;
    if (!email || !email.includes('@')) {
        return showNotification('Lỗi', 'Vui lòng nhập email hợp lệ', 'warning');
    }
    const btn = document.getElementById('btn-send-reg-otp');
    btn.innerText = 'Đang gửi...';
    btn.disabled = true;
    await sendOTP(email);
    
    // Countdown
    let timeLeft = 60;
    const timer = setInterval(() => {
        timeLeft--;
        btn.innerText = `Chờ ${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(timer);
            btn.innerText = 'Gửi Lại';
            btn.disabled = false;
        }
    }, 1000);
});

document.getElementById('btn-do-register').addEventListener('click', async () => {
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-password').value;
    const otp = document.getElementById('reg-otp').value;
    
    if (!name || !email || !pass || !otp) {
        return showNotification('Thiếu thông tin', 'Vui lòng điền đầy đủ', 'warning');
    }
    
    const isValid = await verifyOTP(email, otp);
    if (isValid) {
        // Save user to state
        appState.user = { name, email, pin: pass };
        saveState();
        showNotification('Thành công', 'Đăng ký thành công! Đang đăng nhập...', 'success');
        
        setTimeout(() => {
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('main-app').style.display = 'flex';
        }, 1500);
    }
});

// Forgot Password Flow
document.getElementById('btn-send-forgot-otp').addEventListener('click', async () => {
    const email = document.getElementById('forgot-email').value;
    if (!email || !email.includes('@')) {
        return showNotification('Lỗi', 'Vui lòng nhập email hợp lệ', 'warning');
    }
    if (email !== appState.user.email && appState.user.email) {
        return showNotification('Lỗi', 'Email này chưa được đăng ký trong hệ thống', 'error');
    }
    
    const btn = document.getElementById('btn-send-forgot-otp');
    btn.innerText = 'Đang gửi...';
    btn.disabled = true;
    await sendOTP(email);
    
    let timeLeft = 60;
    const timer = setInterval(() => {
        timeLeft--;
        btn.innerText = `Chờ ${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(timer);
            btn.innerText = 'Gửi Lại';
            btn.disabled = false;
        }
    }, 1000);
});

document.getElementById('btn-do-reset').addEventListener('click', async () => {
    const email = document.getElementById('forgot-email').value;
    const otp = document.getElementById('forgot-otp').value;
    const newPass = document.getElementById('forgot-new-password').value;
    
    if (!email || !otp || !newPass) {
        return showNotification('Lỗi', 'Vui lòng điền đầy đủ', 'warning');
    }
    
    const isValid = await verifyOTP(email, otp);
    if (isValid) {
        appState.user.pin = newPass;
        saveState();
        showNotification('Thành công', 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.', 'success');
        switchAuthTab('login');
    }
});

// Login Flow
document.getElementById('btn-do-login').addEventListener('click', () => {
    const username = document.getElementById('login-email').value.trim().toLowerCase();
    const pass = document.getElementById('login-password').value;
    
    let isSuccess = false;
    
    if (username === 'admin' && pass === '111111') {
        appState.user = { name: 'Admin', email: 'admin@nexbank.com', pin: '111111' };
        isSuccess = true;
    } else if ((username === 'guest' || username === 'guess') && pass === '222222') {
        appState.user = { name: 'Guest', email: 'guest@nexbank.com', pin: '222222' };
        isSuccess = true;
    }
    
    if (isSuccess) {
        if (localStorage.getItem('nexbank_current_user') !== username) {
            localStorage.setItem('nexbank_current_user', username);
            window.location.reload();
            return;
        }
        
        saveState();
        document.getElementById('auth-screen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('main-app').style.display = 'flex';
        }, 300);
        showNotification('Đăng nhập thành công', `Xin chào, ${appState.user.name}`, 'success');
        
        // Cập nhật tên trên UI
        const userNameElements = document.querySelectorAll('.pin-user-name');
        userNameElements.forEach(el => el.innerText = appState.user.name);
    } else {
        showNotification('Lỗi Đăng Nhập', 'Tài khoản hoặc mật khẩu không chính xác', 'error');
    }
});
