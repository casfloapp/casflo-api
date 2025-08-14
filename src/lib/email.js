// src/lib/email.js

export const sendVerificationEmail = async (c, { to, code }) => {
  const from = 'casflo.id <no-reply@casflo.id>'; // GANTI dengan domain terverifikasi Anda di Resend
  const subject = `Kode Verifikasi Anda untuk casflo.id: ${code}`;
  const html = `
    <div style="font-family: sans-serif; text-align: center;">
      <h2>Verifikasi Akun casflo.id Anda</h2>
      <p>Gunakan kode di bawah ini untuk menyelesaikan pendaftaran Anda.</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 5px; background: #f0f0f0; padding: 15px;">
        ${code}
      </p>
      <p>Kode ini akan kedaluwarsa dalam 10 menit.</p>
    </div>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${c.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({ from, to, subject, html })
    });

    if (!response.ok) {
      const errorBody = await response.json();
      console.error('Failed to send email:', errorBody);
      return { success: false, error: 'Failed to send verification email.' };
    }
    
    return { success: true };

  } catch (error) {
    console.error('Email service fetch error:', error);
    return { success: false, error: 'An error occurred while trying to send the email.' };
  }
};