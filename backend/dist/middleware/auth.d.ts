import { Request, Response, NextFunction } from 'express';
export interface AuthPayload {
    userId: string;
    staffId: string;
    role: string;
    teamLeadId?: string;
}
export interface AuthRequest extends Request {
    user?: AuthPayload;
}
export declare function authenticate(req: AuthRequest, res: Response, next: NextFunction): void;
export declare function requireRole(...roles: string[]): (req: AuthRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map