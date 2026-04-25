import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComplexDto } from './dto/create-complex.dto';
import { CreateCourtDto } from './dto/create-court.dto';

@Injectable()
export class ComplexesService {
  constructor(private prisma: PrismaService) {}

  findAll(city?: string) {
    return this.prisma.sportComplex.findMany({
      where: city ? { city: { contains: city, mode: 'insensitive' } } : undefined,
      include: { courts: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const complex = await this.prisma.sportComplex.findUnique({
      where: { id },
      include: { courts: true },
    });
    if (!complex) throw new NotFoundException('Complex not found');
    return complex;
  }

  create(dto: CreateComplexDto) {
    return this.prisma.sportComplex.create({ data: dto });
  }

  async addCourt(complexId: string, dto: CreateCourtDto) {
    await this.findOne(complexId);
    return this.prisma.court.create({
      data: { ...dto, complexId },
    });
  }

  async removeCourt(complexId: string, courtId: string) {
    await this.findOne(complexId);
    return this.prisma.court.delete({ where: { id: courtId } });
  }
}
