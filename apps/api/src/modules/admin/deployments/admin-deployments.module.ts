import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AdminDeploymentsController } from './admin-deployments.controller';
import { AdminDeploymentsService } from './admin-deployments.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminDeploymentsController],
  providers: [AdminDeploymentsService],
})
export class AdminDeploymentsModule {}
