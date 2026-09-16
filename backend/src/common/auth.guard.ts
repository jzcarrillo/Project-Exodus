import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
  Optional,
} from '@nestjs/common';
import { UserIdentity } from './types';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Optional() private readonly authService?: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = await this.resolveUser(req);
    if (!user) {
      throw new UnauthorizedException('Sign in to save and manage your applications.');
    }
    req.user = user;
    return true;
  }

  private async resolveUser(req: any): Promise<UserIdentity> {
    // 1. Try Bearer token from Authorization header
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ') && this.authService) {
      const token = authHeader.slice(7).trim();
      const verified = await this.authService.verifyToken(token);
      if (verified) {
        return verified;
      }
    }

    // 2. Read from custom header or mock headers
    const headerEmail = req.headers['x-user-email'] || req.headers['x-mock-email'];
    const headerRole = req.headers['x-user-role'];
    const headerName = req.headers['x-user-name'];

    const reviewerEmails = (process.env.BI_REVIEWER_EMAILS || 'reviewer@bi.gov.ph,officer@bi.gov.ph')
      .split(',')
      .map((e) => e.trim().toLowerCase());

    if (headerEmail) {
      const email = headerEmail.toString().toLowerCase();
      const role: 'applicant' | 'reviewer' =
        headerRole === 'reviewer' || reviewerEmails.includes(email) ? 'reviewer' : 'applicant';
      const displayName = (headerName || (role === 'reviewer' ? 'Immigration Officer' : 'Applicant User')).toString();

      return {
        userId: email,
        email,
        displayName,
        role,
      };
    }

    return null;
  }
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserIdentity => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
