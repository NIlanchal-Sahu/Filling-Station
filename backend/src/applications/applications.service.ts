import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ApplicationStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MatchingService } from '../matching/matching.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateApplicationDto, UpdateApplicationStatusDto } from './dto/application.dto';

@Injectable()
export class ApplicationsService {
  constructor(
    private prisma: PrismaService,
    private matching: MatchingService,
    private notifications: NotificationsService,
  ) {}

  async apply(userId: string, dto: CreateApplicationDto) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) throw new ForbiddenException('Student profile required');

    const job = await this.prisma.job.findUnique({ where: { id: dto.jobId } });
    if (!job?.isActive) throw new NotFoundException('Job not found');

    const existing = await this.prisma.application.findUnique({
      where: { jobId_studentId: { jobId: dto.jobId, studentId: student.id } },
    });
    if (existing) throw new ConflictException('Already applied');

    const matchScore = this.matching.calculateMatchScore({
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
    });

    const application = await this.prisma.application.create({
      data: {
        jobId: dto.jobId,
        studentId: student.id,
        coverLetter: dto.coverLetter,
        matchScore,
      },
      include: { job: true, student: true },
    });

    const employer = await this.prisma.employerProfile.findUnique({
      where: { id: job.employerId },
    });
    if (employer) {
      await this.notifications.create(employer.userId, {
        type: NotificationType.APPLICATION_UPDATE,
        title: 'New Application',
        body: `${student.fullName} applied for ${job.title}`,
        data: { applicationId: application.id, jobId: job.id },
      });
    }

    return application;
  }

  async getMyApplications(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) throw new ForbiddenException('Student profile required');

    return this.prisma.application.findMany({
      where: { studentId: student.id },
      include: {
        job: { include: { employer: { select: { businessName: true, logoUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getJobApplications(userId: string, jobId: string, status?: ApplicationStatus, search?: string) {
    await this.verifyJobOwnership(userId, jobId);

    return this.prisma.application.findMany({
      where: {
        jobId,
        ...(status && { status }),
        ...(search && {
          student: { fullName: { contains: search, mode: 'insensitive' } },
        }),
      },
      include: { student: { include: { user: { select: { email: true, phone: true, avatarUrl: true } } } } },
      orderBy: [{ matchScore: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async updateStatus(userId: string, applicationId: string, dto: UpdateApplicationStatusDto) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true, student: true },
    });
    if (!application) throw new NotFoundException('Application not found');

    await this.verifyJobOwnership(userId, application.jobId);

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status: dto.status,
        interviewAt: dto.interviewAt ? new Date(dto.interviewAt) : undefined,
        interviewNotes: dto.interviewNotes,
      },
    });

    const studentUser = await this.prisma.user.findUnique({
      where: { id: application.student.userId },
    });
    if (studentUser) {
      await this.notifications.create(studentUser.id, {
        type: dto.status === 'INTERVIEW_SCHEDULED' ? NotificationType.INTERVIEW_INVITE : NotificationType.APPLICATION_UPDATE,
        title: 'Application Update',
        body: `Your application for ${application.job.title} is now ${dto.status.replace('_', ' ').toLowerCase()}`,
        data: { applicationId, status: dto.status },
      });
    }

    return updated;
  }

  async getEmployerDashboard(userId: string) {
    const employer = await this.prisma.employerProfile.findUnique({ where: { userId } });
    if (!employer) throw new ForbiddenException('Employer profile required');

    const jobs = await this.prisma.job.findMany({
      where: { employerId: employer.id },
      select: { id: true },
    });
    const jobIds = jobs.map((j) => j.id);

    const [activeJobs, applications, byStatus] = await Promise.all([
      this.prisma.job.count({ where: { employerId: employer.id, isActive: true } }),
      this.prisma.application.findMany({
        where: { jobId: { in: jobIds } },
        include: { student: true, job: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.application.groupBy({
        by: ['status'],
        where: { jobId: { in: jobIds } },
        _count: true,
      }),
    ]);

    const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));

    return {
      activeJobs,
      totalApplicants: Object.values(statusMap).reduce((a, b) => a + b, 0),
      newApplications: statusMap.APPLIED || 0,
      shortlisted: statusMap.SHORTLISTED || 0,
      rejected: statusMap.REJECTED || 0,
      hired: statusMap.SELECTED || 0,
      recentApplications: applications,
    };
  }

  private async verifyJobOwnership(userId: string, jobId: string) {
    const employer = await this.prisma.employerProfile.findUnique({ where: { userId } });
    if (!employer) throw new ForbiddenException('Employer profile required');

    const job = await this.prisma.job.findFirst({ where: { id: jobId, employerId: employer.id } });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }
}
