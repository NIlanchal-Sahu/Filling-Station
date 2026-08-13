import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get('me')
  getMe(@CurrentUser('id') userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true,
        emailVerified: true,
        phoneVerified: true,
        employerProfile: true,
        studentProfile: true,
        subscription: true,
      },
    });
  }

  @Patch('me')
  updateMe(@CurrentUser('id') userId: string, @Body() body: { avatarUrl?: string; phone?: string }) {
    return this.prisma.user.update({ where: { id: userId }, data: body });
  }
}
