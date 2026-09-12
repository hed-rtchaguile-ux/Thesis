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

// Launch server
app.listen(BACKEND_PORT, () => {
  console.log(`Backend server is running on port ${BACKEND_PORT}`);
});
