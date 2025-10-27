require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const app = express();
// ============================================================================
// MIDDLEWARE
// ============================================================================
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
// ============================================================================
// IMPORT ROUTES
// ============================================================================
const authRoutes = require('./routes/auth');
const tasksRoutes = require('./routes/tasks');
const filesRoutes = require('./routes/files');
const reportsRoutes = require('./routes/reports');  // NEW for A3
// ============================================================================
// REGISTER ROUTES
// ============================================================================
app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/reports', reportsRoutes);  // NEW for A3
// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'task-manager-api',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    features: {
      sqs: !!process.env.SQS_QUEUE_URL,
      s3: !!process.env.S3_BUCKET,
      dynamodb: !!process.env.DYNAMODB_TASKS_TABLE,
      cognito: !!process.env.COGNITO_USER_POOL_ID
    }
  });
});


app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// ============================================================================
// ERROR HANDLER
// ============================================================================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});
module.exports = app; 
