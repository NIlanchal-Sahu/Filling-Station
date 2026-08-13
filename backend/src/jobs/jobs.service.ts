import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobDto, UpdateJobDto, JobQueryDto } from './dto/job.dto';

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: JobQueryDto) {
    const { page = 1, limit = 20, search, remote, lat, lng, radius = 25, ...filters } = query;
    const where: Prisma.JobWhereInput = {
      isActive: true,
      isApproved: true,
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(filters.category && { category: filters.category }),
      ...(filters.jobType && { jobType: filters.jobType }),
      ...(filters.workMode && { workMode: filters.workMode }),
      ...(filters.city && { city: { contains: filters.city, mode: 'insensitive' } }),
      ...(filters.minSalary && { salaryMax: { gte: filters.minSalary } }),
      ...(filters.maxSalary && { salaryMin: { lte: filters.maxSalary } }),
      ...(filters.freshersOnly && { freshersOnly: true }),
      ...(remote && { workMode: 'REMOTE' }),
    };

    let jobs = await this.prisma.job.findMany({
      where,
      include: {
        employer: { select: { businessName: true, logoUrl: true, isVerified: true, city: true } },
        _count: { select: { applications: true } },
      },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    });

    if (lat && lng) {
      jobs = jobs
        .map((job) => ({
          ...job,
          distance: job.latitude && job.longitude
            ? this.haversineKm(lat, lng, job.latitude, job.longitude)
            : null,
        }))
        .filter((j) => j.distance === null || j.distance <= radius)
        .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999)) as typeof jobs;
    }

    const total = await this.prisma.job.count({ where });
    return { data: jobs, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        employer: true,
        _count: { select: { applications: true } },
      },
    });
    if (!job) throw new NotFoundException('Job not found');

    await this.prisma.job.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    return job;
  }

  async findEmployerJobs(userId: string) {
    const employer = await this.getEmployerProfile(userId);
    return this.prisma.job.findMany({
      where: { employerId: employer.id },
      include: { _count: { select: { applications: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateJobDto) {
    const employer = await this.getEmployerProfile(userId);
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });

    if (sub?.plan === 'FREE' && (sub.jobPostsRemaining ?? 0) <= 0) {
      throw new BadRequestException('Free plan job post limit reached. Upgrade to premium.');
    }

    const job = await this.prisma.job.create({
      data: {
        ...dto,
        applicationDeadline: dto.applicationDeadline ? new Date(dto.applicationDeadline) : undefined,
        employerId: employer.id,
      },
    });

    if (sub?.plan === 'FREE') {
      await this.prisma.subscription.update({
        where: { userId },
        data: { jobPostsRemaining: { decrement: 1 } },
      });
    }

    return job;
  }

  async update(userId: string, id: string, dto: UpdateJobDto) {
    const job = await this.getOwnedJob(userId, id);
    return this.prisma.job.update({
      where: { id: job.id },
      data: {
        ...dto,
        applicationDeadline: dto.applicationDeadline ? new Date(dto.applicationDeadline) : undefined,
      },
    });
  }

  async remove(userId: string, id: string) {
    const job = await this.getOwnedJob(userId, id);
    await this.prisma.job.delete({ where: { id: job.id } });
    return { message: 'Job deleted' };
  }

  private async getEmployerProfile(userId: string) {
    const profile = await this.prisma.employerProfile.findUnique({ where: { userId } });
    if (!profile) throw new ForbiddenException('Employer profile required');
    return profile;
  }

  private async getOwnedJob(userId: string, jobId: string) {
    const employer = await this.getEmployerProfile(userId);
    const job = await this.prisma.job.findFirst({ where: { id: jobId, employerId: employer.id } });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
