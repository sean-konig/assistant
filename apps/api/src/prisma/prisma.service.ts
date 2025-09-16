import { INestApplication, Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly hasDatasource: boolean;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    console.log("[PrismaService] Constructor called", {
      hasConfig: Boolean(config),
      configType: typeof config,
    });

    const url = config.get<string>("app.databaseUrl");
    console.log("[PrismaService] Database URL:", { hasUrl: Boolean(url), urlLength: url?.length });

    super(url ? { datasourceUrl: url } : {});
    this.hasDatasource = Boolean(url);

    console.log("[PrismaService] Instance created", {
      hasDatasource: this.hasDatasource,
      hasQueryRawUnsafe: Boolean(this.$queryRawUnsafe),
      instanceType: typeof this,
    });
  }

  async onModuleInit() {
    console.log("[PrismaService] onModuleInit called", { hasDatasource: this.hasDatasource });
    if (this.hasDatasource) {
      await this.$connect();
      console.log("[PrismaService] Connected to database");
    }
  }

  async enableShutdownHooks(app: INestApplication) {
    // Using process 'beforeExit' event instead of prisma.$on to avoid TS typing issue
    process.on("beforeExit", async () => {
      await app.close();
    });
  }
}
