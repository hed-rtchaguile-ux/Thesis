const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const dns = require('dns2');
const systemDns = require('node:dns');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { buildPrintFormHtml, buildPrintFormPdf } = require('./printForm');

// Load environmental variables
dotenv.config();

const databaseDnsServers = (process.env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean);

systemDns.setServers(databaseDnsServers);

const app = express();

const BACKEND_PORT = process.env.PORT || 5000;
const DNS_PORT = Number(process.env.DNS_PORT || 5353);
const DNS_HOST = process.env.DNS_HOST || '127.0.0.1';
const ALLOWED_FRONTEND_ORIGIN = 'http://localhost:5173';
const DATABASE_CONNECTION_STRING = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wedrings';
const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || 'wedrings-local-development-secret';
const AUTH_TOKEN_LIFETIME_SECONDS = 8 * 60 * 60;
const scrypt = promisify(crypto.scrypt);
const passwordResetRequestWindows = new Map();

function isPasswordResetRateLimited(ipAddress) {
  const now = Date.now();
  for (const [address, window] of passwordResetRequestWindows) {
    if (window.expiresAt <= now) passwordResetRequestWindows.delete(address);
  }

  const currentWindow = passwordResetRequestWindows.get(ipAddress);
  if (!currentWindow) {
    passwordResetRequestWindows.set(ipAddress, { count: 1, expiresAt: now + 15 * 60 * 1000 });
    return false;
  }
  if (currentWindow.count >= 5) return true;

  currentWindow.count += 1;
  return false;
}

let dnsRecords;

try {
  dnsRecords = JSON.parse(process.env.DNS_RECORDS || '{"localhost":"127.0.0.1"}');
} catch (error) {
  console.error('DNS_RECORDS must be valid JSON, for example {"example.test":"127.0.0.1"}.');
  process.exit(1);
}

if (!dnsRecords || Array.isArray(dnsRecords) || typeof dnsRecords !== 'object') {
  console.error('DNS_RECORDS must be a JSON object mapping hostnames to IPv4 addresses.');
  process.exit(1);
}

const normalizedDnsRecords = Object.fromEntries(
  Object.entries(dnsRecords).map(([hostname, address]) => [hostname.toLowerCase().replace(/\.$/, ''), address]),
);

const accountSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  passwordResetTokenHash: String,
  passwordResetExpiresAt: Date,
  role: { type: String, required: true, enum: ['applicant', 'admin', 'superadmin'] },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

accountSchema.index({ email: 1 }, { unique: true });

const SuperAdminAccount = mongoose.model('SuperAdminAccount', accountSchema, 'superadmin_accounts');
const AdminAccount = mongoose.model('AdminAccount', accountSchema, 'admin_accounts');
const ApplicantAccount = mongoose.model('ApplicantAccount', accountSchema, 'applicant_accounts');
const accountModels = {
  superadmin: SuperAdminAccount,
  admin: AdminAccount,
  applicant: ApplicantAccount,
};

const applicationSchema = new mongoose.Schema({
  applicantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApplicantAccount', index: true },
  applicantEmail: { type: String, required: true, index: true },
  groomFullName: String,
  groomDob: String,
  groomGender: String,
  groomCivilStatus: String,
  groomMobile: String,
  groomEmail: String,
  brideFullName: String,
  brideDob: String,
  brideGender: String,
  brideCivilStatus: String,
  brideMobile: String,
  brideEmail: String,
  preferredAppointmentDate: String,
  preferredAppointmentTime: String,
  appointmentDate: String,
  appointmentTime: String,
  appointmentLocation: String,
  paymentMethod: String,
  paymentAmount: String,
  applicationData: mongoose.Schema.Types.Mixed,
  documents: { type: Map, of: String },
  documentReviews: { type: Map, of: String },
  documentReviewNotes: { type: Map, of: String },
  notificationReads: { type: Map, of: Date },
  status: { type: String, default: 'For Review' },
}, { timestamps: true });

