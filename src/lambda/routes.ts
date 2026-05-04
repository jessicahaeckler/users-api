import { getAllUsers, getUser, createUser, updateUser, deleteUser } from './controllers/usersController';
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

type RouteHandler = (
    event: APIGatewayProxyEventV2,
    requestId: string
) => Promise<APIGatewayProxyResultV2>;

export const routes: Record<string, RouteHandler> = {
    'GET /v1/users': getAllUsers,
    'POST /v1/users': createUser,
    'GET /v1/users/{id}': getUser,
    'PUT /v1/users/{id}': updateUser,
    'DELETE /v1/users/{id}': deleteUser,
};