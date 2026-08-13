import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JobsService } from './jobs.service';
import { CreateJobDto, UpdateJobDto, JobQueryDto } from './dto/job.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Public()
  @Get()
  findAll(@Query() query: JobQueryDto) {
    return this.jobsService.findAll(query);
  }

  @Public()
  @Get('nearby')
  findNearby(@Query() query: JobQueryDto) {
    return this.jobsService.findAll(query);
  }

  @ApiBearerAuth()
  @Roles(UserRole.EMPLOYER)
  @Get('my/list')
  findMyJobs(@CurrentUser('id') userId: string) {
    return this.jobsService.findEmployerJobs(userId);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @ApiBearerAuth()
  @Roles(UserRole.EMPLOYER)
  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateJobDto) {
    return this.jobsService.create(userId, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.EMPLOYER)
  @Patch(':id')
  update(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: UpdateJobDto) {
    return this.jobsService.update(userId, id, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.EMPLOYER)
  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.jobsService.remove(userId, id);
  }
}
