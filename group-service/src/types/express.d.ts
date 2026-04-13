import 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      accessToken?: string;
      userLabel?: string;
    }
  }
}

export {};
