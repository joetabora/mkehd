import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const email = req.header('x-user-email');
  if (!email) {
    return next();
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    req.user = user;
  }

  next();
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Missing or unknown x-user-email header.' });
  }
  next();
}

export function requireApprover(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.roles.includes('APPROVER')) {
    return res.status(403).json({ error: 'Approver role required.' });
  }
  next();
}
