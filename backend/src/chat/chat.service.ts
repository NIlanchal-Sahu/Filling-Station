import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessageType, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async getConversations(userId: string) {
    const participations = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              include: { user: { select: { id: true, email: true, avatarUrl: true, role: true } } },
            },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    return participations.map((p) => ({
      id: p.conversation.id,
      participants: p.conversation.participants
        .filter((part) => part.userId !== userId)
        .map((part) => part.user),
      lastMessage: p.conversation.messages[0] || null,
      updatedAt: p.conversation.updatedAt,
    }));
  }

  async createConversation(userId: string, otherUserId: string) {
    const existing = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: otherUserId } } },
        ],
      },
    });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId }, { userId: otherUserId }],
        },
      },
      include: { participants: true },
    });
  }

  async getMessages(userId: string, conversationId: string, cursor?: string) {
    await this.verifyParticipant(userId, conversationId);

    return this.prisma.message.findMany({
      where: { conversationId, ...(cursor && { id: { lt: cursor } }) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { sender: { select: { id: true, avatarUrl: true, email: true } } },
    });
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    content: string,
    type: MessageType = MessageType.TEXT,
    fileUrl?: string,
  ) {
    await this.verifyParticipant(userId, conversationId);

    const message = await this.prisma.message.create({
      data: { conversationId, senderId: userId, content, type, fileUrl },
      include: { sender: { select: { id: true, avatarUrl: true } } },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: userId } },
    });

    for (const p of participants) {
      await this.notifications.create(p.userId, {
        type: NotificationType.NEW_MESSAGE,
        title: 'New Message',
        body: content.slice(0, 100),
        data: { conversationId, messageId: message.id },
      });
    }

    return message;
  }

  async scheduleInterview(
    userId: string,
    conversationId: string,
    scheduledAt: Date,
    notes?: string,
  ) {
    const content = `Interview scheduled for ${scheduledAt.toISOString()}${notes ? `: ${notes}` : ''}`;
    return this.sendMessage(userId, conversationId, content, MessageType.INTERVIEW);
  }

  private async verifyParticipant(userId: string, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new ForbiddenException('Not a participant');
    return participant;
  }
}
