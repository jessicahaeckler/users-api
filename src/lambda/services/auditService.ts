import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);
const AUDIT_LOG_TABLE_NAME = process.env.AUDIT_LOG_TABLE_NAME || '';


export async function logAuditEvent({
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
