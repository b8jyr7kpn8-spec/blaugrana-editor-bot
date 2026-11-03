export default {
  async fetch(request, env) {
    if (request.method === "GET") {
      return new Response("Blaugrana Editor is running.");
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const update = await request.json();
    const api = `https://api.telegram.org/bot${env.BOT_TOKEN}`;

    async function tg(method, data) {
      const response = await fetch(`${api}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      return response.json();
    }

    const owner = String(env.OWNER_ID);
    const channel = env.CHANNEL_USERNAME;

    if (update.message) {
      const m = update.message;

      if (String(m.from?.id) !== owner || m.chat.type !== "private") {
        return new Response("OK");
      }

      const text = m.text || "";

      if (text === "/start") {
        await tg("sendMessage", {
          chat_id: m.chat.id,
          text: "🔵🔴 Blaugrana Editor на связи!\n\nОтправь пост командой:\n/draft Текст публикации"
        });
      } else if (text.startsWith("/draft")) {
        const draft = text.replace(/^\/draft\s*/, "").trim();

        if (!draft) {
          await tg("sendMessage", {
            chat_id: m.chat.id,
            text: "Добавь текст после /draft."
          });
        } else {
          await tg("sendMessage", {
            chat_id: m.chat.id,
            text: "📝 ПРЕДПРОСМОТР\n\n" + draft,
            reply_markup: {
              inline_keyboard: [[
                { text: "✅ Опубликовать", callback_data: "publish" },
                { text: "❌ Отклонить", callback_data: "reject" }
              ]]
            }
          });
        }
      }
    }

    if (update.callback_query) {
      const q = update.callback_query;

      if (String(q.from?.id) !== owner) {
        await tg("answerCallbackQuery", {
          callback_query_id: q.id,
          text: "Нет доступа."
        });
        return new Response("OK");
      }

      const draft = (q.message?.text || "").replace("📝 ПРЕДПРОСМОТР\n\n", "");

      if (q.data === "publish") {
        const result = await tg("sendMessage", {
          chat_id: channel,
          text: draft
        });

        if (result.ok) {
          await tg("editMessageText", {
            chat_id: q.message.chat.id,
            message_id: q.message.message_id,
            text: "✅ Опубликовано!\n\n" + draft
          });
        } else {
          await tg("editMessageText", {
            chat_id: q.message.chat.id,
            message_id: q.message.message_id,
            text: "❌ Ошибка публикации. Проверь права бота."
          });
        }
      }

      if (q.data === "reject") {
        await tg("editMessageText", {
          chat_id: q.message.chat.id,
          message_id: q.message.message_id,
          text: "❌ Черновик отклонён."
        });
      }

      await tg("answerCallbackQuery", {
        callback_query_id: q.id
      });
    }

    return new Response("OK");
  }
};
