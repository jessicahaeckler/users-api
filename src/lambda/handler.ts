import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { log } from './utils/logger';
import { routes } from './routes';
// import { faker } from '@faker-js/faker';


export const handler = async (event: APIGatewayProxyEventV2):Promise<APIGatewayProxyResultV2> => {
    const requestId = event.requestContext.requestId;
    const routeKey = event.requestContext.routeKey;

    const routeHandler = routes[routeKey];
    if (!routeHandler) {
        return {
            statusCode: 404,
            body: JSON.stringify({ message: 'Route not found' }),
        };
    }

    try {
        return await routeHandler(event, requestId);
    } catch (error) {
        log('ERROR', 'Unhandled error', { requestId, error });

        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal server error' }),
        };
    }
}


