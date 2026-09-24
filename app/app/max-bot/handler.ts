import { db } from "../db";
import { storage } from "../storage";
import { getBot, Keyboard, isWebhookSecretValid } from "./client";
import {
  clearSession,
  getSession,
  setSession,
  type HouseOption,
  type SessionData,
} from "./session";
import { extractPhoneFromVcf, normalizePhone } from "./phone";
import type {
  Attachment,
  ContactAttachment,
  Message,
  PhotoAttachment,
  Update,
} from "./types";

export { isWebhookSecretValid };

const MENU_KEYBOARD = Keyboard.inlineKeyboard([
  [Keyboard.button.callback("Добавить запись о выполненной работе", "start_new_work")],
]);

const CONTACT_KEYBOARD = Keyboard.inlineKeyboard([
  [Keyboard.button.requestContact("Поделиться контактом")],
]);

const CONFIRM_KEYBOARD = Keyboard.inlineKeyboard([
  [
    Keyboard.button.callback("Сохранить", "confirm_save"),
    Keyboard.button.callback("Отменить", "confirm_cancel"),
  ],
]);

const LIMITS = {
  description: 300,
  location: 200,
  volume: 100,
  materials: 1000,
};

type KeyboardAttachment = ReturnType<typeof Keyboard.inlineKeyboard>;

async function send(userId: number, text: string, withKeyboard?: KeyboardAttachment) {
  await getBot().api.sendMessageToUser(userId, text, {
    attachments: withKeyboard ? [withKeyboard] : undefined,
  });
}

function isPhotoAttachment(a: Attachment): a is PhotoAttachment {
  return a.type === "image";
}

function isContactAttachment(a: Attachment): a is ContactAttachment {
  return a.type === "contact";
}

async function findEmployeeByMaxUserId(maxUserId: number) {
  return db.employee.findUnique({ where: { maxUserId: String(maxUserId) } });
}

// The dataset is guaranteed small (this org has at most a handful of
// employees), so a plain fetch-and-scan is simpler and just as fast as a
// database-side normalized-phone column, without needing a migration to
// add one or keeping it in sync with edits made on the website.
async function findEmployeeByPhone(rawPhone: string) {
  const target = normalizePhone(rawPhone);

  if (!target) {
    return null;
  }

  const employees = await db.employee.findMany();
  return employees.find((e) => normalizePhone(e.phone) === target) ?? null;
}

async function handleContactShared(userId: number, contact: ContactAttachment) {
  const phone = extractPhoneFromVcf(contact.payload.vcf_info);

  if (!phone) {
    await send(
      userId,
      "Не удалось прочитать номер телефона из контакта. Обратитесь к администратору.",
    );
    return;
  }

  const employee = await findEmployeeByPhone(phone);

  if (!employee) {
    await send(
      userId,
      "Сотрудник с таким номером телефона не найден в системе. Обратитесь к администратору, чтобы добавили ваш номер.",
    );
    return;
  }

  await db.employee.update({
    where: { id: employee.id },
    data: { maxUserId: String(userId) },
  });

  await send(userId, `Здравствуйте, ${employee.fullName}! Вы успешно привязаны к системе.`);
  await showMenu(userId);
}

async function showMenu(userId: number) {
  await send(userId, "Что делаем?", MENU_KEYBOARD);
}

async function askForContact(userId: number, greeting: string) {
  await send(userId, greeting, CONTACT_KEYBOARD);
}

// Houses are stored with their full postal address (region, district,
// village, street, house number) because the acts/reports module will
// need that later. Employees only need the street + house number to
// recognize which building is meant, so the bot shows just that part
// while the full address stays in the database untouched.
function shortHouseLabel(fullAddress: string): string {
  const match = fullAddress.match(/ул\.\s*[^,]+,\s*д\.\s*\S+/i);
  return match ? match[0] : fullAddress;
}

