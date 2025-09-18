import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { appConfig } from "./config/app.config";
import { appConfigSchema } from "./config/app.config.schema";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ProjectsModule } from "./projects/projects.module";
import { SourcesModule } from "./sources/sources.module";
import { ItemsModule } from "./items/items.module";
import { EmbeddingsModule } from "./embeddings/embeddings.module";
import { AgentsModule } from "./agents/agents.module";
import { RisksModule } from "./risks/risks.module";
import { DigestsModule } from "./digests/digests.module";
import { RemindersModule } from "./reminders/reminders.module";
import { JobsModule } from "./jobs/jobs.module";
import { IngestModule } from "./ingest/ingest.module";
import { TasksModule } from "./tasks/tasks.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validate: (env: Record<string, unknown>) => {
        const parsed = appConfigSchema.safeParse(env);
        if (!parsed.success) {
          const details = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
          throw new Error(`Invalid environment variables: ${details}`);
        }
        return parsed.data;
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    SourcesModule,
    ItemsModule,
    EmbeddingsModule,
    AgentsModule,
    RisksModule,
    DigestsModule,
    RemindersModule,
    JobsModule,
    IngestModule,
    TasksModule,
  ],
})
export class AppModule {}
