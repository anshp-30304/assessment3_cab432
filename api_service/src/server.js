require('dotenv').config();  // THIS MUST BE FIRST LINE
const app = require('./app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║   Task Manager API Server                    ║');
  console.log('╚═══════════════════════════════════════════════╝\n');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  console.log('Features enabled:');
  console.log(`  ✅ SQS Queue: ${process.env.SQS_QUEUE_URL ? 'Configured' : '⚠️  Not configured'}`);
  console.log(`  ✅ S3 Bucket: ${process.env.S3_BUCKET || '⚠️  Not configured'}`);
  console.log(`  ✅ DynamoDB: ${process.env.DYNAMODB_TASKS_TABLE || '⚠️  Not configured'}`);
  console.log(`  ✅ Cognito: ${process.env.COGNITO_USER_POOL_ID ? 'Configured' : '⚠️  Not configured'}`);
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n📴 SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n📴 SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

module.exports = server;
