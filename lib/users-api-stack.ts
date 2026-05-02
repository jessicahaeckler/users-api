import * as cdk from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import path from 'path';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigateway_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { DynamoDBStack } from './dynamodb-stack';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

interface UsersApiStackProps extends cdk.StackProps {
  dynamoDBStack: DynamoDBStack;
}

export class UsersApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: UsersApiStackProps) {
    super(scope, id, props);

    const usersHandler = new NodejsFunction(this, 'UsersHandler', {
      runtime: Runtime.NODEJS_24_X,
      entry:path.join(__dirname, '../src/lambda/handler.ts'),
      handler:'handler',
      functionName:`${this.stackName}-user-handler`,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: props.dynamoDBStack.usersTable.tableName,
        AUDIT_LOG_TABLE_NAME: props.dynamoDBStack.auditLogTable.tableName,
      }
    });
    props.dynamoDBStack.usersTable.grantReadWriteData(usersHandler);
    props.dynamoDBStack.auditLogTable.grantReadWriteData(usersHandler);
    // NOTE: Open CORS for demo; restrict origins/headers in production
    const httpApi = new apigateway.HttpApi(this, 'UsersApi', {
      apiName:'UsersApi',
      description: 'Users Management API',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigateway.CorsHttpMethod.ANY],
        allowHeaders: ['*'],
      }
    });
    
    const routes = [
      {path: '/v1/users', method: apigateway.HttpMethod.GET, name: 'GetAllUsers'},
      {path: '/v1/users', method: apigateway.HttpMethod.POST, name: 'CreateUser'},
      {path: '/v1/users/{id}', method: apigateway.HttpMethod.GET, name: 'GetUser'},
      {path: '/v1/users/{id}', method: apigateway.HttpMethod.PUT, name: 'UpdateUser'},
      {path: '/v1/users/{id}', method: apigateway.HttpMethod.DELETE, name: 'DeleteUser'},
    ];
    routes.forEach(({path, method, name}) => {
      httpApi.addRoutes({
        path,
        methods: [method],
        integration: new apigateway_integrations.HttpLambdaIntegration(`${name}Integration`, usersHandler)
      });
    });
    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: httpApi.url ?? '',
      description: 'HTTP API URL',
    });
    
    // monitor errors and performance of the Lambda function
    const errorMetric = usersHandler.metricErrors({
      period: cdk.Duration.minutes(1),
    });
    new cloudwatch.Alarm(this, 'UsersHandlerErrorAlarm', {
      metric: errorMetric,
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: 'Alarm if Lambda has >= 1 error in 1 minute',
    });
    const durationMetric = usersHandler.metricDuration({
      period: cdk.Duration.minutes(1),
    });
    new cloudwatch.Alarm(this, 'UsersHandlerDurationAlarm', {
      metric: durationMetric,
      threshold: 3000, // 3 seconds
      evaluationPeriods: 2,
      alarmDescription: 'Alarm if Lambda duration exceeds 3 seconds',
    });
  }
}
