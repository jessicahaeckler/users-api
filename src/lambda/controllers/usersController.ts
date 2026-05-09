import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { log } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';
import { badRequest, success, notFound, conflict } from '../utils/response';
// import { faker } from '@faker-js/faker';

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME!;

export async function getAllUsers(event: APIGatewayProxyEventV2, requestId: string): Promise<APIGatewayProxyResultV2> {
    const nextToken = event.queryStringParameters?.nextToken;
    let exclusiveStartKey;

    try {
        exclusiveStartKey = nextToken
            ? JSON.parse(decodeURIComponent(nextToken))
            : undefined;
    } catch {
        return badRequest('Invalid nextToken');
    }

    const limitParam = Number(event.queryStringParameters?.limit);

    const limit =
        Number.isInteger(limitParam) &&
        limitParam > 0 &&
        limitParam <= 100
            ? limitParam
            : 10;

    try {
        // NOTE: Scan used for demo purposes
        const result = await dynamoDB.send(new ScanCommand({
            TableName: TABLE_NAME,
            Limit: limit,
            ExclusiveStartKey: exclusiveStartKey
        }))
        
        return success(200, {
            items: result.Items || [],
            nextToken: result.LastEvaluatedKey
                ? encodeURIComponent(
                    JSON.stringify(result.LastEvaluatedKey)
                  )
                : null
        }, requestId);
    } catch (error) {
        log('ERROR', 'Error fetching users', { requestId, error: error instanceof Error ? error.message : error });
        throw error;
    }
}

export async function getUser(event: APIGatewayProxyEventV2, requestId: string): Promise<APIGatewayProxyResultV2> {
    const userId = event.pathParameters?.id;
    if (!userId) return badRequest('User ID is required');

    try {
        const result = await dynamoDB.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: {userId}
        }))
        if (!result.Item) {
            return notFound(`User not found with id: ${userId}`);
        }
        return success(200, result.Item, requestId);
    } catch (error) {
        log('ERROR', 'Error fetching user', { requestId, error: error instanceof Error ? error.message : error });
        throw error;
    }
}

// NOTE: Scan used for demo purposes; in production use pagination or indexed queries
export async function createUser(event: APIGatewayProxyEventV2, requestId: string): Promise<APIGatewayProxyResultV2> {
    if (!event.body) return badRequest('Request body required');

    let parsed;
    try {
        parsed = JSON.parse(event.body);
    } catch {
        return badRequest('Invalid JSON');
    }

    // TODO: Create a validation helper to check for required fields and correct data types
    const { name, email } = parsed;
    if (!name || !email) return badRequest('name and email required');

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) return badRequest('Invalid email format');

    const userId = uuidv4();
    const user = {
        userId: userId,
        name,
        email,
        createdAt:new Date().toISOString(),

    }
    //testing user generation with faker
    // const user = {
    //     userId: userId,
    //     name: faker.person.fullName(),
    //     email: faker.internet.email(),
    //     createdAt:new Date().toISOString(),

    // }
    log('INFO', 'Creating user', { requestId, name, email });
    try {
        await dynamoDB.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: user,
            ConditionExpression: 'attribute_not_exists(userId)'
        }))
        log('INFO', 'User created successfully', { requestId, userId });
    } catch (error: any) {
        // TODO: create a helper to parse AWS errors and return appropriate status codes/messages
        if (error.name === 'ConditionalCheckFailedException') {
            return conflict('User already exists');
        }
        log('ERROR', 'Error creating user', { requestId, error: error instanceof Error ? error.message : error });
        throw error;
    }
    try {
        await logAuditEvent({
            userId,
            action: 'CREATE_USER',
            changes: {
                name,
                email
            },
            requestId
        });
    } catch (error) {
        log('ERROR', 'Error creating audit log entry', { requestId, error: error instanceof Error ? error.message : error });
    }
    return success(201, user, requestId);
}

export async function updateUser(event: APIGatewayProxyEventV2, requestId: string): Promise<APIGatewayProxyResultV2> {
    if (!event.body) return badRequest('Request body required');
    
    const userId = event.pathParameters?.id;
    if (!userId) return badRequest('User ID is required');

    let parsed;
    try {
        parsed = JSON.parse(event.body);
    } catch {
        return badRequest('Invalid JSON');
    }

    const { name, email } = parsed;
    if (!name || !email) return badRequest('name and email required');

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) return badRequest('Invalid email format');

    log('INFO', 'Updating user', { requestId, userId, name, email });

    let result;
    try {
        result = await dynamoDB.send(new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {userId},
            UpdateExpression: `SET #name = :name, #email = :email`,
            ExpressionAttributeNames: {
                '#name': 'name',
                '#email': 'email'
            },
            ExpressionAttributeValues: {
                ':name': name,
                ':email': email
            },
            ReturnValues: 'ALL_NEW',
            ConditionExpression: 'attribute_exists(userId)'
        }));
        log('INFO', 'User updated successfully', { requestId, userId });
    } catch (error: any) {
        if (error.name === 'ConditionalCheckFailedException') {
            return notFound('User not found');
        }

        log('ERROR', 'Error updating user', {
            requestId,
            userId,
            error: error instanceof Error ? error.message : error
        });

        throw error;
    }
    try {
        await logAuditEvent({
            userId,
            action: 'UPDATE_USER',
            changes: {
                name,
                email
            },
            requestId
        });
    } catch (error) {
        log('ERROR', 'Error creating audit log entry', {
            requestId,
            userId,
            error: error instanceof Error ? error.message : error
        });
    }
    return success(200, result.Attributes || {}, requestId);
}

export async function deleteUser(event: APIGatewayProxyEventV2, requestId: string): Promise<APIGatewayProxyResultV2> {
    const userId = event.pathParameters?.id;
    if (!userId) return badRequest('User ID is required');

    try {
        await dynamoDB.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {userId},
            ConditionExpression: 'attribute_exists(userId)'
        }))
    } catch (error: any) {
        if (error.name === 'ConditionalCheckFailedException') {
            return notFound('User not found');
        }
        log('ERROR', 'Error deleting user', { requestId, error: error instanceof Error ? error.message : error });
        throw error;
    }
    try {
        await logAuditEvent({
            userId,
            action: 'DELETE_USER',
            changes: {},
            requestId
        });
    } catch (error) {
        log('ERROR', 'Error creating audit log entry', { requestId, error: error instanceof Error ? error.message : error });
    }
    return success(200, {message: `User deleted ${userId}`}, requestId);
}