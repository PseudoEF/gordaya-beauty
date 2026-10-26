import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BookingClient } from "@/components/booking/BookingClient";

export const dynamic = "force-dynamic";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service: slug } = await params;
  const service = await prisma.service.findUnique({ where: { slug } });

  if (!service || !service.active) {
    notFound();
  }

  return (
    <BookingClient
      service={{
        id: service.id,
        slug: service.slug,
        nameUa: service.nameUa,
        nameRu: service.nameRu,
        durationMin: service.durationMin,
        priceFrom: service.priceFrom,
      }}
    />
  );
}
