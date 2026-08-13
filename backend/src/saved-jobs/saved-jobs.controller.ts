import { Controller, Get, Post, Delete, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('saved-jobs')
@ApiBearerAuth()
@Roles(UserRole.STUDENT)
@Controller('saved-jobs')
export class SavedJobsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser('id') userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) return [];

    return this.prisma.savedJob.findMany({
      where: { studentId: student.id },
      include: {
        job: { include: { employer: { select: { businessName: true, logoUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post(':jobId')
  async save(@CurrentUser('id') userId: string, @Param('jobId') jobId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) throw new Error('Student profile required');

    return this.prisma.savedJob.upsert({
      where: { studentId_jobId: { studentId: student.id, jobId } },
      create: { studentId: student.id, jobId },
      update: {},
    });
  }

  @Delete(':jobId')
  async unsave(@CurrentUser('id') userId: string, @Param('jobId') jobId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) return { message: 'Removed' };

    await this.prisma.savedJob.deleteMany({ where: { studentId: student.id, jobId } });
    return { message: 'Removed' };
  }
}
