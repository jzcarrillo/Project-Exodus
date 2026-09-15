import { Global, Module } from '@nestjs/common';
import { DynamoDBService } from './dynamodb.service';
import { S3Service } from './s3.service';
import { CognitoService } from './cognito.service';

@Global()
@Module({
  providers: [DynamoDBService, S3Service, CognitoService],
  exports: [DynamoDBService, S3Service, CognitoService],
})
export class AwsModule {}
