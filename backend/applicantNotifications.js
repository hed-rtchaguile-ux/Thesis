const nodemailer = require('nodemailer');

let emailTransporter;

function getEmailTransporter() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP_HOST, SMTP_USER, and SMTP_PASS must be configured.');
  }

  if (!emailTransporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    emailTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }

  return emailTransporter;
}

async function sendEmail(application, title, message) {
  const rawRecipients = [application.applicantEmail, application.groomEmail, application.brideEmail]
    .map((email) => String(email || '').trim())
    .filter(Boolean);
  const invalidCount = rawRecipients.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).length;
  const recipients = [...new Set(rawRecipients
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    .map((email) => email.toLowerCase()))];
  if (invalidCount > 0) {
    console.warn('Applicant email notification has invalid addresses.', {
      applicationId: String(application._id || ''),
      invalidRecipientCount: invalidCount,
    });
  }
  if (recipients.length === 0) throw new Error('No applicant email addresses are available.');

  const transporter = getEmailTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipients,
    subject: `WedRings: ${title}`,
    text: message,
  });
}

async function sendApplicantNotification(application, title, message, event) {
  const context = {
    applicationId: String(application._id || ''),
    event,
  };
  try {
    await sendEmail(application, title, message);
    console.info('Applicant email notification accepted by delivery provider.', context);
    return { email: { status: 'accepted' } };
  } catch (error) {
    console.error('Applicant email notification delivery failed.', {
      ...context,
      error: error.message,
    });
    return { email: { status: 'failed', error: error.message } };
  }
}

module.exports = { sendApplicantNotification };
