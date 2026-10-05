// Reliable IT Consulting — minimal progressive enhancement.
(function () {
  'use strict';

  // Mobile navigation toggle
  var nav = document.querySelector('.site-nav');
  var toggle = document.querySelector('.nav-toggle');
  if (nav && toggle) {
    var openLabel = toggle.getAttribute('aria-label');
    var closeLabel = toggle.dataset.closeLabel || 'Close';
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? closeLabel : openLabel);
    });
    // Close the menu when a link inside it is activated
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a') && nav.classList.contains('open')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', openLabel);
      }
    });
  }

  // Subtle fade-in on scroll (disabled when reduced motion is preferred)
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealEls = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  }
  // Inquiry form: submit via fetch to the /api/inquiry Pages Function
  var form = document.getElementById('inquiry-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = document.getElementById('form-status');
      var btn = form.querySelector('button[type="submit"]');
      var setStatus = function (cls, heading, body) {
        status.className = 'form-status ' + cls;
        status.innerHTML = '';
        var h = document.createElement('p');
        h.className = 'form-status-heading';
        h.textContent = heading;
        var p = document.createElement('p');
        p.textContent = body;
        status.appendChild(h);
        status.appendChild(p);
      };
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var payload = {};
      new FormData(form).forEach(function (v, k) { payload[k] = v; });
      var original = btn.textContent;
      btn.disabled = true;
      btn.textContent = form.dataset.sending || 'Sending…';
      status.className = 'form-status';
      status.innerHTML = '';
      var bodyForError = function (code) {
        if (code === 'not_configured') return form.dataset.errorNotConfigured || form.dataset.errorBody;
        if (code === 'send_failed') return form.dataset.errorSendFailed || form.dataset.errorBody;
        if (code === 'validation') return form.dataset.errorValidation || form.dataset.errorBody;
        if (code === 'rate_limited') return form.dataset.errorRateLimited || form.dataset.errorBody;
        return form.dataset.errorEndpoint || form.dataset.errorBody;
      };
      fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r.json()
            .then(function (j) { return { ok: r.ok && j.ok, code: j.error || '' }; })
            .catch(function () { return { ok: false, code: 'endpoint_unreachable' }; });
        })
        .then(function (res) {
          if (res.ok) {
            form.reset();
            setStatus('ok', form.dataset.successHeading, form.dataset.successBody);
          } else {
            setStatus('err', form.dataset.errorHeading, bodyForError(res.code));
          }
        })
        .catch(function () {
          setStatus('err', form.dataset.errorHeading, bodyForError('endpoint_unreachable'));
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = original;
        });
    });
  }
})();
