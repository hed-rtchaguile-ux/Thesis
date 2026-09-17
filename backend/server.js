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
  documents: { type: Map, of: String },
  documentReviews: { type: Map, of: String },
  status: { type: String, default: 'For Review' },
}, { timestamps: true });

const Application = mongoose.model('Application', applicationSchema, 'info_wedrings');

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
    atlasConnected: mongoose.connection.readyState === 1,
  });
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

app.put('/api/applications/appointments', async (req, res) => {
  try {
    const { appointmentDate, appointmentTime } = req.body;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate || '') || !appointmentTime) {
      return res.status(400).json({ message: 'Appointment date and time are required.' });
    }

    const result = await Application.updateMany(
      {},
      { $set: { appointmentDate, appointmentTime } },
    );
    const applications = await Application.find({}).sort({ createdAt: -1 }).lean();
    res.json({ modifiedCount: result.modifiedCount, applications });
  } catch (error) {
    res.status(400).json({ message: 'Unable to schedule all applicants.', error: error.message });
  }
});

app.put('/api/applications/:id', async (req, res) => {
  try {
    const protectedFields = new Set(['_id', 'status', 'appointmentDate', 'appointmentTime', 'appointmentLocation', 'applicantEmail', 'createdAt', 'updatedAt']);
    const editableFields = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => !protectedFields.has(key)),
    );

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { $set: editableFields },
      { new: true, runValidators: true },
    ).lean();

    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

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

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { status },
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

app.put('/api/applications/:id/documents/:documentKey/review', async (req, res) => {
  try {
    const { reviewStatus } = req.body;
    const allowedStatuses = ['Accepted', 'Needs Redo'];

    if (!allowedStatuses.includes(reviewStatus)) {
      return res.status(400).json({ message: 'Invalid document review status.' });
    }

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { $set: { [`documentReviews.${req.params.documentKey}`]: reviewStatus } },
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

app.put('/api/applications/:id/appointment', async (req, res) => {
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
      { appointmentDate, appointmentTime },
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

// Launch server
app.listen(BACKEND_PORT, () => {
  console.log(`Backend server is running on port ${BACKEND_PORT}`);
});
