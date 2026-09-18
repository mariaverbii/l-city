import { db } from "../db";

// Conversation state for the MAX bot's multi-step "add completed work"
// dialog, persisted in Postgres (MaxBotSession) rather than kept in
// process memory: the app runs as a single `next start` server process
// today, but in-memory state would silently break the moment it runs as
// more than one instance, and would also be lost on every restart/deploy
// mid-conversation. Keyed by the MAX user id (as a string, since MAX user
// ids are numbers but Prisma's `@id` here is a String for simplicity).

export type SessionStep =
  | "awaiting_contact"
  | "menu"
  | "choosing_house"
  | "entering_description"
  | "entering_location"
  | "entering_volume"
  | "entering_materials"
  | "awaiting_before_photo"
  | "awaiting_after_photo"
  | "confirming";

export type HouseOption = { index: number; id: number; address: string };

export type SessionData = {
  houseOptions?: HouseOption[];
  houseId?: number;
  houseAddress?: string;
  description?: string;
  location?: string;
  volume?: string;
  materials?: string;
  beforePhotoKey?: string;
  beforePhotoType?: string;
  afterPhotoKey?: string;
  afterPhotoType?: string;
};

export type BotSession = {
  maxUserId: string;
  step: SessionStep;
  data: SessionData;
};

export async function getSession(maxUserId: string): Promise<BotSession | null> {
  const row = await db.maxBotSession.findUnique({ where: { maxUserId } });

  if (!row) {
    return null;
  }

  return {
    maxUserId: row.maxUserId,
    step: row.step as SessionStep,
    data: (row.data as unknown as SessionData) ?? {},
  };
}

export async function setSession(
  maxUserId: string,
  step: SessionStep,
  data: SessionData,
): Promise<void> {
  // Round-tripped through JSON so the value handed to Prisma's `Json`
  // column is plain, serializable data (matching what actually gets
  // stored and read back) rather than relying on SessionData's TS shape
  // to line up exactly with Prisma's generated JSON input type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = JSON.parse(JSON.stringify(data));

  await db.maxBotSession.upsert({
    where: { maxUserId },
    create: { maxUserId, step, data: json },
    update: { step, data: json },
  });
}

export async function clearSession(maxUserId: string): Promise<void> {
  await db.maxBotSession.deleteMany({ where: { maxUserId } });
}
