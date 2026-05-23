import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AdminDeploymentsService } from './admin-deployments.service';
import { CreateDeploymentRecordDto } from './dto/create-deployment-record.dto';
import { UpsertDeploymentEnvsDto } from './dto/upsert-deployment-envs.dto';

@Controller('admin/deployments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminDeploymentsController {
  constructor(private readonly deployments: AdminDeploymentsService) {}

  @Get()
  listRecords() {
    return this.deployments.listRecords();
  }

  @Post()
  createRecord(
    @CurrentUser('id') uid: string,
    @Body() dto: CreateDeploymentRecordDto,
  ) {
    return this.deployments.createRecord(dto, uid);
  }

  @Delete(':id')
  deleteRecord(@Param('id') id: string) {
    return this.deployments.deleteRecord(id);
  }

  @Get('envs')
  async getEnvs() {
    const envs = await this.deployments.getEnvs();
    const computed = Object.fromEntries(
      envs.map((e) => [
        e.key,
        {
          ...this.deployments.buildNotifyUrls(e),
          ...this.deployments.buildDockerPaymentPathExamples(e),
          certsDir: e.certsDir ?? null,
        },
      ]),
    );
    return { envs, computed };
  }

  @Put('envs')
  async upsertEnvs(@Body() dto: UpsertDeploymentEnvsDto) {
    const envs = await this.deployments.upsertEnvs(dto.envs);
    const computed = Object.fromEntries(
      envs.map((e) => [
        e.key,
        {
          ...this.deployments.buildNotifyUrls(e),
          ...this.deployments.buildDockerPaymentPathExamples(e),
          certsDir: e.certsDir ?? null,
        },
      ]),
    );
    return { envs, computed };
  }
}
