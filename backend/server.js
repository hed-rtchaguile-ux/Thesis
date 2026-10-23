const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const dns = require('dns2');
const systemDns = require('node:dns');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { buildPrintFormHtml } = require('./printForm');

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
const DATABASE_CONNECTION_STRING = process.env.MONGODB_URI;
const APP_AUTH_TOKEN_SECRET = process.env.APP_AUTH_TOKEN_SECRET || process.env.AUTH_TOKEN_SECRET || (process.env.NODE_ENV === 'production' ? '' : crypto.randomBytes(32).toString('hex'));
const AUTH_TOKEN_LIFETIME_SECONDS = 8 * 60 * 60;
const scrypt = promisify(crypto.scrypt);
const passwordResetRequestWindows = new Map();

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

if (!DATABASE_CONNECTION_STRING) {
  console.error('MongoDB Atlas configuration is incomplete. Set the real MONGODB_URI in backend/.env.');
  process.exit(1);
}

const applicationSchema = new mongoose.Schema({
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
  secondAppointmentDate: String,
  secondAppointmentTime: String,
  paymentMethod: String,
  paymentAmount: String,
  applicationData: mongoose.Schema.Types.Mixed,
  documents: { type: Map, of: String },
  documentReviews: { type: Map, of: String },
  documentReviewNotes: { type: Map, of: String },
  notificationReads: { type: Map, of: Date },
  status: { type: String, default: 'For Review' },
  licenseReleaseDate: String,
}, { timestamps: true });

const Application = mongoose.model('Application', applicationSchema, 'info_wedrings');
const accountSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  passwordResetTokenHash: String,
  passwordResetExpiresAt: Date,
  role: { type: String, required: true, enum: ['applicant', 'admin', 'superadmin'] },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
accountSchema.index({ email: 1 }, { unique: true });

const ApplicantAccount = mongoose.model('ApplicantAccount', accountSchema, 'applicant_accounts');
const AdminAccount = mongoose.model('AdminAccount', accountSchema, 'admin_accounts');
const SuperAdminAccount = mongoose.model('SuperAdminAccount', accountSchema, 'superadmin_accounts');
const accountModels = { applicant: ApplicantAccount, admin: AdminAccount, superadmin: SuperAdminAccount };

// Applying the CORS options const
const corsOptions = {
  origin: ALLOWED_FRONTEND_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '12mb' }));

