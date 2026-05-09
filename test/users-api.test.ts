import { APIGatewayProxyEventV2 } from 'aws-lambda';

// mock DynamoDB client
const sendMock = jest.fn();

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: () => ({
      send: sendMock,
    }),
  },
  PutCommand: jest.fn(),
  GetCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  DeleteCommand: jest.fn(),
  ScanCommand: jest.fn(),
}));

jest.mock('../src/lambda/services/auditService', () => ({
  logAuditEvent: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: () => 'test-uuid',
}));

import { createUser, deleteUser, updateUser } from '../src/lambda/controllers/usersController';
import { logAuditEvent } from '../src/lambda/services/auditService';

beforeEach(() => {
  sendMock.mockReset();
  jest.clearAllMocks();
});

function mockEvent(body?: any): APIGatewayProxyEventV2 {
  return {
    body: body ? JSON.stringify(body) : null,
    pathParameters: {},
    requestContext: {
      requestId: 'test-request-id',
      http: {
        method: 'POST',
        path: '/v1/users'
      }
    }
  } as any;
}
function mockUpdate(userId: string, body?: any): APIGatewayProxyEventV2 {
  return {
    body: body ? JSON.stringify(body) : null,
    pathParameters: {
      id: userId
    },
    requestContext: {
      requestId: 'test-request-id',
      http: {
        method: 'PUT',
        path: '/v1/users/{id}'
      }
    }
  } as any;
}
function mockDelete(userId?: string, body?: any): APIGatewayProxyEventV2 {
  return {
    body: body ? JSON.stringify(body) : null,
    pathParameters: {
      id: userId
    },
    requestContext: {
      requestId: 'test-request-id',
      http: {
        method: 'DELETE',
        path: '/v1/users/{id}'
      }
    }
  } as any;
}

describe('createUser', () => {
    it('should create a user and log audit event', async () => {
        // Arrange
        sendMock.mockResolvedValueOnce({}); // DynamoDB success

        const event = mockEvent({
            name: 'Test User',
            email: 'Test@test.com'
        });

        // Act
        const response = await createUser(event, 'req-1');

        if (typeof response === 'string') {
            throw new Error('Expected object response');
        }
        // Assert
        expect(response.statusCode).toBe(201);

        const body = JSON.parse(response.body!);
        expect(body.name).toBe('Test User');
        expect(body.email).toBe('Test@test.com');

        expect(sendMock).toHaveBeenCalledTimes(1);
        expect(logAuditEvent).toHaveBeenCalledWith({
          userId: 'test-uuid',
          action: 'CREATE_USER',
          changes: {
            name: 'Test User',
            email: 'Test@test.com'
          },
          requestId: 'req-1'
        });
    });

    it('should return 400 if name or email missing', async () => {
        const event = mockEvent({ name: 'Test User' });

        const response = await createUser(event, 'req-1');
        if (typeof response === 'string') {
            throw new Error('Expected object response');
        }

        const body = JSON.parse(response.body!);
        expect(response.statusCode).toBe(400);
        expect(body.message).toBe('name and email required');
    });

    it('should return 409 if user already exists', async () => {
        sendMock.mockRejectedValueOnce({
            name: 'ConditionalCheckFailedException'
        });

        const event = mockEvent({
            name: 'Test User',
            email: 'Test@test.com'
        });

        const response = await createUser(event, 'req-1');
        if (typeof response === 'string') {
            throw new Error('Expected object response');
        }

        const body = JSON.parse(response.body!);
        expect(response.statusCode).toBe(409);
        expect(body.message).toBe('User already exists');
    });
});

describe('updateUser', () => {
    it('should update a user and log audit event', async () => {
        sendMock.mockResolvedValueOnce({});

        const event = mockUpdate('user-1', {
            name: 'Test Update',
            email: 'Test2@test.com'
        });

        // Act
        const response = await updateUser(event, 'req-1');

        if (typeof response === 'string') {
            throw new Error('Expected object response');
        }
        // Assert
        expect(response.statusCode).toBe(200);

        expect(sendMock).toHaveBeenCalledTimes(1);
        expect(logAuditEvent).toHaveBeenCalledWith({
          userId: 'user-1',
          action: 'UPDATE_USER',
          changes: {
            name: 'Test Update',
            email: 'Test2@test.com'
          },
          requestId: 'req-1'
        });
    });

    it('should return 400 if name or email missing', async () => {
        const event = mockUpdate('req-1');

        const response = await updateUser(event, 'req-1');
        if (typeof response === 'string') {
            throw new Error('Expected object response');
        }

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.body!);
        expect(response.statusCode).toBe(400);
        expect(body.message).toBe('Request body required');
    });

    it('should return 404 if user does not exist', async () => {
        sendMock.mockRejectedValueOnce({
            name: 'ConditionalCheckFailedException'
        });

        const event = mockUpdate('user-1', {
            name: 'Test User',
            email: 'Test@test.com'
        });

        const response = await updateUser(event, 'req-1');
        if (typeof response === 'string') {
            throw new Error('Expected object response');
        }

        const body = JSON.parse(response.body!);
        expect(response.statusCode).toBe(404);
        expect(body.message).toBe('User not found');
    });
});

describe('deleteUser', () => {
    it('should delete a user and log audit event', async () => {
        sendMock.mockResolvedValueOnce({});

        const event = mockDelete('user-1');

        // Act
        const response = await deleteUser(event, 'req-1');

        if (typeof response === 'string') {
            throw new Error('Expected object response');
        }
        // Assert
        expect(response.statusCode).toBe(200);

        expect(sendMock).toHaveBeenCalledTimes(1);
        expect(logAuditEvent).toHaveBeenCalledWith({
          userId: 'user-1',
          action: 'DELETE_USER',
          changes: {},
          requestId: 'req-1'
        });
    });

    it('should return 400 if id missing', async () => {
        const event = mockDelete();

        const response = await deleteUser(event, 'req-1');
        if (typeof response === 'string') {
            throw new Error('Expected object response');
        }


        const body = JSON.parse(response.body!);
        expect(response.statusCode).toBe(400);
        expect(body.message).toBe('User ID is required');
    });

    it('should return 404 if user does not exist', async () => {
        sendMock.mockRejectedValueOnce({
            name: 'ConditionalCheckFailedException'
        });

        const event = mockDelete('req-1');

        const response = await deleteUser(event, 'req-1');
        if (typeof response === 'string') {
            throw new Error('Expected object response');
        }


        const body = JSON.parse(response.body!);
        expect(response.statusCode).toBe(404);
        expect(body.message).toBe('User not found');
    });
});