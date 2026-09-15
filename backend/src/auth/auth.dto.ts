import { ApiProperty } from '@nestjs/swagger';

export class SignUpDto {
  @ApiProperty({ example: 'applicant@example.com', description: 'User official email address' })
  email: string;

  @ApiProperty({ example: 'Password123!', description: 'Strong account password (minimum 6 characters)' })
  password: string;

  @ApiProperty({ example: 'Juan', description: 'First name' })
  firstName: string;

  @ApiProperty({ example: 'Dela Cruz', description: 'Last name' })
  lastName: string;

  @ApiProperty({ example: 'Santos', required: false, description: 'Middle name' })
  middleName?: string;

  @ApiProperty({ example: '+639171234567', required: false, description: 'Mobile contact number' })
  contactNumber?: string;

  @ApiProperty({ example: 'applicant', enum: ['applicant', 'reviewer'], required: false, description: 'Account role' })
  role?: 'applicant' | 'reviewer';
}

export class LoginDto {
  @ApiProperty({ example: 'applicant@example.com', description: 'User account email address' })
  email: string;

  @ApiProperty({ example: 'Password123!', description: 'Account password' })
  password: string;
}

export class ConfirmSignUpDto {
  @ApiProperty({ example: 'applicant@example.com', description: 'User email address' })
  email: string;

  @ApiProperty({ example: '123456', description: '6-digit verification code from email' })
  code: string;
}

export class ResendCodeDto {
  @ApiProperty({ example: 'applicant@example.com', description: 'User email address' })
  email: string;
}

export class AuthResponseDto {
  @ApiProperty()
  token: string;

  @ApiProperty({ required: false })
  requiresConfirmation?: boolean;

  @ApiProperty()
  user: {
    userId: string;
    email: string;
    displayName: string;
    firstName?: string;
    lastName?: string;
    role: 'applicant' | 'reviewer';
    contactNumber?: string;
  };
}
