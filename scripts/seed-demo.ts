import { prisma } from "../src/lib/prisma";

// Clearly fictional demo catalogue. Do not copy real prices or client data
// into this public repository; replace these rows through the admin panel in
// a private deployment.
async function main() {
  const manicure = await prisma.service.upsert({
    where: { slug: "manicure" },
    update: {},
    create: {
      slug: "manicure",
      nameUa: "Манікюр",
      nameRu: "Маникюр",
      descriptionUa: "Демонстраційна послуга для публічного репозиторію.",
      descriptionRu: "Демонстрационная услуга для публичного репозитория.",
      durationMin: 180,
      priceFrom: 450,
      noteUa: "Демо-дані. Замініть через адмінку у приватному розгортанні.",
      noteRu: "Демо-данные. Замените через админку в приватном развёртывании.",
      sortOrder: 1,
    },
  });

  const lashes = await prisma.service.upsert({
    where: { slug: "lashes" },
    update: {},
    create: {
      slug: "lashes",
      nameUa: "Нарощування вій",
      nameRu: "Наращивание ресниц",
      descriptionUa: "Демонстраційна послуга для публічного репозиторію.",
      descriptionRu: "Демонстрационная услуга для публичного репозитория.",
      durationMin: 180,
      priceFrom: 600,
      noteUa: "Демо-дані. Замініть через адмінку у приватному розгортанні.",
      noteRu: "Демо-данные. Замените через админку в приватном развёртывании.",
      sortOrder: 2,
    },
  });

  const items = [
    {
      id: "demo-manicure-0",
      serviceId: manicure.id,
      labelUa: "Манікюр з покриттям — демо",
      labelRu: "Маникюр с покрытием — демо",
      amount: 450,
      isSurcharge: false,
      sortOrder: 0,
    },
    {
      id: "demo-manicure-1",
      serviceId: manicure.id,
      labelUa: "Френч — демо",
      labelRu: "Френч — демо",
      amount: 100,
      isSurcharge: true,
      sortOrder: 1,
    },
    {
      id: "demo-lashes-0",
      serviceId: lashes.id,
      labelUa: "Класичне нарощування — демо",
      labelRu: "Классическое наращивание — демо",
      amount: 600,
      isSurcharge: false,
      sortOrder: 0,
    },
  ];

  for (const item of items) {
    const { id, ...data } = item;
    await prisma.priceItem.upsert({
      where: { id },
      update: data,
      create: item,
    });
  }

  console.log("Demo catalogue seeded.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
