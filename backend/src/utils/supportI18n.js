// backend/src/utils/supportI18n.js
// Customer-facing support wording in every app language. A ticket stores the language the
// customer used; everything WE send about it is rendered in that language. The agent's own
// typed reply is delivered as written. Keep in sync with mobile/src/i18n/locales.
'use strict';

const SUPPORTED_LANGUAGES = ["en", "fr", "es", "pt", "de", "da", "ru", "tr", "ar", "hi", "zh"];
const RTL_LANGUAGES = ['ar'];
const STRINGS = {
  "en": {
    "submitted": "Support ticket submitted. Our team will get back to you shortly.",
    "replyTitle": "Update on Ticket #{n}",
    "resolvedTitle": "Ticket #{n} Resolved ✅",
    "resolvedBody": "Your support ticket has been resolved.",
    "resolutionLabel": "Resolution",
    "replyPill": "Support reply",
    "replyHeading": "We've replied to ticket #{n}",
    "replyIntro": "Hi {name}, one of our support agents just responded to your ticket.",
    "supportSays": "Support says",
    "replyOutro": "Log in to view the full conversation and reply if you need to provide more information.",
    "replySubject": "Support replied to your ticket #{n}",
    "viewTicket": "View ticket #{n}",
    "resolvedPill": "Ticket resolved",
    "resolvedHeading": "Ticket #{n} has been resolved ✅",
    "resolvedIntro": "Hi {name}, your support ticket has been marked as resolved.",
    "resolvedOutro": "If this didn't fully solve your issue, just reopen the ticket or contact us again — we're happy to help further.",
    "resolvedSubject": "Your ticket #{n} has been resolved"
  },
  "fr": {
    "submitted": "Ticket d'assistance envoyé. Notre équipe vous répondra très bientôt.",
    "replyTitle": "Mise à jour du ticket n° {n}",
    "resolvedTitle": "Ticket n° {n} résolu ✅",
    "resolvedBody": "Votre ticket d'assistance a été résolu.",
    "resolutionLabel": "Résolution",
    "replyPill": "Réponse du support",
    "replyHeading": "Nous avons répondu à votre ticket n° {n}",
    "replyIntro": "Bonjour {name}, l'un de nos agents du support vient de répondre à votre ticket.",
    "supportSays": "Le support écrit",
    "replyOutro": "Connectez-vous pour consulter toute la conversation et répondre si vous avez d'autres informations à nous donner.",
    "replySubject": "Le support a répondu à votre ticket n° {n}",
    "viewTicket": "Voir le ticket n° {n}",
    "resolvedPill": "Ticket résolu",
    "resolvedHeading": "Le ticket n° {n} est résolu ✅",
    "resolvedIntro": "Bonjour {name}, votre ticket d'assistance a été marqué comme résolu.",
    "resolvedOutro": "Si votre problème n'est pas entièrement réglé, rouvrez simplement le ticket ou contactez-nous à nouveau, nous serons ravis de vous aider.",
    "resolvedSubject": "Votre ticket n° {n} a été résolu"
  },
  "es": {
    "submitted": "Ticket de soporte enviado. Nuestro equipo se pondrá en contacto contigo pronto.",
    "replyTitle": "Actualización del ticket n.º {n}",
    "resolvedTitle": "Ticket n.º {n} resuelto ✅",
    "resolvedBody": "Tu ticket de soporte ha sido resuelto.",
    "resolutionLabel": "Resolución",
    "replyPill": "Respuesta de soporte",
    "replyHeading": "Hemos respondido a tu ticket n.º {n}",
    "replyIntro": "Hola {name}, uno de nuestros agentes de soporte acaba de responder a tu ticket.",
    "supportSays": "Soporte dice",
    "replyOutro": "Inicia sesión para ver la conversación completa y responder si necesitas aportar más información.",
    "replySubject": "Soporte ha respondido a tu ticket n.º {n}",
    "viewTicket": "Ver ticket n.º {n}",
    "resolvedPill": "Ticket resuelto",
    "resolvedHeading": "El ticket n.º {n} ha sido resuelto ✅",
    "resolvedIntro": "Hola {name}, tu ticket de soporte se ha marcado como resuelto.",
    "resolvedOutro": "Si esto no resolvió del todo tu problema, vuelve a abrir el ticket o contáctanos de nuevo; estaremos encantados de ayudarte.",
    "resolvedSubject": "Tu ticket n.º {n} ha sido resuelto"
  },
  "pt": {
    "submitted": "Ticket de suporte enviado. A nossa equipa entrará em contacto consigo em breve.",
    "replyTitle": "Atualização do ticket n.º {n}",
    "resolvedTitle": "Ticket n.º {n} resolvido ✅",
    "resolvedBody": "O seu ticket de suporte foi resolvido.",
    "resolutionLabel": "Resolução",
    "replyPill": "Resposta do suporte",
    "replyHeading": "Respondemos ao seu ticket n.º {n}",
    "replyIntro": "Olá {name}, um dos nossos agentes de suporte acabou de responder ao seu ticket.",
    "supportSays": "O suporte diz",
    "replyOutro": "Inicie sessão para ver a conversa completa e responder, se precisar de fornecer mais informações.",
    "replySubject": "O suporte respondeu ao seu ticket n.º {n}",
    "viewTicket": "Ver ticket n.º {n}",
    "resolvedPill": "Ticket resolvido",
    "resolvedHeading": "O ticket n.º {n} foi resolvido ✅",
    "resolvedIntro": "Olá {name}, o seu ticket de suporte foi marcado como resolvido.",
    "resolvedOutro": "Se isto não resolveu totalmente o seu problema, reabra o ticket ou contacte-nos novamente — teremos todo o gosto em ajudar.",
    "resolvedSubject": "O seu ticket n.º {n} foi resolvido"
  },
  "de": {
    "submitted": "Support-Ticket gesendet. Unser Team meldet sich in Kürze bei Ihnen.",
    "replyTitle": "Aktualisierung zu Ticket Nr. {n}",
    "resolvedTitle": "Ticket Nr. {n} gelöst ✅",
    "resolvedBody": "Ihr Support-Ticket wurde gelöst.",
    "resolutionLabel": "Lösung",
    "replyPill": "Antwort vom Support",
    "replyHeading": "Wir haben auf Ihr Ticket Nr. {n} geantwortet",
    "replyIntro": "Hallo {name}, einer unserer Support-Mitarbeiter hat soeben auf Ihr Ticket geantwortet.",
    "supportSays": "Der Support schreibt",
    "replyOutro": "Melden Sie sich an, um den gesamten Verlauf zu sehen und zu antworten, falls Sie weitere Informationen haben.",
    "replySubject": "Der Support hat auf Ihr Ticket Nr. {n} geantwortet",
    "viewTicket": "Ticket Nr. {n} ansehen",
    "resolvedPill": "Ticket gelöst",
    "resolvedHeading": "Ticket Nr. {n} wurde gelöst ✅",
    "resolvedIntro": "Hallo {name}, Ihr Support-Ticket wurde als gelöst markiert.",
    "resolvedOutro": "Falls Ihr Problem dadurch nicht vollständig gelöst wurde, öffnen Sie das Ticket einfach erneut oder kontaktieren Sie uns noch einmal – wir helfen gern weiter.",
    "resolvedSubject": "Ihr Ticket Nr. {n} wurde gelöst"
  },
  "da": {
    "submitted": "Supportsag er sendt. Vores team vender tilbage til dig snart.",
    "replyTitle": "Opdatering på sag nr. {n}",
    "resolvedTitle": "Sag nr. {n} løst ✅",
    "resolvedBody": "Din supportsag er blevet løst.",
    "resolutionLabel": "Løsning",
    "replyPill": "Svar fra support",
    "replyHeading": "Vi har svaret på din sag nr. {n}",
    "replyIntro": "Hej {name}, en af vores supportmedarbejdere har netop svaret på din sag.",
    "supportSays": "Support skriver",
    "replyOutro": "Log ind for at se hele samtalen og svare, hvis du har flere oplysninger.",
    "replySubject": "Support har svaret på din sag nr. {n}",
    "viewTicket": "Se sag nr. {n}",
    "resolvedPill": "Sag løst",
    "resolvedHeading": "Sag nr. {n} er løst ✅",
    "resolvedIntro": "Hej {name}, din supportsag er markeret som løst.",
    "resolvedOutro": "Hvis det ikke løste dit problem helt, kan du genåbne sagen eller kontakte os igen – vi hjælper gerne videre.",
    "resolvedSubject": "Din sag nr. {n} er løst"
  },
  "ru": {
    "submitted": "Обращение в поддержку отправлено. Наша команда скоро свяжется с вами.",
    "replyTitle": "Обновление по обращению №{n}",
    "resolvedTitle": "Обращение №{n} решено ✅",
    "resolvedBody": "Ваше обращение в поддержку решено.",
    "resolutionLabel": "Решение",
    "replyPill": "Ответ поддержки",
    "replyHeading": "Мы ответили на ваше обращение №{n}",
    "replyIntro": "Здравствуйте, {name}! Один из наших сотрудников поддержки только что ответил на ваше обращение.",
    "supportSays": "Поддержка пишет",
    "replyOutro": "Войдите в приложение, чтобы увидеть всю переписку и ответить, если нужно сообщить дополнительную информацию.",
    "replySubject": "Поддержка ответила на ваше обращение №{n}",
    "viewTicket": "Открыть обращение №{n}",
    "resolvedPill": "Обращение решено",
    "resolvedHeading": "Обращение №{n} решено ✅",
    "resolvedIntro": "Здравствуйте, {name}! Ваше обращение в поддержку отмечено как решённое.",
    "resolvedOutro": "Если проблема решена не полностью, просто откройте обращение снова или свяжитесь с нами — мы с радостью поможем.",
    "resolvedSubject": "Ваше обращение №{n} решено"
  },
  "tr": {
    "submitted": "Destek talebi gönderildi. Ekibimiz kısa süre içinde sizinle iletişime geçecek.",
    "replyTitle": "{n} numaralı talepte güncelleme",
    "resolvedTitle": "{n} numaralı talep çözüldü ✅",
    "resolvedBody": "Destek talebiniz çözüldü.",
    "resolutionLabel": "Çözüm",
    "replyPill": "Destek yanıtı",
    "replyHeading": "{n} numaralı talebinizi yanıtladık",
    "replyIntro": "Merhaba {name}, destek ekibimizden bir temsilci talebinizi az önce yanıtladı.",
    "supportSays": "Destek ekibi yazıyor",
    "replyOutro": "Konuşmanın tamamını görmek ve ek bilgi vermek için giriş yapın.",
    "replySubject": "Destek ekibi {n} numaralı talebinizi yanıtladı",
    "viewTicket": "{n} numaralı talebi görüntüle",
    "resolvedPill": "Talep çözüldü",
    "resolvedHeading": "{n} numaralı talep çözüldü ✅",
    "resolvedIntro": "Merhaba {name}, destek talebiniz çözüldü olarak işaretlendi.",
    "resolvedOutro": "Sorununuz tamamen çözülmediyse talebi yeniden açabilir veya bizimle tekrar iletişime geçebilirsiniz; yardımcı olmaktan memnuniyet duyarız.",
    "resolvedSubject": "{n} numaralı talebiniz çözüldü"
  },
  "ar": {
    "submitted": "تم إرسال تذكرة الدعم. سيتواصل معك فريقنا قريبًا.",
    "replyTitle": "تحديث على التذكرة رقم {n}",
    "resolvedTitle": "تم حل التذكرة رقم {n} ✅",
    "resolvedBody": "تم حل تذكرة الدعم الخاصة بك.",
    "resolutionLabel": "الحل",
    "replyPill": "رد من الدعم",
    "replyHeading": "لقد ردّينا على تذكرتك رقم {n}",
    "replyIntro": "مرحبًا {name}، قام أحد وكلاء الدعم لدينا بالرد على تذكرتك للتو.",
    "supportSays": "الدعم يقول",
    "replyOutro": "سجّل الدخول لعرض المحادثة كاملة والرد إذا كان لديك معلومات إضافية.",
    "replySubject": "ردّ الدعم على تذكرتك رقم {n}",
    "viewTicket": "عرض التذكرة رقم {n}",
    "resolvedPill": "تم حل التذكرة",
    "resolvedHeading": "تم حل التذكرة رقم {n} ✅",
    "resolvedIntro": "مرحبًا {name}، تم وضع علامة «تم الحل» على تذكرة الدعم الخاصة بك.",
    "resolvedOutro": "إذا لم تُحل مشكلتك بالكامل، يمكنك إعادة فتح التذكرة أو التواصل معنا مجددًا، ويسعدنا مساعدتك.",
    "resolvedSubject": "تم حل تذكرتك رقم {n}"
  },
  "hi": {
    "submitted": "सपोर्ट टिकट भेज दिया गया है। हमारी टीम जल्द ही आपसे संपर्क करेगी।",
    "replyTitle": "टिकट #{n} पर अपडेट",
    "resolvedTitle": "टिकट #{n} हल हो गया ✅",
    "resolvedBody": "आपका सपोर्ट टिकट हल कर दिया गया है।",
    "resolutionLabel": "समाधान",
    "replyPill": "सपोर्ट का जवाब",
    "replyHeading": "हमने आपके टिकट #{n} का जवाब दिया है",
    "replyIntro": "नमस्ते {name}, हमारे सपोर्ट एजेंट ने अभी आपके टिकट का जवाब दिया है।",
    "supportSays": "सपोर्ट का संदेश",
    "replyOutro": "पूरी बातचीत देखने और अधिक जानकारी देने के लिए लॉग इन करें।",
    "replySubject": "सपोर्ट ने आपके टिकट #{n} का जवाब दिया",
    "viewTicket": "टिकट #{n} देखें",
    "resolvedPill": "टिकट हल हुआ",
    "resolvedHeading": "टिकट #{n} हल हो गया है ✅",
    "resolvedIntro": "नमस्ते {name}, आपके सपोर्ट टिकट को हल के रूप में चिह्नित कर दिया गया है।",
    "resolvedOutro": "यदि आपकी समस्या पूरी तरह हल नहीं हुई है, तो टिकट दोबारा खोलें या हमसे फिर संपर्क करें — हमें मदद करके खुशी होगी।",
    "resolvedSubject": "आपका टिकट #{n} हल हो गया है"
  },
  "zh": {
    "submitted": "支持工单已提交。我们的团队会尽快与您联系。",
    "replyTitle": "工单 #{n} 有更新",
    "resolvedTitle": "工单 #{n} 已解决 ✅",
    "resolvedBody": "您的支持工单已解决。",
    "resolutionLabel": "解决方案",
    "replyPill": "客服回复",
    "replyHeading": "我们已回复您的工单 #{n}",
    "replyIntro": "{name}，您好！我们的一位客服刚刚回复了您的工单。",
    "supportSays": "客服回复",
    "replyOutro": "请登录查看完整对话，如需补充信息也可在此回复。",
    "replySubject": "客服已回复您的工单 #{n}",
    "viewTicket": "查看工单 #{n}",
    "resolvedPill": "工单已解决",
    "resolvedHeading": "工单 #{n} 已解决 ✅",
    "resolvedIntro": "{name}，您好！您的支持工单已被标记为已解决。",
    "resolvedOutro": "如果问题尚未完全解决，您可以重新打开工单或再次联系我们，我们很乐意继续协助。",
    "resolvedSubject": "您的工单 #{n} 已解决"
  }
};

const normalizeLanguage = (lang, fallback = 'en') => {
  const pick = (v) => String(v ?? '').trim().toLowerCase().split(/[-_]/)[0];
  const l = pick(lang);
  if (SUPPORTED_LANGUAGES.includes(l)) return l;
  const f = pick(fallback);
  return SUPPORTED_LANGUAGES.includes(f) ? f : 'en';
};
const tr = (lang, key, vars = {}) => {
  const l = normalizeLanguage(lang);
  const raw = STRINGS[l]?.[key] ?? STRINGS.en[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
};
const isRtl = (lang) => RTL_LANGUAGES.includes(normalizeLanguage(lang));

module.exports = { SUPPORTED_LANGUAGES, normalizeLanguage, tr, isRtl };
