export const success = (statusCode: number, body: unknown, requestId: string) => ({
    statusCode,
    headers: { 
        'Content-Type': 'application/json',
        'x-request-id': requestId 
    },
    body: JSON.stringify(body),
});

export const badRequest = (message: string) => success(400, { message }, '');