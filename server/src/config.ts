/** Auth-related environment configuration (migrated from inline auth.js constants). */
export const JWT_SECRET = process.env.JWT_SECRET;

export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
