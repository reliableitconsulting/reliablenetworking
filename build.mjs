// Static site generator for Reliable IT Consulting.
// Reads site.config.json + content/<locale>/*.json, renders to dist/.
// Run: node build.mjs
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'));

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Prefix internal hrefs with /zh for the Chinese locale. */
const L = (locale, href) => {
  if (!href || !href.startsWith('/') || href.startsWith('//')) return href;
  return locale === 'zh' ? '/zh' + href : href;
};

/** Canonical path for a page id + locale. */
const pagePath = (locale, id) => {
  const base = id === 'home' ? '/' : `/${id}/`;
  return locale === 'zh' ? (base === '/' ? '/zh/' : `/zh${base}`) : base;
};

const load = (locale, name) =>
  JSON.parse(readFileSync(join(root, 'content', locale, `${name}.json`), 'utf8'));

// ---------------------------------------------------------------- head
function head({ locale, site, seo, pageId, path }) {
  const url = config.baseUrl.replace(/\/$/, '') + path;
  const altLocale = locale === 'en' ? 'zh' : 'en';
  const altPath = pagePath(altLocale, pageId);
  const altUrl = config.baseUrl.replace(/\/$/, '') + altPath;
  const ogImage = config.baseUrl.replace(/\/$/, '') + '/assets/img/hero-network.jpg';

  const org = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': config.baseUrl.replace(/\/$/, '') + '/#organization',
    name: config.siteName,
    slogan: config.tagline,
    description: seo.description,
    url: config.baseUrl,
    image: ogImage,
    areaServed: config.serviceCities.map((c) => ({ '@type': 'City', name: c, addressRegion: 'WA', addressCountry: 'US' })),
    knowsLanguage: ['English', 'Chinese'],
    knowsAbout: [
      'Network consulting',
      'Office network setup',
      'Business Wi-Fi',
      'Structured cabling',
      'Network security',
      'Firewall and VPN',
      'Network monitoring',
      'Enterprise network engineering',
    ],
  };
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.siteName,
    url: config.baseUrl,
    inLanguage: [locale === 'en' ? 'en' : 'zh-CN'],
  };

  return `<!doctype html>
<html lang="${esc(site.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(seo.title)}</title>
<meta name="description" content="${esc(seo.description)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="canonical" href="${esc(url)}">
<link rel="alternate" hreflang="en" href="${esc(locale === 'en' ? url : altUrl)}">
<link rel="alternate" hreflang="zh-CN" href="${esc(locale === 'zh' ? url : altUrl)}">
<link rel="alternate" hreflang="x-default" href="${esc(locale === 'en' ? url : altUrl)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(config.siteName)}">
<meta property="og:title" content="${esc(seo.title)}">
<meta property="og:description" content="${esc(seo.description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:width" content="1600">
<meta property="og:image:height" content="900">
<meta property="og:image:alt" content="${esc(config.siteName)} — ${esc(config.tagline)}">
<meta property="og:locale" content="${esc(site.ogLocale)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(seo.title)}">
<meta name="twitter:description" content="${esc(seo.description)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<meta name="twitter:image:alt" content="${esc(config.siteName)} — ${esc(config.tagline)}">
<meta name="theme-color" content="#0a1c33">
<link rel="icon" type="image/svg+xml" href="/assets/img/favicon.svg">
<link rel="alternate" type="text/markdown" href="/llms.txt" title="LLM-friendly site summary">
<link rel="stylesheet" href="/assets/css/style.css">
<script type="application/ld+json">${JSON.stringify(org)}</script>
<script type="application/ld+json">${JSON.stringify(website)}</script>
</head>`;
}

const logoSvg = `<svg class="brand-mark" viewBox="0 0 40 40" width="34" height="34" aria-hidden="true"><rect width="40" height="40" rx="9" fill="#0a1c33"/><g stroke="#5ea0ff" stroke-width="2" fill="none"><path d="M20 9v22M9 20h22"/></g><g fill="#ffffff"><circle cx="20" cy="9" r="3.2"/><circle cx="20" cy="31" r="3.2"/><circle cx="9" cy="20" r="3.2"/><circle cx="31" cy="20" r="3.2"/></g><circle cx="20" cy="20" r="4" fill="#f59e0b"/></svg>`;

