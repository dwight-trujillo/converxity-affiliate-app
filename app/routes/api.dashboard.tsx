import { json } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";

export async function loader() {
  const [totalConversions, totalAffiliates, billedAgg] = await Promise.all([
    prisma.conversion.count(),
    prisma.affiliate.count({ where: { isActive: true } }),
    prisma.conversion.aggregate({
      _sum: { orderTotal: true, commissionAmt: true, platformFee: true },
      _count: { id: true },
    }),
  ]);

  return json({
    totalConversions,
    activeAffiliates: totalAffiliates,
    totalSales: +(billedAgg._sum.orderTotal || 0).toFixed(2),
    totalCommissions: +(billedAgg._sum.commissionAmt || 0).toFixed(2),
    totalPlatformFees: +(billedAgg._sum.platformFee || 0).toFixed(2),
  });
}
