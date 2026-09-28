import { Router } from "express";
import { z } from "zod";
import { getPrismaClient } from "@hunt/database";
import { requireAuth } from "../auth/middleware.js";
import { buildCharacterSummary } from "../engine/serialize.js";

const prisma = getPrismaClient();
export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get("/", async (req, res) => {
  const summary = await buildCharacterSummary(req.auth!.sub);
  res.json(summary);
});

meRouter.get("/inventory", async (req, res) => {
  const character = await prisma.character.findUniqueOrThrow({ where: { userId: req.auth!.sub } });
  const inventory = await prisma.inventoryItem.findMany({ where: { characterId: character.id }, include: { item: true } });
  res.json(inventory);
});

const SLOT_TO_FIELD: Record<string, string> = {
  armor: "equippedArmorId",
  weapon: "equippedWeaponId",
  accessory: "equippedAccessoryId",
  pet: "equippedPetId",
  title: "equippedTitleId",
  aura: "equippedAuraId",
  mount: "equippedMountId",
  background: "equippedBackgroundId",
};

const CATEGORY_TO_SLOT: Record<string, string> = {
  ARMOR: "armor",
  WEAPON: "weapon",
  HELMET: "accessory",
  ACCESSORY: "accessory",
  PET: "pet",
  TITLE: "title",
  EFFECT: "aura",
  MOUNT: "mount",
  BACKGROUND: "background",
};

const equipSchema = z.object({ slot: z.string(), itemId: z.string().nullable() });

meRouter.post("/equip", async (req, res) => {
  const parsed = equipSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { slot, itemId } = parsed.data;

  const field = SLOT_TO_FIELD[slot];
  if (!field) return res.status(400).json({ error: `Unknown slot "${slot}"` });

  const character = await prisma.character.findUniqueOrThrow({ where: { userId: req.auth!.sub } });

  if (itemId) {
    const owned = await prisma.inventoryItem.findUnique({ where: { characterId_itemId: { characterId: character.id, itemId } } });
    if (!owned) return res.status(403).json({ error: "You do not own this item" });

    const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
    if (CATEGORY_TO_SLOT[item.category] !== slot) {
      return res.status(400).json({ error: `Item category ${item.category} cannot be equipped in slot "${slot}"` });
    }
  }

  await prisma.character.update({ where: { id: character.id }, data: { [field]: itemId } });
  res.json(await buildCharacterSummary(req.auth!.sub));
});

const appearanceSchema = z.object({
  head: z.string().nullable().optional(),
  hair: z.string().nullable().optional(),
  face: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
});

// Base appearance (head/hair/face/body) uses free-form preset keys rather than shop
// items - these are the free original placeholder options from spec section 4, not
// purchasable cosmetics.
meRouter.post("/appearance", async (req, res) => {
  const parsed = appearanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  await prisma.character.update({
    where: { userId: req.auth!.sub },
    data: {
      equippedHead: parsed.data.head,
      equippedHair: parsed.data.hair,
      equippedFace: parsed.data.face,
      equippedBody: parsed.data.body,
    },
  });
  res.json(await buildCharacterSummary(req.auth!.sub));
});
