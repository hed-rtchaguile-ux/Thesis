const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const dns = require('dns2');
const systemDns = require('node:dns');
const crypto = require('node:crypto');
const path = require('node:path');
const { promisify } = require('node:util');
const { buildPrintFormDocument } = require('./printForm');

const { sendApplicantNotification } = require('./applicantNotifications');

if (!process.env.VERCEL) {
  dotenv.config({ path: path.join(__dirname, '.env') });
}

const app = express();

const BACKEND_PORT = process.env.PORT || 5000;
const DNS_PORT = Number(process.env.DNS_PORT || 5353);
const DNS_HOST = process.env.DNS_HOST || '127.0.0.1';
const ALLOWED_FRONTEND_ORIGIN = 'http://localhost:5173';
const APPLICATION_REQUEST_BODY_LIMIT = '75mb';
const DATABASE_RESTORE_BODY_LIMIT = '100mb';
const MAX_APPLICATION_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_MONGODB_DOCUMENT_BYTES = 16 * 1024 * 1024;
const DATABASE_CONNECTION_STRING = process.env.MONGODB_URI;
const APP_AUTH_TOKEN_SECRET = process.env.APP_AUTH_TOKEN_SECRET || process.env.AUTH_TOKEN_SECRET || (process.env.NODE_ENV === 'production' ? '' : crypto.randomBytes(32).toString('hex'));
const AUTH_TOKEN_LIFETIME_SECONDS = 8 * 60 * 60;
const APPLICATION_CLAIM_TIMEOUT_MS = 10 * 60 * 1000;
const FIXED_PAYMENT_METHOD = 'Over the counter (Cash)';
const FIXED_PAYMENT_AMOUNT = '₱ 250.00';
const APPOINTMENT_TIME_OPTIONS = [
  { value: '09:00', label: '9:00 AM' },
  { value: '10:00', label: '10:00 AM' },
  { value: '11:00', label: '11:00 AM' },
  { value: '13:00', label: '1:00 PM' },
  { value: '14:00', label: '2:00 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '16:00', label: '4:00 PM' },
];
const scrypt = promisify(crypto.scrypt);
const passwordResetRequestWindows = new Map();
const registrationRequestWindows = new Map();
let databaseConnectionPromise;
let applicationIndexesReady = false;

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
  appointmentSlotKey: String,
  appointmentDate: String,
  appointmentTime: String,
  appointmentLocation: String,
  secondAppointmentDate: String,
  secondAppointmentTime: String,
  firstCounselingApprovedAt: Date,
  secondAppointmentReminderClaimedAt: Date,
  secondAppointmentReminderSentAt: Date,
  paymentMethod: String,
  paymentAmount: String,
  paymentReceipt: String,
  applicationData: mongoose.Schema.Types.Mixed,
  documents: { type: Map, of: String },
  documentReviews: { type: Map, of: String },
  documentReviewNotes: { type: Map, of: String },
  notificationReads: { type: Map, of: Date },
  status: { type: String, default: 'For Review' },
  licenseReleaseDate: String,
}, { timestamps: true });
applicationSchema.index(
  { appointmentSlotKey: 1 },
  { unique: true, sparse: true, name: 'unique_appointment_slot' },
);

const Application = mongoose.model('Application', applicationSchema, 'applications');
const accountSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  passwordResetTokenHash: String,
  passwordResetExpiresAt: Date,
  passwordResetCodeHash: String,
  passwordResetCodeAttempts: { type: Number, default: 0 },
  activeApplicationId: mongoose.Schema.Types.ObjectId,
  activeApplicationClaimedAt: Date,
  role: { type: String, required: true, enum: ['applicant', 'admin', 'superadmin'] },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
accountSchema.index({ email: 1 }, { unique: true });

const ApplicantAccount = mongoose.model('ApplicantAccount', accountSchema, 'applicant_accounts');
const AdminAccount = mongoose.model('AdminAccount', accountSchema, 'admin_accounts');
const SuperAdminAccount = mongoose.model('SuperAdminAccount', accountSchema, 'superadmin_accounts');
const accountModels = { applicant: ApplicantAccount, admin: AdminAccount, superadmin: SuperAdminAccount };
const auditLogSchema = new mongoose.Schema({
  actorId: { type: String, required: true },
  actorName: { type: String, required: true },
  actorEmail: { type: String, required: true },
  actorRole: { type: String, required: true, enum: ['admin', 'superadmin'] },
  action: { type: String, required: true },
  targetType: { type: String, required: true },
  targetId: String,
  targetLabel: String,
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });
auditLogSchema.index({ createdAt: -1 });
const AuditLog = mongoose.model('AuditLog', auditLogSchema, 'audit_logs');
// Applying the CORS options const
const corsOptions = {
  origin: ALLOWED_FRONTEND_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
const defaultJsonParser = express.json({ limit: '15mb' });
const applicationSubmissionJsonParser = express.json({ limit: APPLICATION_REQUEST_BODY_LIMIT });
const databaseRestoreTextParser = express.text({ type: 'application/json', limit: DATABASE_RESTORE_BODY_LIMIT });
app.use((req, res, next) => {
  const isDatabaseRestore = req.method === 'POST' && req.path === '/api/admin/database-restore';
  const isApplicationSubmission = req.method === 'POST' && req.path === '/api/applications';
  const isAdminDocumentReplacement = req.method === 'PUT'
    && /^\/api\/applications\/[^/]+\/documents\/[^/]+$/.test(req.path);
  const parser = isDatabaseRestore
    ? databaseRestoreTextParser
    : isApplicationSubmission || isAdminDocumentReplacement
      ? applicationSubmissionJsonParser
      : defaultJsonParser;
  parser(req, res, (error) => {
    if (error?.type === 'entity.too.large') {
      const message = isDatabaseRestore
        ? 'Database backup files must be 100 MB or smaller.'
        : isAdminDocumentReplacement
          ? 'Replacement documents must be 20 MB or smaller.'
          : 'Application documents together must be 50 MB or smaller.';
      return res.status(413).json({ message });
    }
    if (error) return next(error);
    next();
  });
});

async function connectToDatabase() {
  if (!DATABASE_CONNECTION_STRING) {
    throw new Error('MONGODB_URI is not configured.');
  }
  if (mongoose.connection.readyState === 1 && applicationIndexesReady) return;
  if (!databaseConnectionPromise) {
    const connection = mongoose.connection.readyState === 1
      ? Promise.resolve()
      : mongoose.connect(DATABASE_CONNECTION_STRING, {
        serverSelectionTimeoutMS: 10000,
        retryWrites: true,
      });
    databaseConnectionPromise = connection.then(async () => {
      await initializeDemoAccounts();
      console.log('Successfully connected to MongoDB database: wedrings');

      try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionNames = new Set(collections.map((collection) => collection.name));

        if (!collectionNames.has('applications')) {
          await mongoose.connection.db.createCollection('applications');
          console.log('Created MongoDB collection: applications');
        }

        if (collectionNames.has('info_wedrings')) {
          const legacyApplications = mongoose.connection.db.collection('info_wedrings');
          const targetApplications = mongoose.connection.db.collection('applications');
          let migrationBatch = [];
          let copiedCount = 0;

          for await (const legacyApplication of legacyApplications.find()) {
            const { _id, ...legacyFields } = legacyApplication;
            migrationBatch.push({
              updateOne: {
                filter: { _id },
                update: { $setOnInsert: legacyFields },
                upsert: true,
              },
            });

            if (migrationBatch.length === 500) {
              const result = await targetApplications.bulkWrite(migrationBatch, { ordered: false });
              copiedCount += result.upsertedCount;
              migrationBatch = [];
            }
          }

          if (migrationBatch.length > 0) {
            const result = await targetApplications.bulkWrite(migrationBatch, { ordered: false });
            copiedCount += result.upsertedCount;
          }

          if (copiedCount > 0) {
            console.log(`Copied ${copiedCount} legacy application(s) into applications.`);
          }
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
      await Application.createIndexes();
      applicationIndexesReady = true;
    }).catch((error) => {
      databaseConnectionPromise = undefined;
      console.error('MongoDB connection error:', error.message);
      const serverErrors = [...(error.reason?.servers?.values() || [])]
        .map((server) => server.error?.message)
        .filter(Boolean);
      if (serverErrors.length > 0) {
        console.error('MongoDB connection details:', [...new Set(serverErrors)].join('; '));
      }
      throw error;
    });
  }
  const connectionPromise = databaseConnectionPromise;
  try {
    await connectionPromise;
  } finally {
    if (databaseConnectionPromise === connectionPromise) {
      databaseConnectionPromise = undefined;
    }
  }
}

app.use(async (req, res, next) => {
  if (req.path === '/api/status') return next();
  try {
    await connectToDatabase();
    next();
  } catch {
    res.status(503).json({
      message: 'The service is temporarily unavailable because the database is disconnected. Please try again later.',
    });
  }
});

app.get('/api/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    atlasConnected: mongoose.connection.readyState === 1,
  });
});