// ---------------------------------------------------------------- header / footer
function header({ locale, site, pageId }) {
  const navItems = site.nav
    .map((n) => {
      const active = n.id === pageId ? ' aria-current="page"' : '';
      return `<li><a href="${esc(L(locale, n.href))}"${active}>${esc(n.label)}</a></li>`;
    })
    .join('\n');
  const other = locale === 'en' ? 'zh' : 'en';
  const otherLabel = locale === 'en' ? '中文' : 'EN';
  const curLabel = locale === 'en' ? 'EN' : '中文';
  return `<a class="skip-link" href="#main">${esc(site.skipLink)}</a>
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="${esc(L(locale, '/'))}" aria-label="${esc(config.siteName)}">
      ${logoSvg}
      <span class="brand-name">${esc(config.siteName)}</span>
    </a>
    <nav class="site-nav" aria-label="Primary">
      <button class="nav-toggle" aria-expanded="false" aria-controls="nav-menu" aria-label="${esc(site.menuOpen)}">
        <span></span><span></span><span></span>
      </button>
      <div class="nav-menu" id="nav-menu">
        <ul>
          ${navItems}
        </ul>
        <div class="nav-meta">
          <div class="lang-switch" role="group" aria-label="${esc(site.langLabel)}">
            <span class="lang-cur" aria-current="true">${esc(curLabel)}</span>
            <span class="lang-sep" aria-hidden="true">|</span>
            <a class="lang-other" href="${esc(pagePath(other, pageId))}" hreflang="${other === 'zh' ? 'zh-CN' : 'en'}">${esc(otherLabel)}</a>
          </div>
          <a class="btn btn-cta btn-sm" href="${esc(L(locale, site.headerCtaHref))}">${esc(site.headerCta)}</a>
        </div>
      </div>
    </nav>
  </div>
</header>`;
}

function ctaBand({ locale, site }) {
  const b = site.ctaBand;
  return `<section class="cta-band" aria-label="${esc(b.title)}">
  <div class="container">
    <h2>${esc(b.title)}</h2>
    <p>${esc(b.text)}</p>
    <div class="btn-row">
      <a class="btn btn-cta" href="${esc(L(locale, b.primaryHref))}">${esc(b.primary)}</a>
      <a class="btn btn-outline-light" href="${esc(L(locale, b.secondaryHref))}">${esc(b.secondary)}</a>
    </div>
  </div>
</section>`;
}

function footer({ locale, site }) {
  const navLinks = site.nav
    .map((n) => `<li><a href="${esc(L(locale, n.href))}">${esc(n.label)}</a></li>`)
    .join('\n');
  const svcLinks = site.footer.serviceLinks
    .map((s) => `<li><a href="${esc(L(locale, s.href))}">${esc(s.label)}</a></li>`)
    .join('\n');
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="container footer-grid">
    <div class="footer-brand">
      <div class="brand">${logoSvg}<span class="brand-name">${esc(config.siteName)}</span></div>
      <p>${esc(site.footer.tagline)}</p>
    </div>
    <nav aria-label="Footer">
      <h3>${esc(site.footer.companyHeading)}</h3>
      <ul>${navLinks}</ul>
    </nav>
    <nav aria-label="Services">
      <h3>${esc(site.footer.servicesHeading)}</h3>
      <ul>${svcLinks}</ul>
    </nav>
    <div>
      <h3>${esc(site.footer.contactHeading)}</h3>
      <ul class="footer-contact">
        <li>${esc(site.footer.area)}</li>
        <li>${esc(site.footer.remote)}</li>
        <li>${esc(site.footer.languages)}</li>
      </ul>
      <a class="btn btn-cta btn-sm" href="${esc(L(locale, site.headerCtaHref))}">${esc(site.headerCta)}</a>
    </div>
  </div>
  <div class="container footer-legal">
    <span>© ${year} ${esc(config.siteName)}. ${esc(site.footer.rights)}</span>
    <span class="legal-links">
      <a href="${esc(L(locale, '/privacy/'))}">${esc(site.footer.privacy)}</a>
      <a href="${esc(L(locale, '/terms/'))}">${esc(site.footer.terms)}</a>
    </span>
  </div>
</footer>
<script src="/assets/js/main.js" defer></script>`;
}

// ---------------------------------------------------------------- page sections
function pageHero(title, intro) {
  return `<section class="page-hero">
  <div class="container">
    <h1>${esc(title)}</h1>
    ${intro ? `<p class="lede">${esc(intro)}</p>` : ''}
  </div>
</section>`;
}

function checkList(items) {
  return `<ul class="check-list">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
}

/** Responsive image: WebP source with JPG fallback when a .webp twin exists. */
function imgTag(src, alt, attrs = '') {
  const webp = String(src).replace(/\.jpg$/i, '.webp');
  const img = `<img src="${esc(src)}" alt="${esc(alt)}" ${attrs}>`;
  if (webp === src) return img;
  return `<picture><source type="image/webp" srcset="${esc(webp)}">${img}</picture>`;
}

