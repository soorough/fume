import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '../config';

export const sql = postgres(env.DATABASE_URL, { max: 5 });
export const db = drizzle(sql);
