import { Hono } from "hono";
import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';
import crypto from 'crypto';

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

userRouter.post('/signup', async(c) => {
    const body = await c.req.json();
    const prisma = getPrismaClient(c.env.DATABASE_URL);

    try {
        if (!body.password || body.password.length < 8) {
            c.status(400);
            return c.json({ error: "Password must be at least 8 characters long" });
        }

        // Store the combined hash+salt string
        const hashedPassword = await hashPassword(body.password);

        // const user = await prisma.user.create({
        //     data: {
        //         name: body.name,
        //         email: body.email,
        //         password: hashedPassword // Contains both hash and salt
        //     }
        // });

        c.status(201);
        return c.json({
            message: "User created successfully",
            hashedPassword
        });
    } catch (error) {
        console.error('Signup error:', error);
        c.status(500);
        return c.json({ error: "Error creating user" });
    }
});

userRouter.post('/login', async(c) => {
    const body = await c.req.json();
    const prisma = getPrismaClient(c.env.DATABASE_URL);

    try {
        const user = "38WiCTTsbXh6jUcUqN87OLKmQ16vExPw6NZWixdeibE=$PqxabyHeox/swW+Ge7gt2w==";

        

        const isValid = await verifyPassword(body.password, user);

        if (!isValid) {
            c.status(401);
            return c.json({ error: "Invalid credentials", isValid });
        }


        c.status(200);
        return c.json({
            message: "Login successful",
            
        });
    } catch (error) {
        console.error('Login error:', error);
        c.status(500);
        return c.json({ error: "Error during login" });
    }
});