function faqSection(locale, faq) {
  if (!faq || !faq.items || !faq.items.length) return '';
  const items = faq.items
    .map((f) => `<div class="faq-item reveal"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`)
    .join('\n');
  return `<section class="section section-alt"><div class="container narrow">
    <h2 class="section-title">${esc(faq.heading)}</h2>
    <div class="faq-list">${items}</div>
  </div></section>`;
}

// ---------------------------------------------------------------- home
function renderHome({ locale, site, c }) {
  const h = c.home;
  const hero = h.hero;
  const helpCards = h.help.items
    .map(
      (it) => `<a class="help-card reveal" href="${esc(L(locale, it.href))}">
        <h3>${esc(it.title)}</h3>
        <p>${esc(it.text)}</p>
        <span class="card-link" aria-hidden="true">→</span>
      </a>`
    )
    .join('\n');
  const whyItems = h.why.items
    .map(
      (it) => `<div class="why-item reveal">
        <h3>${esc(it.title)}</h3>
        <p>${esc(it.text)}</p>
      </div>`
    )
    .join('\n');
  const nc = c['network-care'];
  const plans = nc.plans.map((p) => planCard(locale, p, true)).join('\n');

  return `<section class="hero">
  <div class="container hero-grid">
    <div class="hero-copy">
      <p class="eyebrow">${esc(hero.eyebrow)}</p>
      <h1>${esc(hero.headline)}</h1>
      <p class="lede">${esc(hero.sub)}</p>
      <div class="btn-row">
        <a class="btn btn-cta" href="${esc(L(locale, hero.primaryCtaHref))}">${esc(hero.primaryCta)}</a>
        <a class="btn btn-outline-light" href="${esc(L(locale, hero.secondaryCtaHref))}">${esc(hero.secondaryCta)}</a>
      </div>
      <p class="hero-note">${esc(hero.credibility)}</p>
    </div>
    <div class="hero-media">
      ${imgTag(hero.image, hero.imageAlt, 'width="880" height="560" fetchpriority="high"')}
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <h2 class="section-title">${esc(h.help.heading)}</h2>
    <div class="help-grid">${helpCards}</div>
    <div class="center"><a class="btn btn-outline" href="${esc(L(locale, h.help.ctaHref))}">${esc(h.help.cta)}</a></div>
  </div>
</section>

<section class="section section-alt">
  <div class="container">
    <h2 class="section-title">${esc(h.why.heading)}</h2>
    <div class="why-grid">${whyItems}</div>
  </div>
</section>

<section class="section">
  <div class="container industries-teaser">
    <div>
      <h2 class="section-title left">${esc(h.industries.heading)}</h2>
      <p>${esc(h.industries.text)}</p>
      <a class="btn btn-outline" href="${esc(L(locale, h.industries.linkHref))}">${esc(h.industries.linkLabel)}</a>
    </div>
    ${imgTag(h.industries.image, h.industries.imageAlt, 'width="880" height="560" loading="lazy" decoding="async"')}
  </div>
</section>

<section class="section section-dark">
  <div class="container">
    <h2 class="section-title light">${esc(h.careTeaser.heading)}</h2>
    <p class="section-sub light">${esc(h.careTeaser.text)}</p>
    <div class="plans-grid">${plans}</div>
    <div class="center"><a class="btn btn-outline-light" href="${esc(L(locale, h.careTeaser.ctaHref))}">${esc(h.careTeaser.cta)}</a></div>
  </div>
</section>`;
}

// ---------------------------------------------------------------- services
function serviceCard(locale, s) {
  const includes = s.includes
    ? `<h4>${esc(s.includesLabel || 'Includes')}</h4>${checkList(s.includes)}`
    : '';
  const tech = s.technologies
    ? `<h4>${esc(s.technologiesLabel)}</h4><p class="tags">${s.technologies.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</p>`
    : '';
  const bestFor = s.bestFor ? `<p class="best-for"><strong>${esc(s.bestFor)}</strong></p>` : '';
  const priceNote = s.priceNote ? `<span class="price-note">${esc(s.priceNote)}</span>` : '';
  const href = s.ctaHref ? L(locale, s.ctaHref) : L(locale, '/contact/');
  return `<article class="service-card reveal" id="${esc(s.id)}">
    <div class="service-top">
      <h3>${esc(s.name)}</h3>
      <p class="price">${esc(s.price)}${priceNote}</p>
    </div>
    <p>${esc(s.desc)}</p>
    ${bestFor}${includes}${tech}
    <a class="btn btn-outline btn-sm" href="${esc(href)}">${esc(s.cta)}</a>
  </article>`;
}

