import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: { userId, ...input, data: input.data as object },
    });

    // FCM push would be sent here in production
    const tokens = await this.prisma.deviceToken.findMany({ where: { userId } });
    if (tokens.length) {
      console.log(`[FCM] Push to ${tokens.length} devices: ${input.title}`);
    }

    return notification;
  }

  async findAll(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly && { isRead: false }) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async registerDevice(userId: string, token: string, platform: string) {
    return this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }
}
