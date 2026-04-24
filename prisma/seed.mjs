import { PrismaClient } from "@prisma/client";
import { createHmac } from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");
  const shopDomain = "dev-shop.myshopify.com";

  await prisma.conversion.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.affiliate.deleteMany();
  await prisma.billingConfig.deleteMany();

  await prisma.billingConfig.create({
    data: {
      shopDomain,
      subscriptionId: "gid://shopify/AppSubscription/mock-12345",
      cappedAmount: 1000,
      planName: "Capped Amount",
      isActive: true,
    },
  });

  const affiliates = await Promise.all(
    ["MARIAG2026", "CARLOSR2026", "ANAM2026", "PEDROL2026", "LAURAS2026"].map((ref, i) =>
      prisma.affiliate.create({
        data: {
          shopDomain,
          name: ["Maria Garcia", "Carlos Rodriguez", "Ana Martinez", "Pedro Lopez", "Laura Sanchez"][i],
          email: ["maria@example.com", "carlos@example.com", "ana@example.com", "pedro@example.com", "laura@example.com"][i],
          refId: ref,
          commissionRate: [10, 12, 8, 15, 10][i],
          isActive: i !== 3,
        },
      })
    )
  );

  for (let i = 0; i < 25; i++) {
    const aff = affiliates[i % 5];
    const total = +(Math.random() * 200 + 20).toFixed(2);
    const statuses = ["billed", "billed", "billed", "pending", "retrying"];
    const status = statuses[i % 5];
    await prisma.conversion.create({
      data: {
        id: `seed_conv_${i}`,
        shopDomain,
        orderId: `order_${i}_${Date.now()}`,
        orderTotal: total,
        currency: "USD",
        affiliateId: aff.id,
        commissionRate: aff.commissionRate,
        commissionAmt: +(total * (aff.commissionRate / 100)).toFixed(2),
        platformFee: +(total * 0.05).toFixed(2),
        status,
        idempotencyKey: createHmac("sha256", "seed").update(`seed_conv_${i}`).digest("hex").substring(0, 64),
        usageRecordId: status === "billed" ? `gid://shopify/UsageRecord/mock-${i}` : null,
        processedAt: status === "billed" ? new Date() : null,
        retryCount: status === "retrying" ? i % 5 : 0,
      },
    });
  }

  console.log("Seed complete! Created:", affiliates.length, "affiliates, 25 conversions");
  console.log("Test links:");
  console.log("  http://localhost:3000/?ref=MARIAG2026");
  console.log("  http://localhost:3000/?ref=CARLOSR2026");
}

main().catch(console.error).finally(() => prisma.$disconnect());
