import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DynamoDBService } from '../aws/dynamodb.service';
import { DatabaseService } from '../database/database.service';
import { CognitoService } from '../aws/cognito.service';
import { SignUpDto, LoginDto, ConfirmSignUpDto, ResendCodeDto } from './auth.dto';
import { UserIdentity } from '../common/types';

const TOKEN_SECRET = process.env.JWT_SECRET || 'bi-eservices-secure-auth-secret-key-2026';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private isDynamo: boolean;

  constructor(
    private readonly ddb: DynamoDBService,
    private readonly db: DatabaseService,
    private readonly cognito: CognitoService,
  ) {
    this.isDynamo = (process.env.DB_PROVIDER || 'dynamodb') === 'dynamodb';
  }

  async onModuleInit() {
    await this.seedDemoUsers();
  }

  // --- Password Hashing with Scrypt (Local fallback) ---
  hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const s = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, s, 64).toString('hex');
    return { hash, salt: s };
  }

  verifyPassword(password: string, hash: string, salt: string): boolean {
    const checkHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(checkHash, 'hex'));
  }

  // --- Token Creation & Verification ---
  createToken(user: { email: string; role: 'applicant' | 'reviewer'; displayName: string }): string {
    const payload = {
      email: user.email.toLowerCase(),
      role: user.role,
      displayName: user.displayName,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(encodedPayload)
      .digest('base64url');
    return `${encodedPayload}.${signature}`;
  }

  async verifyToken(token: string): Promise<UserIdentity | null> {
    // 1. Try AWS Cognito Token Verification
    if (this.cognito.enabled) {
      const cognitoUser = await this.cognito.verifyToken(token);
      if (cognitoUser) {
        return cognitoUser;
      }
    }

    // 2. Try Local Signed Token Verification
    try {
      const parts = token.split('.');
      if (parts.length === 2) {
        const [encodedPayload, signature] = parts;
        const expectedSignature = crypto
          .createHmac('sha256', TOKEN_SECRET)
          .update(encodedPayload)
          .digest('base64url');

        if (signature === expectedSignature) {
          const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'));
          if (!payload.exp || Date.now() <= payload.exp) {
            return {
              userId: payload.email,
              email: payload.email,
              displayName: payload.displayName,
              role: payload.role,
            };
          }
        }
      }
    } catch {
      // ignore
    }

    return null;
  }

  // --- User Repository Access (DynamoDB or SQLite) ---
  async findUserByEmail(email: string): Promise<any | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (this.isDynamo) {
      return this.ddb.getUser(cleanEmail);
    } else {
      const row: any = this.db.instance
        .prepare('SELECT * FROM users WHERE email = ?')
        .get(cleanEmail);
      return row || null;
    }
  }

  async saveUser(user: any): Promise<void> {
    const cleanEmail = user.email.trim().toLowerCase();
    const item = {
      ...user,
      email: cleanEmail,
      updatedAt: new Date().toISOString(),
    };

    if (this.isDynamo) {
      await this.ddb.saveUser(item);
    } else {
      this.db.instance
        .prepare(`
          INSERT INTO users (email, passwordHash, salt, firstName, lastName, middleName, displayName, role, contactNumber, createdAt, updatedAt)
          VALUES (@email, @passwordHash, @salt, @firstName, @lastName, @middleName, @displayName, @role, @contactNumber, @createdAt, @updatedAt)
          ON CONFLICT(email) DO UPDATE SET
            passwordHash=excluded.passwordHash,
            salt=excluded.salt,
            firstName=excluded.firstName,
            lastName=excluded.lastName,
            middleName=excluded.middleName,
            displayName=excluded.displayName,
            role=excluded.role,
            contactNumber=excluded.contactNumber,
            updatedAt=excluded.updatedAt
        `)
        .run(item);
    }
  }

  // --- Sign Up (Cognito + Local Persistence) ---
  async signUp(dto: SignUpDto) {
    if (!dto.email || !dto.email.includes('@')) {
      throw new BadRequestException('A valid email address is required.');
    }
    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters long.');
    }
    if (!dto.firstName || !dto.lastName) {
      throw new BadRequestException('First name and Last name are required.');
    }

    const cleanEmail = dto.email.trim().toLowerCase();
    const reviewerEmails = (process.env.BI_REVIEWER_EMAILS || 'reviewer@bi.gov.ph,officer@bi.gov.ph')
      .split(',')
      .map((e) => e.trim().toLowerCase());

    const role: 'applicant' | 'reviewer' =
      dto.role === 'reviewer' || reviewerEmails.includes(cleanEmail) ? 'reviewer' : 'applicant';

    const displayName = `${dto.firstName.trim()} ${dto.lastName.trim()}`;
    const now = new Date().toISOString();

    // 1. If Cognito is enabled, register with AWS Cognito
    if (this.cognito.enabled) {
      try {
        const cognitoResult = await this.cognito.signUp({
          email: cleanEmail,
          password: dto.password,
          firstName: dto.firstName,
          lastName: dto.lastName,
          contactNumber: dto.contactNumber,
          role,
        });

        // Save profile record in DynamoDB
        if (this.isDynamo) {
          await this.ddb.saveProfile(
            cleanEmail,
            {
              firstName: dto.firstName.trim(),
              lastName: dto.lastName.trim(),
              middleName: dto.middleName?.trim() || '',
              email: cleanEmail,
              mobile: dto.contactNumber?.trim() || '',
            },
            now,
          );
        }

        if (!cognitoResult.userConfirmed) {
          return {
            requiresConfirmation: true,
            token: '',
            user: {
              userId: cleanEmail,
              email: cleanEmail,
              displayName,
              firstName: dto.firstName.trim(),
              lastName: dto.lastName.trim(),
              role,
              contactNumber: dto.contactNumber?.trim() || '',
            },
          };
        }

        // Auto-sign in if confirmed
        const authResult = await this.cognito.signIn(cleanEmail, dto.password);
        return {
          token: authResult.idToken,
          user: {
            userId: cleanEmail,
            email: cleanEmail,
            displayName,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            role,
            contactNumber: dto.contactNumber?.trim() || '',
          },
        };
      } catch (err: any) {
        this.logger.error(`Cognito sign up error: ${err.message}`);
        if (err.name === 'UsernameExistsException') {
          throw new ConflictException('An account with this email address already exists.');
        }
        throw new BadRequestException(err.message || 'Cognito account registration failed.');
      }
    }

    // 2. Local Fallback Sign Up
    const existing = await this.findUserByEmail(cleanEmail);
    if (existing) {
      throw new ConflictException('An account with this email address already exists.');
    }

    const { hash, salt } = this.hashPassword(dto.password);
    const newUser = {
      email: cleanEmail,
      passwordHash: hash,
      salt,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      middleName: dto.middleName?.trim() || '',
      displayName,
      role,
      contactNumber: dto.contactNumber?.trim() || '',
      createdAt: now,
      updatedAt: now,
    };

    await this.saveUser(newUser);

    if (this.isDynamo) {
      await this.ddb.saveProfile(
        cleanEmail,
        {
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          middleName: newUser.middleName,
          email: cleanEmail,
          mobile: newUser.contactNumber,
        },
        now,
      );
    }

    const token = this.createToken({
      email: cleanEmail,
      role,
      displayName,
    });

    this.logger.log(`Created new account for ${cleanEmail} (${role})`);

    return {
      token,
      user: {
        userId: cleanEmail,
        email: cleanEmail,
        displayName,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role,
        contactNumber: newUser.contactNumber,
      },
    };
  }

  // --- Confirm Sign Up (Cognito) ---
  async confirmSignUp(dto: ConfirmSignUpDto) {
    if (!this.cognito.enabled) {
      return { success: true, message: 'Account confirmed.' };
    }
    try {
      await this.cognito.confirmSignUp(dto.email, dto.code);
      return { success: true, message: 'Email address confirmed successfully! You can now sign in.' };
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Invalid or expired confirmation code.');
    }
  }

  // --- Resend Code (Cognito) ---
  async resendCode(dto: ResendCodeDto) {
    if (!this.cognito.enabled) {
      return { success: true, message: 'Verification code sent.' };
    }
    try {
      await this.cognito.resendCode(dto.email);
      return { success: true, message: 'Verification code resent to your email.' };
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Failed to resend confirmation code.');
    }
  }

  // --- Sign In / Login ---
  async login(dto: LoginDto) {
    if (!dto.email || !dto.password) {
      throw new BadRequestException('Email and password are required.');
    }

    const cleanEmail = dto.email.trim().toLowerCase();

    // 1. Try AWS Cognito Login if enabled
    if (this.cognito.enabled) {
      try {
        const authResult = await this.cognito.signIn(cleanEmail, dto.password);
        const profile = this.isDynamo ? await this.ddb.getProfile(cleanEmail) : {};
        const reviewerEmails = (process.env.BI_REVIEWER_EMAILS || 'reviewer@bi.gov.ph,officer@bi.gov.ph')
          .split(',')
          .map((e) => e.trim().toLowerCase());
        const role: 'applicant' | 'reviewer' = reviewerEmails.includes(cleanEmail) ? 'reviewer' : 'applicant';

        return {
          token: authResult.idToken,
          user: {
            userId: cleanEmail,
            email: cleanEmail,
            displayName: profile?.firstName ? `${profile.firstName} ${profile.lastName || ''}`.trim() : cleanEmail,
            firstName: profile?.firstName,
            lastName: profile?.lastName,
            role,
            contactNumber: profile?.mobile,
          },
        };
      } catch (err: any) {
        if (err.name === 'UserNotConfirmedException') {
          return {
            requiresConfirmation: true,
            token: '',
            user: {
              userId: cleanEmail,
              email: cleanEmail,
              displayName: cleanEmail,
              role: 'applicant' as const,
            },
          };
        }
        this.logger.warn(`Cognito login failed for ${cleanEmail}: ${err.message}`);
        // Fallback to local user check if user exists locally
      }
    }

    // 2. Local Fallback Login
    const user = await this.findUserByEmail(cleanEmail);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isValid = this.verifyPassword(dto.password, user.passwordHash, user.salt);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const token = this.createToken({
      email: cleanEmail,
      role: user.role,
      displayName: user.displayName || user.email,
    });

    this.logger.log(`User logged in: ${cleanEmail} (${user.role})`);

    return {
      token,
      user: {
        userId: cleanEmail,
        email: cleanEmail,
        displayName: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || cleanEmail,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        contactNumber: user.contactNumber,
      },
    };
  }

  // --- Demo Seeding ---
  private async seedDemoUsers() {
    const defaultAccounts = [
      {
        email: 'officer@bi.gov.ph',
        password: 'Officer@1234',
        firstName: 'Immigration',
        lastName: 'Officer',
        displayName: 'Immigration Officer (BIIS)',
        role: 'reviewer' as const,
        contactNumber: '+63 2 8465 2400',
      },
      {
        email: 'applicant@example.com',
        password: 'Applicant@1234',
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        displayName: 'Juan Dela Cruz',
        role: 'applicant' as const,
        contactNumber: '+63 917 123 4567',
      },
      {
        email: 'seedy@sites.test',
        password: 'Seedy@1234',
        firstName: 'Seedy',
        lastName: 'Applicant',
        displayName: 'Seedy Applicant',
        role: 'applicant' as const,
        contactNumber: '+63 918 765 4321',
      },
    ];

    for (const acc of defaultAccounts) {
      try {
        const existing = await this.findUserByEmail(acc.email);
        if (!existing) {
          const { hash, salt } = this.hashPassword(acc.password);
          const now = new Date().toISOString();
          await this.saveUser({
            email: acc.email,
            passwordHash: hash,
            salt,
            firstName: acc.firstName,
            lastName: acc.lastName,
            middleName: '',
            displayName: acc.displayName,
            role: acc.role,
            contactNumber: acc.contactNumber,
            createdAt: now,
            updatedAt: now,
          });
          this.logger.log(`✓ Seeded default demo account: ${acc.email} (${acc.role})`);
        }

        // If Cognito is active, ensure demo users are confirmed in Cognito pool as well
        if (this.cognito.enabled) {
          try {
            await this.cognito.signUp({
              email: acc.email,
              password: acc.password,
              firstName: acc.firstName,
              lastName: acc.lastName,
              contactNumber: acc.contactNumber,
              role: acc.role,
            });
            await this.cognito.adminConfirmUser(acc.email);
          } catch {}
        }
      } catch (err: any) {
        this.logger.warn(`Could not seed demo account ${acc.email}: ${err.message}`);
      }
    }
  }
}
