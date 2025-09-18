import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { SupabaseJwtGuard } from "../common/guards/supabase-jwt.guard";
import { GetUser } from "../common/decorators/get-user.decorator";
import { IngestService } from "./ingest.service";
import { IngestManualDto, IngestManualResponseDto } from "./dto/ingest-manual.dto";

@Controller("ingest")
// @UseGuards(SupabaseJwtGuard)  // Temporarily disabled for testing
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post("manual")
  async ingestManual(@Body() dto: IngestManualDto): Promise<IngestManualResponseDto> {
    return this.ingestService.ingestManual("seankonig", dto);
  }
}
