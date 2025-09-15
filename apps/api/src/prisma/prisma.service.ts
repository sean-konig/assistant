import { INestApplication, Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly hasDatasource: boolean;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const url = config.get<string>("app.databaseUrl");
    super(url ? { datasourceUrl: url } : {});
    this.hasDatasource = Boolean(url);
  }

  async onModuleInit() {
    if (this.hasDatasource) {
      await this.$connect();
    }
  }

  async enableShutdownHooks(app: INestApplication) {
    // Using process 'beforeExit' event instead of prisma.$on to avoid TS typing issue
    process.on("beforeExit", async () => {
      await app.close();
    });
  }
}
