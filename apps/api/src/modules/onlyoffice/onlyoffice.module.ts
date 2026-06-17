import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { OnlyOfficeConfigService } from './onlyoffice-config.service';
import { OnlyOfficeController } from './onlyoffice.controller';
import { OnlyOfficeService } from './onlyoffice.service';

@Module({
  imports: [PrismaModule],
  controllers: [OnlyOfficeController],
  providers: [OnlyOfficeConfigService, OnlyOfficeService],
})
export class OnlyOfficeModule {}