function renderServices({ locale, site, c }) {
  const s = c.services;
  const cats = s.categories
    .map(
      (cat) => `<section class="service-cat" aria-label="${esc(cat.name)}">
      <h2>${esc(cat.name)}</h2>
      <p class="cat-tag">${esc(cat.tagline)}</p>
      <div class="services-grid">
        ${cat.services.map((svc) => serviceCard(locale, svc)).join('\n')}
      </div>
    </section>`
    )
    .join('\n');
  return `${pageHero(s.heading, s.intro)}
<section class="section"><div class="container">${cats}</div></section>${faqSection(locale, s.faq)}`;
}

// ---------------------------------------------------------------- industries
function renderIndustries({ locale, site, c }) {
  const d = c.industries;
  const cards = d.industries
    .map(
      (ind) => `<article class="industry-card reveal" id="${esc(ind.id)}">
      <h3>${esc(ind.name)}</h3>
      <p>${esc(ind.desc)}</p>
      <h4>${esc(locale === 'zh' ? '常见需求' : 'Common needs')}</h4>
      <ul class="needs-list">${ind.needs.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    </article>`
    )
    .join('\n');
  return `${pageHero(d.heading, d.intro)}
<section class="section"><div class="container">
  <h2 class="sr-only">${esc(locale === 'zh' ? '所有行业' : 'All industries')}</h2>
  <div class="industries-grid">${cards}</div>
  <div class="center"><a class="btn btn-cta" href="${esc(L(locale, d.ctaHref))}">${esc(d.cta)}</a></div>
</div></section>`;
}

// ---------------------------------------------------------------- network care
function planCard(locale, p, compact = false) {
  const feats = compact ? p.features.slice(0, 6) : p.features;
  const more = compact && p.features.length > 6
    ? `<li class="more">${esc(locale === 'zh' ? `另有 ${p.features.length - 6} 项服务…` : `Plus ${p.features.length - 6} more…`)}</li>`
    : '';
  return `<article class="plan-card reveal${p.id === 'professional' ? ' featured' : ''}">
    <h3>${esc(p.name)}</h3>
    <p class="plan-price">${esc(p.price)}</p>
    <p class="plan-audience">${esc(p.audience)}</p>
    <ul class="check-list">${feats.map((f) => `<li>${esc(f)}</li>`).join('')}${more}</ul>
    ${p.note ? `<p class="plan-note">${esc(p.note)}</p>` : ''}
    <a class="btn ${p.id === 'professional' ? 'btn-cta' : 'btn-outline'} btn-sm" href="${esc(L(locale, p.ctaHref))}">${esc(p.cta)}</a>
  </article>`;
}

function renderNetworkCare({ locale, site, c }) {
  const d = c['network-care'];
  const plans = d.plans.map((p) => planCard(locale, p)).join('\n');
  return `${pageHero(d.heading, d.intro)}
<section class="section"><div class="container">
  <h2 class="sr-only">${esc(locale === 'zh' ? '网络运维方案' : 'Network Care plans')}</h2>
  <div class="plans-grid">${plans}</div>
  <div class="plan-closing">
    <h2>${esc(d.closing.title)}</h2>
    <p>${esc(d.closing.text)}</p>
    <a class="btn btn-cta" href="${esc(L(locale, '/contact/'))}">${esc(site.headerCta)}</a>
  </div>
</div></section>${faqSection(locale, d.faq)}`;
}

// ---------------------------------------------------------------- about
function renderAbout({ locale, site, c }) {
  const a = c.about;
  const highlights = a.highlights
    .map((x) => `<div class="why-item reveal"><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div>`)
    .join('\n');
  return `${pageHero(a.heading, a.intro)}
<section class="section"><div class="container about-grid">
  <div>
    ${a.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('\n')}
    <dl class="about-meta">
      <div><dt>${esc(a.location.label)}</dt><dd>${esc(a.location.value)}</dd></div>
      <div><dt>${esc(a.serviceArea.label)}</dt><dd>${esc(a.serviceArea.value)}</dd></div>
    </dl>
  </div>
  ${imgTag(a.image, a.imageAlt, 'width="720" height="560" loading="lazy" decoding="async"')}
</div></div></section>
<section class="section section-alt"><div class="container">
  <h2 class="sr-only">${esc(locale === 'zh' ? '专业领域' : 'Areas of expertise')}</h2>
  <div class="why-grid">${highlights}</div>
</div></section>`;
}

