Assignment 2 - Cloud Services Exercises - Response to Criteria
================================================

Instructions
------------------------------------------------
- Keep this file named A2_response_to_criteria.md, do not change the name
- Upload this file along with your code in the root directory of your project
- Upload this file in the current Markdown format (.md extension)
- Do not delete or rearrange sections.  If you did not attempt a criterion, leave it blank
- Text inside [ ] like [eg. S3 ] are examples and should be removed


Overview
------------------------------------------------

- **Name:** Aansh Kaushalbhai Patel
- **Student number:** n11857374
- **Partner name (if applicable):** 
- **Application name:** TaskManager
- **Two line description:** A cloud-native task management application that allows users to create, manage, and share tasks with file attachments. Demonstrates comprehensive AWS service integration including data persistence, authentication, caching, and secure file handling.
- **EC2 instance name or ID:** n11857374_Assessment2(i-0e8d930f3200fd18d)

------------------------------------------------

### Core - First data persistence service

- **AWS service name:**  DynamoDB
- **What data is being stored?:** Task metadata including task IDs, titles, descriptions, priorities, status, and timestamps
- **Why is this service suited to this data?:** DynamoDB provides fast NoSQL storage for structured task data with efficient user-specific queries
- **Why is are the other services used not suitable for this data?:** S3 is for files not structured queries. RDS is overkill for simple task metadata
- **Bucket/instance/table name:** cab432-tasks-n11857374
- **Video timestamp:** 5:40
- **Relevant files:**
    - src/services/dynamodb.js

### Core - Second data persistence service

- **AWS service name:**  S3
- **What data is being stored?:** S3 offers unlimited storage, high durability, and direct client uploads via pre-signed URLs
- **Why is this service suited to this data?:** DynamoDB has 400KB size limits. Binary files don't need database query capabilities
- **Why is are the other services used not suitable for this data?:**
- **Bucket/instance/table name:** cab432-task-files-n11857374
- **Video timestamp:** 6:29
- **Relevant files:**
    - src/services/s3.js

### Third data service

- **AWS service name:**  [eg. RDS]
- **What data is being stored?:** [eg video metadata]
- **Why is this service suited to this data?:** [eg. ]
- **Why is are the other services used not suitable for this data?:** [eg. Advanced video search requires complex querries which are not available on S3 and inefficient on DynamoDB]
- **Bucket/instance/table name:**
- **Video timestamp:**
- **Relevant files:**
    -

### S3 Pre-signed URLs

- **S3 Bucket names:** cab432-task-files-n11857374
- **Video timestamp:** 6:31
- **Relevant files:**
    - src/services/s3.js

### In-memory cache

- **ElastiCache instance name:** n11857374
- **What data is being cached?:** User task lists and authentication token validation results
- **Why is this data likely to be accessed frequently?:** Task lists are loaded on every page refresh. Tokens are validated on every API request
- **Video timestamp:** 7:24
- **Relevant files:**
    - src/services/cache.js
    - src/routes/tasks.js

### Core - Statelessness

- **What data is stored within your application that is not stored in cloud data services?:**  No persistent data. Only temporary cache entries which are non-persistent by design
- **Why is this data not considered persistent state?:** Cache data can be regenerated from DynamoDB/Cognito. Loss only impacts performance, not functionality
- **How does your application ensure data consistency if the app suddenly stops?:** All data immediately written to AWS services. No local storage or sessions used
- **Relevant files:**
    - src/middleware/auth.js

### Graceful handling of persistent connections

- **Type of persistent connection and use:** WebSocket connections for real-time task notifications
- **Method for handling lost connections:** Client auto-reconnects. Core functionality continues via REST API
- **Relevant files:**
    - src/app.js
    - index.html

### Core - Authentication with Cognito

- **User pool name:** cab432-task-users-n11857374
- **How are authentication tokens handled by the client?:** WT tokens stored in localStorage and sent in Authorization headers
- **Video timestamp:** 0.18 
- **Relevant files:**
    - src/services/cognito.js
    - src/middleware/auth.js

### Cognito multi-factor authentication

- **What factors are used for authentication:** Password and TOTP (Time-based One-Time Password) via authenticator apps
- **Video timestamp:** 1:10
- **Relevant files:**
   - src/services/cognito.js

### Cognito federated identities

- **Identity providers used:**
- **Video timestamp:**
- **Relevant files:**
    -

### Cognito groups

- **How are groups used to set permissions?:**  Admin group users have additional permissions including ability to add users to groups and access admin-only API endpoints. Regular users group has standard task management permissions. Group membership is checked server-side via JWT token claims.
- **Video timestamp:** 4:22  
- **Relevant files:**
    - src/routes/auth.js (admin endpoint with group checking)
    - src/middleware/auth.js (requireAdmin middleware)

### Core - DNS with Route53

- **Subdomain**:  n11857374-tasks.cab432.com
- **Video timestamp:** 5:10

### Parameter store

- **Parameter names:** [eg. n1234567/base_url]
- **Video timestamp:**
- **Relevant files:**
    -

### Secrets manager

- **Secrets names:** /cab432/task-manager/cognito-client-secret
- **Video timestamp:** 4:42
- **Relevant files:**
    - src/services/secrets.js

### Infrastructure as code

- **Technology used:** Terraform
- **Services deployed:** DynamoDB tables, S3 bucket with CORS and security settings, Cognito User Pool with MFA and groups, ElastiCache Redis cluster with security groups, Parameter Store parameters, Secrets Manager secrets, IAM roles and policies for EC2 access
- **Video timestamp:** [not included in video, but used it]
- **Relevant files:**
    - infrastructure/main.tf
    - infrastructure/variables.tf
    - infrastructure/terraform.tf





### Other (with prior approval only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**
    -

### Other (with prior permission only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**
    -