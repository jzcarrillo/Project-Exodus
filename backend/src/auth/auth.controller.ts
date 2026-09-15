import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignUpDto, LoginDto, ConfirmSignUpDto, ResendCodeDto, AuthResponseDto } from './auth.dto';
import { AuthGuard, CurrentUser } from '../common/auth.guard';
import { UserIdentity } from '../common/types';

@ApiTags('Authentication & Account Management')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Register a new applicant or officer account' })
  async signUp(@Body() dto: SignUpDto): Promise<AuthResponseDto> {
    return this.authService.signUp(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with registered email and password' })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm AWS Cognito user registration with 6-digit email code' })
  async confirm(@Body() dto: ConfirmSignUpDto) {
    return this.authService.confirmSignUp(dto);
  }

  @Post('resend-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend AWS Cognito confirmation code to user email' })
  async resendCode(@Body() dto: ResendCodeDto) {
    return this.authService.resendCode(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign out and invalidate current session' })
  async logout() {
    return { success: true, message: 'Logged out successfully.' };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get profile details of the authenticated user' })
  async me(@CurrentUser() user: UserIdentity) {
    const userRecord = await this.authService.findUserByEmail(user.email);
    return {
      user: {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        firstName: userRecord?.firstName,
        lastName: userRecord?.lastName,
        role: user.role,
        contactNumber: userRecord?.contactNumber,
      },
    };
  }
}
