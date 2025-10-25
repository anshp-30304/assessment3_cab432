
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();


const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { v4: uuidv4 } = require('uuid');


const sqsClient = new SQSClient({ 
  region: process.env.AWS_REGION || 'us-east-1' 
});

const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;


app.post('/api/reports/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub; // From JWT token
    const { reportType = 'task-summary' } = req.body;

    // Validate queue URL
    if (!SQS_QUEUE_URL) {
      console.error('SQS_QUEUE_URL not configured');
      return res.status(500).json({ 
        error: 'Report service not configured' 
      });
    }

    // Generate unique request ID
    const requestId = uuidv4();
    
    // Create message payload
    const messageBody = {
      requestId,
      userId,
      reportType,
      timestamp: new Date().toISOString(),
      metadata: {
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    };

    // Send message to SQS
    const command = new SendMessageCommand({
      QueueUrl: SQS_QUEUE_URL,
      MessageBody: JSON.stringify(messageBody),
      MessageAttributes: {
        'RequestId': {
          DataType: 'String',
          StringValue: requestId
        },
        'UserId': {
          DataType: 'String',
          StringValue: userId
        },
        'ReportType': {
          DataType: 'String',
          StringValue: reportType
        }
      }
    });

    await sqsClient.send(command);

    console.log(`Report queued: ${requestId} for user: ${userId}`);

    // Return success response
    res.status(202).json({
      message: 'Report generation queued successfully',
      requestId,
      status: 'queued',
      estimatedTime: '1-2 minutes'
    });

  } catch (error) {
    console.error('Error queueing report:', error);
    res.status(500).json({ 
      error: 'Failed to queue report generation',
      details: error.message 
    });
  }
});


app.get('/api/reports/status/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.sub;

    // Check if report exists in S3
    const s3Key = `reports/${userId}/${requestId}.pdf`;
    
    // Try to get object metadata
    const s3Client = new S3Client({ region: process.env.AWS_REGION });
    const { HeadObjectCommand } = require('@aws-sdk/client-s3');
    
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: s3Key
      }));

      // File exists
      res.json({
        requestId,
        status: 'completed',
        downloadUrl: `/api/reports/download/${requestId}`
      });
    } catch (error) {
      if (error.name === 'NotFound') {
        // Still processing
        res.json({
          requestId,
          status: 'processing',
          message: 'Report is being generated'
        });
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('Error checking report status:', error);
    res.status(500).json({ 
      error: 'Failed to check report status',
      details: error.message 
    });
  }
});


app.get('/api/reports/download/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.sub;

    const s3Key = `reports/${userId}/${requestId}.pdf`;
    
    const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
    const s3Client = new S3Client({ region: process.env.AWS_REGION });

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key
    });

    const response = await s3Client.send(command);

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="task-report-${requestId}.pdf"`);

    // Stream the PDF to response
    response.Body.pipe(res);

  } catch (error) {
    console.error('Error downloading report:', error);
    
    if (error.name === 'NoSuchKey') {
      res.status(404).json({ 
        error: 'Report not found',
        message: 'Report may still be processing or does not exist'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to download report',
        details: error.message 
      });
    }
  }
});


app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'task-manager-api',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    features: {
      sqs: !!SQS_QUEUE_URL,
      s3: !!process.env.S3_BUCKET,
      dynamodb: !!process.env.DYNAMODB_TASKS_TABLE
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

module.exports = app;