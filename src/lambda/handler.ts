import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
// import { faker } from '@faker-js/faker';

const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || '';
const AUDIT_LOG_TABLE_NAME = process.env.AUDIT_LOG_TABLE_NAME || '';

export const handler = async (event: APIGatewayProxyEventV2):Promise<APIGatewayProxyResultV2> => {
    const method = event.requestContext.http.method;
    const path = event.requestContext.http.path;
    const requestId = event.requestContext.requestId;

    try {
        log('INFO', 'Incoming request', {
            requestId,
            method,
            path
        });
        if (path === '/v1/users') {
            switch (method) {
                case 'GET':
                    return getAllUsers(event);
                case 'POST':
                    return createUser(event, requestId);
                default:
                    return {
                        statusCode: 400,
                        body: JSON.stringify({message: 'Unsupported HTTP method for /v1/users path'})
                    }
            }
        }
        if (path.startsWith('/v1/users/')) {
            const userId = event.pathParameters?.id;

            if (!userId) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({message: `User ID is required in the path: ${path}`})
                }
            }
            switch (method) {
                case 'GET':
                    return getUser(userId);
                case 'PUT':
                    return updateUser(event, userId, requestId);
                case 'DELETE':
                    return deleteUser(event, userId, requestId);
                default:
                    return {
                        statusCode: 400,
                        body: JSON.stringify({message: 'Unsupported HTTP method for /v1/users/{id} path'})
                    }
            }
        }
        return {
            statusCode: 404,
            body: JSON.stringify({message: 'Path not found'})
        }
    } catch (error) {
        console.error('Error processing request:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({message: 'Internal server error'})
        }
        
    }
}

async function logAuditEvent({
    userId,
    action,
    changes = {},
    requestId
}: {
    userId: string;
    action: string;
    changes?: any;
    requestId?: string;
}) {
    return dynamoDB.send(new PutCommand({
        TableName: AUDIT_LOG_TABLE_NAME,
        Item: {
            userId,
            action,
            timestamp: `${new Date().toISOString()}#${uuidv4()}`,
            changes,
            requestId,
            ttl: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
        }
    }));
}

function log(level: 'INFO' | 'ERROR', message: string, context: Record<string, unknown> = {}) {
    console.log(JSON.stringify({
        level,
        message,
        timestamp: new Date().toISOString(),
        ...context
    }));
}

async function getAllUsers(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const result = await dynamoDB.send(new ScanCommand({
        TableName: TABLE_NAME
    }))
    return {
        statusCode: 200,
        body: JSON.stringify(result.Items || [])
    }
}

async function getUser(userId: string): Promise<APIGatewayProxyResultV2> {
    const result = await dynamoDB.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {userId}
    }))
    if (!result.Item) {
        return {
            statusCode: 404,
            body: JSON.stringify({message: `User not found with id: ${userId}`})
        }
    }
    return {
        statusCode: 200,
        body: JSON.stringify(result.Item || {})
    }
}

// NOTE: Scan used for demo purposes; in production use pagination or indexed queries
async function createUser(event: APIGatewayProxyEventV2, requestId: string): Promise<APIGatewayProxyResultV2> {
    if (!event.body) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Request body required' }) };
    }

    const { name, email } = JSON.parse(event.body);

    if (!name || !email) {
        return { statusCode: 400, body: JSON.stringify({ message: 'name and email are required' }) };
    }
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
            Item: user
        }))
        log('INFO', 'User created successfully', { requestId, userId });
    } catch (error) {
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
    return {
        statusCode: 201,
        headers: {
            'Content-Type': 'application/json',
            'x-request-id': requestId
        },
        body: JSON.stringify(user)
    };
}

async function updateUser(event: APIGatewayProxyEventV2, userId: string, requestId: string): Promise<APIGatewayProxyResultV2> {
    if (!event.body) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Request body required' }) };
    }

    const { name, email } = JSON.parse(event.body);

    if (!name || !email) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Name and email are required' }) };
    }

    log('INFO', 'Updating user', { requestId, name, email });
    const result = await dynamoDB.send(new UpdateCommand({
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
        ReturnValues: 'ALL_NEW'
    }));
    log('INFO', 'User updated successfully', { requestId, userId });
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
        log('ERROR', 'Error creating audit log entry', { requestId, error: error instanceof Error ? error.message : error });
    }
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'x-request-id': requestId
        },
        body: JSON.stringify(result.Attributes || {})
    }
}

async function deleteUser(event: APIGatewayProxyEventV2, userId: string, requestId: string): Promise<APIGatewayProxyResultV2> {
    try {
        await dynamoDB.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {userId}
        }))
    } catch (error) {
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
    return {
        statusCode: 200,
        body: JSON.stringify({message: `User deleted ${userId}`})
    }
}