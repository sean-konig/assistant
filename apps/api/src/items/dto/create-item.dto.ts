import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsDateString, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator'

export enum ItemTypeDto {
  EMAIL = 'EMAIL',
  CAL_EVENT = 'CAL_EVENT',
  NOTE = 'NOTE',
  DOC = 'DOC',
}

export class CreateItemDto {
  @ApiProperty({ enum: ItemTypeDto })
  @IsEnum(ItemTypeDto)
  type!: ItemTypeDto

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  title?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string

  @ApiPropertyOptional({ type: 'string', format: 'date-time' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string

  @ApiPropertyOptional({ description: 'Optional related project id' })
  @IsOptional()
  @IsString()
  projectId?: string

  @ApiPropertyOptional({ description: 'Optional source id' })
  @IsOptional()
  @IsString()
  sourceId?: string

  @ApiPropertyOptional({ description: 'Raw structured payload' })
  @IsOptional()
  @IsObject()
  raw?: Record<string, any>
}

