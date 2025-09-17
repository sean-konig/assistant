import { Module } from "@nestjs/common";
import { IngestController } from "./ingest.controller";
import { IngestService } from "./ingest.service";
import { PrismaModule } from "../prisma/prisma.module";
import { JobsModule } from "../jobs/jobs.module";

@Module({
  imports: [PrismaModule, JobsModule],
  controllers: [IngestController],
  providers: [IngestService],
})
export class IngestModule {}
