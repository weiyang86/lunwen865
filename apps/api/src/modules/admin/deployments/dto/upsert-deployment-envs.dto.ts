import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class DeploymentEnvDto {
  @IsString()
  @MaxLength(50)
  key!: string;

  @IsString()
  @MaxLength(50)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  webBaseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  apiBaseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  webhookBaseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  certsDir?: string;
}

export class UpsertDeploymentEnvsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeploymentEnvDto)
  envs!: DeploymentEnvDto[];
}
