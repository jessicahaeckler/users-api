export function log(level: 'INFO' | 'ERROR', message: string, context: Record<string, unknown> = {}) {
    console.log(JSON.stringify({
        level,
        message,
        timestamp: new Date().toISOString(),
        ...context
    }));
}