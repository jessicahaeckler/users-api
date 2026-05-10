export interface Parsed {
    name: string;
    email: string;
}

export function validateUserInput(parsed: Parsed) {
    const { name, email } = parsed;

    if (!name || !email) {
        return 'name and email required';
    }

    const emailRegex = /\S+@\S+\.\S+/;

    if (!emailRegex.test(email)) {
        return 'Invalid email format';
    }

    return null;
}