import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class PortalActionDto {
  @ApiProperty({ description: 'Action type: save, submit, profile, read, review, pay' })
  @IsNotEmpty()
  @IsString()
  action: 'save' | 'submit' | 'profile' | 'read' | 'review' | 'pay';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  service?: string;

  @ApiPropertyOptional()
  @IsOptional()
  data?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  version?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channel?: string;
}

export class PayApplicationDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channel?: string;
}

export class SaveDraftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  service: string;

  @ApiProperty()
  @IsNotEmpty()
  data: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  version?: number;
}

export class SubmitApplicationDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  id: string;
}

export class UpdateProfileDto {
  @ApiProperty()
  @IsNotEmpty()
  data: Record<string, string>;
}

export class ReviewActionDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  id: string;

  @ApiProperty({ enum: ['Under review', 'For correction', 'Approved', 'Disapproved', 'Endorsed'] })
  @IsNotEmpty()
  @IsString()
  status: 'Under review' | 'For correction' | 'Approved' | 'Disapproved' | 'Endorsed';

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  note: string;
}
