/**
 * Renders the client-side password gate HTML.
 *
 * Drops in three placeholder tokens that the caller must substitute with the
 * actual base64-encoded salt, IV, and ciphertext from the AES-GCM encryption
 * pipeline (carried over from alpha): `__SALT__`, `__IV__`, `__CT__`, `__ITER__`.
 *
 * Chrome system: references /style.css for tokens + brand.
 * Voice: "Locked." per docs/design/voice.md.
 */
export function renderPasswordGate(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Locked · mirador</title>
<link rel="icon" type="image/svg+xml" media="(prefers-color-scheme: light)" href="/assets/aperture-favicon.svg">
<link rel="icon" type="image/svg+xml" media="(prefers-color-scheme: dark)" href="/assets/aperture-favicon-dark.svg">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div class="gate">
  <form class="gate-card stack" id="gate-form" autocomplete="off">
    <svg class="gate-mark mark-anim" viewBox="0 0 24 24" aria-hidden="true">
      <rect class="outer" x="0.75" y="0.75" width="22.5" height="22.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <rect class="inner" x="14" y="4" width="6" height="6" fill="#2541B2"/>
    </svg>
    <h1 class="gate-title">Locked.</h1>
    <input
      id="gate-input"
      class="gate-input"
      type="password"
      placeholder="Password"
      autocomplete="current-password"
      autofocus
      required>
    <button type="submit" class="cta-primary gate-submit">Unlock</button>
    <div class="gate-error" id="gate-error" role="alert"></div>
    <p class="gate-foot">Client-side gate. Deters viewers, not attackers.</p>
  </form>
</div>

<script>
const SALT_B64 = "__SALT__";
const IV_B64 = "__IV__";
const CT_B64 = "__CT__";
const ITER = __ITER__;

const b64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function deriveKey(pw) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64(SALT_B64), iterations: ITER, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
}

document.getElementById('gate-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const pw = document.getElementById('gate-input').value;
  const err = document.getElementById('gate-error');
  const mark = document.querySelector('.mark-anim');
  err.textContent = '';
  try {
    const key = await deriveKey(pw);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(IV_B64) }, key, b64(CT_B64));
    if (mark) { mark.classList.remove('mark-pulsed'); void mark.offsetWidth; mark.classList.add('mark-pulsed'); }
    document.open();
    document.write(new TextDecoder().decode(pt));
    document.close();
  } catch (e) {
    err.textContent = 'Wrong password.';
    document.getElementById('gate-input').focus();
    document.getElementById('gate-input').select();
  }
});
</script>
</body>
</html>
`;
}
