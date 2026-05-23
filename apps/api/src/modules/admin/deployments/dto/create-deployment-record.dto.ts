import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const DEPLOY_ENV_KEYS = ['dev', 'staging', 'prod'] as const;
export type DeployEnvKey = (typeof DEPLOY_ENV_KEYS)[number];

export class CreateDeploymentRecordDto {
  @IsIn(DEPLOY_ENV_KEYS)
  env!: DeployEnvKey;

  @IsString()
  @MaxLength(50)
  version!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  image?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  commit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
