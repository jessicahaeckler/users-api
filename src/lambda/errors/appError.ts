export class UserAlreadyExistsError extends Error {
    constructor() {
        super('User already exists');
        this.name = 'UserAlreadyExistsError';
    }
}

export class UserNotFoundError extends Error {
    constructor() {
        super('User not found');
        this.name = 'UserNotFoundError';
    }
}