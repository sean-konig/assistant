import { Module } from '@nestjs/common'
import { DigestsService } from './digests.service'
import { DigestsController } from './digests.controller'

@Module({ controllers: [DigestsController], providers: [DigestsService] })
export class DigestsModule {}

