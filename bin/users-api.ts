#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { UsersApiStack } from '../lib/users-api-stack';
import { DynamoDBStack } from '../lib/dynamodb-stack';

const app = new cdk.App();

const dynamoDBStack = new DynamoDBStack(app, 'DynamoDBStack');

const usersApiStack = new UsersApiStack(app, 'UsersApiStack', {dynamoDBStack});
usersApiStack.addDependency(dynamoDBStack);
