import { IsOptional, IsString, IsInt, Min, IsEnum, IsBoolean, IsArray, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { JobType, WorkMode, Gender } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class JobQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsEnum(JobType) jobType?: JobType;
  @IsOptional() @IsEnum(WorkMode) workMode?: WorkMode;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @Type(() => Number) @IsInt() minSalary?: number;
  @IsOptional() @Type(() => Number) @IsInt() maxSalary?: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean() freshersOnly?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() remote?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() lat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() lng?: number;
  @IsOptional() @Type(() => Number) @IsNumber() radius?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 20;
}

export class CreateJobDto {
  @IsString() title: string;
  @IsString() category: string;
  @IsEnum(JobType) jobType: JobType;
  @IsOptional() @IsInt() salaryMin?: number;
  @IsOptional() @IsInt() salaryMax?: number;
  @IsOptional() @IsBoolean() isHourly?: boolean;
  @IsOptional() @IsNumber() hourlyRate?: number;
  @IsOptional() @IsInt() openings?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) requiredSkills?: string[];
  @IsOptional() @IsString() educationRequirement?: string;
  @IsOptional() @IsString() experienceRequired?: string;
  @IsOptional() @IsInt() minAge?: number;
  @IsOptional() @IsEnum(Gender) genderPreference?: Gender;
  @IsString() city: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsEnum(WorkMode) workMode: WorkMode;
  @IsString() description: string;
  @IsOptional() @IsDateString() applicationDeadline?: string;
  @IsOptional() @IsBoolean() freshersOnly?: boolean;
}

export class UpdateJobDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsEnum(JobType) jobType?: JobType;
  @IsOptional() @IsInt() salaryMin?: number;
  @IsOptional() @IsInt() salaryMax?: number;
  @IsOptional() @IsBoolean() isHourly?: boolean;
  @IsOptional() @IsNumber() hourlyRate?: number;
  @IsOptional() @IsInt() openings?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) requiredSkills?: string[];
  @IsOptional() @IsString() educationRequirement?: string;
  @IsOptional() @IsString() experienceRequired?: string;
  @IsOptional() @IsInt() minAge?: number;
  @IsOptional() @IsEnum(Gender) genderPreference?: Gender;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsEnum(WorkMode) workMode?: WorkMode;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() applicationDeadline?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() freshersOnly?: boolean;
}
