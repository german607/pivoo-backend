import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSportStatsDto } from './dto/update-sport-stats.dto';
import { UpdateStatsDto } from './dto/update-stats.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create user profile (called after registration)' })
  createProfile(@Request() req: any, @Body() dto: CreateProfileDto) {
    return this.usersService.createProfile(req.user.userId, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@Request() req: any) {
    return this.usersService.findById(req.user.userId);
  }

  @Get('rankings')
  @ApiOperation({ summary: 'Get rankings by sport' })
  @ApiQuery({ name: 'sportId', required: true })
  @ApiQuery({ name: 'limit', required: false })
  getRankings(@Query('sportId') sportId: string, @Query('limit') limit?: number) {
    return this.usersService.getRankings(sportId, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user profile by ID' })
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Get('username/:username')
  @ApiOperation({ summary: 'Get user profile by username' })
  findByUsername(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.userId, dto);
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
        return cb(new BadRequestException('Solo se permiten imágenes JPEG, PNG o WebP'), false);
      }
      cb(null, true);
    },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Upload profile picture (JPEG, PNG o WebP, máx 5 MB)' })
  uploadAvatar(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    return this.usersService.uploadAvatar(req.user.userId, file);
  }

  @Patch('me/stats/:sportId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own level and/or category for a sport (upserts if no record exists)' })
  updateMySportStats(
    @Request() req: any,
    @Param('sportId') sportId: string,
    @Body() dto: UpdateSportStatsDto,
  ) {
    return this.usersService.updateMySportStats(req.user.userId, sportId, dto);
  }

  @Post('stats')
  @ApiOperation({ summary: 'Update sport stats after match (internal, called by matches-service)' })
  updateStats(@Body() dto: UpdateStatsDto) {
    return this.usersService.updateStatsAfterMatch(dto.userId, dto.sportId, dto.won, dto.pointsDelta);
  }
}
