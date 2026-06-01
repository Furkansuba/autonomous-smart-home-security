require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const app = express();
const PORT = process.env.PORT || 5000;
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'autonomous-smart-home-backend',
    timestamp: new Date().toISOString(),
  });
});
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
  });
});
app.listen(PORT, () => {
  console.log('Backend server running on port ' + PORT);
});
