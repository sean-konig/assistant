import { IsArray, IsDateString, IsIn, IsOptional, IsString } from "class-validator";

export class GetTasksQueryDto {
  @IsOptional()
  @IsString()
  project?: string;

  @IsOptional()
  @IsString()
  bucket?: string; // comma-separated: "P0,P1"

  @IsOptional()
  @IsIn(["todo", "in_progress", "done"])
  status?: "todo" | "in_progress" | "done";
}

export class RescoreTasksQueryDto {
  @IsOptional()
  @IsString()
  project?: string;
}

export class RescoreTasksResponseDto {
  updated!: number;
}

export interface TaskResponseDto {
  id: string;
  title: string;
  description?: string;
  owner: string;
  dueDate?: string;
  status: string;
  priorityScore?: number;
  priorityBucket?: string;
  reason?: any;
  signals: string[];
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

// Types for agent processing
export interface ExtractorTaskInput {
  title: string;
  description?: string;
  owner?: string;
  due_date?: string;
  signals?: string[];
  source_ingest_event_id?: string;
}

export interface ExtractorResponse {
  tasks: ExtractorTaskInput[];
}

export interface PrioritizerTaskInput {
  title: string;
  description?: string;
  dueDate?: string;
  signals?: string[];
}

export interface PrioritizerResult {
  title: string;
  priority_score: number;
  priority_bucket: "P0" | "P1" | "P2" | "P3";
  explanation: string;
}

export interface PrioritizerResponse {
  results: PrioritizerResult[];
}
