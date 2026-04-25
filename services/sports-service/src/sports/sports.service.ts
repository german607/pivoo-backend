import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSportDto } from './dto/create-sport.dto';

@Injectable()
export class SportsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.sport.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const sport = await this.prisma.sport.findUnique({ where: { id } });
    if (!sport) throw new NotFoundException('Sport not found');
    return sport;
  }

  create(dto: CreateSportDto) {
    return this.prisma.sport.create({ data: dto });
  }
}
