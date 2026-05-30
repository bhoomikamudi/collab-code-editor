import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";

import { JWT_EXPIRES_IN, JWT_SECRET } from "./config";
import type { AuthenticatedUser } from "./types";

export interface TokenUser {
  id: string;
  email: string;
}

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function createToken(user: TokenUser): string {
  const signOptions: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as SignOptions["expiresIn"]
  };

  return jwt.sign(
    {
      userId: user.id,
      email: user.email
    },
    JWT_SECRET as jwt.Secret,
    signOptions
  );
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void | Response {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Authorization token is required"
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      error: "Authorization token is required"
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      JWT_SECRET as jwt.Secret
    ) as AuthenticatedUser;

    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({
      error: "Invalid or expired token"
    });
  }
}
