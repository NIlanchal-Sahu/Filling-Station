import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('conversations')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get()
  getConversations(@CurrentUser('id') userId: string) {
    return this.chatService.getConversations(userId);
  }

  @Post()
  createConversation(@CurrentUser('id') userId: string, @Body() body: { otherUserId: string }) {
    return this.chatService.createConversation(userId, body.otherUserId);
  }

  @Get(':id/messages')
  getMessages(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.chatService.getMessages(userId, id, cursor);
  }
}
