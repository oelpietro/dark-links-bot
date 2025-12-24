require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const fetch = require("node-fetch");
const path = require("path");

const bot = new Telegraf(process.env.BOT_TOKEN);
const API_KEY = process.env.PUSHIN_API_KEY;

// pagamentos ativos
const pagamentos = new Map();
/*
pagamentos.set(userId, {
  pixId,
  intervalo,
  timeout,
  pixMessageId
})
*/

// ======================================================
// GERAR PIX
// ======================================================
async function gerarPix(valorCentavos) {
  try {
    const resp = await fetch("https://api.pushinpay.com.br/api/pix/cashIn", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        value: valorCentavos,
        webhook_url: null,
        split_rules: []
      })
    });

    const json = await resp.json();
    if (!resp.ok) {
      console.log("Erro ao gerar PIX:", json);
      return null;
    }

    return json;
  } catch (err) {
    console.log("Erro PIX:", err);
    return null;
  }
}

// ======================================================
// VERIFICAR PAGAMENTO + EXPIRAÇÃO
// ======================================================
function verificarPagamento(ctx, pixId, tempoExpiracaoMs = 10 * 60 * 1000) {
  const userId = ctx.from.id;

  const intervalo = setInterval(async () => {
    try {
      const resp = await fetch(
        `https://api.pushinpay.com.br/api/transactions/${pixId}`,
        {
          headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Accept": "application/json"
          }
        }
      );

      if (!resp.ok) return;

      const json = await resp.json();

      if (json.status && json.status.toLowerCase() === "paid") {
        clearInterval(intervalo);
        clearTimeout(pagamentos.get(userId)?.timeout);

        const dados = pagamentos.get(userId);

        // 🗑️ apaga a mensagem do PIX
        if (dados?.pixMessageId) {
          try {
            await ctx.telegram.deleteMessage(
              ctx.chat.id,
              dados.pixMessageId
            );
          } catch (e) {
            console.log("Não foi possível apagar a mensagem do PIX");
          }
        }

        pagamentos.delete(userId);

        await ctx.reply(
          `✅ *Pagamento confirmado!*\n\n` +
          `🎉 Seu acesso foi liberado!\n\n` +
          `👉 *Acesse agora:*\nhttps://t.me/+bd0I-6yEOhtiN2Fh`,
          { parse_mode: "Markdown" }
        );
      }
    } catch (err) {
      console.log("Erro verificação:", err);
    }
  }, 60 * 1000); // verifica a cada 60s

  // ⏰ EXPIRAÇÃO
  const timeout = setTimeout(async () => {
    clearInterval(intervalo);

    const dados = pagamentos.get(userId);

    // apaga a mensagem do PIX quando expirar
    if (dados?.pixMessageId) {
      try {
        await ctx.telegram.deleteMessage(
          ctx.chat.id,
          dados.pixMessageId
        );
      } catch (e) {}
    }

    pagamentos.delete(userId);

    await ctx.reply(
      `⏰ *PIX expirado!*\n\nEsse pagamento não é mais válido.\nClique novamente para gerar outro.`,
      { parse_mode: "Markdown" }
    );
  }, tempoExpiracaoMs);

  pagamentos.set(userId, { pixId, intervalo, timeout });
}

// ======================================================
// START
// ======================================================
bot.start(async (ctx) => {
  await ctx.replyWithPhoto(
    {
      source: path.join(__dirname, "imagens", "5037788251149765451.jpg")
    },
    {
      caption: "🔞 DARK LINKS 🌚🔗✅\n\n  🗂 LIVES +18/n 🗂 IDOSAS +18/n 🗂 NOVINHAS +18/n 🗂 AMADORAS  +18/n 🗂 BDSM +18/n 🗂 CASADAS +18/n+ 🗂 SCAT +18/n 🗂 GORDINHAS +18/n 🗂 GRÁVIDAS +18/n 🗂 HARD +18/n 🗂 LACTANTES +18/n 🗂 FEMBOYS +18/n 🗂 VAZADAS +18/n/n De ❌ 34,90 R$/n 👇/n Por ✅ 24,90 R$/n/n⚠️ Você precisa ser maior de idade para comprar!/n/n✅ Seguro, nada ilegal aqui!/n ✅ Entrada automática após o pagamento/n🔥 *Escolha seu plano*\n\nClique abaixo para gerar o PIX:"",
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("💰 Plano Semanal — R$ 24,90", "pagar_2490")],
        [Markup.button.url("🆘 Suporte", "https://t.me/romanogs")]
      ])
    }
  );
});

// ======================================================
// BOTÃO PAGAMENTO
// ======================================================
bot.action("pagar_2490", async (ctx) => {
  const userId = ctx.from.id;

  if (pagamentos.has(userId)) {
    return ctx.reply("⏳ Você já tem um PIX ativo. Aguarde expirar.");
  }

  await ctx.answerCbQuery("⏳ Gerando PIX...");

  const valorCentavos = 2490;
  const nomePlano = "Plano Semanal";

  const pix = await gerarPix(valorCentavos);
  if (!pix) {
    return ctx.reply("❌ Erro ao gerar o PIX.");
  }

  verificarPagamento(ctx, pix.id);

  // 🔥 QR CODE BASE64 (FUNCIONAL)
  try {
    const base64data = pix.qr_code_base64.split(",")[1];
    const imgBuffer = Buffer.from(base64data, "base64");

    const sent = await ctx.replyWithPhoto(
      { source: imgBuffer },
      {
        caption:
          `💳 *PIX Gerado!*\n\n` +
          `📌 *${nomePlano}*\n` +
          `💰 Valor: *R$ ${(valorCentavos / 100).toFixed(2)}*\n\n` +
          `📋 *PIX Copia e Cola:*\n\`${pix.qr_code}\`\n\n` +
          `⏳ *Este PIX expira em 10 minutos*`,
        parse_mode: "Markdown"
      }
    );

    // salva o message_id do PIX
    const dados = pagamentos.get(userId);
    pagamentos.set(userId, {
      ...dados,
      pixMessageId: sent.message_id
    });

  } catch (err) {
    await ctx.reply(
      `📋 *PIX Copia e Cola:*\n\`${pix.qr_code}\``,
      { parse_mode: "Markdown" }
    );
  }
});

// ======================================================
bot.launch();
console.log("🤖 Bot online");

process.on("SIGINT", () => bot.stop());
process.on("SIGTERM", () => bot.stop());
