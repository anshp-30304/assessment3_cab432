module.exports = {
  apps: [
    {
      name: "api",
      script: "./api_service/src/server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        AWS_REGION: "ap-southeast-2",
        SQS_QUEUE_URL:
          "https://sqs.ap-southeast-2.amazonaws.com/901444280953/task-manager-reports",
        S3_BUCKET: "cab432-task-files-n11857374",
        DYNAMODB_TASKS_TABLE: "cab432-tasks-n11857374",
        COGNITO_USER_POOL_ID: "ap-southeast-2_C3o7rWAqP",
        COGNITO_CLIENT_ID: "1s4v8jhpjebna3uj930dalds1r",
        COGNITO_CLIENT_SECRET:
          "4na7fuh6i0rg0go6473jg5ee36bhpde13ftqco3m34bknloij4j",
        JWT_SECRET: "assessment3_n11857374",
      },
    },
    {
      name: "worker-1",
      script: "./worker_service/src/worker.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        AWS_REGION: "ap-southeast-2",
        SQS_QUEUE_URL:
          "https://sqs.ap-southeast-2.amazonaws.com/901444280953/task-manager-reports",
        S3_BUCKET: "cab432-task-files-n11857374",
        DYNAMODB_TASKS_TABLE: "cab432-tasks-n11857374",
        WORKER_ID: "worker-1",
      },
    },
  ],
};

