import { Hono } from 'hono';
import { userRouter } from "./routes/user";
import { cors } from 'hono/cors';


const app = new Hono();

app.use('*', cors());

app.route("/api/v1/user", userRouter);

app.get('/', (c) => {
  return c.text('Copyright 2025 Sanskar Chirania. All rights reserved.')
})

export default app
