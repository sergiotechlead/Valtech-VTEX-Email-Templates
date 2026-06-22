/* Preview UI — live reload + JSON editor */

// ── Live Reload (SSE) ─────────────────────────────────────────────────────────
(function () {
  const es = new EventSource('/sse');
  es.onmessage = e => {
    if (e.data === 'reload') location.reload();
  };
  es.onerror = () => {
    // Silently ignore SSE connection errors (e.g. when server restarts)
  };
})();

// ── JSON Editor ───────────────────────────────────────────────────────────────
(function () {
  const textarea   = document.getElementById('json-editor');
  const applyBtn   = document.getElementById('btn-apply');
  const resetBtn   = document.getElementById('btn-reset');
  const emailFrame = document.getElementById('email-frame');
  const toggleBtn  = document.getElementById('btn-toggle-json');
  const jsonPanel  = document.getElementById('json-panel');

  if (!textarea || !emailFrame) return;

  const templateName = document.body.dataset.template;
  const originalJson = textarea.value;

  let debounceTimer;

  // Apply JSON to preview
  function applyData(json) {
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch {
      textarea.style.borderColor = '#e74c3c';
      return;
    }
    textarea.style.borderColor = '';

    fetch(`/render/${templateName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    })
      .then(r => r.json())
      .then(({ html, error }) => {
        if (error) { console.error(error); return; }
        const doc = emailFrame.contentDocument || emailFrame.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();
      })
      .catch(console.error);
  }

  // Auto-apply on edit (debounced)
  textarea.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyData(textarea.value), 600);
  });

  if (applyBtn) {
    applyBtn.addEventListener('click', () => applyData(textarea.value));
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      textarea.value = originalJson;
      applyData(originalJson);
    });
  }

  // Toggle JSON panel
  if (toggleBtn && jsonPanel) {
    toggleBtn.addEventListener('click', () => {
      jsonPanel.classList.toggle('collapsed');
      toggleBtn.textContent = jsonPanel.classList.contains('collapsed') ? '{ }' : '✕ JSON';
    });
  }

  // ── Width toggle (desktop / mobile) ──────────────────────────────────────
  document.querySelectorAll('[data-width]').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = btn.dataset.width;
      emailFrame.style.width  = w === 'full'   ? '100%' : (w + 'px');
      emailFrame.parentElement.style.display = 'flex';
      emailFrame.parentElement.style.justifyContent = 'center';
      document.querySelectorAll('[data-width]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // ── Copy raw HTML ─────────────────────────────────────────────────────────
  const copyBtn = document.getElementById('btn-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        const res  = await fetch(`/preview/${templateName}?raw`);
        const html = await res.text();
        await navigator.clipboard.writeText(html);
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy HTML', 2000);
      } catch {
        window.open(`/preview/${templateName}?raw`, '_blank');
      }
    });
  }
})();