// ---------------------------------------------------------------- contact
function renderContact({ locale, site, c }) {
  const d = c.contact;
  const f = d.form;
  const opt = (arr) => arr.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('\n');
  const field = (name, label, type, ph, req, extra = '') =>
    `<div class="field"><label for="inq-${name}">${esc(label)} ${req ? `<span class="req" aria-hidden="true">*</span><span class="sr-only">(${esc(f.required)})</span>` : `<span class="opt">(${esc(f.optional)})</span>`}</label>
     <input id="inq-${name}" name="${name}" type="${type}" placeholder="${esc(ph)}"${req ? ' required' : ''}${extra}></div>`;
  const formBlock = `<form id="inquiry-form" class="inquiry-form" action="/api/inquiry" method="post"
      data-sending="${esc(f.sending)}" data-submit="${esc(f.submit)}"
      data-success-heading="${esc(f.successHeading)}" data-success-body="${esc(f.successBody)}"
      data-error-heading="${esc(f.errorHeading)}" data-error-body="${esc(f.errorBody)}"
      data-error-not-configured="${esc(f.errNotConfigured)}" data-error-send-failed="${esc(f.errSendFailed)}"
      data-error-endpoint="${esc(f.errEndpoint)}" data-error-validation="${esc(f.errValidation)}"
      data-error-rate-limited="${esc(f.errRateLimited)}">
    <div class="field-row">
      ${field('name', f.name, 'text', f.namePh, true, ' autocomplete="name"')}
      ${field('company', f.company, 'text', f.companyPh, false, ' autocomplete="organization"')}
    </div>
    <div class="field-row">
      ${field('email', f.email, 'email', f.emailPh, true, ' autocomplete="email"')}
      ${field('phone', f.phone, 'tel', f.phonePh, false, ' autocomplete="tel"')}
    </div>
    <div class="field-row">
      ${field('location', f.location, 'text', f.locationPh, false)}
      ${field('employees', f.employees, 'text', f.employeesPh, false, ' inputmode="numeric"')}
    </div>
    <div class="field-row">
      <div class="field"><label for="inq-service">${esc(f.service)} <span class="req" aria-hidden="true">*</span><span class="sr-only">(${esc(f.required)})</span></label>
        <select id="inq-service" name="service" required><option value="" disabled selected>—</option>
        ${opt(f.serviceOptions)}</select></div>
      <div class="field"><label for="inq-contactMethod">${esc(f.contactMethod)} <span class="opt">(${esc(f.optional)})</span></label>
        <select id="inq-contactMethod" name="contactMethod"><option value="" disabled selected>—</option>
        ${opt(f.contactMethodOptions)}</select></div>
    </div>
    <div class="field"><label for="inq-timeline">${esc(f.timeline)} <span class="opt">(${esc(f.optional)})</span></label>
      <input id="inq-timeline" name="timeline" type="text" placeholder="${esc(f.timelinePh)}"></div>
    <div class="field"><label for="inq-description">${esc(f.description)} <span class="req" aria-hidden="true">*</span><span class="sr-only">(${esc(f.required)})</span></label>
      <textarea id="inq-description" name="description" rows="5" placeholder="${esc(f.descriptionPh)}" required></textarea></div>
    <div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
    <input type="hidden" name="locale" value="${locale}">
    <button type="submit" class="btn btn-cta">${esc(f.submit)}</button>
    <div id="form-status" class="form-status" role="status" aria-live="polite"></div>
  </form>`;
  const steps = d.nextSteps.steps.map((s) => `<li>${esc(s)}</li>`).join('\n');
  return `${pageHero(d.heading, d.intro)}
<section class="section"><div class="container contact-grid">
  <div>
    <h2>${esc(d.formHeading)}</h2>
    ${formBlock}
  </div>
  <aside class="contact-side">
    <div class="side-card">
      <h3>${esc(d.serviceArea.heading)}</h3>
      <p><strong>${esc(d.serviceArea.area)}</strong></p>
      <p>${esc(d.serviceArea.remote)}</p>
      <p class="cities">${esc(config.serviceCities.join(' • '))}</p>
    </div>
    <div class="side-card">
      <h3>${esc(d.nextSteps.heading)}</h3>
      <ol class="steps">${steps}</ol>
    </div>
  </aside>
</div></section>${faqSection(locale, d.faq)}`;
}

// ---------------------------------------------------------------- legal
function renderLegal({ doc }) {
  const secs = doc.sections
    .map((s) => `<section><h2>${esc(s.heading)}</h2><p>${esc(s.text)}</p></section>`)
    .join('\n');
  return `${pageHero(doc.title, doc.updated)}
<section class="section"><div class="container narrow">${secs}</div></section>`;
}

