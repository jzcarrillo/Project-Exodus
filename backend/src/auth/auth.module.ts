import { Module, Global } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AwsModule } from '../aws/aws.module';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [AwsModule, DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