const Application = mongoose.model('Application', applicationSchema, 'applications');

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const [salt, expectedHex] = String(storedHash || '').split(':');
  if (!salt || !expectedHex) return false;

  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await scrypt(password, salt, expected.length);
  return expected.length > 0 && crypto.timingSafeEqual(actual, expected);
}

function createAccessToken(account) {
  const payload = Buffer.from(JSON.stringify({
    sub: account._id.toString(),
    email: account.email,
    name: account.name,
    role: account.role,
    exp: Math.floor(Date.now() / 1000) + AUTH_TOKEN_LIFETIME_SECONDS,
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function requireRoles(allowedRoles) {
  return async (req, res, next) => {
    const authorization = req.get('Authorization') || '';
    const [scheme, token] = authorization.split(' ');
    const [payload, signature] = token ? token.split('.') : [];

    if (scheme !== 'Bearer' || !payload || !signature) {
      return res.status(401).json({ message: 'Authentication is required.' });
    }

    const expectedSignature = crypto.createHmac('sha256', AUTH_TOKEN_SECRET).update(payload).digest();
    const receivedSignature = Buffer.from(signature, 'base64url');
    if (expectedSignature.length !== receivedSignature.length || !crypto.timingSafeEqual(expectedSignature, receivedSignature)) {
      return res.status(401).json({ message: 'Authentication token is invalid.' });
    }

    let claims;
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return res.status(401).json({ message: 'Authentication token is invalid.' });
    }

    if (!claims.sub || !claims.role || claims.exp <= Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ message: 'Authentication token has expired.' });
    }

    const Account = accountModels[claims.role];
    if (!Account) return res.status(401).json({ message: 'Authentication token is invalid.' });

    try {
      const account = await Account.findOne({ _id: claims.sub, isActive: true }).lean();
      if (!account) return res.status(401).json({ message: 'Account is unavailable.' });
      if (!allowedRoles.includes(account.role)) return res.status(403).json({ message: 'You are not allowed to perform this action.' });

      req.user = {
        id: account._id.toString(),
        email: account.email,
        name: account.name,
        role: account.role,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

async function initializeAccounts() {
  if (process.env.NODE_ENV === 'production' && !process.env.AUTH_TOKEN_SECRET) {
    throw new Error('AUTH_TOKEN_SECRET must be configured in production.');
  }

  if (process.env.NODE_ENV !== 'production') {
    const demoAccounts = [
      { name: 'Jamie Applicant', email: 'applicant@wedrings.test', password: 'Applicant123!', role: 'applicant' },
      { name: 'Portal Administrator', email: 'admin@wedrings.test', password: 'Admin123!', role: 'admin' },
      { name: 'Super Administrator', email: 'superadmin@wedrings.test', password: 'SuperAdmin123!', role: 'superadmin' },
    ];

    for (const demoAccount of demoAccounts) {
      const Account = accountModels[demoAccount.role];
      const existingAccount = await Account.findOne({ email: demoAccount.email });
      if (!existingAccount) {
        await Account.create({
          name: demoAccount.name,
          email: demoAccount.email,
          passwordHash: await hashPassword(demoAccount.password),
          role: demoAccount.role,
        });
      }
    }
  }

  const database = mongoose.connection.db;
  let collections = new Set((await database.listCollections().toArray()).map(({ name }) => name));
  if (collections.has('info_wedrings')) {
    if (!collections.has('applications')) {
      await database.collection('info_wedrings').rename('applications');
      collections.add('applications');
    } else {
      const legacyApplications = await database.collection('info_wedrings').find().toArray();
      for (const legacyApplication of legacyApplications) {
        await database.collection('applications').updateOne(
          { _id: legacyApplication._id },
          { $setOnInsert: legacyApplication },
          { upsert: true },
        );
      }
    }
  }

  const unassignedApplications = await database.collection('applications').find({
    applicantId: { $exists: false },
  }).project({ _id: 1, applicantEmail: 1 }).toArray();

  for (const application of unassignedApplications) {
    const email = String(application.applicantEmail || '').trim().toLowerCase();
    if (!email) continue;

    let applicant = await ApplicantAccount.findOne({ email });
    if (!applicant) {
      applicant = await ApplicantAccount.create({
        name: email,
        email,
        passwordHash: await hashPassword(crypto.randomBytes(32).toString('hex')),
        role: 'applicant',
        isActive: false,
      });
    }

    await database.collection('applications').updateOne(
      { _id: application._id, applicantId: { $exists: false } },
      { $set: { applicantId: applicant._id, applicantEmail: email } },
    );
  }

  await Application.updateMany({ status: 'Verify' }, { $set: { status: 'For Review' } });
  await Application.updateMany({ status: 'Reject' }, { $set: { status: 'Rejected' } });
}

// Applying the CORS options const
const corsOptions = {
  origin: ALLOWED_FRONTEND_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json()); // Parses incoming JSON data

app.get('/api/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    databaseConnected: mongoose.connection.readyState === 1,
  });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  if (process.env.NODE_ENV === 'production' && !smtpConfigured) {
    return res.status(503).json({ message: 'Password reset is temporarily unavailable. Please contact support.' });
  }
  if (isPasswordResetRateLimited(req.ip || req.socket.remoteAddress || 'unknown')) {
    return res.status(429).json({ message: 'Too many reset requests. Please try again later.' });
  }

  try {
    let account;
    for (const role of ['applicant', 'admin', 'superadmin']) {
      account = await accountModels[role].findOne({ email, isActive: true });
      if (account) break;
    }

    const responseBody = {
      message: 'If an account exists for that email, password reset instructions are available.',
      developmentResetLinkLogged: !smtpConfigured && process.env.NODE_ENV !== 'production',
    };

    if (!account) return res.json(responseBody);

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'http://localhost:5173' : req.get('origin') || 'http://localhost:5173');
    const resetUrl = new URL('/reset-password', frontendUrl);
    resetUrl.searchParams.set('token', token);

    account.passwordResetTokenHash = tokenHash;
    account.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await account.save();

    if (smtpConfigured) {
      const nodemailer = require('nodemailer');
      const port = Number(process.env.SMTP_PORT || 587);
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE === 'true' || port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: account.email,
        subject: 'Reset your WedRings password',
        text: `Use this link to reset your password. It expires in 30 minutes: ${resetUrl.toString()}`,
        html: `<p>Use the link below to reset your WedRings password. It expires in 30 minutes.</p><p><a href="${resetUrl.toString()}">Reset password</a></p>`,
      });
    } else {
      console.info(`Development password reset link: ${resetUrl.toString()}`);
    }

    res.set('Cache-Control', 'no-store');
    res.json(responseBody);
  } catch (error) {
    console.error('Password reset request failed:', error.message);
    res.status(500).json({ message: 'Unable to process the password reset request.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const token = String(req.body.token || '');
  const password = String(req.body.password || '');

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ message: 'Password must be between 8 and 128 characters.' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    let account;
    for (const role of ['applicant', 'admin', 'superadmin']) {
      account = await accountModels[role].findOne({
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { $gt: new Date() },
        isActive: true,
      });
      if (account) break;
    }

    if (!account) return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });

    account.passwordHash = await hashPassword(password);
    account.passwordResetTokenHash = undefined;
    account.passwordResetExpiresAt = undefined;
    await account.save();

    res.set('Cache-Control', 'no-store');
    res.json({ message: 'Your password has been reset. You can now log in.' });
  } catch (error) {
    console.error('Password reset failed:', error.message);
    res.status(500).json({ message: 'Unable to reset the password.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

    for (const role of ['applicant', 'admin', 'superadmin']) {
      const account = await accountModels[role].findOne({ email, isActive: true });
      if (account && await verifyPassword(password, account.passwordHash)) {
        return res.json({
          token: createAccessToken(account),
          user: {
            id: account._id.toString(),
            name: account.name,
            email: account.email,
            role: account.role,
          },
        });
      }
    }

    res.status(401).json({ message: 'The email or password is incorrect.' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to sign in.', error: error.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({ message: 'Enter a name between 2 and 100 characters.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    const existingAccounts = await Promise.all(
      Object.values(accountModels).map((Account) => Account.exists({ email })),
    );
    if (existingAccounts.some(Boolean)) return res.status(409).json({ message: 'An account with this email already exists.' });

    const account = await ApplicantAccount.create({
      name,
      email,
      passwordHash: await hashPassword(password),
      role: 'applicant',
    });

    res.status(201).json({
      token: createAccessToken(account),
      user: {
        id: account._id.toString(),
        name: account.name,
        email: account.email,
        role: account.role,
      },
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' });
    res.status(500).json({ message: 'Unable to create the account.', error: error.message });
  }
});

const dnsServer = dns.createUDPServer((request, send) => {
  const response = dns.Packet.createResponseFromRequest(request);
  const [question] = request.questions;

  if (!question || question.type !== dns.Packet.TYPE.A) {
    response.header.rcode = dns.Packet.RCODE.NXDOMAIN;
    return send(response);
  }

  const hostname = question.name.toLowerCase().replace(/\.$/, '');
  const address = normalizedDnsRecords[hostname];

  if (!address) {
    response.header.rcode = dns.Packet.RCODE.NXDOMAIN;
    return send(response);
  }

  response.answers.push({
    name: question.name,
    type: dns.Packet.TYPE.A,
    class: dns.Packet.CLASS.IN,
    ttl: 300,
    address,
  });
  send(response);
});

dnsServer.on('requestError', (error) => {
  console.error('DNS request error:', error.message);
});

dnsServer.listen(DNS_PORT, DNS_HOST, () => {
  console.log(`DNS server is running on ${DNS_HOST}:${DNS_PORT}`);
});

// Connecting to the Database using our defined const
mongoose.connect(DATABASE_CONNECTION_STRING, {
  serverSelectionTimeoutMS: 10000,
  retryWrites: true,
})
  .then(async () => {
    await initializeAccounts();
    console.log('Connected to MongoDB and initialized account/application collections.');
  })
  .catch((error) => {
    console.error('MongoDB initialization error:', error.message);
  });

// Base route
app.get('/', (req, res) => {
  res.send('The WedRings API is fully active.');
});

app.post('/api/applications', requireRoles(['applicant']), async (req, res) => {
  try {
    const appointmentDate = String(req.body.preferredAppointmentDate || '');
    const appointmentTime = String(req.body.preferredAppointmentTime || '');
    const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(appointmentDate);
    const parsedDate = dateParts
      ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]))
      : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const validDate = parsedDate
      && parsedDate.getFullYear() === Number(dateParts[1])
      && parsedDate.getMonth() === Number(dateParts[2]) - 1
      && parsedDate.getDate() === Number(dateParts[3])
      && parsedDate >= today;
    const timeParts = /^(\d{2}):(\d{2})$/.exec(appointmentTime);
    const validTime = timeParts && Number(timeParts[1]) < 24 && Number(timeParts[2]) < 60;

    if (!validDate || !validTime) {
      return res.status(400).json({ message: 'Choose a valid appointment date and time.' });
    }

    const application = await Application.create({
      ...req.body,
      applicantId: req.user.id,
      applicantEmail: req.user.email,
      preferredAppointmentDate: appointmentDate,
      preferredAppointmentTime: appointmentTime,
      appointmentDate: 'To be assigned by office',
      appointmentTime: '',
      appointmentLocation: 'Villaverde',
      status: 'For Review',
    });
    res.status(201).json(application);
  } catch (error) {
    res.status(400).json({ message: 'Unable to save application.', error: error.message });
  }
});

app.get('/api/applications', requireRoles(['applicant', 'admin', 'superadmin']), async (req, res) => {
  try {
    const filter = req.user.role === 'applicant' ? { applicantId: req.user.id } : {};
    const applications = await Application.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    res.set('Cache-Control', 'no-store');
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load applications.', error: error.message });
  }
});

app.get('/api/applications/:id', requireRoles(['applicant', 'admin', 'superadmin']), async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user.role === 'applicant') filter.applicantId = req.user.id;
    const application = await Application.findOne(filter).lean();

    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    res.set('Cache-Control', 'no-store');
    res.json(application);
  } catch (error) {
    res.status(400).json({ message: 'Unable to load application.', error: error.message });
  }
});

