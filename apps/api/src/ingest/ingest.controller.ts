import { Body, Controller, HttpCode, Inject, InternalServerErrorException, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IngestService } from "./ingest.service";
import { IngestManualDto, IngestManualResponseDto } from "./dto/ingest-manual.dto";

@ApiTags("ingest")
@Controller("ingest")
export class IngestController {
  constructor(@Inject(IngestService) private readonly ingestService: IngestService) {}

  @Post("manual")
  @HttpCode(200)
  async ingestManual(@Body() dto: IngestManualDto): Promise<IngestManualResponseDto> {
    if (!this.ingestService) {
      throw new InternalServerErrorException("IngestService unavailable");
    }
    return this.ingestService.ingestManual(dto);
  }
}