app.get('/api/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    atlasConnected: mongoose.connection.readyState === 1,
  });
});

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
  const signature = crypto.createHmac('sha256', APP_AUTH_TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function requireRoles(allowedRoles) {
  return async (req, res, next) => {
    const [scheme, token] = String(req.get('Authorization') || '').split(' ');
    const [payload, signature] = token ? token.split('.') : [];
    if (scheme !== 'Bearer' || !payload || !signature) {
      return res.status(401).json({ message: 'Authentication is required.' });
    }

    const expectedSignature = crypto.createHmac('sha256', APP_AUTH_TOKEN_SECRET).update(payload).digest();
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
      const account = await Account.findOne({ _id: claims.sub, isActive: { $ne: false } }).lean();
      if (!account) return res.status(401).json({ message: 'Account is unavailable.' });
      const role = account.role || claims.role;
      if (!allowedRoles.includes(role)) return res.status(403).json({ message: 'You are not allowed to perform this action.' });
      req.user = { id: account._id.toString(), email: account.email, name: account.name, role };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

async function initializeDemoAccounts() {
  if (!APP_AUTH_TOKEN_SECRET) {
    throw new Error('APP_AUTH_TOKEN_SECRET or AUTH_TOKEN_SECRET must be configured before account login is enabled.');
  }
  if (process.env.NODE_ENV === 'production') return;
  const demoAccounts = [
    { name: 'Jamie Applicant', email: 'applicant@wedrings.test', password: 'Applicant123!', role: 'applicant' },
    { name: 'Portal Administrator', email: 'admin@wedrings.test', password: 'Admin123!', role: 'admin' },
    { name: 'Super Administrator', email: 'superadmin@wedrings.test', password: 'SuperAdmin123!', role: 'superadmin' },
  ];
  for (const demoAccount of demoAccounts) {
    const Account = accountModels[demoAccount.role];
    await Account.findOneAndUpdate(
      { email: demoAccount.email },
      {
        $set: {
          name: demoAccount.name,
          email: demoAccount.email,
          passwordHash: await hashPassword(demoAccount.password),
          role: demoAccount.role,
          isActive: true,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
}

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
    if (['admin@wedrings.test', 'superadmin@wedrings.test'].includes(email)) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ message: 'Password must be between 8 and 128 characters.' });
    }

    const applicant = await ApplicantAccount.create({ name, email, passwordHash: await hashPassword(password), role: 'applicant', isActive: true });
    res.status(201).json({
      token: createAccessToken(applicant),
      user: { id: applicant._id.toString(), name: applicant.name, email: applicant.email, role: 'applicant' },
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' });
    res.status(500).json({ message: 'Unable to create the applicant account.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    let account;
    for (const role of ['applicant', 'admin', 'superadmin']) {
      account = await accountModels[role].findOne({ email, isActive: { $ne: false } }).lean();
      if (account) {
        account.role = role;
        break;
      }
    }
    if (!account || !await verifyPassword(password, account.passwordHash)) {
      return res.status(401).json({ message: 'The email or password is incorrect.' });
    }
    res.set('Cache-Control', 'no-store');
    res.json({
      token: createAccessToken(account),
      user: { id: account._id.toString(), name: account.name, email: account.email, role: account.role },
    });
  } catch (error) {
    res.status(500).json({ message: 'Unable to sign in.' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  if (isPasswordResetRateLimited(req.ip || req.socket.remoteAddress || 'unknown')) {
    return res.status(429).json({ message: 'Too many reset requests. Please try again later.' });
  }

  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  if (process.env.NODE_ENV === 'production' && !smtpConfigured) {
    return res.status(503).json({ message: 'Password reset is temporarily unavailable. Please contact support.' });
  }
  if (!APP_AUTH_TOKEN_SECRET) {
    return res.status(503).json({ message: 'Password recovery is not configured.' });
  }

  try {
    const applicant = await ApplicantAccount.findOne({ email });
    const responseBody = { message: 'If an account exists for that email, password reset instructions are available.' };
    if (!applicant) return res.json(responseBody);

    const token = crypto.randomBytes(32).toString('hex');
    applicant.passwordResetTokenHash = crypto.createHmac('sha256', APP_AUTH_TOKEN_SECRET).update(token).digest('hex');
    applicant.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await applicant.save();

    const frontendUrl = process.env.FRONTEND_URL || ALLOWED_FRONTEND_ORIGIN;
    const resetUrl = new URL('/reset-password', frontendUrl);
    resetUrl.searchParams.set('token', token);
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
        to: applicant.email,
        subject: 'Reset your WedRings password',
        text: `Use this link to reset your password. It expires in 30 minutes: ${resetUrl}`,
        html: `<p>This link expires in 30 minutes.</p><p><a href="${resetUrl}">Reset password</a></p>`,
      });
    } else {
      console.info(`Development password reset link: ${resetUrl}`);
      responseBody.developmentResetLinkLogged = true;
    }

    res.set('Cache-Control', 'no-store');
    res.json(responseBody);
  } catch (error) {
    console.error('Applicant password reset request failed:', error.message);
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
  if (!APP_AUTH_TOKEN_SECRET) return res.status(503).json({ message: 'Password recovery is not configured.' });

  try {
    const tokenHash = crypto.createHmac('sha256', APP_AUTH_TOKEN_SECRET).update(token).digest('hex');
    const applicant = await ApplicantAccount.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    });
    if (!applicant) return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });

    applicant.passwordHash = await hashPassword(password);
    applicant.passwordResetTokenHash = undefined;
    applicant.passwordResetExpiresAt = undefined;
    await applicant.save();
    res.set('Cache-Control', 'no-store');
    res.json({ message: 'Your password has been reset. You can now log in.' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to reset the password.' });
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
    await initializeDemoAccounts();
    console.log('Successfully connected to MongoDB database: wedrings 💍');

    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      const hasCollection = collections.some((collection) => collection.name === 'info_wedrings');

      if (!hasCollection) {
        await mongoose.connection.db.createCollection('info_wedrings');
        console.log('Created MongoDB collection: info_wedrings');
      }

      const legacyVerifyUpdate = await Application.updateMany(
        { status: 'Verify' },
        { $set: { status: 'For Review' } },
      );
      const legacyRejectUpdate = await Application.updateMany(
        { status: 'Reject' },
        { $set: { status: 'Rejected' } },
      );
      const normalizedStatusCount = legacyVerifyUpdate.modifiedCount + legacyRejectUpdate.modifiedCount;

      if (normalizedStatusCount > 0) {
        console.log(`Normalized ${normalizedStatusCount} legacy application status(es).`);
      }
    } catch (collectionError) {
      console.error('MongoDB collection setup error:', collectionError);
    }
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error.message);
    console.error('Please verify the Atlas cluster is running and your IP is whitelisted.');
  });

// Base route
app.get('/', (req, res) => {
  res.send('The WedRings API is fully active.');
});

app.post('/api/applications', requireRoles(['applicant']), async (req, res) => {
  try {
    // Applicants submit a preferred date/time, while the office assigns the
    // actual appointment later. Validate the preference instead of the
    // "To be assigned by office" placeholder stored in appointmentDate.
    const preferredAppointmentDate = String(req.body.preferredAppointmentDate || req.body.appointmentDate || '').trim();
    const preferredAppointmentTime = String(req.body.preferredAppointmentTime || req.body.appointmentTime || '').trim();
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(preferredAppointmentDate)
      ? new Date(`${preferredAppointmentDate}T00:00:00Z`)
      : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== preferredAppointmentDate) {
      return res.status(400).json({ message: 'Enter a valid appointment date.' });
    }
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (preferredAppointmentDate < todayKey) {
      return res.status(400).json({ message: 'Appointment dates cannot be in the past.' });
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(preferredAppointmentTime)) {
      return res.status(400).json({ message: 'Enter a valid appointment time.' });
    }

    const application = await Application.create({
      ...req.body,
      applicantEmail: req.user.email,
      status: 'For Review',
    });
    res.status(201).json(application);
  } catch (error) {
    res.status(400).json({ message: 'Unable to save application.', error: error.message });
  }
});

app.get('/api/applications', requireRoles(['applicant', 'admin', 'superadmin']), async (req, res) => {
  try {
    const filter = req.user.role === 'applicant' ? { applicantEmail: req.user.email } : {};
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
    const filter = req.user.role === 'applicant'
      ? { _id: req.params.id, applicantEmail: req.user.email }
      : { _id: req.params.id };
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
    const application = await Application.findById(req.params.id).lean();

    if (!application || (req.user.role === 'applicant'
      && String(application.applicantEmail || '').trim().toLowerCase() !== req.user.email.toLowerCase())) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    const printForm = await buildPrintFormHtml(application);
    res.set('Cache-Control', 'no-store');
    res.type('html').send(printForm);
  } catch (error) {
    console.error('Application print form error:', error.message);
    res.status(500).json({
      message: 'Unable to prepare the application print form.',
      ...(process.env.NODE_ENV !== 'production' ? { error: error.message } : {}),
    });
  }
});

app.put('/api/applications/:id', requireRoles(['applicant']), async (req, res) => {
  try {
    if (req.params.id === 'appointments') {
      return res.status(404).json({ message: 'Appointment scheduling is disabled.' });
    }

    const protectedFields = new Set(['_id', 'status', 'appointmentDate', 'appointmentTime', 'appointmentLocation', 'secondAppointmentDate', 'secondAppointmentTime', 'applicantEmail', 'createdAt', 'updatedAt']);
    const editableFields = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => !protectedFields.has(key)),
    );

    const ownerFilter = { _id: req.params.id, applicantEmail: req.user.email };
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

app.put('/api/applications/:id/status', requireRoles(['superadmin']), async (req, res) => {
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

app.put('/api/applications/:id/second-appointment', requireRoles(['admin', 'superadmin']), async (req, res) => {
  try {
    const application = await Application.findById(req.params.id).lean();
    if (!application) return res.status(404).json({ message: 'Application not found.' });

    const firstDateValue = application.appointmentDate && application.appointmentDate !== 'To be assigned by office'
      ? application.appointmentDate
      : application.preferredAppointmentDate;
    const toDateKey = (value) => {
      const normalized = String(value || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
      const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(normalized);
      if (!slashMatch) return '';
      const [, first, second, year] = slashMatch;
      const month = Number(first) > 12 ? Number(second) : Number(first);
      const day = Number(first) > 12 ? Number(first) : Number(second);
      return month >= 1 && month <= 12 && day >= 1 && day <= 31
        ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        : '';
    };
    const firstDateKey = toDateKey(firstDateValue);
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (!firstDateKey || firstDateKey >= todayKey) {
      return res.status(409).json({ message: 'The counseling appointment can be scheduled after the first appointment date has passed.' });
    }

    const { date, time } = req.body;
    const secondDateKey = toDateKey(date);
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(secondDateKey)
      ? new Date(`${secondDateKey}T00:00:00Z`)
      : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== secondDateKey || secondDateKey <= firstDateKey || secondDateKey < todayKey) {
      return res.status(400).json({ message: 'Choose a valid counseling date after the first appointment.' });
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || ''))) {
      return res.status(400).json({ message: 'Choose a valid counseling appointment time.' });
    }

    const updatedApplication = await Application.findByIdAndUpdate(
      req.params.id,
      { $set: { secondAppointmentDate: secondDateKey, secondAppointmentTime: time }, $unset: { 'notificationReads.secondAppointment': 1 } },
      { new: true, runValidators: true },
    ).lean();
    res.json(updatedApplication);
  } catch (error) {
    res.status(400).json({ message: 'Unable to schedule the counseling appointment.', error: error.message });
  }
});

app.put('/api/applications/:id/license-release-date', requireRoles(['admin', 'superadmin']), async (req, res) => {
  try {
    const releaseDate = String(req.body.releaseDate || '').trim();
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(releaseDate)
      ? new Date(`${releaseDate}T00:00:00Z`)
      : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== releaseDate) {
      return res.status(400).json({ message: 'Enter a valid license release date.' });
    }

    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ message: 'Application not found.' });
    if (application.status !== 'Verified') {
      return res.status(409).json({ message: 'Only verified applicants can be given a license release date.' });
    }

    application.licenseReleaseDate = releaseDate;
    application.set('notificationReads.licenseRelease', undefined);
    await application.save();
    res.json(application.toObject());
  } catch (error) {
    res.status(400).json({ message: 'Unable to set the license release date.', error: error.message });
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

app.put('/api/applications/:id/notifications/:notificationKey/read', requireRoles(['applicant']), async (req, res) => {
  try {
    const { notificationKey } = req.params;
    if (!/^(appointment|secondAppointment|rejected|licenseRelease|redo-[A-Za-z0-9_-]+)$/.test(notificationKey)) {
      return res.status(400).json({ message: 'Invalid notification.' });
    }

    const application = await Application.findOneAndUpdate(
      { _id: req.params.id, applicantEmail: req.user.email },
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