app.get('/api/applications/:id/print', requireRoles(['applicant', 'admin', 'superadmin']), async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user.role === 'applicant') filter.applicantId = req.user.id;
    const application = await Application.findOne(filter).lean();

    if (!application) return res.status(404).json({ message: 'Application not found.' });

    const printForm = await buildPrintFormPdf(application);
    res.set('Cache-Control', 'no-store');
    res.set('Content-Disposition', 'inline; filename="marriage-license-application.pdf"');
    res.type('application/pdf').send(printForm);
  } catch (error) {
    console.error('Application print form error:', error.message);
    res.status(500).json({ message: 'Unable to prepare the application print form.' });
  }
});

app.get('/api/applications/:id/print/preview', requireRoles(['applicant', 'admin', 'superadmin']), async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user.role === 'applicant') filter.applicantId = req.user.id;
    const application = await Application.findOne(filter).lean();

    if (!application) return res.status(404).json({ message: 'Application not found.' });

    const preview = await buildPrintFormHtml(application);
    res.set('Cache-Control', 'no-store');
    res.type('html').send(preview);
  } catch (error) {
    console.error('Application worksheet preview error:', error.message);
    res.status(500).json({ message: 'Unable to prepare the application preview.' });
  }
});

app.put('/api/applications/appointments', requireRoles(['admin', 'superadmin']), async (req, res) => {
  try {
    const { appointmentDate, appointmentTime } = req.body;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate || '') || !appointmentTime) {
      return res.status(400).json({ message: 'Appointment date and time are required.' });
    }

    const result = await Application.updateMany(
      {},
      { $set: { appointmentDate, appointmentTime }, $unset: { 'notificationReads.appointment': 1 } },
    );
    const applications = await Application.find({}).sort({ createdAt: -1 }).lean();
    res.json({ modifiedCount: result.modifiedCount, applications });
  } catch (error) {
    res.status(400).json({ message: 'Unable to schedule all applicants.', error: error.message });
  }
});

