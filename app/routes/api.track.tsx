import { json, type ActionFunctionArgs } from "@remix-run/node";
import { prisma } from "~/db/prisma.server";
import { createHmac } from "crypto";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { orderId, total, affiliateRef, currency, source } = body;

    // Validaciones básicas
    if (!orderId || !total || !affiliateRef) {
      return json({ success: false, error: "Missing required fields" }, { status: 422 });
    }

    if (typeof total !== "number" || total <= 0 || total > 1000000) {
      return json({ success: false, error: "Invalid total amount" }, { status: 422 });
    }

    if (!/^[A-Za-z0-9_-]{1,50}$/.test(affiliateRef)) {
      return json({ success: false, error: "Invalid affiliate reference" }, { status: 422 });
    }

    // Buscar afiliado
    const affiliate = await prisma.affiliate.findFirst({
      where: { refId: affiliateRef, isActive: true },
    });

    if (!affiliate) {
      return json({ success: false, error: "Affiliate not found" }, { status: 422 });
    }

    // Verificar idempotencia
    const existing = await prisma.conversion.findFirst({
      where: { orderId, affiliateId: affiliate.id },
    });

    if (existing) {
      return json({ success: true, conversionId: existing.id, isDuplicate: true });
    }

    // Crear conversión
    const commissionAmt = +(total * (affiliate.commissionRate / 100)).toFixed(2);
    const platformFee = +(total * 0.05).toFixed(2);
    const idempotencyKey = createHmac("sha256", "converxity")
      .update(`${orderId}:${affiliate.id}`)
      .digest("hex")
      .substring(0, 64);

    const conversion = await prisma.conversion.create({
      data: {
        id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        shopDomain: affiliate.shopDomain,
        orderId,
        orderTotal: total,
        currency: currency || "USD",
        affiliateId: affiliate.id,
        commissionRate: affiliate.commissionRate,
        commissionAmt,
        platformFee,
        status: "billed",
        idempotencyKey,
        usageRecordId: `gid://shopify/UsageRecord/mock-${Date.now()}`,
        processedAt: new Date(),
      },
    });

    return json({
      success: true,
      conversionId: conversion.id,
      platformFee,
      commissionAmt,
    });

  } catch (error) {
    return json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

export async function loader() {
  return json({ success: false, error: "POST only" }, { status: 405 });
}
