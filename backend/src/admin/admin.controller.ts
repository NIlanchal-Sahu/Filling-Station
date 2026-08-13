import { Controller, Get, Patch, Delete, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private prisma: PrismaService) {}

  @Get('analytics')
  async analytics() {
    const [users, employers, jobs, applications] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.EMPLOYER } }),
      this.prisma.job.count(),
      this.prisma.application.count(),
    ]);

    const premiumEmployers = await this.prisma.subscription.count({
      where: { plan: 'PREMIUM_EMPLOYER' },
    });
    const premiumStudents = await this.prisma.subscription.count({
      where: { plan: 'PREMIUM_STUDENT' },
    });

    return {
      totalUsers: users,
      totalEmployers: employers,
      totalStudents: users - employers,
      totalJobs: jobs,
      totalApplications: applications,
      revenue: {
        premiumEmployers,
        premiumStudents,
        estimatedMRR: premiumEmployers * 999 + premiumStudents * 299,
      },
    };
  }

  @Get('users')
  users(@Query('page') page = '1', @Query('limit') limit = '20') {
    const p = parseInt(page, 10);
    const l = parseInt(limit, 10);
    return this.prisma.user.findMany({
      skip: (p - 1) * l,
      take: l,
      select: {
        id: true,
        email: true,
        role: true,
        isSuspended: true,
        createdAt: true,
        employerProfile: { select: { businessName: true, isVerified: true } },
        studentProfile: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Patch('users/:id/suspend')
  suspendUser(@Param('id') id: string) {
    return this.prisma.user.update({ where: { id }, data: { isSuspended: true } });
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  @Get('jobs')
  jobs(@Query('page') page = '1') {
    const p = parseInt(page, 10);
    return this.prisma.job.findMany({
      skip: (p - 1) * 20,
      take: 20,
      include: { employer: { select: { businessName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Patch('jobs/:id/approve')
  approveJob(@Param('id') id: string) {
    return this.prisma.job.update({ where: { id }, data: { isApproved: true } });
  }

  @Delete('jobs/:id')
  deleteJob(@Param('id') id: string) {
    return this.prisma.job.delete({ where: { id } });
  }

  @Patch('employers/:id/verify')
  async verifyEmployer(@Param('id') id: string) {
    return this.prisma.employerProfile.update({
      where: { id },
      data: { isVerified: true, verificationBadge: true },
    });
  }
}
