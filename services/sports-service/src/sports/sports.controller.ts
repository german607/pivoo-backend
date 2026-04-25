import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SportsService } from './sports.service';
import { CreateSportDto } from './dto/create-sport.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('sports')
@Controller('sports')
export class SportsController {
  constructor(private sportsService: SportsService) {}

  @Get()
  @ApiOperation({ summary: 'List all sports' })
  findAll() {
    return this.sportsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sport by ID' })
  findOne(@Param('id') id: string) {
    return this.sportsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a sport (admin)' })
  create(@Body() dto: CreateSportDto) {
    return this.sportsService.create(dto);
  }
}
