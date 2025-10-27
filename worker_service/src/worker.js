/**
 * Report Worker Service - Main Entry Point
 * 
 * This worker polls SQS queue for report generation requests,
 * processes them (CPU-intensive PDF generation), and uploads
 * the results to S3.
 * 
 * Auto-scaling: This service scales based on CPU utilization (70% target)
 */

require('dotenv').config();
const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { generateTaskReport } = require('./pdf-generator');

// ============================================================================
// AWS CLIENT INITIALIZATION
// ============================================================================

const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  queueUrl: process.env.SQS_QUEUE_URL,
  bucketName: process.env.S3_BUCKET,
  tasksTable: process.env.DYNAMODB_TASKS_TABLE,
  maxMessages: 1,
  waitTimeSeconds: 20,
  visibilityTimeout: 300
};

// ============================================================================
// STARTUP
// ============================================================================

console.log('\n╔═══════════════════════════════════════════════╗');
console.log('║   Report Worker Service Starting...          ║');
console.log('╚═══════════════════════════════════════════════╝\n');

console.log('Configuration:');
console.log('  Queue URL:', CONFIG.queueUrl || '⚠️  NOT SET');
console.log('  S3 Bucket:', CONFIG.bucketName || '⚠️  NOT SET');
console.log('  Tasks Table:', CONFIG.tasksTable || '⚠️  NOT SET');
console.log('  Region:', process.env.AWS_REGION || 'us-east-1');
console.log('  Max Messages:', CONFIG.maxMessages);
console.log('  Wait Time:', CONFIG.waitTimeSeconds, 'seconds');
console.log('  Visibility Timeout:', CONFIG.visibilityTimeout, 'seconds');
console.log('');

// Validate configuration
if (!CONFIG.queueUrl || !CONFIG.bucketName || !CONFIG.tasksTable) {
  console.error('❌ ERROR: Missing required configuration!');
  console.error('Please ensure the following environment variables are set:');
  console.error('  - SQS_QUEUE_URL');
  console.error('  - S3_BUCKET');
  console.error('  - DYNAMODB_TASKS_TABLE');
  process.exit(1);
}

// ============================================================================
// MAIN QUEUE POLLING LOOP
// ============================================================================

/**
 * Main polling loop - runs continuously
 */
async function pollQueue() {
  console.log('✅ Worker ready. Polling SQS queue for messages...\n');
  
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;
  
  while (true) {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: CONFIG.queueUrl,
        MaxNumberOfMessages: CONFIG.maxMessages,
        WaitTimeSeconds: CONFIG.waitTimeSeconds,
        VisibilityTimeout: CONFIG.visibilityTimeout,
        MessageAttributeNames: ['All']
      });

      const response = await sqsClient.send(command);

      if (response.Messages && response.Messages.length > 0) {
        console.log(`📨 Received ${response.Messages.length} message(s)`);
        consecutiveErrors = 0; // Reset error counter on success
        
        for (const message of response.Messages) {
          try {
            await processMessage(message);
            await deleteMessage(message.ReceiptHandle);
            console.log('✅ Message processed and deleted successfully\n');
          } catch (error) {
            console.error('❌ Error processing message:', error.message);
            console.error('Stack:', error.stack);
            // Message will become visible again after visibility timeout
            // After max receives, it will go to DLQ if configured
          }
        }
      } else {
        // No messages - this is normal with long polling
        process.stdout.write('⏳ Waiting for messages...\r');
      }
      
    } catch (error) {
      consecutiveErrors++;
      console.error(`\n❌ Queue polling error (${consecutiveErrors}/${maxConsecutiveErrors}):`, error.message);
      
      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.error('❌ Too many consecutive errors. Exiting...');
        process.exit(1);
      }
      
      // Wait before retrying to avoid tight loop on errors
      await sleep(5000);
    }
  }
}

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

/**
 * Process a single SQS message
 */
