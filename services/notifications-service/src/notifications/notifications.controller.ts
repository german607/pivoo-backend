import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { UpdatePreferenceDto } from './dto/update-preferences.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current user' })
  findAll(@CurrentUser() userId: string, @Query() dto: QueryNotificationsDto) {
    return this.service.findAll(userId, dto);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count of unread notifications' })
  getUnreadCount(@CurrentUser() userId: string) {
    return this.service.getUnreadCount(userId);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser() userId: string) {
    return this.service.markAllRead(userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.service.markRead(id, userId);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  getPreferences(@CurrentUser() userId: string) {
    return this.service.getPreferences(userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update a notification preference' })
  updatePreference(@CurrentUser() userId: string, @Body() dto: UpdatePreferenceDto) {
    return this.service.updatePreference(userId, dto);
  }

  @Post('device-tokens')
  @ApiOperation({ summary: 'Register a push device token' })
  registerDeviceToken(@CurrentUser() userId: string, @Body() dto: RegisterDeviceTokenDto) {
    return this.service.registerDeviceToken(userId, dto);
  }

  @Delete('device-tokens/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a push device token' })
  removeDeviceToken(@Param('token') token: string, @CurrentUser() userId: string) {
    return this.service.removeDeviceToken(token, userId);
  }
}
