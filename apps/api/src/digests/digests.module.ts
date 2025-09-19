import { Module } from '@nestjs/common'
import { DigestsService } from './digests.service'
import { DigestsController } from './digests.controller'

@Module({ controllers: [DigestsController], providers: [DigestsService], exports: [DigestsService] })
export class DigestsModule {}