async function processMessage(message) {
  const startTime = Date.now();
  
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║   Processing Message                          ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log('Message ID:', message.MessageId);
  
  // Parse message body
  let messageData;
  try {
    messageData = JSON.parse(message.Body);
  } catch (error) {
    throw new Error(`Failed to parse message body: ${error.message}`);
  }
  
  console.log('Request ID:', messageData.requestId);
  console.log('User ID:', messageData.userId);
  console.log('Report Type:', messageData.reportType);
  console.log('Timestamp:', messageData.timestamp);
  
  // Step 1: Fetch user's tasks from DynamoDB
  console.log('\n📊 Step 1: Fetching tasks from DynamoDB...');
  const tasks = await fetchUserTasks(messageData.userId);
  console.log(`✅ Fetched ${tasks.length} tasks`);
  
  // Step 2: Generate PDF report (CPU-intensive)
  console.log('\n🔄 Step 2: Generating PDF report...');
  console.log('   (This is CPU-intensive - expect high CPU utilization)');
  const pdfStartTime = Date.now();
  
  const pdfBuffer = await generateTaskReport(messageData, tasks);
  
  const pdfDuration = Date.now() - pdfStartTime;
  console.log(`✅ PDF generated successfully`);
  console.log(`   Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
  console.log(`   Duration: ${pdfDuration}ms`);
  
  // Step 3: Upload to S3
  console.log('\n☁️  Step 3: Uploading to S3...');
  const s3Key = `reports/${messageData.userId}/${messageData.requestId}.pdf`;
  await uploadToS3(s3Key, pdfBuffer);
  console.log(`✅ Uploaded to: s3://${CONFIG.bucketName}/${s3Key}`);
  
  // Summary
  const totalDuration = Date.now() - startTime;
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║   Processing Complete                         ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log(`Total Time: ${totalDuration}ms`);
  console.log(`PDF Generation: ${pdfDuration}ms (${((pdfDuration / totalDuration) * 100).toFixed(1)}%)`);
  console.log(`Report ID: ${messageData.requestId}`);
  console.log('');
}

// ============================================================================
// DYNAMODB OPERATIONS
// ============================================================================

/**
 * Fetch all tasks for a user from DynamoDB
 */
async function fetchUserTasks(userId) {
  try {
    // Try with GSI first (if it exists)
    console.log('   Attempting query with userId-index...');
    
    const command = new QueryCommand({
      TableName: CONFIG.tasksTable,
      IndexName: 'userId-index',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });

    const result = await docClient.send(command);
    console.log('   ✅ Query successful');
    return result.Items || [];
    
  } catch (error) {
    // Fallback to scan if GSI doesn't exist
    console.log('   ⚠️  GSI query failed, falling back to scan...');
    console.log('   Error:', error.message);
    
    try {
      const scanCommand = new ScanCommand({
        TableName: CONFIG.tasksTable,
        FilterExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      });

      const result = await docClient.send(scanCommand);
      console.log('   ✅ Scan successful');
      return result.Items || [];
      
    } catch (scanError) {
      console.error('   ❌ Scan also failed:', scanError.message);
      throw new Error(`Failed to fetch tasks: ${scanError.message}`);
    }
  }
}

// ============================================================================
// S3 OPERATIONS
// ============================================================================

/**
 * Upload PDF to S3
 */
async function uploadToS3(key, buffer) {
  try {
    const command = new PutObjectCommand({
      Bucket: CONFIG.bucketName,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
      ServerSideEncryption: 'AES256',
      Metadata: {
        'generated-by': 'task-manager-worker',
        'generated-at': new Date().toISOString()
      }
    });

    await s3Client.send(command);
    console.log('   ✅ Upload successful');
    
  } catch (error) {
    console.error('   ❌ Upload failed:', error.message);
    throw new Error(`Failed to upload to S3: ${error.message}`);
  }
}

// ============================================================================
// SQS OPERATIONS
// ============================================================================

/**
 * Delete message from SQS queue
 */
async function deleteMessage(receiptHandle) {
  try {
    const command = new DeleteMessageCommand({
      QueueUrl: CONFIG.queueUrl,
      ReceiptHandle: receiptHandle
    });

    await sqsClient.send(command);
    
  } catch (error) {
    console.error('⚠️  Failed to delete message from queue:', error.message);
    // Don't throw - message will become visible again
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log('\n⚠️  Forced shutdown...');
    process.exit(1);
  }
  
  isShuttingDown = true;
  console.log(`\n\n📴 ${signal} received, shutting down gracefully...`);
  console.log('Finishing current work...');
  
  // Give time for current message processing to complete
  await sleep(2000);
  
  console.log('✅ Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('\n❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// ============================================================================
// START THE WORKER
// ============================================================================

pollQueue().catch(error => {
  console.error('\n❌ Fatal error in worker:', error);
  process.exit(1);
});
