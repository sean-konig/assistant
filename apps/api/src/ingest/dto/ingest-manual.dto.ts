import { IsDateString, IsIn, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class IngestManualDto {
  @IsString()
  projectId!: string;

  @IsIn(["NOTE", "TASK", "DOC"])
  kind!: "NOTE" | "TASK" | "DOC";

  @IsOptional()
  @IsString()
  @MaxLength(512)
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsObject()
  raw?: Record<string, any>;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

export interface IngestManualResponseDto {
  id: string;
}

// Interface used by internal processor/worker if needed
export interface IngestJobDetails {
  itemId: string;
  userId: string;
  projectId: string | null;
  text: string;
}
