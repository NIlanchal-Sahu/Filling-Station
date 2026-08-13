import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MessageType } from '@prisma/client';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/chat' })
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private chatService: ChatService,
    private jwt: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwt.verify(token, { secret: process.env.JWT_SECRET });
      client.data.userId = payload.sub;

      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set());
      }
      this.userSockets.get(payload.sub)!.add(client.id);
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    client.join(`conversation:${data.conversationId}`);
    return { event: 'joined', conversationId: data.conversationId };
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { conversationId: string; content: string; type?: MessageType; fileUrl?: string },
  ) {
    const message = await this.chatService.sendMessage(
      client.data.userId,
      data.conversationId,
      data.content,
      data.type || MessageType.TEXT,
      data.fileUrl,
    );

    this.server.to(`conversation:${data.conversationId}`).emit('message', message);
    return message;
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.to(`conversation:${data.conversationId}`).emit('typing', {
      userId: client.data.userId,
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('read')
  async handleRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageId: string },
  ) {
    client.to(`conversation:${data.conversationId}`).emit('read', {
      userId: client.data.userId,
      messageId: data.messageId,
    });
  }

  @SubscribeMessage('schedule_interview')
  async handleScheduleInterview(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; scheduledAt: string; notes?: string },
  ) {
    const message = await this.chatService.scheduleInterview(
      client.data.userId,
      data.conversationId,
      new Date(data.scheduledAt),
      data.notes,
    );
    this.server.to(`conversation:${data.conversationId}`).emit('message', message);
    return message;
  }
}
