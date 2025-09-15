import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsObject, IsString, MaxLength } from 'class-validator'

export enum SourceTypeDto {
  GMAIL = 'GMAIL',
  GOOGLE_CAL = 'GOOGLE_CAL',
  SLACK = 'SLACK',
  MANUAL_NOTE = 'MANUAL_NOTE',
  TRAINING_MATERIAL = 'TRAINING_MATERIAL',
}

export class UpsertSourceDto {
  @ApiProperty({ enum: SourceTypeDto })
  @IsEnum(SourceTypeDto)
  type!: SourceTypeDto

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  @IsNotEmpty()
  label!: string

  @ApiProperty({ description: 'Connector metadata (no raw secrets)' })
  @IsObject()
  config!: Record<string, any>
}

