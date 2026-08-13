import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApplicationStatus } from '@prisma/client';

export class CreateApplicationDto {
  @IsString() jobId: string;
  @IsOptional() @IsString() coverLetter?: string;
}

export class UpdateApplicationStatusDto {
  @IsEnum(ApplicationStatus) status: ApplicationStatus;
  @IsOptional() @IsDateString() interviewAt?: string;
  @IsOptional() @IsString() interviewNotes?: string;
}
