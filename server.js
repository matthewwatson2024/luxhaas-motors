require('dotenv').config();
const express    = require('express');
const path       = require('path');
const nodemailer = require('nodemailer');

const app  = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/',          (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/about',     (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/contact',   (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));
app.get('/configure-your-build', (req, res) => res.sendFile(path.join(__dirname, 'customize.html')));
app.get('/customize', (req, res) => res.redirect(301, '/configure-your-build'));

// ── Contact form handler ─────────────────────────────────────────────────────

const INQUIRY_LABELS = {
  custom:    'Commission a Custom Build',
  visit:     'Schedule a Factory Visit',
  configure: 'Discuss a Configuration',
  press:     'Press / Media',
  other:     'Other',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/contact', async (req, res) => {
  const { fname, lname, email, phone, country, inquiry, message } = req.body ?? {};

  if (!fname?.trim() || !lname?.trim() || !email?.trim() || !inquiry) {
    return res.status(400).json({ success: false, error: 'Please complete all required fields.' });
  }
  if (!EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
  }
  if (!INQUIRY_LABELS[inquiry]) {
    return res.status(400).json({ success: false, error: 'Invalid inquiry type.' });
  }

  const fullName      = `${fname.trim()} ${lname.trim()}`;
  const inquiryLabel  = INQUIRY_LABELS[inquiry];
  const timestamp     = new Date().toLocaleString('en-US', {
    timeZone:    'America/Chicago',
    weekday:     'long',
    year:        'numeric',
    month:       'long',
    day:         'numeric',
    hour:        '2-digit',
    minute:      '2-digit',
    timeZoneName:'short',
  });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from:    `"LuxHaus Motors" <${process.env.EMAIL_USER}>`,
      to:      process.env.EMAIL_TO || 'michaelmccaul01@gmail.com',
      replyTo: email.trim(),
      subject: `[LuxHaus Inquiry] ${inquiryLabel} — ${fullName}`,
      html:    buildEmail({
        fullName,
        fname:        fname.trim(),
        email:        email.trim(),
        phone:        phone?.trim()   || '',
        country:      country?.trim() || '',
        inquiryLabel,
        message:      message?.trim() || '',
        timestamp,
      }),
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Contact] Mail error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Message could not be delivered. Please try again or contact us directly.',
    });
  }
});

// ── HTML email builder ───────────────────────────────────────────────────────

