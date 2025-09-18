import { Module } from '@nestjs/common'
import { ItemsService } from './items.service'
import { ItemsController } from './items.controller'
import { IndexerModule } from '../indexer/indexer.module'

@Module({ imports: [IndexerModule], controllers: [ItemsController], providers: [ItemsService] })
export class ItemsModule {}
