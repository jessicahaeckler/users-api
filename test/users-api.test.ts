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

import { createUser } from '../src/lambda/controllers/usersController';
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

describe('createUser', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

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
        expect(logAuditEvent).toHaveBeenCalledTimes(1);
    });

    it('should return 400 if name or email missing', async () => {
        const event = mockEvent({ name: 'Test User' });

        const response = await createUser(event, 'req-1');
        if (typeof response === 'string') {
            throw new Error('Expected object response');
        }

        expect(response.statusCode).toBe(400);
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

        expect(response.statusCode).toBe(409);
    });
});
