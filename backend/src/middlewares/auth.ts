import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';

export async function verifyFirebaseToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = await getAuth().verifyIdToken(token);
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
