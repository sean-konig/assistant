import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testEmbedding() {
  try {
    // Create a test vector (1536 dimensions with random values)
    const testVector = Array.from({ length: 1536 }, () => Math.random());

    console.log("Testing embedding insertion...");

    // Try to insert the embedding
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO embeddings ("userId", "projectId", "itemId", vector, dim, "createdAt") VALUES ($1, $2, $3, $4::vector, $5, now()) RETURNING id`,
      "test-user-id",
      "test-project-id",
      "test-item-id",
      `[${testVector.join(",")}]`,
      1536
    );

    console.log("✅ Successfully inserted embedding:", result[0]);

    // Check if we can query it back
    const count = await prisma.$queryRaw`SELECT COUNT(*) FROM embeddings WHERE "userId" = 'test-user-id'`;
    console.log("✅ Total test embeddings in DB:", count[0].count);

    // Clean up test data
    await prisma.$executeRaw`DELETE FROM embeddings WHERE "userId" = 'test-user-id'`;
    console.log("✅ Cleaned up test data");
  } catch (error) {
    console.error("❌ Failed to test embedding:", error.message);
    if (error.code) {
      console.error("Error code:", error.code);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testEmbedding();
