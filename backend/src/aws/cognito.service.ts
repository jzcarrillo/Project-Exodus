import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  AdminConfirmSignUpCommand,
  AdminUpdateUserAttributesCommand,
  GetUserCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { UserIdentity } from '../common/types';

@Injectable()
export class CognitoService implements OnModuleInit {
  private readonly logger = new Logger(CognitoService.name);
  private client: CognitoIdentityProviderClient;
  private userPoolId: string;
  private clientId: string;
  private region: string;
  private isConfigured = false;
  private idTokenVerifier: any = null;

  onModuleInit() {
    this.region = process.env.COGNITO_REGION || process.env.AWS_REGION || 'ap-southeast-1';
    this.userPoolId = process.env.COGNITO_USER_POOL_ID || '';
    this.clientId = process.env.COGNITO_CLIENT_ID || '';

    const clientConfig: any = { region: this.region };
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }
    if (process.env.COGNITO_ENDPOINT) {
      clientConfig.endpoint = process.env.COGNITO_ENDPOINT;
    }

    this.client = new CognitoIdentityProviderClient(clientConfig);

    if (this.userPoolId && this.clientId) {
      this.isConfigured = true;
      this.logger.log(
        `AWS Cognito service initialized for pool '${this.userPoolId}' in region '${this.region}'`,
      );

      try {
        this.idTokenVerifier = CognitoJwtVerifier.create({
          userPoolId: this.userPoolId,
          tokenUse: 'id',
          clientId: this.clientId,
        });
      } catch (e: any) {
        this.logger.warn(`Could not initialize Cognito JWT verifier: ${e.message}`);
      }
    } else {
      this.logger.log('AWS Cognito not fully configured. Operating in hybrid/local fallback mode.');
    }
  }

  get enabled(): boolean {
    return this.isConfigured;
  }

  // --- 1. Sign Up in Cognito ---
  async signUp(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    contactNumber?: string;
    role?: 'applicant' | 'reviewer';
  }): Promise<{ userSub: string; userConfirmed: boolean }> {
    const cleanEmail = params.email.trim().toLowerCase();
    const attributes = [
      { Name: 'email', Value: cleanEmail },
      { Name: 'given_name', Value: params.firstName.trim() },
      { Name: 'family_name', Value: params.lastName.trim() },
    ];

    if (params.contactNumber) {
      attributes.push({ Name: 'phone_number', Value: params.contactNumber.trim() });
    }

    const command = new SignUpCommand({
      ClientId: this.clientId,
      Username: cleanEmail,
      Password: params.password,
      UserAttributes: attributes,
    });

    const response = await this.client.send(command);
    return {
      userSub: response.UserSub || cleanEmail,
      userConfirmed: response.UserConfirmed || false,
    };
  }

  // --- 2. Confirm Sign Up with Verification Code ---
  async confirmSignUp(email: string, code: string): Promise<boolean> {
    const command = new ConfirmSignUpCommand({
      ClientId: this.clientId,
      Username: email.trim().toLowerCase(),
      ConfirmationCode: code.trim(),
    });
    await this.client.send(command);
    return true;
  }

  // --- 3. Resend Confirmation Code ---
  async resendCode(email: string): Promise<void> {
    const command = new ResendConfirmationCodeCommand({
      ClientId: this.clientId,
      Username: email.trim().toLowerCase(),
    });
    await this.client.send(command);
  }

  // --- 4. Admin Auto-Confirm (Useful for dev / seeded users) ---
  async adminConfirmUser(email: string): Promise<void> {
    if (!this.userPoolId) return;
    try {
      await this.client.send(
        new AdminConfirmSignUpCommand({
          UserPoolId: this.userPoolId,
          Username: email.trim().toLowerCase(),
        }),
      );
    } catch (e: any) {
      this.logger.debug(`adminConfirmUser note: ${e.message}`);
    }
  }

  // --- 5. Sign In / Initiate Auth ---
  async signIn(email: string, password: string): Promise<{
    idToken: string;
    accessToken: string;
    refreshToken?: string;
  }> {
    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: this.clientId,
      AuthParameters: {
        USERNAME: email.trim().toLowerCase(),
        PASSWORD: password,
      },
    });

    const response = await this.client.send(command);
    if (!response.AuthenticationResult?.IdToken) {
      throw new Error('Authentication challenge required or invalid credentials.');
    }

    return {
      idToken: response.AuthenticationResult.IdToken,
      accessToken: response.AuthenticationResult.AccessToken || '',
      refreshToken: response.AuthenticationResult.RefreshToken,
    };
  }

  // --- 6. Verify Cognito JWT Token ---
  async verifyToken(token: string): Promise<UserIdentity | null> {
    if (!this.isConfigured) return null;

    try {
      if (this.idTokenVerifier) {
        const payload = await this.idTokenVerifier.verify(token);
        const email = (payload.email || payload['cognito:username'] || '').toString().toLowerCase();
        const givenName = payload.given_name || '';
        const familyName = payload.family_name || '';
        const displayName = `${givenName} ${familyName}`.trim() || email;

        const reviewerEmails = (process.env.BI_REVIEWER_EMAILS || 'reviewer@bi.gov.ph,officer@bi.gov.ph')
          .split(',')
          .map((e) => e.trim().toLowerCase());

        const role: 'applicant' | 'reviewer' =
          payload['custom:role'] === 'reviewer' || reviewerEmails.includes(email)
            ? 'reviewer'
            : 'applicant';

        return {
          userId: email,
          email,
          displayName,
          role,
        };
      }

      // Fallback: parse unverified payload safely
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
        const email = (payload.email || payload['cognito:username'] || '').toString().toLowerCase();
        if (email) {
          const reviewerEmails = (process.env.BI_REVIEWER_EMAILS || 'reviewer@bi.gov.ph,officer@bi.gov.ph')
            .split(',')
            .map((e) => e.trim().toLowerCase());
          const role: 'applicant' | 'reviewer' = reviewerEmails.includes(email) ? 'reviewer' : 'applicant';
          return {
            userId: email,
            email,
            displayName: `${payload.given_name || ''} ${payload.family_name || ''}`.trim() || email,
            role,
          };
        }
      }
      return null;
    } catch (e: any) {
      this.logger.debug(`Cognito token verify failed: ${e.message}`);
      return null;
    }
  }
}
