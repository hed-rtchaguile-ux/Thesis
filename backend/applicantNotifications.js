const nodemailer = require('nodemailer');

let emailTransporter;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function formatEmailDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function getEmailDetails(application, event) {
  const eventName = String(event || '');
  const details = [];
  const addDetail = (label, value) => {
    if (value) details.push(`${label}: ${value}`);
  };
  const coupleNames = [application.groomFullName, application.brideFullName].filter(Boolean);

  if (eventName === 'submitted') {
    addDetail('Applicant 1', application.groomFullName);
    addDetail('Applicant 2', application.brideFullName);
    addDetail('Date received', formatEmailDate(application.createdAt));
    addDetail('Submitted via', 'Online portal');
    addDetail('Current status', application.status || 'For Review');
  } else if (eventName === 'applicationStatus') {
    addDetail('Applicant 1', application.groomFullName);
    addDetail('Applicant 2', application.brideFullName);
    addDetail('Date of application', formatEmailDate(application.createdAt));
    addDetail('Current status', application.status);
  } else if (eventName === 'licenseRelease') {
    addDetail('Applicant 1', application.groomFullName);
    addDetail('Applicant 2', application.brideFullName);
    addDetail('Date of application', formatEmailDate(application.createdAt));
    addDetail('Release date', formatEmailDate(application.licenseReleaseDate));
  } else if (eventName.startsWith('redo-')) {
    const documentKey = eventName.slice('redo-'.length);
    const documentName = documentKey.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
    addDetail('Document', documentName);
    addDetail('Applicants', coupleNames.join(' & '));
    addDetail('Date flagged', formatEmailDate(application.updatedAt));
    const reviewNotes = application.documentReviewNotes;
    const reviewerNote = reviewNotes instanceof Map
      ? reviewNotes.get(documentKey)
      : reviewNotes?.[documentKey];
    addDetail('Reviewer note', reviewerNote);
  }

  return details;
}

function buildApplicantEmailContent(application, title, message, event) {
  const eventName = String(event || '');
  const details = getEmailDetails(application, event);
  const nextSteps = eventName === 'submitted'
    ? ['Processing updates will be shared through your WedRings account.', 'We will notify you if additional information is needed.']
    : eventName === 'applicationStatus' && application.status === 'For Review'
      ? ['We will notify you if additional information is needed.']
      : eventName === 'applicationStatus' && application.status === 'Verified'
        ? ['Sign in to your WedRings account to check for updates and next steps.']
    : eventName === 'licenseRelease'
      ? ['Bring valid government-issued ID for both applicants.']
      : eventName.startsWith('redo-')
        ? ['Log in to your WedRings account and upload the corrected document.']
        : [];
  const contactMessage = eventName === 'licenseRelease'
    ? 'Contact the licensing office to confirm the pickup location, office hours, and any additional requirements.'
    : 'If you have questions, contact the licensing office.';
  const nextStepsHeading = eventName === 'licenseRelease'
    ? 'What to bring'
    : eventName.startsWith('redo-')
      ? 'How to resubmit'
      : 'Next steps';
  const text = [
    title,
    '',
    message,
    ...(details.length ? ['', 'Application details:', ...details.map((detail) => `- ${detail}`)] : []),
    ...(nextSteps.length ? ['', `${nextStepsHeading}:`, ...nextSteps.map((step) => `- ${step}`)] : []),
    '',
    'Contact:',
    contactMessage,
    '',
    'WedRings',
  ].join('\n');
  const html = [
    `<h1>${escapeHtml(title)}</h1>`,
    `<p>${escapeHtml(message)}</p>`,
    ...(details.length
      ? ['<h2>Application details</h2><ul>', ...details.map((detail) => `<li>${escapeHtml(detail)}</li>`), '</ul>']
      : []),
    ...(nextSteps.length
      ? [`<h2>${escapeHtml(nextStepsHeading)}</h2><ul>`, ...nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`), '</ul>']
      : []),
    `<h2>Contact</h2><p>${escapeHtml(contactMessage)}</p>`,
    '<p>WedRings</p>',
  ].join('');

  return { text, html };
}

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

async function sendEmail(application, title, message, event) {
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
  const content = buildApplicantEmailContent(application, title, message, event);

  if (process.env.BREVO_API_KEY && process.env.SENDER_EMAIL) {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: process.env.SENDER_NAME || 'WedRings',
          email: process.env.SENDER_EMAIL,
        },
        to: recipients.map((email) => ({ email })),
        subject: `WedRings: ${title}`,
        textContent: content.text,
        htmlContent: content.html,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || `Brevo email request failed with status ${response.status}.`);
    }
    return;
  }

  if (process.env.VERCEL) {
    throw new Error('BREVO_API_KEY and SENDER_EMAIL must be configured on Vercel.');
  }

  const transporter = getEmailTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipients,
    subject: `WedRings: ${title}`,
    text: content.text,
    html: content.html,
  });
}

async function sendApplicantNotification(application, title, message, event) {
  const context = {
    applicationId: String(application._id || ''),
    event,
  };
  try {
    await sendEmail(application, title, message, event);
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

module.exports = { buildApplicantEmailContent, sendApplicantNotification };
