const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// In-memory OTP store (for dev purposes)
const otpStore = {};

// Create Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

// Endpoint to send OTP
app.post('/api/send-otp', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP (expires in 5 minutes)
    otpStore[email] = {
        code: otp,
        expiresAt: Date.now() + 5 * 60 * 1000
    };

    try {
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: email,
            subject: 'Mã xác thực NexBank',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #007bff; text-align: center;">NexBank</h2>
                    <p style="font-size: 16px;">Xin chào,</p>
                    <p style="font-size: 16px;">Mã xác thực (OTP) của bạn là:</p>
                    <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p style="font-size: 14px; color: #666;">Mã này sẽ hết hạn sau 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`[NexBank] OTP sent to ${email}: ${otp}`);
        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Failed to send OTP. Please check your email configuration in .env.' });
    }
});

// Endpoint to verify OTP
app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const record = otpStore[email];
    
    if (!record) {
        return res.status(400).json({ error: 'OTP chưa được gửi hoặc đã hết hạn' });
    }

    if (Date.now() > record.expiresAt) {
        delete otpStore[email];
        return res.status(400).json({ error: 'Mã OTP đã hết hạn' });
    }

    if (record.code === otp) {
        // OTP matches
        delete otpStore[email]; // clean up
        res.json({ success: true, message: 'OTP verified successfully' });
    } else {
        res.status(400).json({ error: 'Mã OTP không chính xác' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`-----------------------------------`);
    console.log(`NexBank Auth Server is running!`);
    console.log(`API Listening on http://localhost:${PORT}`);
    console.log(`Make sure to configure .env with your GMAIL_USER and GMAIL_APP_PASSWORD`);
    console.log(`-----------------------------------`);
});
