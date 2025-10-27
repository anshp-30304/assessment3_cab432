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
          "",
        S3_BUCKET: "",
        DYNAMODB_TASKS_TABLE: "",
        COGNITO_USER_POOL_ID: "",
        COGNITO_CLIENT_ID: "",
        COGNITO_CLIENT_SECRET:
          "",
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
          "",
        S3_BUCKET: "",
        DYNAMODB_TASKS_TABLE: "",
        WORKER_ID: "worker-1",
      },
    },
  ],
};

