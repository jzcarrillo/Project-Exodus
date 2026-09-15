import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AwsModule } from './aws/aws.module';
import { AuthModule } from './auth/auth.module';
import { PortalModule } from './portal/portal.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [DatabaseModule, AwsModule, AuthModule, PortalModule, DocumentsModule],
})
export class AppModule {}
