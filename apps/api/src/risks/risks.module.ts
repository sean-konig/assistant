import { Module } from '@nestjs/common'
import { RisksService } from './risks.service'
import { RisksController } from './risks.controller'

@Module({ controllers: [RisksController], providers: [RisksService] })
export class RisksModule {}

