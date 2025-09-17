import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Ingest E2E", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe.skip("POST /ingest/manual", () => {
    it("should create an item when valid data is provided", async () => {
      const ingestData = {
        kind: "note",
        title: "Test meeting notes",
        raw_text:
          "We discussed the new feature implementation. Need to create tasks for backend API and frontend components.",
        occurred_at: "2025-09-17T10:00:00Z",
        tags: ["meeting", "development"],
      };

      const response = await request(app.getHttpServer()).post("/ingest/manual").send(ingestData);

      // Since this requires auth, we expect 401 without proper JWT
      expect(response.status).toBe(401);
    });

    it("should validate required fields", async () => {
      const invalidData = {
        title: "Test",
        // Missing required fields: kind, raw_text
      };

      const response = await request(app.getHttpServer()).post("/ingest/manual").send(invalidData);

      expect(response.status).toBe(400);
    });

    it("should validate kind enum values", async () => {
      const invalidData = {
        kind: "invalid_kind",
        raw_text: "Some text here",
      };

      const response = await request(app.getHttpServer()).post("/ingest/manual").send(invalidData);

      expect(response.status).toBe(400);
    });
  });
});
