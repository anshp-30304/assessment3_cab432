const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { 
  generatePresignedUploadUrl, 
  generatePresignedDownloadUrl, 
  deleteFile 
} = require('../services/s3');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.post('/generate',  async (req, res) => {
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

router.get('/status/:requestId', async (req, res) => {
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

router.get('/download/:requestId',  async (req, res) => {
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

router.post('/upload-url', async (req, res) => {
  try {
    const { fileName, contentType, taskId } = req.body;

    if (!fileName) {
      return res.status(400).json({ error: 'File name is required' });
    }

    const fileKey = `tasks/${taskId || 'general'}/${req.user.userId}/${uuidv4()}-${fileName}`;
    
    const result = await generatePresignedUploadUrl(fileKey, contentType);
    
    if (result.success) {
      res.json({
        uploadUrl: result.uploadUrl,
        fileKey: result.key,
        message: 'Upload URL generated successfully'
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

router.post('/download-url', async (req, res) => {
  try {
    const { fileKey } = req.body;

    if (!fileKey) {
      return res.status(400).json({ error: 'File key is required' });
    }

    // Basic access control - users can only access their own files
    if (!fileKey.includes(req.user.userId)) {
      return res.status(403).json({ error: 'Access denied to this file' });
    }

    const result = await generatePresignedDownloadUrl(fileKey);
    
    if (result.success) {
      res.json({
        downloadUrl: result.downloadUrl,
        message: 'Download URL generated successfully'
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

router.delete('/:fileKey(*)', async (req, res) => {
  try {
    const fileKey = req.params.fileKey;

    if (!fileKey) {
      return res.status(400).json({ error: 'File key is required' });
    }

    // Basic access control - users can only delete their own files
    if (!fileKey.includes(req.user.userId)) {
      return res.status(403).json({ error: 'Access denied to this file' });
    }

    const result = await deleteFile(fileKey);
    
    if (result.success) {
      res.json({ message: 'File deleted successfully' });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router;
