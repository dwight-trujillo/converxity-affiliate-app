import { json } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";

export async function loader() {
  const affiliates = await prisma.affiliate.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      refId: true,
      commissionRate: true,
      email: true,
      createdAt: true,
    },
  });

  return json({ affiliates, total: affiliates.length });
}