function buildHouseListText(options: HouseOption[]): string {
  const lines = options.map((o) => `${o.index}. ${shortHouseLabel(o.address)}`);
  return `Выберите дом (отправьте номер из списка):\n\n${lines.join("\n")}`;
}

async function startChoosingHouse(userId: number) {
  const houses = await db.house.findMany({ orderBy: { address: "asc" } });

  if (houses.length === 0) {
    await send(userId, "В системе пока не добавлено ни одного дома. Обратитесь к администратору.");
    return;
  }

  const options: HouseOption[] = houses.map((h, i) => ({
    index: i + 1,
    id: h.id,
    address: h.address,
  }));

  await setSession(String(userId), "choosing_house", { houseOptions: options });
  await send(userId, buildHouseListText(options));
}

async function deleteUploadedPhotos(data: SessionData) {
  await Promise.all(
    [data.beforePhotoKey, data.afterPhotoKey]
      .filter((key): key is string => Boolean(key))
      .map((key) => storage.delete(key, { ignoreNotFound: true })),
  );
}

async function cancelFlow(userId: number, data: SessionData) {
  await deleteUploadedPhotos(data);
  await clearSession(String(userId));
  await send(userId, "Действие отменено.");
  await showMenu(userId);
}

function guessExtension(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

// `payload.url` is a direct, pre-signed media link — verified from the
// official client library's source (it never attaches an Authorization
// header when handling attachment URLs) and the underlying TamTam API
// schema MAX is built on ("token" is only for *re-sending* the same
// media in an outgoing message, via ImageAttachment({token}), not for
// downloading). A bare unauthenticated GET is tried first; the
// Authorization retry is just a defensive fallback in case a particular
// deployment does gate these URLs.
async function downloadPhoto(
  attachment: PhotoAttachment,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  try {
    let response = await fetch(attachment.payload.url);

    if (!response.ok && (response.status === 401 || response.status === 403)) {
      const token = process.env.MAX_BOT_TOKEN;
      if (token) {
        response = await fetch(attachment.payload.url, {
          headers: { Authorization: token },
        });
      }
    }

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const bytes = Buffer.from(await response.arrayBuffer());
    return { bytes, contentType };
  } catch {
    return null;
  }
}

async function handlePhotoStep(
  userId: number,
  data: SessionData,
  side: "before" | "after",
  message: Message,
) {
  const photoAttachment = message.body.attachments?.find(isPhotoAttachment);

  if (!photoAttachment) {
    // Called only when the message wasn't the "пропустить" skip word
    // (see call sites), so a missing attachment here just means the
    // message had no photo — ask again.
    await send(
      userId,
      `Пришлите фото ${side === "before" ? "ДО" : "ПОСЛЕ"} начала работ, или напишите «пропустить».`,
    );
    return false;
  }

  const downloaded = await downloadPhoto(photoAttachment);

  if (!downloaded) {
    await send(userId, "Не удалось загрузить фото, попробуйте отправить его ещё раз.");
    return false;
  }

  const extension = guessExtension(downloaded.contentType);
  const key = `completed-work/${crypto.randomUUID()}-${side}.${extension}`;
  const result = await storage.uploadFromBytes(key, downloaded.bytes);

  if (!result.ok) {
    await send(userId, "Не удалось сохранить фото в хранилище, попробуйте ещё раз.");
    return false;
  }

  if (side === "before") {
    data.beforePhotoKey = key;
    data.beforePhotoType = downloaded.contentType;
  } else {
    data.afterPhotoKey = key;
    data.afterPhotoType = downloaded.contentType;
  }

  return true;
}

function buildSummary(data: SessionData): string {
  return [
    "Проверьте данные записи:",
    `Дом: ${data.houseAddress}`,
    `Описание: ${data.description}`,
    `Место: ${data.location}`,
    `Объём: ${data.volume}`,
    `Материалы: ${data.materials}`,
    `Фото до: ${data.beforePhotoKey ? "есть" : "нет"}`,
    `Фото после: ${data.afterPhotoKey ? "есть" : "нет"}`,
  ].join("\n");
}

async function finalizeEntry(userId: number, employeeId: number, data: SessionData) {
  if (!data.houseId || !data.description || !data.location || !data.volume) {
    await send(userId, "Не хватает данных для сохранения записи, начните заново.");
    await clearSession(String(userId));
    await showMenu(userId);
    return;
  }

  try {
    // costKopecks/costConfirmed are intentionally left at their defaults
    // (null/false) — employees never enter cost data through the bot or
    // the website; cost is set separately by office staff.
    await db.completedWork.create({
      data: {
        houseId: data.houseId,
        employeeId,
        description: data.description,
        location: data.location,
        volume: data.volume,
        materials: data.materials ?? "",
        beforePhotoKey: data.beforePhotoKey,
        beforePhotoType: data.beforePhotoType,
        afterPhotoKey: data.afterPhotoKey,
        afterPhotoType: data.afterPhotoType,
      },
    });

    await clearSession(String(userId));
    await send(userId, "Запись сохранена. Спасибо!");
    await showMenu(userId);
  } catch {
    await send(userId, "Не удалось сохранить запись, попробуйте ещё раз.");
  }
}

async function handleLinkedMessage(
  userId: number,
  employeeId: number,
  message: Message,
) {
  const text = (message.body.text ?? "").trim();
  const lower = text.toLowerCase();

  const session = await getSession(String(userId));

  if (lower === "отмена" || lower === "/cancel") {
    if (session) {
      await cancelFlow(userId, session.data);
    } else {
      await showMenu(userId);
    }
    return;
  }

  const step = session?.step ?? "menu";
  const data = session?.data ?? {};

  switch (step) {
    case "menu": {
      await showMenu(userId);
      return;
    }

    case "choosing_house": {
      const options = data.houseOptions ?? [];
      const asIndex = Number(text);
      let match: HouseOption | undefined;

      if (Number.isInteger(asIndex)) {
        match = options.find((o) => o.index === asIndex);
      }

      if (!match && text) {
        match = options.find(
          (o) =>
            o.address.toLowerCase().includes(lower) ||
            shortHouseLabel(o.address).toLowerCase().includes(lower),
        );
      }

      if (!match) {
        await send(userId, buildHouseListText(options));
        return;
      }

      data.houseId = match.id;
      data.houseAddress = shortHouseLabel(match.address);
      await setSession(String(userId), "entering_description", data);
      await send(userId, "Опишите выполненную работу.");
      return;
    }

    case "entering_description": {
      if (!text || text.length > LIMITS.description) {
        await send(userId, `Опишите работу текстом (до ${LIMITS.description} символов).`);
        return;
      }
      data.description = text;
      await setSession(String(userId), "entering_location", data);
      await send(userId, "Укажите место проведения работ (например: подъезд 2, этаж 3).");
      return;
    }

    case "entering_location": {
      if (!text || text.length > LIMITS.location) {
        await send(userId, `Укажите место проведения работ (до ${LIMITS.location} символов).`);
        return;
      }
      data.location = text;
      await setSession(String(userId), "entering_volume", data);
      await send(userId, "Укажите объём выполненных работ (например: 15 м², 3 шт.).");
      return;
    }

    case "entering_volume": {
      if (!text || text.length > LIMITS.volume) {
        await send(userId, `Укажите объём выполненных работ (до ${LIMITS.volume} символов).`);
        return;
      }
      data.volume = text;
      await setSession(String(userId), "entering_materials", data);
      await send(
        userId,
        `Перечислите использованные материалы (если не использовались — напишите «нет»).`,
      );
      return;
    }

    case "entering_materials": {
      if (!text || text.length > LIMITS.materials) {
        await send(userId, `Перечислите материалы (до ${LIMITS.materials} символов) или напишите «нет».`);
        return;
      }
      data.materials = lower === "нет" ? "" : text;
      await setSession(String(userId), "awaiting_before_photo", data);
      await send(userId, "Пришлите фото ДО начала работ, или напишите «пропустить».");
      return;
    }

    case "awaiting_before_photo": {
      const skip = lower === "пропустить";
      const uploaded = skip
        ? false
        : await handlePhotoStep(userId, data, "before", message);

      if (!skip && !uploaded) {
        return;
      }

      await setSession(String(userId), "awaiting_after_photo", data);
      await send(userId, "Пришлите фото ПОСЛЕ выполнения работ, или напишите «пропустить».");
      return;
    }

    case "awaiting_after_photo": {
      const skip = lower === "пропустить";
      const uploaded = skip
        ? false
        : await handlePhotoStep(userId, data, "after", message);

      if (!skip && !uploaded) {
        return;
      }

      await setSession(String(userId), "confirming", data);
      await send(userId, buildSummary(data), CONFIRM_KEYBOARD);
      return;
    }

    case "confirming": {
      if (lower === "да") {
        await finalizeEntry(userId, employeeId, data);
        return;
      }
      if (lower === "нет") {
        await cancelFlow(userId, data);
        return;
      }
      await send(userId, buildSummary(data), CONFIRM_KEYBOARD);
      return;
    }

    default:
      await showMenu(userId);
  }
}

async function handleMessageCreated(message: Message) {
  const senderId = message.sender?.user_id;

  if (!senderId || message.recipient.chat_type !== "dialog") {
    // No sender to reply to, or a group/channel context — this bot's
    // flow is designed for a private 1:1 chat with each employee.
    return;
  }

  const contact = message.body.attachments?.find(isContactAttachment);

  if (contact) {
    await handleContactShared(senderId, contact);
    return;
  }

  const employee = await findEmployeeByMaxUserId(senderId);

  if (!employee) {
    await askForContact(
      senderId,
      "Здравствуйте! Чтобы пользоваться ботом, поделитесь, пожалуйста, своим контактом — так мы найдём вас в системе.",
    );
    return;
  }

  await handleLinkedMessage(senderId, employee.id, message);
}

async function handleCallback(update: Extract<Update, { update_type: "message_callback" }>) {
  const senderId = update.callback.user.user_id;
  const payload = update.callback.payload;
  const employee = await findEmployeeByMaxUserId(senderId);

  if (!employee) {
    await askForContact(
      senderId,
      "Чтобы продолжить, сначала поделитесь своим контактом.",
    );
    return;
  }

  if (payload === "start_new_work") {
    await startChoosingHouse(senderId);
    return;
  }

  if (payload === "confirm_save" || payload === "confirm_cancel") {
    const session = await getSession(String(senderId));

    if (!session) {
      await showMenu(senderId);
      return;
    }

    if (payload === "confirm_save") {
      await finalizeEntry(senderId, employee.id, session.data);
    } else {
      await cancelFlow(senderId, session.data);
    }
  }
}

async function handleBotStarted(update: Extract<Update, { update_type: "bot_started" }>) {
  const senderId = update.user.user_id;
  const employee = await findEmployeeByMaxUserId(senderId);

  if (employee) {
    await showMenu(senderId);
    return;
  }

  await askForContact(
    senderId,
    `Здравствуйте! Это бот ООО «Л-Сити» для сотрудников. Чтобы начать, поделитесь, пожалуйста, своим контактом.`,
  );
}

export async function handleUpdate(update: Update): Promise<void> {
  switch (update.update_type) {
    case "message_created":
      await handleMessageCreated((update as Extract<Update, { update_type: "message_created" }>).message);
      return;
    case "message_callback":
      await handleCallback(update as Extract<Update, { update_type: "message_callback" }>);
      return;
    case "bot_started":
      await handleBotStarted(update as Extract<Update, { update_type: "bot_started" }>);
      return;
    default:
      // Update types this bot doesn't act on (bot_added, chat_title_changed, ...).
      return;
  }
}
