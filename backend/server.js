const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environmental variables
dotenv.config();

const app = express();

// Explicitly defining configuration using const
const BACKEND_PORT = process.env.PORT || 5000;
const ALLOWED_FRONTEND_ORIGIN = 'http://localhost:5173';
const DATABASE_CONNECTION_STRING = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wedrings';

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

// Connecting to the Database using our defined const
mongoose.connect(DATABASE_CONNECTION_STRING)
  .then(async () => {
    console.log('Successfully connected to MongoDB database: wedrings 💍');

    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      const hasCollection = collections.some((collection) => collection.name === 'info_wedrings');

      if (!hasCollection) {
        await mongoose.connection.db.createCollection('info_wedrings');
        console.log('Created MongoDB collection: info_wedrings');
      }
    } catch (collectionError) {
      console.error('MongoDB collection setup error:', collectionError);
    }
  })
  .catch((error) => console.error('MongoDB connection error:', error));

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
    const filter = req.query.applicantEmail ? { applicantEmail: req.query.applicantEmail } : {}
    const applications = await Application.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    res.json(applications);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load applications.', error: error.message });
  }
});

app.put('/api/applications/:id/status', async (req, res) => {
  try {
    const allowedStatuses = ['For Review', 'Verified', 'Rejected'];
    const { status } = req.body;

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
    res.status(500).json({ message: 'Unable to update application status.', error: error.message });
  }
});

// Launch server
app.listen(BACKEND_PORT, () => {
  console.log(`Backend server is running on port ${BACKEND_PORT}`);
});
