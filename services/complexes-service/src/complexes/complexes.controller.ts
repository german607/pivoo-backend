import {
  Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ComplexesService } from './complexes.service';
import { CreateComplexDto } from './dto/create-complex.dto';
import { CreateCourtDto } from './dto/create-court.dto';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { getClientIp, getCountryFromIp } from '../common/geo';

@ApiTags('complexes')
@Controller('complexes')
export class ComplexesController {
  constructor(private complexesService: ComplexesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List complexes. Authenticated users auto-filter by their country.' })
  @ApiQuery({ name: 'country', required: false, description: 'ISO country code override (e.g. UY, AR, ES)' })
  @ApiQuery({ name: 'city', required: false })
  findAll(@Request() req: any, @Query('country') country?: string, @Query('city') city?: string) {
    const effectiveCountry =
      country ??
      (req.user?.country as string | null) ??
      getCountryFromIp(getClientIp(req)) ??
      undefined;
    return this.complexesService.findAll(effectiveCountry, city);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get complex with courts' })
  findOne(@Param('id') id: string) {
    return this.complexesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a complex (admin)' })
  create(@Body() dto: CreateComplexDto) {
    return this.complexesService.create(dto);
  }

  @Post(':id/courts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a court to a complex' })
  addCourt(@Param('id') id: string, @Body() dto: CreateCourtDto) {
    return this.complexesService.addCourt(id, dto);
  }

  @Delete(':id/courts/:courtId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a court from a complex' })
  removeCourt(@Param('id') id: string, @Param('courtId') courtId: string) {
    return this.complexesService.removeCourt(id, courtId);
  }
}
