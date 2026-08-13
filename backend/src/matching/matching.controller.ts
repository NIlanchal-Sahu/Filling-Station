import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { MatchingService } from './matching.service';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('matching')
@ApiBearerAuth()
@Controller('matching')
export class MatchingController {
  constructor(
    private matching: MatchingService,
    private prisma: PrismaService,
  ) {}

  @Roles(UserRole.EMPLOYER)
  @Get('job/:jobId')
  async topCandidates(@Param('jobId') jobId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    const applications = await this.prisma.application.findMany({
      where: { jobId },
      include: { student: true },
      orderBy: { matchScore: 'desc' },
      take: 20,
    });

    return applications.map((app) => ({
      applicationId: app.id,
      student: app.student,
      matchScore: app.matchScore ?? this.matching.calculateMatchScore({
        studentSkills: app.student.skills,
        studentEducation: app.student.education,
        studentExperience: app.student.experience,
        studentLat: app.student.latitude,
        studentLng: app.student.longitude,
        jobSkills: job?.requiredSkills || [],
        jobEducation: job?.educationRequirement,
        jobExperience: job?.experienceRequired,
        jobLat: job?.latitude,
        jobLng: job?.longitude,
      }),
      status: app.status,
    }));
  }

  @Roles(UserRole.STUDENT)
  @Get('student/recommendations')
  async recommendations(@CurrentUser('id') userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) return [];

    const jobs = await this.prisma.job.findMany({
      where: { isActive: true, isApproved: true },
      include: { employer: { select: { businessName: true, logoUrl: true } } },
      take: 50,
    });

    return jobs
      .map((job) => ({
        job,
        matchScore: this.matching.calculateMatchScore({
          studentSkills: student.skills,
          studentEducation: student.education,
          studentExperience: student.experience,
          studentLat: student.latitude,
          studentLng: student.longitude,
          jobSkills: job.requiredSkills,
          jobEducation: job.educationRequirement,
          jobExperience: job.experienceRequired,
          jobLat: job.latitude,
          jobLng: job.longitude,
        }),
      }))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);
  }
}
