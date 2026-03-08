const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: "*",   // allow requests from Vercel frontend
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());

// Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/donors',    require('./routes/donors'));
app.use('/api/emergency', require('./routes/emergency'));

// Test route
app.get('/', (req, res) => {
  res.send('Health Tech Connect API Running ✅');
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ DB Error:', err));

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});