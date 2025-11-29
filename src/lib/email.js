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

export const sendBookInvitationEmail = async (c, { to, inviterName, bookName }) => {
  const from = 'casflo.id <no-reply@casflo.id>';
  const subject = `Anda telah diundang ke buku ${bookName}`;
  const html = `
    <div style="font-family: sans-serif; text-align: center;">
      <h2>Undangan Bergabung</h2>
      <p>Halo!</p>
      <p>
        <strong>${inviterName}</strong> telah mengundang Anda untuk bergabung ke buku 
        <strong style="font-size: 18px;">${bookName}</strong>
        di aplikasi Casflo.
      </p>
      <p>
        Cukup login ke akun Casflo Anda, dan Anda akan otomatis melihat buku baru ini di daftar Anda.
      </p>
      <p style="font-size: 12px; color: #888;">
        Jika Anda tidak merasa meminta undangan ini, Anda bisa mengabaikan email ini.
      </p>
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
      console.error('Failed to send invitation email:', errorBody);
      return { success: false, error: 'Failed to send invitation email.' };
    }
    
    return { success: true };

  } catch (error) {
    console.error('Email service fetch error:', error);
    return { success: false, error: 'An error occurred while trying to send the email.' };
  }
};