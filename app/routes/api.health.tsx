import { json } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";

export async function loader() {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (e) {}

  return json({
    status: dbOk ? "healthy" : "degraded",
    database: dbOk,
    timestamp: new Date().toISOString(),
  }, {
    status: dbOk ? 200 : 503,
  });
}
