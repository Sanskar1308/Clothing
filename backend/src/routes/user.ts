import { Hono } from "hono";
import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';
import crypto from 'crypto';
import { signupinput, signininput } from "@sanskar1308/clothing";

function getPrismaClient(databaseUrl: string) {
    const prisma = new PrismaClient({
        datasourceUrl: databaseUrl,
    }).$extends(withAccelerate());

    return prisma;
}


// Configuration
const ITERATIONS = 100000;
const HASH_LENGTH = 32;
const SALT_LENGTH = 16;

// Format: $hash$salt
const SEPARATOR = '$';

async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    const key = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveBits']
    );

    const params = {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: salt,
        iterations: ITERATIONS
    };

    const derivedKey = await crypto.subtle.deriveBits(
        params,
        key,
        HASH_LENGTH * 8
    );

    // Combine hash and salt with separator
    const hashBase64 = Buffer.from(derivedKey).toString('base64');
    const saltBase64 = Buffer.from(salt).toString('base64');

    // Return combined string: $hash$salt
    return `${hashBase64}${SEPARATOR}${saltBase64}`;
}

async function verifyPassword(inputPassword: string, storedValue: string): Promise<boolean> {
    // Split the stored value into hash and salt
    const [storedHash, storedSaltBase64] = storedValue.split(SEPARATOR);

    if (!storedHash || !storedSaltBase64) {
        console.log("here bay")
        return false;
    }

    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(inputPassword);
    const salt = Buffer.from(storedSaltBase64, 'base64');

    const key = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveBits']
    );

    const params = {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: salt,
        iterations: ITERATIONS
    };

    const derivedKey = await crypto.subtle.deriveBits(
        params,
        key,
        HASH_LENGTH * 8
    );

    const inputHash = Buffer.from(derivedKey).toString('base64');
    console.log(inputPassword)
    console.log(storedValue)
    return inputHash === storedHash;
}

type Bindings = {
    DATABASE_URL: string;
    JWT_SECRET: string;
}

export const userRouter = new Hono<{
    Bindings: Bindings;
}>();

userRouter.post('/signup', async (c) => {
    const body = await c.req.json();
    const prisma = getPrismaClient(c.env.DATABASE_URL);

    const response = signupinput.safeParse(body);
    if(!response.success){
      c.status(411);
      return c.json({
        message: "Wrong input",
        error: response
      })
    }

    try {
        // Store the combined hash+salt string
        const hashedPassword = await hashPassword(body.password);

        const user = await prisma.user.create({
            data: {
                name: body.name,
                email: body.email,
                password: hashedPassword // Contains both hash and salt
            }
        });

        c.status(201);
        return c.json({
            message: "User created successfully",
            userId: user.id
        });
    } catch (error) {
        console.error('Signup error:', error);
        c.status(500);
        return c.json({ error: "Error creating user" });
    }
});

userRouter.post('/login', async (c) => {
    const body = await c.req.json();
    const prisma = getPrismaClient(c.env.DATABASE_URL);

    const response = signininput.safeParse(body);
    if(!response.success){
        c.status(411);
        return c.json({
            message: "Wrong input",
            error: response
        })
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: body.email }
        });

        if (!user) {
            // Prevent timing attacks
            await verifyPassword('dummy', 'dummyHash$dummySalt');
            c.status(401);
            return c.json({ error: "Invalid credentials" });
        }

        const isValid = await verifyPassword(body.password, user.password);

        if (!isValid) {
            c.status(401);
            return c.json({ error: "Invalid credentials" });
        }

        const { password: _, ...userData } = user;

        c.status(200);
        return c.json({
            message: "Login successful",
            user: userData
        });
    } catch (error) {
        console.error('Login error:', error);
        c.status(500);
        return c.json({ error: "Error during login" });
    }
});