// ---------------------------------------------------------------- assembly + build
const PAGES = [
  { id: 'home', render: renderHome },
  { id: 'services', render: renderServices },
  { id: 'industries', render: renderIndustries },
  { id: 'network-care', render: renderNetworkCare },
  { id: 'about', render: renderAbout },
  { id: 'contact', render: renderContact },
  { id: 'privacy', render: renderLegal, sub: 'privacy' },
  { id: 'terms', render: renderLegal, sub: 'terms' },
];

function serviceSchemas(all, locale, path) {
  const base = config.baseUrl.replace(/\/$/, '');
  const pageUrl = base + path;
  const services = [];
  for (const cat of all.services.categories) {
    for (const s of cat.services) {
      if (s.link) continue;
      services.push({
        '@type': 'Service',
        name: s.name,
        description: s.desc,
        url: `${pageUrl}#${s.id}`,
        provider: { '@id': base + '/#organization' },
        areaServed: config.serviceCities.map((c) => ({ '@type': 'City', name: c, addressRegion: 'WA', addressCountry: 'US' })),
      });
    }
  }
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': services })}</script>`;
}

function breadcrumbSchema(locale, site, pageId, path, title) {
  if (pageId === 'home') return '';
  const base = config.baseUrl.replace(/\/$/, '');
  const items = [
    { '@type': 'ListItem', position: 1, name: locale === 'zh' ? '首页' : 'Home', item: base + pagePath(locale, 'home') },
    { '@type': 'ListItem', position: 2, name: title, item: base + path },
  ];
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items })}</script>`;
}

function faqSchema(faq) {
  if (!faq || !faq.items || !faq.items.length) return '';
  const mainEntity = faq.items.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  }));
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity })}</script>`;
}

function renderPage(locale, page) {
  const names = ['site', 'home', 'services', 'industries', 'network-care', 'about', 'contact', 'legal'];
  const c = Object.fromEntries(names.map((n) => [n, load(locale, n)]));
  const site = c.site;
  const doc = page.sub ? c.legal[page.sub] : null;
  const src = page.sub ? c.legal : c[page.id === 'home' ? 'home' : page.id];
  const seo = page.sub
    ? { title: `${doc.title} | ${config.siteName}`, description: doc.sections[0].text.slice(0, 160) }
    : src.seo;
  const path = pagePath(locale, page.id);
  const main = page.render({ locale, site, c, doc });
  const faq = !page.sub && src && src.faq ? src.faq : null;
  const extraLd =
    (page.id === 'services' ? serviceSchemas(c, locale, path) : '') +
    breadcrumbSchema(locale, site, page.id, path, (seo.title || '').split('|')[0].trim()) +
    faqSchema(faq);
  return (
    head({ locale, site, seo, pageId: page.id, path }) +
    `\n<body>\n${header({ locale, site, pageId: page.id })}\n<main id="main">\n${main}\n</main>\n${ctaBand({ locale, site })}\n${footer({ locale, site })}\n${extraLd}\n</body>\n</html>\n`
  );
}

