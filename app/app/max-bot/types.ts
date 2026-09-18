// Local type definitions mirroring the MAX Bot API's incoming webhook
// payload shapes.
//
// The official `@maxhub/max-bot-api` client (used for outgoing calls via
// `bot.api.*`, see client.ts) does NOT export these incoming-update types
// from its public package entry point — only its own `Api`/`Bot`/`Webhook`
// classes and outgoing-attachment helpers are exported. These types were
// copied from the client library's own (internal, unexported) source at
// github.com/max-messenger/max-bot-api-client-ts, so the webhook route can
// parse `request.json()` into something typed instead of `any`, without
// depending on the library's private `handleUpdate` dispatcher (which
// can't be called from outside code — see route.ts for why).

export type UserLocale = string;

export type MaxUser = {
  user_id: number;
  name: string;
  first_name: string;
  last_name?: string;
  username: string | null;
  is_bot: boolean;
  last_activity_time: number;
};

export type ChatType = "dialog" | "chat" | "channel";

export type MediaPayload = {
  url: string;
  token: string;
};

export type PhotoAttachment = {
  type: "image";
  payload: MediaPayload & { photo_id: number };
};

export type ContactAttachment = {
  type: "contact";
  payload: {
    vcf_info: string;
    max_info: MaxUser;
    hash: string;
  };
};

// Other attachment types (video, audio, file, sticker, location, share,
// inline_keyboard) can appear on incoming messages too, but the bot's
// flow only acts on photos and shared contacts, so they're typed loosely
// here rather than fully mirrored.
export type OtherAttachment = { type: string; [key: string]: unknown };

export type Attachment = PhotoAttachment | ContactAttachment | OtherAttachment;

export type MessageBody = {
  mid: string;
  seq: number;
  text: string | null;
  attachments?: Attachment[] | null;
};

export type MessageRecipient = {
  chat_id: number | null;
  chat_type: ChatType;
  user_id: number | null;
  post_id: number | null;
};

export type Message = {
  sender?: MaxUser | null;
  recipient: MessageRecipient;
  timestamp: number;
  body: MessageBody;
};

export type MessageCreatedUpdate = {
  update_type: "message_created";
  timestamp: number;
  message: Message;
};

export type MessageCallbackUpdate = {
  update_type: "message_callback";
  timestamp: number;
  callback: {
    timestamp: number;
    callback_id: string;
    payload?: string;
    user: MaxUser;
  };
  message?: Message | null;
};

export type BotStartedUpdate = {
  update_type: "bot_started";
  timestamp: number;
  chat_id: number;
  user: MaxUser;
  payload?: string | null;
};

// Other update types (bot_added, chat_title_changed, user_added, ...)
// exist but aren't relevant to a bot used only in private 1:1 chats, so
// they fall through to the generic case in the handler.
export type Update =
  | MessageCreatedUpdate
  | MessageCallbackUpdate
  | BotStartedUpdate
  | { update_type: string; [key: string]: unknown };
