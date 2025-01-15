import z from "zod";

export const signupinput = z.object({
    name: z.string(),
    email: z.string().email(),
    password: z.string().min(8),
    // phone: z.number().optional()
});

export type SignupType = z.infer<typeof signupinput>;

export const signininput = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    // phone: z.number().optional()
});

export type SigninType = z.infer<typeof signininput>;