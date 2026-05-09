export const success = (statusCode: number, body: unknown, requestId: string) => ({
    statusCode,
    headers: { 
        'Content-Type': 'application/json',
        'x-request-id': requestId 
    },
    body: JSON.stringify(body),
});

export const badRequest = (message: string) => success(400, { message }, '');
export const notFound = (message: string) => success(404, { message }, '');
export const conflict = (message: string) => success(409, { message }, '');
export const internalError = (message: string) => success(500, { message }, '');