app.put('/api/applications/:id', requireRoles(['applicant']), async (req, res) => {
  try {
    const protectedFields = new Set(['_id', 'applicantId', 'status', 'appointmentDate', 'appointmentTime', 'appointmentLocation', 'applicantEmail', 'createdAt', 'updatedAt']);
    const editableFields = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => !protectedFields.has(key)),
    );

    const ownerFilter = { _id: req.params.id, applicantId: req.user.id };
    const existingApplication = await Application.findOne(ownerFilter).lean();

    if (!existingApplication) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    const replacedFlaggedDocuments = Object.keys(editableFields.documents || {}).filter((documentKey) => (
      existingApplication.documents?.[documentKey] !== editableFields.documents[documentKey]
      && existingApplication.documentReviews?.[documentKey] === 'Needs Redo'
    ));

    if (existingApplication.status === 'Rejected' || replacedFlaggedDocuments.length > 0) {
      editableFields.status = 'For Review';
    }

    const update = { $set: editableFields };
    if (replacedFlaggedDocuments.length > 0) {
      update.$unset = Object.fromEntries(replacedFlaggedDocuments.flatMap((documentKey) => [
        [`documentReviews.${documentKey}`, 1],
        [`documentReviewNotes.${documentKey}`, 1],
      ]));
    }

    const application = await Application.findOneAndUpdate(
      ownerFilter,
      update,
      { new: true, runValidators: true },
    ).lean();

    res.set('Cache-Control', 'no-store');
    res.json(application);
  } catch (error) {
    res.status(400).json({ message: 'Unable to update application.', error: error.message });
  }
});

