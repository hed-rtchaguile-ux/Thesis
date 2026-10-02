const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const dns = require('dns2');
const systemDns = require('node:dns');

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
  marriageLicenseNumber: String,
  marriageLicenseIssuedAt: Date,
}, { timestamps: true });

const Application = mongoose.model('Application', applicationSchema, 'info_wedrings');
const noticeSchema = new mongoose.Schema({
  groomFullName: { type: String, required: true },
  brideFullName: { type: String, required: true },
  ceremonyDate: { type: String, required: true },
  message: String,
  imageData: { type: String, required: true },
  publishedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
const MarriageNotice = mongoose.model('MarriageNotice', noticeSchema, 'marriage_notices');

// Applying the CORS options const
const corsOptions = {
  origin: ALLOWED_FRONTEND_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '12mb' })); // Allows compressed couple photos in notice posts

app.get('/api/status', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    atlasConnected: mongoose.connection.readyState === 1,
  });
});

app.get('/api/notices', async (req, res) => {
  try {
    const notices = await MarriageNotice.find({ expiresAt: { $gt: new Date() } })
      .sort({ publishedAt: -1 })
      .lean();
    res.set('Cache-Control', 'no-store');
    res.json(notices);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load marriage notices.', error: error.message });
  }
});

app.post('/api/notices', async (req, res) => {
  try {
    const { groomFullName, brideFullName, ceremonyDate, message = '', imageData } = req.body;
    if (!String(groomFullName || '').trim() || !String(brideFullName || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(ceremonyDate || '')) {
      return res.status(400).json({ message: 'Couple names and a ceremony date are required.' });
    }
    if (typeof imageData !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(imageData) || imageData.length > 10_000_000) {
      return res.status(400).json({ message: 'Upload a JPEG, PNG, or WebP image under 7 MB.' });
    }

    const publishedAt = new Date();
    const notice = await MarriageNotice.create({
      groomFullName: String(groomFullName).trim(),
      brideFullName: String(brideFullName).trim(),
      ceremonyDate,
      message: String(message).trim().slice(0, 500),
      imageData,
      publishedAt,
      expiresAt: new Date(publishedAt.getTime() + 10 * 24 * 60 * 60 * 1000),
    });
    res.status(201).json(notice);
  } catch (error) {
    res.status(400).json({ message: 'Unable to publish marriage notice.', error: error.message });
  }
});

app.delete('/api/notices/:id', async (req, res) => {
  try {
    const notice = await MarriageNotice.findByIdAndDelete(req.params.id);
    if (!notice) return res.status(404).json({ message: 'Marriage notice not found.' });
    res.status(204).end();
  } catch (error) {
    res.status(400).json({ message: 'Unable to remove marriage notice.', error: error.message });
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

app.post('/api/applications', async (req, res) => {
  try {
    const application = await Application.create({
      ...req.body,
      status: 'For Review',
    });
    res.status(201).json(application);
  } catch (error) {
    res.status(400).json({ message: 'Unable to save application.', error: error.message });
  }
});

app.get('/api/applications', async (req, res) => {
  try {
    const filter = req.query.applicantEmail ? { applicantEmail: req.query.applicantEmail } : {};
    const applications = await Application.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    res.set('Cache-Control', 'no-store');
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load applications.', error: error.message });
  }
});

app.get('/api/applications/:id', async (req, res) => {
  try {
    const application = await Application.findById(req.params.id).lean();

    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    res.set('Cache-Control', 'no-store');
    res.json(application);
  } catch (error) {
    res.status(400).json({ message: 'Unable to load application.', error: error.message });
  }
});

app.put('/api/applications/:id', async (req, res) => {
  try {
    if (req.params.id === 'appointments') {
      return res.status(404).json({ message: 'Appointment scheduling is disabled.' });
    }

    const protectedFields = new Set(['_id', 'status', 'appointmentDate', 'appointmentTime', 'appointmentLocation', 'applicantEmail', 'createdAt', 'updatedAt']);
    const editableFields = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => !protectedFields.has(key)),
    );

    const existingApplication = await Application.findById(req.params.id).lean();

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

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true },
    ).lean();

    res.set('Cache-Control', 'no-store');
    res.json(application);
  } catch (error) {
    res.status(400).json({ message: 'Unable to update application.', error: error.message });
  }
});

app.put('/api/applications/:id/status', async (req, res) => {
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

app.put('/api/applications/:id/license', async (req, res) => {
  try {
    const licenseNumber = String(req.body.licenseNumber || '').trim();
    if (!licenseNumber || licenseNumber.length > 80) {
      return res.status(400).json({ message: 'Enter a marriage license number up to 80 characters.' });
    }

    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ message: 'Application not found.' });
    if (application.status !== 'Verified') {
      return res.status(409).json({ message: 'Only verified applications can be issued a marriage license.' });
    }
    if (application.marriageLicenseIssuedAt) {
      return res.status(409).json({ message: 'A marriage license has already been issued for this application.' });
    }

    application.marriageLicenseNumber = licenseNumber;
    application.marriageLicenseIssuedAt = new Date();
    await application.save();
    res.json(application.toObject());
  } catch (error) {
    res.status(400).json({ message: 'Unable to issue marriage license.', error: error.message });
  }
});

app.put('/api/applications/:id/documents/:documentKey/review', async (req, res) => {
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

app.put('/api/applications/:id/notifications/:notificationKey/read', async (req, res) => {
  try {
    const { notificationKey } = req.params;
    if (!/^(appointment|rejected|redo-[A-Za-z0-9_-]+)$/.test(notificationKey)) {
      return res.status(400).json({ message: 'Invalid notification.' });
    }

    const application = await Application.findByIdAndUpdate(
      req.params.id,
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
