import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole, ApplicationStatus } from '@prisma/client';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto, UpdateApplicationStatusDto } from './dto/application.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('applications')
@ApiBearerAuth()
@Controller()
export class ApplicationsController {
  constructor(private applicationsService: ApplicationsService) {}

  @Roles(UserRole.STUDENT)
  @Post('applications')
  apply(@CurrentUser('id') userId: string, @Body() dto: CreateApplicationDto) {
    return this.applicationsService.apply(userId, dto);
  }

  @Roles(UserRole.STUDENT)
  @Get('applications/my')
  myApplications(@CurrentUser('id') userId: string) {
    return this.applicationsService.getMyApplications(userId);
  }

  @Roles(UserRole.EMPLOYER)
  @Get('jobs/:jobId/applications')
  jobApplications(
    @CurrentUser('id') userId: string,
    @Param('jobId') jobId: string,
    @Query('status') status?: ApplicationStatus,
    @Query('search') search?: string,
  ) {
    return this.applicationsService.getJobApplications(userId, jobId, status, search);
  }

  @Roles(UserRole.EMPLOYER)
  @Patch('applications/:id/status')
  updateStatus(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.applicationsService.updateStatus(userId, id, dto);
  }

  @Roles(UserRole.EMPLOYER)
  @Get('employers/dashboard')
  dashboard(@CurrentUser('id') userId: string) {
    return this.applicationsService.getEmployerDashboard(userId);
  }
}