app.put('/api/applications/:id/status', requireRoles(['admin', 'superadmin']), async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['For Review', 'Verified', 'Rejected'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid application status.' });
    }

    const statusUpdate = { $set: { status } };
    if (status === 'Rejected') statusUpdate.$unset = { 'notificationReads.rejected': 1 };

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      statusUpdate,
      { new: true, runValidators: true },
    ).lean();

    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    res.json(application);
  } catch (error) {
    res.status(400).json({ message: 'Unable to update application status.', error: error.message });
  }
});

app.put('/api/applications/:id/documents/:documentKey/review', requireRoles(['admin', 'superadmin']), async (req, res) => {
  try {
    const { reviewStatus, reviewNote } = req.body;
    const allowedStatuses = ['Accepted', 'Needs Redo'];

    if (!allowedStatuses.includes(reviewStatus)) {
      return res.status(400).json({ message: 'Invalid document review status.' });
    }

    if (reviewStatus === 'Needs Redo' && !String(reviewNote || '').trim()) {
      return res.status(400).json({ message: 'A redo instruction is required.' });
    }

    const update = {
      $set: { [`documentReviews.${req.params.documentKey}`]: reviewStatus },
    };

    if (reviewStatus === 'Needs Redo') {
      update.$set[`documentReviewNotes.${req.params.documentKey}`] = String(reviewNote).trim();
      update.$unset = { [`notificationReads.redo-${req.params.documentKey}`]: 1 };
    } else {
      update.$unset = {
        [`documentReviewNotes.${req.params.documentKey}`]: 1,
        [`notificationReads.redo-${req.params.documentKey}`]: 1,
      };
    }

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true },
    ).lean();

    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    res.json(application);
  } catch (error) {
    res.status(400).json({ message: 'Unable to update document review.', error: error.message });
  }
});