function render404() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page Not Found | ${esc(config.siteName)}</title>
<meta name="robots" content="noindex">
<link rel="icon" type="image/svg+xml" href="/assets/img/favicon.svg">
<link rel="alternate" type="text/markdown" href="/llms.txt" title="LLM-friendly site summary">
<link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>
<main id="main"><section class="section"><div class="container narrow center">
<h1>Page not found</h1>
<p>The page you're looking for doesn't exist or has moved.</p>
<p><a class="btn btn-cta" href="/">Back to Home</a> <a class="btn btn-outline" href="/zh/">返回首页</a></p>
</div></section></main>
</body>
</html>
`;
}

// ---------------------------------------------------------------- run
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const sitemapUrls = [];

for (const locale of config.locales) {
  for (const page of PAGES) {
    const path = pagePath(locale, page.id);
    const html = renderPage(locale, page);
    const outDir = join(dist, path.replace(/^\//, ''));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'index.html'), html);
    sitemapUrls.push(config.baseUrl.replace(/\/$/, '') + path);
    console.log('wrote', path);
  }
}

writeFileSync(join(dist, '404.html'), render404());

// sitemap.xml (with hreflang alternates between EN and ZH versions)
const SITEMAP_META = {
  home: { priority: '1.0', freq: 'monthly' },
  services: { priority: '0.9', freq: 'monthly' },
  'network-care': { priority: '0.8', freq: 'monthly' },
  contact: { priority: '0.8', freq: 'monthly' },
  industries: { priority: '0.7', freq: 'monthly' },
  about: { priority: '0.6', freq: 'monthly' },
  privacy: { priority: '0.3', freq: 'yearly' },
  terms: { priority: '0.3', freq: 'yearly' },
};
const sitemapEntries = [];
for (const page of PAGES) {
  const enPath = pagePath('en', page.id);
  const zhPath = pagePath('zh', page.id);
  const base = config.baseUrl.replace(/\/$/, '');
  const meta = SITEMAP_META[page.id] || { priority: '0.5', freq: 'monthly' };
  for (const [loc, pth] of [['en', enPath], ['zh-CN', zhPath]]) {
    sitemapEntries.push(
      `  <url><loc>${esc(base + pth)}</loc><lastmod>${today}</lastmod><changefreq>${meta.freq}</changefreq><priority>${meta.priority}</priority>` +
      `<xhtml:link rel="alternate" hreflang="en" href="${esc(base + enPath)}"/>` +
      `<xhtml:link rel="alternate" hreflang="zh-CN" href="${esc(base + zhPath)}"/>` +
      `<xhtml:link rel="alternate" hreflang="x-default" href="${esc(base + enPath)}"/></url>`
    );
  }
}
const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
  sitemapEntries.join('\n') +
  `\n</urlset>\n`;
writeFileSync(join(dist, 'sitemap.xml'), sitemap);

// llms.txt + llms-full.txt: concise, factual summary for AI search/retrieval.
// Note: these files are hygiene for non-Google AI engines; they are not a ranking signal.
const baseUrlClean = config.baseUrl.replace(/\/$/, '');
const enHome = load('en', 'home');
const enServices = load('en', 'services');
const enCare = load('en', 'network-care');
const enIndustries = load('en', 'industries');
const enAbout = load('en', 'about');
const zhHome = load('zh', 'home');
const pageDesc = (locale, name) => load(locale, name).seo.description;
const llmsLines = [
  '# ' + config.siteName,
  '',
  '> ' + config.tagline + '. Network consulting, office network setup, business Wi-Fi, structured cabling, network security, and managed network monitoring for businesses in the ' + config.serviceArea + '. English & Mandarin support.',
  '',
  'Problems we solve: slow or unreliable office Wi-Fi, new office and relocation network buildouts, aging network infrastructure upgrades, structured cabling (Cat6, Cat6A, fiber), firewall/VPN and secure remote access, and 24/7 proactive network monitoring.',
  '',
  'Key facts: Service area is ' + config.serviceCities.join(', ') + ' (Greater Seattle Area, WA). Support is available in English and Mandarin. All services and Network Care plans are custom-quoted — no prices are published on this website. The first consultation is free. Consultation requests submitted through the contact form are answered within 3-5 business days.',
  '',
  '## Services',
  ...enServices.categories.flatMap((cat) => cat.services.filter((s) => !s.link).map((s) => `- [${s.name}](${baseUrlClean + pagePath('en', 'services')}#${s.id}): ${s.desc} (Custom Quote)`)),
  '',
  '## Network Care Plans',
  ...enCare.plans.map((pl) => `- [${pl.name}](${baseUrlClean + pagePath('en', 'network-care')}): ${pl.audience} Includes: ${pl.features.slice(0, 5).join('; ')}. (Custom Quote)`),
  '',
  '## Main Pages',
  `- [Home](${baseUrlClean + pagePath('en', 'home')}): ${pageDesc('en', 'home')}`,
  `- [Services](${baseUrlClean + pagePath('en', 'services')}): ${pageDesc('en', 'services')}`,
  `- [Industries](${baseUrlClean + pagePath('en', 'industries')}): ${pageDesc('en', 'industries')}`,
  `- [Network Care](${baseUrlClean + pagePath('en', 'network-care')}): ${pageDesc('en', 'network-care')}`,
  `- [About](${baseUrlClean + pagePath('en', 'about')}): ${pageDesc('en', 'about')}`,
  `- [Contact](${baseUrlClean + pagePath('en', 'contact')}): ${pageDesc('en', 'contact')}`,
  '',
  '## 中文页面',
  `- [首页](${baseUrlClean + pagePath('zh', 'home')}): ${pageDesc('zh', 'home')}`,
  `- [服务](${baseUrlClean + pagePath('zh', 'services')}): ${pageDesc('zh', 'services')}`,
  `- [行业](${baseUrlClean + pagePath('zh', 'industries')}): ${pageDesc('zh', 'industries')}`,
  `- [网络运维](${baseUrlClean + pagePath('zh', 'network-care')}): ${pageDesc('zh', 'network-care')}`,
  `- [关于我们](${baseUrlClean + pagePath('zh', 'about')}): ${pageDesc('zh', 'about')}`,
  `- [联系我们](${baseUrlClean + pagePath('zh', 'contact')}): ${pageDesc('zh', 'contact')}`,
  '',
  '## Optional',
  `- [Privacy Policy](${baseUrlClean + pagePath('en', 'privacy')})`,
  `- [Terms of Service](${baseUrlClean + pagePath('en', 'terms')})`,
  `- [Full text for AI](${baseUrlClean}/llms-full.txt): Complete plain-text content of the main pages in English and Chinese.`,
  '',
];
writeFileSync(join(dist, 'llms.txt'), llmsLines.join('\n'));