app.get('/api/admin/audit-logs', requireRoles(['admin', 'superadmin']), async (req, res) => {
  try {
    if (isDatabaseUnavailable(res, 'Audit history')) return;
    const auditLogs = await AuditLog.find()
      .select('actorName actorEmail actorRole action targetType targetId targetLabel details createdAt')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.set('Cache-Control', 'no-store');
    res.json(auditLogs);
  } catch (error) {
    console.error('Unable to load admin audit history:', error.message);
    res.status(500).json({ message: 'Unable to load audit history.' });
  }
});

app.get('/api/admin/database-backup', requireRoles(['admin', 'superadmin']), async (req, res) => {
  try {
    if (isDatabaseUnavailable(res, 'Database backup')) return;
    const database = mongoose.connection.db;
    const collections = await database.listCollections({}, { nameOnly: true }).toArray();
    const backupCollections = {};
    const accountCredentialFields = {
      passwordHash: 0,
      passwordResetTokenHash: 0,
      passwordResetExpiresAt: 0,
      passwordResetCodeHash: 0,
      passwordResetCodeAttempts: 0,
    };

    for (const { name } of collections.filter(({ name }) => !name.startsWith('system.'))) {
      const projection = name.endsWith('_accounts') ? accountCredentialFields : undefined;
      backupCollections[name] = await database.collection(name).find({}, { projection }).toArray();
    }

    const exportedAt = new Date();
    const fileTimestamp = exportedAt.toISOString().replace(/[:.]/g, '-');
    const backup = {
      format: 'wedrings-mongodb-extended-json-backup',
      version: 1,
      database: database.databaseName,
      exportedAt: exportedAt.toISOString(),
      excludedAccountFields: Object.keys(accountCredentialFields),
      collections: backupCollections,
    };
    const serializedBackup = mongoose.mongo.BSON.EJSON.stringify(backup, null, 2, { relaxed: false });
    await recordAdminAction(req, {
      action: 'database.backup.downloaded',
      targetType: 'database',
      targetLabel: database.databaseName,
      details: { collectionCount: Object.keys(backupCollections).length },
    });
    res.set({
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="wedrings-database-backup-${fileTimestamp}.json"`,
    });
    res.send(serializedBackup);
  } catch (error) {
    if (error.code === 'AUDIT_LOG_FAILED') {
      return res.status(500).json({ message: error.message });
    }
    console.error('Unable to create database backup:', error.message);
    res.status(500).json({ message: 'Unable to create database backup.' });
  }
});

app.post('/api/admin/database-restore', requireRoles(['admin', 'superadmin']), async (req, res) => {
  try {
    if (isDatabaseUnavailable(res, 'Database restore')) return;

    const database = mongoose.connection.db;
    const ejson = mongoose.mongo.BSON.EJSON;
    let backup;
    try {
      backup = ejson.parse(req.body);
    } catch {
      return res.status(400).json({ message: 'The selected file is not valid JSON.' });
    }
    if (
      backup?.format !== 'wedrings-mongodb-extended-json-backup'
      || backup.version !== 1
      || !backup.collections
      || typeof backup.collections !== 'object'
      || Array.isArray(backup.collections)
    ) {
      return res.status(400).json({ message: 'The selected file is not a supported WedRings database backup.' });
    }
    if (backup.database !== database.databaseName) {
      return res.status(400).json({ message: 'This backup belongs to a different database.' });
    }

    const entries = Object.entries(backup.collections);
    if (entries.length === 0) {
      return res.status(400).json({ message: 'The selected backup does not contain any collections.' });
    }

    const existingNames = new Set(
      (await database.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name),
    );
    const allowedAccountRoles = {
      applicant_accounts: 'applicant',
      admin_accounts: 'admin',
      superadmin_accounts: 'superadmin',
    };
    const restoredCollections = {};

    for (const [name, sourceDocuments] of entries) {
      if (!/^[a-zA-Z0-9_-]+$/.test(name) || name.startsWith('system.') || !existingNames.has(name)) {
        return res.status(400).json({ message: `The backup contains an unsupported collection: ${name}.` });
      }
      if (!Array.isArray(sourceDocuments)) {
        return res.status(400).json({ message: `The backup data for ${name} is invalid.` });
      }

      const documents = sourceDocuments;
      const seenIds = new Set();
      const seenAppointmentSlots = new Set();
      for (const document of documents) {
        if (!document || typeof document !== 'object' || Array.isArray(document) || document._id == null) {
          return res.status(400).json({ message: `The backup contains an invalid document in ${name}.` });
        }
        const id = String(document._id);
        if (seenIds.has(id)) {
          return res.status(400).json({ message: `The backup contains duplicate document IDs in ${name}.` });
        }
        seenIds.add(id);

        if (name === 'applications' && document.appointmentSlotKey) {
          if (seenAppointmentSlots.has(document.appointmentSlotKey)) {
            return res.status(400).json({ message: 'The backup contains duplicate appointment slots.' });
          }
          seenAppointmentSlots.add(document.appointmentSlotKey);
        }

        const expectedRole = allowedAccountRoles[name];
        if (expectedRole && document.role !== expectedRole) {
          return res.status(400).json({ message: `The backup contains an invalid role in ${name}.` });
        }
      }
      restoredCollections[name] = documents;
    }

    const actorCollectionName = `${req.user.role}_accounts`;
    const actorAccountIsInBackup = restoredCollections[actorCollectionName]?.some(
      (account) => String(account._id) === String(req.user.id),
    );
    if (restoredCollections[actorCollectionName] && !actorAccountIsInBackup) {
      return res.status(400).json({ message: 'The backup does not contain your administrator account, so it cannot be restored while you are signed in.' });
    }

    const session = await mongoose.connection.startSession();
    let restoredRecordCount = 0;
    try {
      await session.withTransaction(async () => {
        restoredRecordCount = 0;
        for (const [name, documents] of Object.entries(restoredCollections)) {
          let safeDocuments = documents;
          if (allowedAccountRoles[name]) {
            const collection = database.collection(name);
            const currentAccounts = await collection.find(
              { _id: { $in: documents.map(({ _id }) => _id) } },
              { session },
            ).toArray();
            const currentById = new Map(currentAccounts.map((account) => [String(account._id), account]));
            if (currentAccounts.length !== documents.length) {
              const missingCredentialCount = documents.filter((document) => !currentById.has(String(document._id))).length;
              if (missingCredentialCount > 0) {
                const error = new Error('This backup contains accounts that no longer exist. Restore was cancelled because their passwords are not present in the backup.');
                error.code = 'ACCOUNT_RESTORE_UNAVAILABLE';
                throw error;
              }
            }

            safeDocuments = documents.map((document) => {
              const currentAccount = currentById.get(String(document._id));
              const restoredAccount = { ...document, passwordHash: currentAccount.passwordHash };
              delete restoredAccount.passwordResetTokenHash;
              delete restoredAccount.passwordResetExpiresAt;
              delete restoredAccount.passwordResetCodeHash;
              delete restoredAccount.passwordResetCodeAttempts;
              return restoredAccount;
            });
          }

          const collection = database.collection(name);
          await collection.deleteMany({}, { session });
          if (safeDocuments.length > 0) {
            await collection.insertMany(safeDocuments, { session, ordered: true });
          }
          restoredRecordCount += safeDocuments.length;
        }

        await database.collection('audit_logs').insertOne({
          actorId: req.user.id,
          actorName: req.user.name,
          actorEmail: req.user.email,
          actorRole: req.user.role,
          action: 'database.backup.restored',
          targetType: 'database',
          targetLabel: database.databaseName,
          details: {
            collectionCount: entries.length,
            recordCount: restoredRecordCount,
          },
          createdAt: new Date(),
        }, { session });
      });
    } finally {
      await session.endSession();
    }

    res.set('Cache-Control', 'no-store');
    res.json({
      message: 'Database restored successfully.',
      collectionCount: entries.length,
      recordCount: restoredRecordCount,
    });
  } catch (error) {
    if (error.code === 'ACCOUNT_RESTORE_UNAVAILABLE') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Unable to restore database backup:', error.message);
    res.status(500).json({ message: 'Unable to restore the database backup.' });
  }
});

function isRateLimited(requestWindows, key, limit, windowMilliseconds) {
  const now = Date.now();
  for (const [requestKey, window] of requestWindows) {
    if (window.expiresAt <= now) requestWindows.delete(requestKey);
  }

  const currentWindow = requestWindows.get(key);
  if (!currentWindow) {
    requestWindows.set(key, { count: 1, expiresAt: now + windowMilliseconds });
    return false;
  }
  if (currentWindow.count >= limit) return true;
  currentWindow.count += 1;
  return false;
}

function isPasswordResetRateLimited(ipAddress) {
  return isRateLimited(passwordResetRequestWindows, ipAddress, 5, 15 * 60 * 1000);
}

function isDatabaseUnavailable(res, action) {
  if (mongoose.connection.readyState === 1) return false;
  res.status(503).json({
    message: `${action} is temporarily unavailable because the database is disconnected. Please try again later.`,
  });
  return true;
}

function getCoupleNames(application) {
  return [application.groomFullName, application.brideFullName].filter(Boolean).join(' & ') || 'your application';
}

async function recordAdminAction(req, action) {
  try {
    await AuditLog.create({
      actorId: req.user.id,
      actorName: req.user.name,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      ...action,
    });
  } catch (error) {
    console.error('Unable to record admin audit action:', error.message);
    const auditError = new Error('The change was saved, but its audit record could not be recorded.');
    auditError.code = 'AUDIT_LOG_FAILED';
    throw auditError;
  }
}

function respondToAdminMutationError(res, error, message) {
  if (error.code === 'AUDIT_LOG_FAILED') {
    return res.status(500).json({ message: error.message });
  }
  console.error(`${message}:`, error.message);
  return res.status(400).json({ message });
}

function formatApplicantNotificationDate(value, time = '') {
  if (!value || value === 'To be assigned by office') return 'None';

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!timeMatch) return formattedDate;

  const hour = Number(timeMatch[1]);
  return `${formattedDate} at ${hour % 12 || 12}:${timeMatch[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function getManilaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function toAppointmentDateKey(value) {
  const normalized = String(value || '').trim();
  let dateKey = normalized;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(normalized);
    if (!slashMatch) return '';
    const [, first, second, year] = slashMatch;
    const month = Number(first) > 12 ? Number(second) : Number(first);
    const day = Number(first) > 12 ? Number(first) : Number(second);
    if (month < 1 || month > 12 || day < 1 || day > 31) return '';
    dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const parsedDate = new Date(`${dateKey}T00:00:00Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === dateKey
    ? dateKey
    : '';
}

function addDaysToDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getNextLastWednesday(firstAppointmentDate, today) {
  const earliestDate = [
    addDaysToDateKey(firstAppointmentDate, 1),
    addDaysToDateKey(today, 1),
  ].sort().at(-1);
  let month = new Date(`${earliestDate.slice(0, 7)}-01T00:00:00Z`);

  for (let monthOffset = 0; monthOffset < 24; monthOffset += 1) {
    const lastWednesday = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0));
    const daysSinceWednesday = (lastWednesday.getUTCDay() - 3 + 7) % 7;
    lastWednesday.setUTCDate(lastWednesday.getUTCDate() - daysSinceWednesday);
    if (lastWednesday.toISOString().slice(0, 10) >= earliestDate) {
      return lastWednesday.toISOString().slice(0, 10);
    }
    month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
  }

  throw new Error('Unable to find the next last Wednesday for counseling.');
}

async function sendDueSecondAppointmentReminders() {
  const today = getManilaDateKey();
  const reminderThroughDate = addDaysToDateKey(today, 3);
  const applications = await Application.find({
    firstCounselingApprovedAt: { $exists: true },
    secondAppointmentDate: { $gt: today, $lte: reminderThroughDate },
    secondAppointmentReminderSentAt: { $exists: false },
  }).lean();
  const staleClaimBefore = new Date(Date.now() - 10 * 60 * 1000);

  for (const application of applications) {
    const claimTime = new Date();
    const claim = await Application.updateOne(
      {
        _id: application._id,
        secondAppointmentReminderSentAt: { $exists: false },
        $or: [
          { secondAppointmentReminderClaimedAt: { $exists: false } },
          { secondAppointmentReminderClaimedAt: { $lt: staleClaimBefore } },
        ],
      },
      { $set: { secondAppointmentReminderClaimedAt: claimTime } },
    );
    if (claim.modifiedCount !== 1) continue;

    const notification = await sendApplicantNotification(
      application,
      'Counseling appointment reminder',
      `This is a reminder that your second counseling appointment is scheduled for ${formatApplicantNotificationDate(application.secondAppointmentDate, application.secondAppointmentTime)}.`,
      'secondAppointmentReminder',
    );
    if (notification.email.status === 'accepted') {
      await Application.updateOne(
        { _id: application._id, secondAppointmentReminderClaimedAt: claimTime },
        {
          $set: { secondAppointmentReminderSentAt: new Date() },
          $unset: { secondAppointmentReminderClaimedAt: 1 },
        },
      );
    } else {
      await Application.updateOne(
        { _id: application._id, secondAppointmentReminderClaimedAt: claimTime },
        { $unset: { secondAppointmentReminderClaimedAt: 1 } },
      );
    }
  }
}

let counselingReminderCheck;
async function checkCounselingReminders() {
  if (counselingReminderCheck) return counselingReminderCheck;
  counselingReminderCheck = sendDueSecondAppointmentReminders()
    .catch((error) => {
      console.error('Unable to send due counseling appointment reminders:', error.message);
    })
    .finally(() => {
      counselingReminderCheck = undefined;
    });
  return counselingReminderCheck;
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
    if (!/^[^\s@]+@gmail\.com$/.test(email)) {
      return res.status(400).json({ message: 'Use a Gmail address ending in @gmail.com.' });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ message: 'Password must be between 8 and 128 characters.' });
    }
    if (!APP_AUTH_TOKEN_SECRET) {
      return res.status(503).json({ message: 'Account registration is not configured.' });
    }
    if (isDatabaseUnavailable(res, 'Account registration')) return;

    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    if (isRateLimited(registrationRequestWindows, `ip:${ipAddress}`, 5, 15 * 60 * 1000)
      || isRateLimited(registrationRequestWindows, `email:${email}`, 3, 15 * 60 * 1000)) {
      return res.status(429).json({ message: 'Too many account registration attempts. Please try again later.' });
    }

    const accountExists = await Promise.all([
      ApplicantAccount.exists({ email }),
      AdminAccount.exists({ email }),
      SuperAdminAccount.exists({ email }),
    ]);
    if (accountExists.some(Boolean)) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const applicant = await ApplicantAccount.create({
      name,
      email,
      passwordHash: await hashPassword(password),
      role: 'applicant',
      isActive: true,
    });
    res.set('Cache-Control', 'no-store');
    res.status(201).json({
      token: createAccessToken(applicant),
      user: { id: applicant._id.toString(), name: applicant.name, email: applicant.email, role: 'applicant' },
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' });
    console.error('Applicant account registration failed:', error.message);
    res.status(500).json({ message: 'Unable to create the applicant account.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  if (isDatabaseUnavailable(res, 'Sign-in')) return;
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
    console.error('Sign-in failed:', error.message);
    res.status(500).json({ message: 'Unable to sign in.' });
  }
});

app.put('/api/auth/change-password', requireRoles(['applicant', 'admin', 'superadmin']), async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');

  if (!currentPassword) {
    return res.status(400).json({ message: 'Enter your current password.' });
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ message: 'New password must be between 8 and 128 characters.' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'Your new password must be different from your current password.' });
  }
  if (isDatabaseUnavailable(res, 'Password change')) return;

  try {
    const Account = accountModels[req.user.role];
    const account = await Account.findOne({ _id: req.user.id, isActive: { $ne: false } });
    if (!account || !await verifyPassword(currentPassword, account.passwordHash)) {
      return res.status(400).json({ message: 'Your current password is incorrect.' });
    }

    account.passwordHash = await hashPassword(newPassword);
    account.passwordResetTokenHash = undefined;
    account.passwordResetExpiresAt = undefined;
    account.passwordResetCodeHash = undefined;
    account.passwordResetCodeAttempts = 0;
    await account.save();

    res.set('Cache-Control', 'no-store');
    res.json({ message: 'Your password has been changed successfully.' });
  } catch (error) {
    console.error('Account password change failed:', error.message);
    res.status(500).json({ message: 'Unable to change your password.' });
  }
});

async function sendPasswordResetEmail(email, code) {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL;
  if (brevoApiKey && senderEmail) {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: process.env.SENDER_NAME || 'WedRings',
          email: senderEmail,
        },
        to: [{ email }],
        subject: 'Your WedRings password reset code',
        textContent: `Your password reset verification code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
        htmlContent: `<p>Your password reset verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Brevo rejected the password reset email:', JSON.stringify({
        status: response.status,
        code: result.code || '',
        message: result.message || '',
      }));
      throw new Error(result.message || `Brevo email request failed with status ${response.status}.`);
    }
    return;
  }

  if (process.env.VERCEL) {
    throw new Error('BREVO_API_KEY and SENDER_EMAIL must be configured on Vercel.');
  }

  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  if (!smtpConfigured) return;

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
    to: email,
    subject: 'Your WedRings password reset code',
    text: `Your password reset verification code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your password reset verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
  });
}

app.post('/api/auth/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@gmail\.com$/.test(email)) {
    return res.status(400).json({ message: 'Enter the Gmail address associated with your account.' });
  }
  if (isDatabaseUnavailable(res, 'Password recovery')) return;
  if (isPasswordResetRateLimited(req.ip || req.socket.remoteAddress || 'unknown')) {
    return res.status(429).json({ message: 'Too many reset requests. Please try again later.' });
  }

  const emailConfigured = Boolean(
    (process.env.BREVO_API_KEY && process.env.SENDER_EMAIL)
    || (!process.env.VERCEL && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
  );
  if (!emailConfigured && process.env.NODE_ENV === 'production') {
    return res.status(503).json({ message: 'Password reset is temporarily unavailable. Please contact support.' });
  }
  if (!APP_AUTH_TOKEN_SECRET) {
    return res.status(503).json({ message: 'Password recovery is not configured.' });
  }

  try {
    let account;
    let accountRole;
    for (const role of ['applicant', 'admin', 'superadmin']) {
      account = await accountModels[role].findOne({ email });
      if (account) {
        accountRole = role;
        break;
      }
    }
    const responseBody = {
      message: 'If an account exists for that email, a verification code will be sent shortly.',
      developmentVerificationCodeLogged: !emailConfigured,
    };
    if (!account) {
      res.set('Cache-Control', 'no-store');
      return res.json(responseBody);
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const resetCodeHash = crypto.createHmac('sha256', APP_AUTH_TOKEN_SECRET).update(`${email}:${code}`).digest('hex');
    const Account = accountModels[accountRole];
    await Account.updateOne({ _id: account._id }, {
      $set: {
        passwordResetCodeHash: resetCodeHash,
        passwordResetCodeAttempts: 0,
        passwordResetExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
      $unset: { passwordResetTokenHash: 1 },
    });

    if (emailConfigured) {
      await sendPasswordResetEmail(account.email, code);
    } else {
      console.info(`Development password reset code for ${email}: ${code}`);
    }

    res.set('Cache-Control', 'no-store');
    res.json(responseBody);
  } catch (error) {
    const errorCode = error.code || error.name || 'RESET_REQUEST_ERROR';
    console.error('Password reset request failed:', JSON.stringify({
      code: errorCode,
      command: error.command || '',
      responseCode: error.responseCode || '',
    }));
    const message = errorCode === 'EAUTH'
      ? 'Google rejected the app sender login. Check SMTP_USER and use a Google App Password in SMTP_PASS.'
      : ['EENVELOPE', 'EMESSAGE'].includes(errorCode)
        ? 'Gmail rejected the sender or recipient address. Check SMTP_FROM and the account email.'
        : ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS'].includes(errorCode)
          ? `The app could not connect to Gmail (${errorCode}). Check network access and the SMTP host/port settings.`
          : `Unable to send or save the verification code (${errorCode}). Please try again later.`;
    res.status(500).json({ message });
  }
});

app.post('/api/auth/verify-reset-code', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  if (!/^[^\s@]+@gmail\.com$/.test(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: 'Enter the Gmail address and six-digit verification code.' });
  }
  if (!APP_AUTH_TOKEN_SECRET) return res.status(503).json({ message: 'Password recovery is not configured.' });
  if (isDatabaseUnavailable(res, 'Password reset')) return;

  try {
    let account;
    let accountRole;
    for (const role of ['applicant', 'admin', 'superadmin']) {
      account = await accountModels[role].findOne({ email });
      if (account) {
        accountRole = role;
        break;
      }
    }
    if (!account || !account.passwordResetCodeHash || !account.passwordResetExpiresAt
      || account.passwordResetExpiresAt <= new Date() || account.passwordResetCodeAttempts >= 5) {
      return res.status(400).json({ message: 'The verification code is invalid or expired. Request a new code and try again.' });
    }

    const suppliedCodeHash = crypto.createHmac('sha256', APP_AUTH_TOKEN_SECRET).update(`${email}:${code}`).digest();
    const expectedCodeHash = Buffer.from(account.passwordResetCodeHash, 'hex');
    const Account = accountModels[accountRole];
    if (expectedCodeHash.length !== suppliedCodeHash.length || !crypto.timingSafeEqual(expectedCodeHash, suppliedCodeHash)) {
      const attempts = (account.passwordResetCodeAttempts || 0) + 1;
      if (attempts >= 5) {
        await Account.updateOne({ _id: account._id, passwordResetCodeHash: account.passwordResetCodeHash }, {
          $set: { passwordResetCodeAttempts: attempts },
          $unset: { passwordResetCodeHash: 1, passwordResetExpiresAt: 1 },
        });
      } else {
        await Account.updateOne({ _id: account._id, passwordResetCodeHash: account.passwordResetCodeHash }, {
          $set: { passwordResetCodeAttempts: attempts },
        });
      }
      return res.status(400).json({ message: 'The verification code is invalid or expired. Request a new code and try again.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHmac('sha256', APP_AUTH_TOKEN_SECRET).update(resetToken).digest('hex');
    const updated = await Account.updateOne({
      _id: account._id,
      passwordResetCodeHash: account.passwordResetCodeHash,
      passwordResetCodeAttempts: { $lt: 5 },
      passwordResetExpiresAt: { $gt: new Date() },
    }, {
      $set: {
        passwordResetTokenHash: resetTokenHash,
        passwordResetCodeAttempts: 0,
        passwordResetExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
      $unset: { passwordResetCodeHash: 1 },
    });
    if (!updated.matchedCount) {
      return res.status(400).json({ message: 'The verification code is invalid or expired. Request a new code and try again.' });
    }

    res.set('Cache-Control', 'no-store');
    res.json({ resetToken, message: 'Verification successful. Choose a new password.' });
  } catch (error) {
    console.error('Password reset code verification failed:', error.message);
    res.status(500).json({ message: 'Unable to verify the code. Please try again later.' });
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
  if (isDatabaseUnavailable(res, 'Password reset')) return;

  try {
    const tokenHash = crypto.createHmac('sha256', APP_AUTH_TOKEN_SECRET).update(token).digest('hex');
    const passwordHash = await hashPassword(password);
    let updated = false;
    for (const role of ['applicant', 'admin', 'superadmin']) {
      const result = await accountModels[role].updateOne({
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { $gt: new Date() },
      }, {
        $set: { passwordHash, passwordResetCodeAttempts: 0 },
        $unset: {
          passwordResetTokenHash: 1,
          passwordResetExpiresAt: 1,
          passwordResetCodeHash: 1,
        },
      });
      if (result.matchedCount) {
        updated = true;
        break;
      }
    }
    if (!updated) return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });
    res.set('Cache-Control', 'no-store');
    res.json({ message: 'Your password has been reset. You can now log in.' });
  } catch (error) {
    console.error('Password reset failed:', error.message);
    res.status(500).json({ message: 'Unable to reset the password.' });
  }
});

// Base route
app.get('/', (req, res) => {
  res.send('The WedRings API is fully active.');
});

function isValidAppointmentDate(value) {
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00Z`)
    : null;
  return Boolean(parsedDate
    && !Number.isNaN(parsedDate.getTime())
    && parsedDate.toISOString().slice(0, 10) === value);
}

function isValidMarriageDissolutionDate(form, person) {
  const day = Number(form[`${person}DissolutionDay`]);
  const month = Number(form[`${person}DissolutionMonth`]);
  const year = Number(form[`${person}DissolutionYear`]);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)
    || day < 1 || day > 31 || month < 1 || month > 12 || year < 1 || year > 9999) return false;

  const inputDateKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${inputDateKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const dateKey = date.toISOString().slice(0, 10);
  return dateKey === inputDateKey && dateKey <= getManilaDateKey();
}

function getAppointmentSlotKey(date, time) {
  return `${date}|${time}`;
}

async function getOccupiedAppointmentTimes(date, excludeApplicationId) {
  const filter = {
    $or: [
      { preferredAppointmentDate: date },
      { 'applicationData.preferredAppointmentDate': date },
      { appointmentDate: date },
    ],
  };
  if (excludeApplicationId) filter._id = { $ne: excludeApplicationId };

  const applications = await Application.find(filter)
    .select('_id preferredAppointmentDate preferredAppointmentTime appointmentDate appointmentTime applicationData')
    .lean();
  const occupiedTimes = new Set();
  const availableTimeValues = new Set(APPOINTMENT_TIME_OPTIONS.map(({ value }) => value));

  applications.forEach((application) => {
    const applicationData = application.applicationData || {};
    const preferredDate = application.preferredAppointmentDate || applicationData.preferredAppointmentDate;
    const preferredTime = application.preferredAppointmentTime || applicationData.preferredAppointmentTime;
    if (preferredDate === date && availableTimeValues.has(preferredTime)) occupiedTimes.add(preferredTime);
    if (application.appointmentDate === date && availableTimeValues.has(application.appointmentTime)) {
      occupiedTimes.add(application.appointmentTime);
    }
  });

  return occupiedTimes;
}

app.get('/api/appointment-slots', requireRoles(['applicant']), async (req, res) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date.trim() : '';
    if (!isValidAppointmentDate(date)) {
      return res.status(400).json({ message: 'Choose a valid appointment date.' });
    }

    const excludeApplicationId = typeof req.query.excludeApplicationId === 'string'
      ? req.query.excludeApplicationId.trim()
      : '';
    if (excludeApplicationId) {
      if (!mongoose.isValidObjectId(excludeApplicationId)) {
        return res.status(400).json({ message: 'The application identifier is invalid.' });
      }
      const ownApplication = await Application.exists({
        _id: excludeApplicationId,
        applicantEmail: req.user.email,
      });
      if (!ownApplication) return res.status(404).json({ message: 'Application not found.' });
    }

    const occupiedTimes = await getOccupiedAppointmentTimes(date, excludeApplicationId || undefined);
    res.set('Cache-Control', 'no-store');
    res.json({
      date,
      slots: APPOINTMENT_TIME_OPTIONS.map((slot) => ({
        ...slot,
        available: !occupiedTimes.has(slot.value),
      })),
    });
  } catch (error) {
    console.error('Unable to load appointment availability:', error.message);
    res.status(500).json({ message: 'Unable to load appointment availability.' });
  }
});

app.post('/api/applications', requireRoles(['applicant']), async (req, res) => {
  let claimedApplicationId;
  try {
    const submittedApplicationData = req.body.applicationData && typeof req.body.applicationData === 'object'
      && !Array.isArray(req.body.applicationData)
      ? req.body.applicationData
      : req.body;
    for (const person of ['groom', 'bride']) {
      if (submittedApplicationData[`${person}PreviouslyMarried`] === 'Yes'
        && !isValidMarriageDissolutionDate(submittedApplicationData, person)) {
        return res.status(400).json({
          message: `Enter a valid marriage dissolution date for the ${person}.`,
        });
      }
      if (submittedApplicationData[`${person}PreviouslyMarried`] === 'Yes'
        && submittedApplicationData[`${person}DissolutionMethod`] === 'Other'
        && (typeof submittedApplicationData[`${person}DissolutionMethodOther`] !== 'string'
          || !submittedApplicationData[`${person}DissolutionMethodOther`].trim()
          || submittedApplicationData[`${person}DissolutionMethodOther`].length > 200)) {
        return res.status(400).json({
          message: `Describe how the marriage was dissolved for the ${person} (200 characters or fewer).`,
        });
      }
    }

    // Applicants submit a preferred date/time, while the office assigns the
    // actual appointment later. Validate the preference instead of the
    // "To be assigned by office" placeholder stored in appointmentDate.
    const preferredAppointmentDate = String(req.body.preferredAppointmentDate || req.body.appointmentDate || '').trim();
    const preferredAppointmentTime = String(req.body.preferredAppointmentTime || req.body.appointmentTime || '').trim();
    if (!isValidAppointmentDate(preferredAppointmentDate)) {
      return res.status(400).json({ message: 'Enter a valid appointment date.' });
    }
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (preferredAppointmentDate < todayKey) {
      return res.status(400).json({ message: 'Appointment dates cannot be in the past.' });
    }
    if (!APPOINTMENT_TIME_OPTIONS.some(({ value }) => value === preferredAppointmentTime)) {
      return res.status(400).json({ message: 'Enter a valid appointment time.' });
    }

    const occupiedTimes = await getOccupiedAppointmentTimes(preferredAppointmentDate);
    if (occupiedTimes.has(preferredAppointmentTime)) {
      return res.status(409).json({ message: 'That appointment time is no longer available. Choose another time.' });
    }

    claimedApplicationId = new mongoose.Types.ObjectId();
    let accountClaim = await ApplicantAccount.findOneAndUpdate(
      { _id: req.user.id, activeApplicationId: { $exists: false } },
      { $set: { activeApplicationId: claimedApplicationId, activeApplicationClaimedAt: new Date() } },
      { returnDocument: 'after' },
    ).lean();

    if (!accountClaim) {
      const currentAccount = await ApplicantAccount.findById(req.user.id)
        .select('activeApplicationId activeApplicationClaimedAt updatedAt')
        .lean();
      const claimCreatedAt = currentAccount?.activeApplicationClaimedAt || currentAccount?.updatedAt;
      const claimIsStale = currentAccount?.activeApplicationId
        && claimCreatedAt
        && Date.now() - new Date(claimCreatedAt).getTime() >= APPLICATION_CLAIM_TIMEOUT_MS;

      if (claimIsStale) {
        const staleClaimFilter = {
          _id: req.user.id,
          activeApplicationId: currentAccount.activeApplicationId,
          updatedAt: currentAccount.updatedAt,
        };
        if (currentAccount.activeApplicationClaimedAt) {
          staleClaimFilter.activeApplicationClaimedAt = currentAccount.activeApplicationClaimedAt;
        } else {
          staleClaimFilter.activeApplicationClaimedAt = { $exists: false };
        }

        await ApplicantAccount.updateOne(staleClaimFilter, {
          $unset: { activeApplicationId: 1, activeApplicationClaimedAt: 1 },
        });
        accountClaim = await ApplicantAccount.findOneAndUpdate(
          { _id: req.user.id, activeApplicationId: { $exists: false } },
          { $set: { activeApplicationId: claimedApplicationId, activeApplicationClaimedAt: new Date() } },
          { returnDocument: 'after' },
        ).lean();
      }
    }

    if (!accountClaim) {
      claimedApplicationId = null;
      return res.status(409).json({
        message: 'An application submission is already in progress for this account. Wait a moment and try again.',
      });
    }

    const applicationData = req.body.applicationData && typeof req.body.applicationData === 'object' && !Array.isArray(req.body.applicationData)
      ? { ...req.body.applicationData, paymentMethod: FIXED_PAYMENT_METHOD, paymentAmount: FIXED_PAYMENT_AMOUNT }
      : req.body.applicationData;
    const applicantFields = { ...req.body };
    delete applicantFields.secondAppointmentDate;
    delete applicantFields.secondAppointmentTime;
    delete applicantFields.firstCounselingApprovedAt;
    delete applicantFields.secondAppointmentReminderClaimedAt;
    delete applicantFields.secondAppointmentReminderSentAt;
    delete applicantFields.appointmentSlotKey;
    const application = await Application.create({
      ...applicantFields,
      _id: claimedApplicationId,
      applicantEmail: req.user.email,
      appointmentSlotKey: getAppointmentSlotKey(preferredAppointmentDate, preferredAppointmentTime),
      status: 'For Review',
      paymentMethod: FIXED_PAYMENT_METHOD,
      paymentAmount: FIXED_PAYMENT_AMOUNT,
      applicationData,
    });
    await ApplicantAccount.updateOne(
      { _id: req.user.id, activeApplicationId: claimedApplicationId },
      { $unset: { activeApplicationId: 1, activeApplicationClaimedAt: 1 } },
    );
    claimedApplicationId = null;
    const notificationDelivery = await sendApplicantNotification(
      application,
      'Application received',
      `We received the marriage license application for ${getCoupleNames(application)}. You can follow updates in your WedRings account.`,
      'submitted',
    );
    res.status(201).json({ ...application.toObject(), notificationDelivery });
  } catch (error) {
    if (claimedApplicationId) {
      await ApplicantAccount.updateOne(
        { _id: req.user.id, activeApplicationId: claimedApplicationId },
        { $unset: { activeApplicationId: 1, activeApplicationClaimedAt: 1 } },
      );
    }
    if (error.code === 11000 && error.keyPattern?.appointmentSlotKey) {
      return res.status(409).json({ message: 'That appointment time was just booked. Choose another time.' });
    }
    res.status(400).json({ message: 'Unable to save application.', error: error.message });
  }
});

app.get('/api/applications', requireRoles(['applicant', 'admin', 'superadmin']), async (req, res) => {
  try {
    const filter = req.user.role === 'applicant' ? { applicantEmail: req.user.email } : {};
    const applicationQuery = Application.find(filter).sort({ createdAt: -1 });
    if (req.user.role !== 'applicant') {
      applicationQuery.select('-documents -paymentReceipt');
    }
    const applications = await applicationQuery.lean();
    res.set('Cache-Control', 'no-store');
    res.json(applications);
  } catch (error) {
    console.error('Unable to load applications:', error.message);
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

    const printForm = await buildPrintFormDocument(application);
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

app.put('/api/applications/:id/payment-receipt', requireRoles(['applicant']), async (req, res) => {
  try {
    if (isDatabaseUnavailable(res, 'Payment receipt upload')) return;

    const receipt = req.body.receipt;
    const receiptMatch = typeof receipt === 'string'
      ? /^data:(image\/(?:jpeg|png)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(receipt)
      : null;
    if (!receiptMatch) {
      return res.status(400).json({ message: 'Upload a JPEG, PNG, or PDF receipt.' });
    }

    const receiptData = Buffer.from(receiptMatch[2], 'base64');
    if (receiptData.length === 0 || receiptData.length > 5 * 1024 * 1024
      || receiptData.toString('base64') !== receiptMatch[2]) {
      return res.status(400).json({ message: 'The receipt must be no larger than 5 MB.' });
    }

    const application = await Application.findOneAndUpdate(
      { _id: req.params.id, applicantEmail: req.user.email },
      { $set: { paymentReceipt: receipt } },
      { new: true, runValidators: true },
    ).lean();

    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    res.set('Cache-Control', 'no-store');
    res.json(application);
  } catch (error) {
    res.status(400).json({ message: 'Unable to save the payment receipt.', error: error.message });
  }
});

app.put('/api/applications/:id/admin-information', requireRoles(['admin', 'superadmin']), async (req, res) => {
  try {
    const applicationData = req.body.applicationData;
    if (!applicationData || typeof applicationData !== 'object' || Array.isArray(applicationData)) {
      return res.status(400).json({ message: 'Provide applicant information to update.' });
    }

    const entries = Object.entries(applicationData);
    if (!entries.length || entries.some(([key, value]) => (
      !/^(groom|bride)[A-Za-z0-9]*$/.test(key)
      || !['string', 'number', 'boolean'].includes(typeof value)
      || String(value).length > 5000
    ))) {
      return res.status(400).json({ message: 'Applicant information contains an invalid field or value.' });
    }

    const existingApplication = await Application.findById(req.params.id).lean();
    if (!existingApplication) return res.status(404).json({ message: 'Application not found.' });

    const currentData = existingApplication.applicationData && typeof existingApplication.applicationData === 'object'
      && !Array.isArray(existingApplication.applicationData)
      ? existingApplication.applicationData
      : {};
    const updatedData = {
      ...currentData,
      ...Object.fromEntries(entries.map(([key, value]) => [key, String(value)])),
    };
    for (const person of ['groom', 'bride']) {
      if (updatedData[`${person}PreviouslyMarried`] === 'Yes'
        && !isValidMarriageDissolutionDate(updatedData, person)) {
        return res.status(400).json({
          message: `Enter a valid marriage dissolution date for the ${person}.`,
        });
      }
      if (updatedData[`${person}PreviouslyMarried`] === 'Yes'
        && updatedData[`${person}DissolutionMethod`] === 'Other'
        && (typeof updatedData[`${person}DissolutionMethodOther`] !== 'string'
          || !updatedData[`${person}DissolutionMethodOther`].trim()
          || updatedData[`${person}DissolutionMethodOther`].length > 200)) {
        return res.status(400).json({
          message: `Describe how the marriage was dissolved for the ${person} (200 characters or fewer).`,
        });
      }
      const dateKeys = ['DobMonth', 'DobDay', 'DobYear'].map((part) => `${person}${part}`);
      const dateParts = dateKeys.map((key) => String(updatedData[key] || '').trim());
      const hasDateFields = dateKeys.some((key) => key in updatedData);
      if (hasDateFields && dateParts.some(Boolean) && !dateParts.every(Boolean)) {
        return res.status(400).json({ message: `Enter a complete date of birth for the ${person}.` });
      }
    }

    const updatedFields = { applicationData: updatedData };

    for (const person of ['groom', 'bride']) {
      const nameParts = ['FirstName', 'MiddleName', 'LastName', 'Suffix']
        .map((part) => String(updatedData[`${person}${part}`] || '').trim())
        .filter(Boolean);
      const hasNameParts = ['FirstName', 'LastName'].some((part) => `${person}${part}` in updatedData);
      const dateParts = ['DobMonth', 'DobDay', 'DobYear']
        .map((part) => String(updatedData[`${person}${part}`] || '').trim());
      const hasDateParts = ['DobMonth', 'DobDay', 'DobYear']
        .some((part) => `${person}${part}` in updatedData);
      const fullName = hasNameParts ? nameParts.join(' ') : String(updatedData[`${person}FullName`] || existingApplication[`${person}FullName`] || '');
      const dateOfBirth = hasDateParts && dateParts.every(Boolean)
        ? `${dateParts[0]}/${dateParts[1]}/${dateParts[2]}`
        : hasDateParts
          ? ''
          : String(updatedData[`${person}Dob`] || existingApplication[`${person}Dob`] || '');

      updatedData[`${person}FullName`] = fullName;
      updatedData[`${person}Dob`] = dateOfBirth;
      updatedFields[`${person}FullName`] = fullName;
      updatedFields[`${person}Dob`] = dateOfBirth;
      for (const suffix of ['Gender', 'CivilStatus', 'Mobile', 'Email']) {
        updatedFields[`${person}${suffix}`] = String(
          updatedData[`${person}${suffix}`] ?? existingApplication[`${person}${suffix}`] ?? '',
        );
      }
    }

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { $set: updatedFields },
      { new: true, runValidators: true },
    ).lean();
    if (!application) return res.status(404).json({ message: 'Application not found.' });

    await recordAdminAction(req, {
      action: 'application.information.updated',
      targetType: 'application',
      targetId: application._id.toString(),
      targetLabel: getCoupleNames(application),
      details: { fields: entries.map(([key]) => key) },
    });
    res.set('Cache-Control', 'no-store');
    res.json(application);
  } catch (error) {
    respondToAdminMutationError(res, error, 'Unable to update applicant information.');
  }
});

app.put('/api/applications/:id/status', requireRoles(['superadmin']), async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['For Review', 'Verified', 'Rejected'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid application status.' });
    }

    const existingApplication = await Application.findById(req.params.id)
      .select('status')
      .lean();
    if (!existingApplication) {
      return res.status(404).json({ message: 'Application not found.' });
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

    await recordAdminAction(req, {
      action: 'application.status.updated',
      targetType: 'application',
      targetId: application._id.toString(),
      targetLabel: getCoupleNames(application),
      details: { previousStatus: existingApplication.status, status },
    });

    if (status === 'Rejected') {
      const coupleNames = getCoupleNames(application);
      const notificationDelivery = await sendApplicantNotification(
        application,
        'Application needs updating',
        `Your application for ${coupleNames} was rejected. Please contact the office for assistance.`,
        'rejected',
      );
      return res.json({ ...application, notificationDelivery });
    }

    res.json(application);
  } catch (error) {
    respondToAdminMutationError(res, error, 'Unable to update application status.');
  }
});

app.put('/api/applications/:id/first-counseling/approve', requireRoles(['admin', 'superadmin']), async (req, res) => {
  try {
    const application = await Application.findById(req.params.id).lean();
    if (!application) return res.status(404).json({ message: 'Application not found.' });

    const firstDateValue = application.appointmentDate && application.appointmentDate !== 'To be assigned by office'
      ? application.appointmentDate
      : application.preferredAppointmentDate;
    const firstDateKey = toAppointmentDateKey(firstDateValue);
    const todayKey = getManilaDateKey();
    if (!firstDateKey || firstDateKey >= todayKey) {
      return res.status(409).json({ message: 'The first appointment can be approved after its scheduled date has passed.' });
    }

    const { time } = req.body;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || ''))) {
      return res.status(400).json({ message: 'Choose a valid counseling appointment time.' });
    }

    if (application.firstCounselingApprovedAt) {
      return res.status(409).json({ message: 'The first counseling has already been approved.' });
    }

    const secondDateKey = getNextLastWednesday(firstDateKey, todayKey);
    const updatedApplication = await Application.findOneAndUpdate(
      { _id: req.params.id, firstCounselingApprovedAt: { $exists: false } },
      {
        $set: {
          firstCounselingApprovedAt: new Date(),
          secondAppointmentDate: secondDateKey,
          secondAppointmentTime: time,
        },
        $unset: {
          'notificationReads.firstCounselingApproved': 1,
          'notificationReads.secondAppointment': 1,
          secondAppointmentReminderClaimedAt: 1,
          secondAppointmentReminderSentAt: 1,
        },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!updatedApplication) return res.status(409).json({ message: 'The first counseling has already been approved.' });
    await recordAdminAction(req, {
      action: 'appointment.first.approved',
      targetType: 'application',
      targetId: updatedApplication._id.toString(),
      targetLabel: getCoupleNames(updatedApplication),
      details: {
        secondAppointmentDate: updatedApplication.secondAppointmentDate,
        secondAppointmentTime: updatedApplication.secondAppointmentTime,
      },
    });
    const coupleNames = getCoupleNames(updatedApplication);
    const firstCounselingNotification = await sendApplicantNotification(
      updatedApplication,
      'First counseling approved',
      `The first counseling for ${coupleNames} has been approved. Your second counseling appointment is scheduled for ${formatApplicantNotificationDate(updatedApplication.secondAppointmentDate, updatedApplication.secondAppointmentTime)}.`,
      'firstCounselingApproved',
    );
    const secondAppointmentNotification = await sendApplicantNotification(
      updatedApplication,
      'Second counseling appointment scheduled',
      `Your second counseling appointment for ${coupleNames} is set for ${formatApplicantNotificationDate(updatedApplication.secondAppointmentDate, updatedApplication.secondAppointmentTime)}. We will send you an email reminder three days before the appointment.`,
      'secondAppointment',
    );
    res.json({
      ...updatedApplication,
      notificationDelivery: {
        firstCounseling: firstCounselingNotification,
        secondAppointment: secondAppointmentNotification,
      },
    });
  } catch (error) {
    respondToAdminMutationError(res, error, 'Unable to approve the first counseling and schedule the second counseling.');
  }
});

app.put('/api/applications/:id/second-appointment', requireRoles(['superadmin']), async (req, res) => {
  try {
    const application = await Application.findById(req.params.id).lean();
    if (!application) return res.status(404).json({ message: 'Application not found.' });
    if (!application.firstCounselingApprovedAt || !application.secondAppointmentDate) {
      return res.status(409).json({ message: 'Approve the first counseling before updating the second counseling time.' });
    }

    const date = toAppointmentDateKey(req.body.date);
    if (date !== application.secondAppointmentDate) {
      return res.status(400).json({ message: 'The second counseling date is automatically scheduled on the last Wednesday of the month.' });
    }
    const { time } = req.body;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time || ''))) {
      return res.status(400).json({ message: 'Choose a valid counseling appointment time.' });
    }

    const updatedApplication = await Application.findByIdAndUpdate(
      req.params.id,
      {
        $set: { secondAppointmentTime: time },
        $unset: {
          'notificationReads.secondAppointment': 1,
          secondAppointmentReminderClaimedAt: 1,
          secondAppointmentReminderSentAt: 1,
        },
      },
      { new: true, runValidators: true },
    ).lean();
    if (!updatedApplication) return res.status(404).json({ message: 'Application not found.' });
    await recordAdminAction(req, {
      action: 'appointment.second.updated',
      targetType: 'application',
      targetId: updatedApplication._id.toString(),
      targetLabel: getCoupleNames(updatedApplication),
      details: {
        secondAppointmentDate: updatedApplication.secondAppointmentDate,
        secondAppointmentTime: updatedApplication.secondAppointmentTime,
      },
    });
    const notificationDelivery = await sendApplicantNotification(
      updatedApplication,
      'Second counseling appointment updated',
      `Your second counseling appointment is set for ${formatApplicantNotificationDate(updatedApplication.secondAppointmentDate, updatedApplication.secondAppointmentTime)}. We will send you an email reminder three days before the appointment.`,
      'secondAppointment',
    );
    res.json({ ...updatedApplication, notificationDelivery });
  } catch (error) {
    respondToAdminMutationError(res, error, 'Unable to update the second counseling time.');
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
    const updatedApplication = application.toObject();
    await recordAdminAction(req, {
      action: 'license.release-date.updated',
      targetType: 'application',
      targetId: application._id.toString(),
      targetLabel: getCoupleNames(updatedApplication),
      details: { releaseDate },
    });
    const notificationDelivery = await sendApplicantNotification(
      updatedApplication,
      'Marriage license release',
      `Your marriage license is scheduled for release on ${formatApplicantNotificationDate(updatedApplication.licenseReleaseDate)}.`,
      'licenseRelease',
    );
    res.json({ ...updatedApplication, notificationDelivery });
  } catch (error) {
    respondToAdminMutationError(res, error, 'Unable to set the license release date.');
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

    await recordAdminAction(req, {
      action: 'document.review.updated',
      targetType: 'application',
      targetId: application._id.toString(),
      targetLabel: getCoupleNames(application),
      details: { documentKey: req.params.documentKey, reviewStatus },
    });

    if (reviewStatus === 'Needs Redo') {
      const documentName = req.params.documentKey.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
      const coupleNames = getCoupleNames(application);
      const reviewInstruction = application.documentReviewNotes?.[req.params.documentKey];
      const notificationDelivery = await sendApplicantNotification(
        application,
        'Document needs replacement',
        reviewInstruction
          ? `${documentName} needs to be replaced for ${coupleNames}. Reviewer note: ${reviewInstruction}`
          : `${documentName} needs to be replaced for ${coupleNames}.`,
        `redo-${req.params.documentKey}`,
      );
      return res.json({ ...application, notificationDelivery });
    }

    res.json(application);
  } catch (error) {
    respondToAdminMutationError(res, error, 'Unable to update document review.');
  }
});

app.put('/api/applications/:id/documents/:documentKey', requireRoles(['admin', 'superadmin']), async (req, res) => {
  try {
    const { documentKey } = req.params;
    const { document } = req.body;
    if (!/^[A-Za-z0-9_-]+$/.test(documentKey)) {
      return res.status(400).json({ message: 'Invalid document key.' });
    }

    const dataUrlMatch = typeof document === 'string'
      ? /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(document)
      : null;
    if (!dataUrlMatch) {
      return res.status(400).json({ message: 'Choose a JPEG, PNG, WebP, or PDF document.' });
    }

    const documentBytes = Buffer.from(dataUrlMatch[2], 'base64');
    if (documentBytes.length === 0 || documentBytes.toString('base64') !== dataUrlMatch[2]) {
      return res.status(400).json({ message: 'The selected document is invalid.' });
    }
    if (documentBytes.length > MAX_APPLICATION_DOCUMENT_BYTES) {
      return res.status(413).json({ message: 'Replacement documents must be 20 MB or smaller.' });
    }

    const existingApplication = await Application.findById(req.params.id);
    if (!existingApplication) return res.status(404).json({ message: 'Application not found.' });
    if (!existingApplication.documents?.has(documentKey)) {
      return res.status(404).json({ message: 'Document not found in this application.' });
    }

    const updatedApplicationData = existingApplication.toObject({ flattenMaps: true });
    updatedApplicationData.documents[documentKey] = document;
    updatedApplicationData.documentReviews = updatedApplicationData.documentReviews || {};
    updatedApplicationData.documentReviews[documentKey] = 'Accepted';
    if (updatedApplicationData.documentReviewNotes) {
      delete updatedApplicationData.documentReviewNotes[documentKey];
    }
    if (updatedApplicationData.notificationReads) {
      delete updatedApplicationData.notificationReads[`redo-${documentKey}`];
    }
    if (mongoose.mongo.BSON.calculateObjectSize(updatedApplicationData) > MAX_MONGODB_DOCUMENT_BYTES) {
      return res.status(413).json({
        message: 'This application cannot store the replacement document because its complete record would exceed the database size limit. Choose a smaller file.',
      });
    }

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          [`documents.${documentKey}`]: document,
          [`documentReviews.${documentKey}`]: 'Accepted',
        },
        $unset: {
          [`documentReviewNotes.${documentKey}`]: 1,
          [`notificationReads.redo-${documentKey}`]: 1,
        },
      },
      { new: true, runValidators: true },
    ).lean();

    if (!application) return res.status(404).json({ message: 'Application not found.' });

    await recordAdminAction(req, {
      action: 'document.replaced',
      targetType: 'application',
      targetId: application._id.toString(),
      targetLabel: getCoupleNames(application),
      details: { documentKey, reviewStatus: 'Accepted', replacementBytes: documentBytes.length },
    });

    res.set('Cache-Control', 'no-store');
    res.json(application);
  } catch (error) {
    respondToAdminMutationError(res, error, 'Unable to replace the application document.');
  }
});

app.put('/api/applications/:id/notifications/:notificationKey/read', requireRoles(['applicant']), async (req, res) => {
  try {
    const { notificationKey } = req.params;
    if (!/^(submitted|appointment|firstCounselingApproved|secondAppointment|rejected|licenseRelease|redo-[A-Za-z0-9_-]+)$/.test(notificationKey)) {
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

app.use((error, req, res, next) => {
  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      message: 'The application documents are too large to submit. Reduce the file sizes and try again.',
    });
  }
  next(error);
});

if (require.main === module) {
  const databaseDnsServers = (process.env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);
  systemDns.setServers(databaseDnsServers);

  try {
    const dnsRecords = JSON.parse(process.env.DNS_RECORDS || '{"localhost":"127.0.0.1"}');
    if (!dnsRecords || Array.isArray(dnsRecords) || typeof dnsRecords !== 'object') {
      throw new Error('DNS_RECORDS must be a JSON object mapping hostnames to IPv4 addresses.');
    }

    const normalizedDnsRecords = Object.fromEntries(
      Object.entries(dnsRecords).map(([hostname, address]) => [hostname.toLowerCase().replace(/\.$/, ''), address]),
    );
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
  } catch (error) {
    console.error('Unable to start the local DNS server:', error.message);
    process.exitCode = 1;
  }

  if (process.exitCode !== 1) {
    app.listen(BACKEND_PORT, () => {
      console.log(`Backend server is running on port ${BACKEND_PORT}`);
    });
    const counselingReminderInterval = setInterval(() => {
      if (mongoose.connection.readyState === 1) void checkCounselingReminders();
    }, 15 * 60 * 1000);
    counselingReminderInterval.unref();
    connectToDatabase()
      .then(() => checkCounselingReminders())
      .catch(() => {
        console.error('Please verify the Atlas cluster is running and your IP is whitelisted.');
      });
  }
}

module.exports = app;