app.put('/api/applications/:id/appointment', requireRoles(['admin', 'superadmin']), async (req, res) => {
  try {
    const { appointmentDate, appointmentTime } = req.body;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate || '')) {
      return res.status(400).json({ message: 'Appointment date must use YYYY-MM-DD format.' });
    }

    if (!appointmentTime || typeof appointmentTime !== 'string') {
      return res.status(400).json({ message: 'Appointment time is required.' });
    }

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { $set: { appointmentDate, appointmentTime }, $unset: { 'notificationReads.appointment': 1 } },
      { new: true, runValidators: true },
    ).lean();

    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    res.json(application);
  } catch (error) {
    res.status(400).json({ message: 'Unable to schedule appointment.', error: error.message });
  }
});

app.put('/api/applications/:id/notifications/:notificationKey/read', requireRoles(['applicant']), async (req, res) => {
  try {
    const { notificationKey } = req.params;
    if (!/^(appointment|rejected|redo-[A-Za-z0-9_-]+)$/.test(notificationKey)) {
      return res.status(400).json({ message: 'Invalid notification.' });
    }

    const application = await Application.findOneAndUpdate(
      { _id: req.params.id, applicantId: req.user.id },
      { $set: { [`notificationReads.${notificationKey}`]: new Date() } },
      { new: true, runValidators: true },
    ).lean();

    if (!application) return res.status(404).json({ message: 'Application not found.' });
    res.json(application);
  } catch (error) {
    res.status(400).json({ message: 'Unable to mark notification as read.', error: error.message });
  }
});

// Launch server
app.listen(BACKEND_PORT, () => {
  console.log(`Backend server is running on port ${BACKEND_PORT}`);
});