function buildEmail({ fullName, fname, email, phone, country, inquiryLabel, message, timestamp }) {
  const messageHtml = esc(message || 'No message provided.').replace(/\n/g, '<br>');

  const field = (label, value) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0 0 5px;font-size:10px;letter-spacing:0.38em;text-transform:uppercase;color:#C9A84C;font-family:Helvetica,Arial,sans-serif;">${label}</p>
            <p style="margin:0;font-size:15px;color:#ffffff;font-family:Helvetica,Arial,sans-serif;">${esc(value)}</p>
          </td>
        </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>LuxHaus Motors — New Inquiry</title>
</head>
<body style="margin:0;padding:0;background-color:#0d0d0d;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0d0d0d;">
<tr><td align="center" style="padding:48px 16px 56px;">

  <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

    <!-- ── Header ── -->
    <tr>
      <td style="padding-bottom:24px;border-bottom:1px solid #C9A84C;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td>
            <span style="font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:0.25em;color:#C9A84C;text-transform:uppercase;font-weight:400;">LUXHAUS</span>
            <span style="font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:0.22em;text-transform:uppercase;vertical-align:middle;padding-left:6px;">MOTORS</span>
          </td>
          <td align="right">
            <span style="font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(255,255,255,0.2);font-family:Helvetica,Arial,sans-serif;">Private Inquiry</span>
          </td>
        </tr></table>
      </td>
    </tr>

    <!-- ── Inquiry type title ── -->
    <tr>
      <td style="padding:36px 0 8px;">
        <p style="margin:0 0 10px;font-size:10px;letter-spacing:0.45em;text-transform:uppercase;color:#C9A84C;font-family:Helvetica,Arial,sans-serif;">New Inquiry Received</p>
        <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:30px;color:#ffffff;font-weight:400;letter-spacing:0.04em;line-height:1.25;">${esc(inquiryLabel)}</h1>
      </td>
    </tr>

    <!-- ── Gradient rule ── -->
    <tr><td style="padding:24px 0 32px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="40%" style="height:1px;background-color:#C9A84C;opacity:0.5;"></td>
        <td style="height:1px;background-color:rgba(201,168,76,0.05);"></td>
      </tr></table>
    </td></tr>

    <!-- ── Contact information ── -->
    <tr>
      <td style="background-color:#111111;padding:28px 32px;border-left:3px solid #C9A84C;">
        <p style="margin:0 0 4px;font-size:10px;letter-spacing:0.38em;text-transform:uppercase;color:rgba(255,255,255,0.25);font-family:Helvetica,Arial,sans-serif;">Contact Information</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${field('Full Name',     fullName)}
          ${field('Email Address', email)}
          ${field('Phone Number',  phone   || 'Not provided')}
          ${field('Country',       country || 'Not provided')}
        </table>
      </td>
    </tr>

    <!-- ── Spacer ── -->
    <tr><td style="height:20px;background-color:#0d0d0d;"></td></tr>

    <!-- ── Nature of inquiry ── -->
    <tr>
      <td style="background-color:#111111;padding:24px 32px;border-left:3px solid rgba(201,168,76,0.4);">
        <p style="margin:0 0 8px;font-size:10px;letter-spacing:0.38em;text-transform:uppercase;color:rgba(255,255,255,0.25);font-family:Helvetica,Arial,sans-serif;">Nature of Inquiry</p>
        <p style="margin:0;font-size:17px;color:#C9A84C;font-family:Georgia,'Times New Roman',serif;font-weight:400;letter-spacing:0.03em;">${esc(inquiryLabel)}</p>
      </td>
    </tr>

    <!-- ── Spacer ── -->
    <tr><td style="height:20px;background-color:#0d0d0d;"></td></tr>

    <!-- ── Message body ── -->
    <tr>
      <td style="background-color:#111111;padding:28px 32px;border-left:3px solid rgba(201,168,76,0.4);">
        <p style="margin:0 0 16px;font-size:10px;letter-spacing:0.38em;text-transform:uppercase;color:rgba(255,255,255,0.25);font-family:Helvetica,Arial,sans-serif;">Message</p>
        <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.78);line-height:1.8;font-family:Helvetica,Arial,sans-serif;">${messageHtml}</p>
      </td>
    </tr>

    <!-- ── Rule ── -->
    <tr><td style="padding:32px 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="height:1px;background-color:rgba(201,168,76,0.18);"></td>
      </tr></table>
    </td></tr>

    <!-- ── Timestamp + reply-to ── -->
    <tr>
      <td style="padding:20px 0 4px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td>
            <p style="margin:0;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:rgba(255,255,255,0.18);font-family:Helvetica,Arial,sans-serif;">Submitted</p>
            <p style="margin:5px 0 0;font-size:12px;color:rgba(255,255,255,0.32);font-family:Helvetica,Arial,sans-serif;">${esc(timestamp)}</p>
          </td>
          <td align="right">
            <p style="margin:0;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:rgba(255,255,255,0.18);font-family:Helvetica,Arial,sans-serif;">Reply To</p>
            <p style="margin:5px 0 0;font-size:12px;color:#C9A84C;font-family:Helvetica,Arial,sans-serif;">${esc(email)}</p>
          </td>
        </tr></table>
      </td>
    </tr>

    <!-- ── Brand footer ── -->
    <tr>
      <td style="padding:24px 0 0;border-top:1px solid rgba(255,255,255,0.05);">
        <p style="margin:0 0 5px;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.1);font-family:Helvetica,Arial,sans-serif;">LuxHaus Motors — Automated Inquiry Notification</p>
        <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.1);font-family:Helvetica,Arial,sans-serif;line-height:1.6;">This message was generated by the LuxHaus Motors contact form. Reply directly to respond to ${esc(fname)}.</p>
      </td>
    </tr>

  </table>
</td></tr>
</table>

</body>
</html>`;
}

function esc(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(port, () => {
  console.log(`LuxHaus Motors running at http://localhost:${port}`);
});
