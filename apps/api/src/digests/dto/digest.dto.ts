import { IsOptional, IsString } from "class-validator";

export class GetDigestQueryDto {
  @IsOptional()
  @IsString()
  project?: string;
}

export class DigestResponseDto {
  id!: string;
  projectId?: string;
  forDate!: string;
  summaryMd!: string;
  createdAt!: string;
}
