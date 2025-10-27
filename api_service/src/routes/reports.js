const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { S3Client, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-2' });

router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.userId;
    const { reportType = 'task-summary' } = req.body;
    
    if (!process.env.SQS_QUEUE_URL) {
      return res.status(500).json({ error: 'SQS not configured' });
    }

    const requestId = uuidv4();
    await sqsClient.send(new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify({ requestId, userId, reportType, timestamp: new Date().toISOString() }),
      MessageAttributes: {
        'RequestId': { DataType: 'String', StringValue: requestId },
        'UserId': { DataType: 'String', StringValue: userId }
      }
    }));

    console.log(`✅ Report queued: ${requestId}`);
    res.status(202).json({ success: true, message: 'Report queued', requestId, status: 'queued' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to queue report', details: error.message });
  }
});

router.get('/status/:requestId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.userId;
    const s3Key = `reports/${userId}/${req.params.requestId}.pdf`;
    
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: s3Key }));
      res.json({ success: true, requestId: req.params.requestId, status: 'completed', downloadUrl: `/api/reports/download/${req.params.requestId}` });
    } catch (error) {
      if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
        res.json({ success: true, requestId: req.params.requestId, status: 'processing' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to check status', details: error.message });
  }
});

router.get('/download/:requestId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.userId;
    const s3Key = `reports/${userId}/${req.params.requestId}.pdf`;
    const response = await s3Client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: s3Key }));
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.requestId}.pdf"`);
    response.Body.pipe(res);
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      res.status(404).json({ error: 'Report not found' });
    } else {
      res.status(500).json({ error: 'Download failed', details: error.message });
    }
  }
});

router.get('/health', (req, res) => {
  res.json({ service: 'reports', status: 'healthy', sqs: !!process.env.SQS_QUEUE_URL, s3: !!process.env.S3_BUCKET });
});

module.exports = router;
