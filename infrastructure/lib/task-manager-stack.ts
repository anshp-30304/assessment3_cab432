import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

export class TaskManagerStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'TaskManagerVPC', {
      maxAzs: 2
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'TaskManagerCluster', {
      vpc: vpc
    });

    // SQS Queue
    const queue = new sqs.Queue(this, 'ReportQueue', {
      visibilityTimeout: cdk.Duration.seconds(300),
      deadLetterQueue: {
        queue: new sqs.Queue(this, 'ReportDLQ'),
        maxReceiveCount: 3
      }
    });

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      internetFacing: true
    });

    // ACM Certificate (use existing from A2)
    const certificate = acm.Certificate.fromCertificateArn(
      this,
      'Certificate',
      'arn:aws:acm:region:account:certificate/id'
    );

    // API Service (ECS Fargate)
    const apiTaskDef = new ecs.FargateTaskDefinition(this, 'ApiTaskDef');
    apiTaskDef.addContainer('api', {
      image: ecs.ContainerImage.fromAsset('./api-service'),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'api' }),
      environment: {
        SQS_QUEUE_URL: queue.queueUrl
      }
    });

    const apiService = new ecs.FargateService(this, 'ApiService', {
      cluster,
      taskDefinition: apiTaskDef,
      desiredCount: 1
    });

    // Worker Service (ECS Fargate with Auto Scaling)
    const workerTaskDef = new ecs.FargateTaskDefinition(this, 'WorkerTaskDef', {
      cpu: 256,
      memoryLimitMiB: 512
    });
    
    workerTaskDef.addContainer('worker', {
      image: ecs.ContainerImage.fromAsset('./worker-service'),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'worker' }),
      environment: {
        SQS_QUEUE_URL: queue.queueUrl
      }
    });

    const workerService = new ecs.FargateService(this, 'WorkerService', {
      cluster,
      taskDefinition: workerTaskDef,
      desiredCount: 1
    });

    // Auto Scaling for Worker
    const workerScaling = workerService.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 3
    });

    workerScaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60)
    });

    // ALB Listener
    const listener = alb.addListener('Listener', {
      port: 443,
      certificates: [certificate]
    });

    listener.addTargets('ApiTarget', {
      port: 3000,
      targets: [apiService],
      healthCheck: {
        path: '/health'
      }
    });
  }
}