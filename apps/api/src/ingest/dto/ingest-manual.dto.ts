import { IsArray, IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class IngestManualDto {
  @IsOptional()
  @IsString()
  projectCode?: string;

  @IsIn(["note", "meeting", "action_items"])
  kind!: "note" | "meeting" | "action_items";

  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(10000)
  raw_text!: string;

  @IsOptional()
  @IsDateString()
  occurred_at?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export interface IngestManualResponseDto {
  itemId: string;
}

export interface IngestJobDetails {
  itemId: string;
  userId: string;
  projectId: string | null;
  text: string;
}
