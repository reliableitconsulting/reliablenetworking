// Cloudflare Pages Function: POST /api/inquiry
// Accepts the consultation-request form and emails it to the site owner via Resend.
//
// Required Pages environment variables:
//   RESEND_API_KEY  – API key from https://resend.com/api-keys
//   INQUIRY_TO      – destination mailbox, e.g. you@yourcompany.com
// Optional:
//   INQUIRY_FROM    – verified sender, e.g. inquiries@yourcompany.com
//                     (defaults to Resend's onboarding sender, which only
//                      delivers to the Resend account owner's address)

const RATE_LIMIT = new Map(); // ip -> { count, reset } — best-effort, per isolate

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function str(v, max) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

function rateLimited(ip) {
  const now = Date.now();
  const entry = RATE_LIMIT.get(ip);
  if (!entry || now > entry.reset) {
    RATE_LIMIT.set(ip, { count: 1, reset: now + 60 * 60 * 1000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 10; // 10 inquiries per IP per hour
}

const CONFIRM = {
  en: {
    subject: 'We received your consultation request — Reliable IT Consulting',
    body: (name) =>
      `Hi ${name},\n\nThanks for reaching out to Reliable IT Consulting. ` +
      `We've received your request and will review it — expect to hear from us within 3-5 business days.\n\n` +
      `— Reliable IT Consulting, Greater Seattle Area`,
  },
  zh: {
    subject: '我们已收到您的咨询请求 — Reliable IT Consulting',
    body: (name) =>
      `${name}，您好：\n\n感谢您联系 Reliable IT Consulting。我们已收到您的咨询请求并将尽快审核，` +
      `预计在 3–5 个工作日内回复您。\n\n— Reliable IT Consulting，大西雅图地区`,
  },
};

function thankYouPage(locale, ok) {
  const zh = locale === 'zh';
  const title = ok
    ? zh ? '已收到您的请求' : 'Request received'
    : zh ? '发送失败' : 'Something went wrong';
  const body = ok
    ? zh ? '我们已收到您的咨询请求，将在 3–5 个工作日内回复您。'
         : 'We received your consultation request and will reply within 3-5 business days.'
    : zh ? '请求未能发送，请稍后重试。'
         : 'Your request could not be sent. Please try again later.';
  return new Response(
    `<!doctype html><html lang="${zh ? 'zh-CN' : 'en'}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem">` +
    `<h1>${title}</h1><p>${body}</p>` +
    `<p><a href="${zh ? '/zh/contact/' : '/contact/'}">${zh ? '返回联系页面' : 'Back to contact page'}</a></p>` +
    `</body></html>`,
    { status: ok ? 200 : 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';

  if (rateLimited(ip)) return json({ ok: false, error: 'rate_limited' }, 429);

  let data;
  let wantsJson = false;
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      data = await request.json();
      wantsJson = true;
    } else {
      const fd = await request.formData();
      data = Object.fromEntries(fd.entries());
    }
  } catch {
    return wantsJson ? json({ ok: false, error: 'bad_request' }, 400) : thankYouPage('en', false);
  }

  // Honeypot: bots fill this, humans never see it. Pretend success.
  if (str(data.website, 200)) {
    return wantsJson ? json({ ok: true }) : thankYouPage(data.locale === 'zh' ? 'zh' : 'en', true);
  }

  // Timestamp check: reject forms submitted implausibly fast (< 2.5s)
  const ts = Number(data._ts);
  if (ts && Date.now() - ts < 2500) {
    return wantsJson ? json({ ok: true }) : thankYouPage(data.locale === 'zh' ? 'zh' : 'en', true);
  }

  const name = str(data.name, 100);
  const email = str(data.email, 160);
  const service = str(data.service, 80);
  const description = str(data.description, 4000);
  const company = str(data.company, 120);
  const phone = str(data.phone, 40);
  const location = str(data.location, 120);
  const employees = str(data.employees, 40);
  const timeline = str(data.timeline, 120);
  const contactMethod = str(data.contactMethod, 20);
  const locale = data.locale === 'zh' ? 'zh' : 'en';
  const referer = request.headers.get('referer') || '';
  const page = str(referer, 300);

  const missing = [];
  if (!name) missing.push('name');
  if (!validEmail(email)) missing.push('email');
  if (!service) missing.push('service');
  if (!description) missing.push('description');
  if (missing.length) {
    return wantsJson
      ? json({ ok: false, error: 'validation', fields: missing }, 400)
      : thankYouPage(locale, false);
  }

  if (!env.RESEND_API_KEY || !env.INQUIRY_TO) {
    return wantsJson
      ? json({ ok: false, error: 'not_configured' }, 503)
      : thankYouPage(locale, false);
  }

  const from = env.INQUIRY_FROM || 'onboarding@resend.dev';
  const subject = `New consultation request — ${service} — ${name}`;
  const lines = [
    `Name: ${name}`,
    `Email: ${email}`,
    company && `Company: ${company}`,
    phone && `Phone: ${phone}`,
    location && `Business location: ${location}`,
    employees && `Employees: ${employees}`,
    `Service needed: ${service}`,
    timeline && `Desired timeline: ${timeline}`,
    contactMethod && `Preferred contact method: ${contactMethod}`,
    '',
    'Project description:',
    description,
    '',
    `Submitted from: ${page || '(unknown)'}`,
  ].filter(Boolean);

  const send = (payload) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

  // 1) Notify the owner. Reply-To goes straight to the inquirer.
  let ownerRes;
  try {
    ownerRes = await send({
      from: `Reliable IT Consulting <${from}>`,
      to: [env.INQUIRY_TO],
      reply_to: email,
      subject,
      text: lines.join('\n'),
    });
  } catch {
    ownerRes = { ok: false };
  }
  if (!ownerRes.ok) {
    return wantsJson
      ? json({ ok: false, error: 'send_failed' }, 502)
      : thankYouPage(locale, false);
  }

  // 2) Confirmation to the inquirer (best effort — never blocks success).
  try {
    const c = CONFIRM[locale];
    await send({
      from: `Reliable IT Consulting <${from}>`,
      to: [email],
      subject: c.subject,
      text: c.body(name),
    });
  } catch {
    /* confirmation is a courtesy; the inquiry itself was delivered */
  }

  return wantsJson ? json({ ok: true }) : thankYouPage(locale, true);
}
