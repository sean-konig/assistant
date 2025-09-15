import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator'

export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  @IsNotEmpty()
  name!: string

  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be kebab-case' })
  slug!: string
}