// llms-full.txt: full plain-text content (regenerated every build, never stale)
const full = [];
full.push('# ' + config.siteName + ' — Full Site Text');
full.push('');
full.push(config.tagline + '. ' + pageDesc('en', 'home'));
full.push('Service area: ' + config.serviceCities.join(', ') + ', WA (Greater Seattle Area). Languages: English and Mandarin. Pricing: all services are custom-quoted; no prices are published. First consultation is free. Form replies within 3-5 business days.');
full.push('');
for (const loc of ['en', 'zh']) {
  const svc = load(loc, 'services');
  const care = load(loc, 'network-care');
  const ind = load(loc, 'industries');
  const about = load(loc, 'about');
  const contact = load(loc, 'contact');
  full.push(`## ${loc === 'en' ? 'English' : '中文 (Chinese)'}`);
  full.push('');
  full.push(`### ${svc.heading}`);
  full.push(svc.intro);
  for (const cat of svc.categories) {
    full.push(`#### ${cat.name} — ${cat.tagline}`);
    for (const s of cat.services) {
      full.push(`- ${s.name} (${s.price}): ${s.desc}` + (s.includes ? ' Includes: ' + s.includes.join('; ') + '.' : ''));
    }
  }
  if (svc.faq) { full.push(`### ${svc.faq.heading}`); for (const f of svc.faq.items) { full.push(`Q: ${f.q}`); full.push(`A: ${f.a}`); } }
  full.push('');
  full.push(`### ${care.heading}`);
  full.push(care.intro);
  for (const pl of care.plans) {
    full.push(`- ${pl.name} (${pl.price}): ${pl.audience} Features: ${pl.features.join('; ')}.` + (pl.note ? ' Note: ' + pl.note : ''));
  }
  if (care.faq) { full.push(`### ${care.faq.heading}`); for (const f of care.faq.items) { full.push(`Q: ${f.q}`); full.push(`A: ${f.a}`); } }
  full.push('');
  full.push(`### ${ind.heading}`);
  full.push(ind.intro);
  for (const item of ind.industries) { full.push(`- ${item.name}: ${item.desc} Common needs: ${item.needs.join('; ')}.`); }
  full.push('');
  full.push(`### ${about.heading}`);
  full.push(about.intro);
  for (const para of about.paragraphs) full.push(para);
  full.push('');
  full.push(`### ${contact.heading}`);
  full.push(contact.intro);
  if (contact.faq) { full.push(`### ${contact.faq.heading}`); for (const f of contact.faq.items) { full.push(`Q: ${f.q}`); full.push(`A: ${f.a}`); } }
  full.push('');
}
writeFileSync(join(dist, 'llms-full.txt'), full.join('\n'));

// robots.txt — allow search + AI retrieval crawlers, keep the form API out
const AI_BOTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  'Claude-SearchBot',
  'Claude-User',
  'ClaudeBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'Meta-ExternalAgent',
  'CCBot',
];
const robotsTxt =
  `User-agent: *\nAllow: /\nDisallow: /api/\n\n` +
  AI_BOTS.map((b) => `User-agent: ${b}\nAllow: /\nDisallow: /api/\n`).join('\n') +
  `\nSitemap: ${config.baseUrl.replace(/\/$/, '')}/sitemap.xml\n`;
writeFileSync(join(dist, 'robots.txt'), robotsTxt);

// Cloudflare Pages headers: long cache for hashed assets is N/A (no hashes),
// so use a modest immutable cache for assets + security headers site-wide.
/* eslint-disable */
writeFileSync(
  join(dist, '_headers'),
  `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n/llms.txt\n  X-Robots-Tag: noindex\n/llms-full.txt\n  X-Robots-Tag: noindex\n/assets/*\n  Cache-Control: public, max-age=86400\n`
);

// assets
cpSync(join(root, 'assets'), join(dist, 'assets'), { recursive: true });

// Pages Functions must live inside the uploaded directory ('dist/functions'),
// otherwise 'wrangler pages deploy dist' silently ships no Functions at all.
cpSync(join(root, 'functions'), join(dist, 'functions'), { recursive: true });

console.log(`\nDone. ${sitemapUrls.length} pages -> dist/`);
