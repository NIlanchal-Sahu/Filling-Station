import { Controller, Get, Patch, Post, Body, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string, @Query('unread') unread?: string) {
    return this.notificationsService.findAll(userId, unread === 'true');
  }

  @Patch(':id/read')
  markRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.markRead(userId, id);
  }

  @Post('register-device')
  registerDevice(
    @CurrentUser('id') userId: string,
    @Body() body: { token: string; platform: string },
  ) {
    return this.notificationsService.registerDevice(userId, body.token, body.platform);
  }
}
