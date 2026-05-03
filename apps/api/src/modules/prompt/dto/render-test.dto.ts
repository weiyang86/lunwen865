import { IsObject, IsOptional } from 'class-validator';

export class RenderTestDto {
  @IsOptional()
  @IsObject()
  vars?: Record<string, unknown>;
}
