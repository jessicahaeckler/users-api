import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { log } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';
import { badRequest, success, notFound, conflict } from '../utils/response';
import { createUserRecord, updateUserRecord, deleteUserRecord, getAllUserRecords, getUserRecord } from '../services/userService';
import { UserAlreadyExistsError, UserNotFoundError } from '../errors/appError';
import { validateUserInput } from '../utils/validation';
// import { faker } from '@faker-js/faker';


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

    let result;
    try {
        result = await getAllUserRecords({
            limit,
            exclusiveStartKey
        });
    } catch (error) {
        log('ERROR', 'Error fetching users', { requestId, error: error instanceof Error ? error.message : error });
        throw error;
    }
    return success(200, result, requestId);
}

export async function getUser(event: APIGatewayProxyEventV2, requestId: string): Promise<APIGatewayProxyResultV2> {
    const userId = event.pathParameters?.id;
    if (!userId) return badRequest('User ID is required');

    let result;
    try {
        result = await getUserRecord(userId);
        if (!result.Item) {
            return notFound(`User not found with id: ${userId}`);
        }
    } catch (error) {
        log('ERROR', 'Error fetching user', { requestId, error: error instanceof Error ? error.message : error });
        throw error;
    }
    return success(200, result.Item, requestId);
}

// NOTE: Scan used for demo purposes; in production use pagination or indexed queries
export async function createUser(event: APIGatewayProxyEventV2, requestId: string): Promise<APIGatewayProxyResultV2> {
    if (!event.body) return badRequest('Request body required');
    interface CreateUserBody {
        name: string;
        email: string;
    }

    let parsed: CreateUserBody;
    try {
        parsed = JSON.parse(event.body) as CreateUserBody;
    } catch {
        return badRequest('Invalid JSON');
    }

    const validationError = validateUserInput(parsed);
    if (validationError) {
        return badRequest(validationError);
    }

    const { name, email } = parsed;

    const userId = uuidv4();
    const user = {
        userId,
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
        await createUserRecord(user);
        log('INFO', 'User created successfully', { requestId, userId });
    } catch (error: unknown) {
        // TODO: create a helper to parse AWS errors and return appropriate status codes/messages
        if (error instanceof UserAlreadyExistsError) {
            return conflict(error.message);
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
    let result;
    const userId = event.pathParameters?.id;
    if (!userId) return badRequest('User ID is required');

    interface UpdateUserBody {
        name: string;
        email: string;
    }

    let parsed: UpdateUserBody;
    try {
        parsed = JSON.parse(event.body) as UpdateUserBody;
    } catch {
        return badRequest('Invalid JSON');
    }
    
    const validationError = validateUserInput(parsed);
    if (validationError) {
        return badRequest(validationError);
    }

    const { name, email } = parsed;

    log('INFO', 'Updating user', { requestId, userId, name, email });
    try {
        result = await updateUserRecord({name, email, userId});
        log('INFO', 'User updated successfully', { requestId, userId });
    } catch (error: unknown) {
        if (error instanceof UserNotFoundError) {
            return notFound(error.message);
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
        await deleteUserRecord(userId);
        log('INFO', 'User deleted successfully', { requestId, userId });
    } catch (error: unknown) {
        if (error instanceof UserNotFoundError) {
            return notFound(error.message);
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