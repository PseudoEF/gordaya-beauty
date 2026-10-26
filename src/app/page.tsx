import { prisma } from "@/lib/prisma";
import { HomeClient } from "@/components/HomeClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: { priceItems: { orderBy: { sortOrder: "asc" } } },
  });

  return (
    <HomeClient
      services={services.map((s) => ({
        id: s.id,
        slug: s.slug,
        nameUa: s.nameUa,
        nameRu: s.nameRu,
        durationMin: s.durationMin,
        priceFrom: s.priceFrom,
        noteUa: s.noteUa,
        noteRu: s.noteRu,
        priceItems: s.priceItems.map((p) => ({
          id: p.id,
          labelUa: p.labelUa,
          labelRu: p.labelRu,
          amount: p.amount,
          isSurcharge: p.isSurcharge,
        })),
      }))}
    />
  );
}
