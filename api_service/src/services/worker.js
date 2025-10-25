const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const PDFDocument = require('pdfkit'); // CPU-intensive library

const sqsClient = new SQSClient({ region: process.env.AWS_REGION });
const s3Client = new S3Client({ region: process.env.AWS_REGION });

const QUEUE_URL = process.env.SQS_QUEUE_URL;
const BUCKET_NAME = process.env.S3_BUCKET;

async function pollQueue() {
  while (true) {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 300
      });

      const response = await sqsClient.send(command);

      if (response.Messages && response.Messages.length > 0) {
        for (const message of response.Messages) {
          await processMessage(message);
          
          // Delete message after successful processing
          await sqsClient.send(new DeleteMessageCommand({
            QueueUrl: QUEUE_URL,
            ReceiptHandle: message.ReceiptHandle
          }));
        }
      }
    } catch (error) {
      console.error('Queue polling error:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function processMessage(message) {
  const data = JSON.parse(message.Body);
  console.log('Processing report request:', data.requestId);

  // THIS IS THE CPU-INTENSIVE PART
  const pdfBuffer = await generatePDFReport(data);

  // Upload to S3
  const key = `reports/${data.userId}/${data.requestId}.pdf`;
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf'
  }));

  console.log('Report generated:', key);
}

async function generatePDFReport(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // CPU-INTENSIVE: Generate complex PDF
    doc.fontSize(25).text('Task Report', 100, 80);
    doc.fontSize(12).text(`User: ${data.userId}`, 100, 120);
    doc.text(`Report Type: ${data.reportType}`, 100, 140);
    doc.text(`Generated: ${new Date().toISOString()}`, 100, 160);

    // ADD CPU-INTENSIVE OPERATIONS HERE:
    // - Fetch tasks from DynamoDB
    // - Generate statistics
    // - Create charts (using chart libraries)
    // - Add complex formatting
    
    // Make it CPU-intensive by doing calculations
    for (let i = 0; i < 1000000; i++) {
      Math.sqrt(i * Math.random());
    }

    doc.end();
  });
}

console.log('Worker started, polling queue...');
pollQueue();