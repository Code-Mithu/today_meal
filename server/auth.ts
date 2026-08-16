import { betterAuth } from 'better-auth';
import { pool } from './db';

const baseURL = process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;

export const auth = betterAuth({
  database: pool,
  baseURL,
  emailAndPassword: { enabled: true },
  trustedOrigins: [
    baseURL,
    ...(process.env.EXPO_PUBLIC_API_URL ? [process.env.EXPO_PUBLIC_API_URL] : []),
  ],
});
