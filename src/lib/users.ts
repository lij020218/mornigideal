import { promises as fs } from 'fs';
import path from 'path';

const USERS_FILE = path.join(process.cwd(), '.cache', 'users.json');

export interface User {
    id: string;
    name: string;
    username: string;
    email: string;
    password: string; // In production, this should be hashed
    createdAt: string;
}

async function ensureFile() {
    const dir = path.dirname(USERS_FILE);
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (error) {
        // Directory already exists
    }
    try {
        await fs.access(USERS_FILE);
    } catch (error) {
        await fs.writeFile(USERS_FILE, JSON.stringify([], null, 2));
    }
}

export async function getUsers(): Promise<User[]> {
    await ensureFile();
    const data = await fs.readFile(USERS_FILE, 'utf-8');
    return JSON.parse(data);
}

export async function getUserByEmail(email: string): Promise<User | null> {
    const users = await getUsers();
    return users.find(u => u.email === email) || null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
    const users = await getUsers();
    return users.find(u => u.username === username) || null;
}

export async function createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const users = await getUsers();

    const newUser: User = {
        ...userData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));

    return newUser;
}

export async function validateUser(email: string, password: string): Promise<User | null> {
    const user = await getUserByEmail(email);
    if (!user) return null;

    // In production, compare hashed passwords
    if (user.password !== password) return null;

    return user;
}
