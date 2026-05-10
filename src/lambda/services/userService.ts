import { PutCommand, GetCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { UserAlreadyExistsError, UserNotFoundError } from '../errors/appError';
import { dynamoDB } from '../db/client';
import { UpdateCommandOutput, GetCommandOutput } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.TABLE_NAME;
if (!TABLE_NAME) {
    throw new Error('TABLE_NAME environment variable is required');
}

export interface User {
    userId: string;
    name: string;
    email: string;
    createdAt: string;
}
export async function createUserRecord(user: User): Promise<void> { 
    try {
        await dynamoDB.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: user,
            ConditionExpression: 'attribute_not_exists(userId)'
        }));
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
            throw new UserAlreadyExistsError();
        }
        throw error;
    }
}
export async function updateUserRecord(
    {
        name, 
        email, 
        userId
    }: {
        name: string, 
        email: string, 
        userId: string
    }) : Promise<UpdateCommandOutput> {
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
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
            throw new UserNotFoundError();
        }
        throw error;
    }
    return result;
}
export async function deleteUserRecord(userId: string) {
    try {
        await dynamoDB.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {userId},
            ConditionExpression: 'attribute_exists(userId)'
        }))
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
            throw new UserNotFoundError();
        }
        throw error;
    }
}
export async function getAllUserRecords(
    {
        limit, 
        exclusiveStartKey
    }: {
        limit: number, 
        exclusiveStartKey?: Record<string, unknown>
    }) {
    let result;
    try {
        // NOTE: Scan used for demo purposes; in production use pagination or indexed queries
        result = await dynamoDB.send(new ScanCommand({
            TableName: TABLE_NAME,
            Limit: limit,
            ExclusiveStartKey: exclusiveStartKey
        }));
    } catch (error) {
        throw error;
    }
    return {
        items: result?.Items || [],
        nextToken: result.LastEvaluatedKey
            ? encodeURIComponent(
                JSON.stringify(result.LastEvaluatedKey)
                )
            : null
    };
}
export async function getUserRecord(userId: string): Promise<GetCommandOutput> {
    try {
        return await dynamoDB.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: {userId}
        }));
    } catch (error) {
        throw error; 
    }
}