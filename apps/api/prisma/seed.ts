import path from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// Categorias del sistema (isSystem=true, sin dueño). El usuario puede añadir las suyas propias;
// estas son solo el punto de partida configurable descrito en la Fase 0.
const SYSTEM_CATEGORIES: { name: string; children?: string[] }[] = [
  { name: "Vivienda" },
  { name: "Supermercado" },
  { name: "Restaurantes" },
  { name: "Transporte" },
  { name: "Viajes" },
  { name: "Compras" },
  { name: "Salud" },
  { name: "Deporte" },
  { name: "Ocio" },
  { name: "Suscripciones" },
  { name: "Educación" },
  { name: "Seguros" },
  { name: "Impuestos" },
  { name: "Servicios" },
  { name: "Transferencias" },
  { name: "Ingresos", children: ["Nómina", "Reembolsos"] },
  { name: "Inversión" },
  { name: "Otros" },
];

async function ensureSystemCategory(name: string, parentId: string | null): Promise<string> {
  const existing = await prisma.category.findFirst({
    where: { name, userId: null, parentId, isSystem: true },
  });
  if (existing) return existing.id;

  const created = await prisma.category.create({
    data: { name, parentId, isSystem: true, userId: null },
  });
  return created.id;
}

async function main() {
  for (const category of SYSTEM_CATEGORIES) {
    const parentId = await ensureSystemCategory(category.name, null);
    for (const childName of category.children ?? []) {
      await ensureSystemCategory(childName, parentId);
    }
  }
  console.log("Categorías del sistema sincronizadas.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
