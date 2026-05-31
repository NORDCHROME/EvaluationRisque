// mailer.js — Notifications via Brevo API HTTP (pas de port SMTP bloqué)
// Variable Railway requise :
//   BREVO_API_KEY   ex: xkeysib-xxxxxxxxxxxxxx
//   BREVO_SENDER    ex: noreply@nordchrome.com  (doit être vérifié dans Brevo)
//   BREVO_SENDER_NAME  ex: EvalRisque NORDCHROME  (optionnel)
//   APP_URL         ex: https://evalrisque.up.railway.app

const https = require('https');

const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const BREVO_API_KEY   = () => process.env.BREVO_API_KEY   || '';
const BREVO_SENDER    = () => process.env.BREVO_SENDER    || process.env.SMTP_USER || '';
const BREVO_SENDER_NAME = () => process.env.BREVO_SENDER_NAME || 'EvalRisque NORDCHROME';

// ── Appel API Brevo ───────────────────────────────────────────────────────────
function brevoSend(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.brevo.com',
      path:     '/v3/smtp/email',
      method:   'POST',
      headers:  {
        'api-key':      BREVO_API_KEY(),
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true });
        } else {
          reject(new Error(`Brevo API ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Templates HTML ────────────────────────────────────────────────────────────
function tplNewValidation({ managerName, submitterName, interventionTitle, location, date, riskCount }) {
  const title   = interventionTitle || 'Évaluation sans titre';
  const dateStr = date ? new Date(date).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }) : '—';
  return {
    subject: `⚠️ Nouvelle évaluation à valider — ${title}`,
    html: `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;margin:0;padding:20px;color:#1a2533}
  .wrap{max-width:580px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}
  .hdr{background:#0a121a;padding:28px 32px}
  .hdr-title{color:#fff;font-size:22px;font-weight:700;margin:0}
  .hdr-sub{color:#7ab3d4;font-size:13px;margin-top:4px}
  .body{padding:28px 32px}
  .alert{background:#fff8f3;border-left:4px solid #c84b31;border-radius:4px;padding:14px 18px;margin-bottom:22px;font-size:14px;color:#374151}
  .meta{background:#f5f8fa;border-radius:6px;padding:16px 20px;margin-bottom:22px}
  .row{display:flex;gap:12px;padding:5px 0;font-size:13px;border-bottom:1px solid #eee}
  .lbl{color:#6b7280;min-width:120px;font-weight:600}
  .val{color:#1a2533}
  .btn{display:inline-block;background:#c84b31;color:#fff!important;text-decoration:none;padding:13px 28px;border-radius:5px;font-weight:700;font-size:15px;margin:8px 0}
  .badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;background:#fde8e6;color:#c84b31}
  .footer{background:#f0f4f8;padding:16px 32px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb}
</style></head><body>
<div class="wrap">
  <div class="hdr">
    <div class="hdr-title">🛡 EvalRisque — Nouvelle validation requise</div>
    <div class="hdr-sub">NORDCHROME — Système de gestion des risques</div>
  </div>
  <div class="body">
    <div class="alert">Bonjour <strong>${managerName}</strong>,<br/><br/>
      <strong>${submitterName}</strong> vient de soumettre une évaluation des risques qui nécessite votre validation.
    </div>
    <div class="meta">
      <div class="row"><span class="lbl">🏷️ Intervention</span><span class="val"><strong>${title}</strong></span></div>
      <div class="row"><span class="lbl">👤 Intervenant</span><span class="val">${submitterName}</span></div>
      <div class="row"><span class="lbl">📍 Lieu</span><span class="val">${location || '—'}</span></div>
      <div class="row"><span class="lbl">📅 Date</span><span class="val">${dateStr}</span></div>
      <div class="row"><span class="lbl">⚠️ Risques</span><span class="val"><span class="badge">${riskCount} risque(s) identifié(s)</span></span></div>
    </div>
    <p style="font-size:13px;color:#4b5563;margin-bottom:20px">Connectez-vous pour consulter le détail complet et valider ou refuser ce rapport.</p>
    <a href="${APP_URL}" class="btn">👁 Accéder à l'application</a>
  </div>
  <div class="footer">EvalRisque • NORDCHROME • Message automatique.</div>
</div></body></html>`
  };
}

function tplValidationResult({ submitterName, interventionTitle, status, comment, managerName }) {
  const title      = interventionTitle || 'Évaluation sans titre';
  const isApproved = status === 'approved';
  const statusColor = isApproved ? '#2d7a4f' : '#c84b31';
  const statusBg    = isApproved ? '#e6f4ec'  : '#fde8e6';
  const statusLabel = isApproved ? '✅ Rapport VALIDÉ' : '❌ Rapport REFUSÉ';
  const statusMsg   = isApproved
    ? 'Votre rapport a été approuvé et signé. Téléchargez-le depuis "Mes Évaluations".'
    : 'Votre rapport a été refusé. Consultez le commentaire et corrigez votre évaluation.';
  return {
    subject: `${isApproved ? '✅' : '❌'} Rapport ${isApproved ? 'validé' : 'refusé'} — ${title}`,
    html: `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;margin:0;padding:20px;color:#1a2533}
  .wrap{max-width:580px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}
  .hdr{background:#0a121a;padding:28px 32px}
  .hdr-title{color:#fff;font-size:22px;font-weight:700;margin:0}
  .hdr-sub{color:#7ab3d4;font-size:13px;margin-top:4px}
  .body{padding:28px 32px}
  .status{background:${statusBg};border:1.5px solid ${statusColor};border-radius:6px;padding:14px 20px;font-size:16px;font-weight:700;color:${statusColor};margin-bottom:20px}
  .msg{font-size:13.5px;color:#374151;margin-bottom:18px;line-height:1.6}
  .cmt{background:#f9fafb;border-left:4px solid #6b7280;padding:12px 16px;border-radius:4px;font-size:13px;color:#374151;font-style:italic;margin-bottom:20px}
  .btn{display:inline-block;background:#0a121a;color:#fff!important;text-decoration:none;padding:13px 28px;border-radius:5px;font-weight:700;font-size:14px}
  .footer{background:#f0f4f8;padding:16px 32px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb}
</style></head><body>
<div class="wrap">
  <div class="hdr">
    <div class="hdr-title">🛡 EvalRisque — Résultat de validation</div>
    <div class="hdr-sub">NORDCHROME — Système de gestion des risques</div>
  </div>
  <div class="body">
    <p class="msg">Bonjour <strong>${submitterName}</strong>,</p>
    <div class="status">${statusLabel}</div>
    <p class="msg">Votre évaluation <strong>"${title}"</strong> a été traitée par <strong>${managerName}</strong>.<br/>${statusMsg}</p>
    ${comment ? `<div><p style="font-size:12px;font-weight:700;color:#6b7280;margin-bottom:6px">COMMENTAIRE :</p><div class="cmt">${comment}</div></div>` : ''}
    <a href="${APP_URL}" class="btn">📋 Voir mes évaluations</a>
  </div>
  <div class="footer">EvalRisque • NORDCHROME • Message automatique.</div>
</div></body></html>`
  };
}

// ── Template auto-validation ─────────────────────────────────────────────────
function tplAutoValidation({ submitterName, interventionTitle, maxScore, threshold, scores }) {
  const title = interventionTitle || 'Évaluation sans titre';
  const scoresHtml = (scores || []).map(s => `
    <tr style="background:${s.overThreshold?'#fde8e6':'#f9fafb'}">
      <td style="padding:7px 12px;font-size:12px">${s.riskName}</td>
      <td style="padding:7px 12px;text-align:center;font-size:12px">${s.brut}</td>
      <td style="padding:7px 12px;text-align:center;font-size:12px;color:var(--safe)">−${s.deductions}</td>
      <td style="padding:7px 12px;text-align:center;font-weight:700;font-size:12px;color:${s.residuel>=threshold?'#c84b31':'#2d7a4f'}">${s.residuel}</td>
    </tr>`).join('');
  return {
    subject: `✅ Rapport validé automatiquement — ${title}`,
    html: `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;margin:0;padding:20px}
  .wrap{max-width:580px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}
  .hdr{background:#0a121a;padding:28px 32px}
  .hdr-title{color:#fff;font-size:22px;font-weight:700;margin:0}
  .hdr-sub{color:#7ab3d4;font-size:13px;margin-top:4px}
  .body{padding:28px 32px}
  .badge{background:#e6f4ec;border:1.5px solid #2d7a4f;border-radius:6px;padding:14px 20px;font-size:16px;font-weight:700;color:#2d7a4f;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  th{background:#0a121a;color:#fff;padding:8px 12px;font-size:10px;text-transform:uppercase;letter-spacing:.1em;text-align:left}
  .btn{display:inline-block;background:#0a121a;color:#fff!important;text-decoration:none;padding:13px 28px;border-radius:5px;font-weight:700;font-size:14px}
  .footer{background:#f0f4f8;padding:16px 32px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb}
</style></head><body>
<div class="wrap">
  <div class="hdr">
    <div class="hdr-title">🛡 EvalRisque — Rapport validé automatiquement</div>
    <div class="hdr-sub">NORDCHROME — Système de gestion des risques</div>
  </div>
  <div class="body">
    <p style="font-size:13.5px;color:#374151">Bonjour <strong>${submitterName}</strong>,</p>
    <div class="badge">✅ Rapport validé automatiquement par le système</div>
    <p style="font-size:13px;color:#4b5563">Votre évaluation <strong>"${title}"</strong> a été analysée par le moteur de scoring EvalRisque. Tous les risques sont correctement protégés — aucune validation manuelle n'est requise.</p>
    <table>
      <thead><tr><th>Risque</th><th style="text-align:center">Brut</th><th style="text-align:center">Déductions</th><th style="text-align:center">Score résiduel</th></tr></thead>
      <tbody>${scoresHtml}</tbody>
    </table>
    <p style="font-size:11.5px;color:#6b7280">Score maximum : <strong>${maxScore}</strong> / Seuil de validation : <strong>${threshold}</strong></p>
    <a href="${APP_URL}" class="btn">📋 Voir mes évaluations</a>
  </div>
  <div class="footer">EvalRisque • NORDCHROME • Validé automatiquement le ${new Date().toLocaleDateString('fr-FR')}.</div>
</div></body></html>`
  };
}

// ── Fonctions publiques ───────────────────────────────────────────────────────
async function sendNewValidationNotification(managerEmail, data) {
  if (!BREVO_API_KEY() || !managerEmail) {
    console.warn('[Mailer] BREVO_API_KEY manquante ou email vide — ignoré');
    return false;
  }
  try {
    const tpl = tplNewValidation(data);
    await brevoSend({
      sender:   { name: BREVO_SENDER_NAME(), email: BREVO_SENDER() },
      to:       [{ email: managerEmail, name: data.managerName }],
      subject:  tpl.subject,
      htmlContent: tpl.html,
    });
    console.log(`[Mailer] ✅ Notif responsable envoyée → ${managerEmail}`);
    return true;
  } catch (e) {
    console.error(`[Mailer] ❌ Erreur envoi responsable:`, e.message);
    return false;
  }
}

async function sendValidationResultNotification(submitterEmail, data) {
  if (!BREVO_API_KEY() || !submitterEmail) {
    console.warn('[Mailer] BREVO_API_KEY manquante ou email vide — ignoré');
    return false;
  }
  try {
    const tpl = tplValidationResult(data);
    await brevoSend({
      sender:   { name: BREVO_SENDER_NAME(), email: BREVO_SENDER() },
      to:       [{ email: submitterEmail, name: data.submitterName }],
      subject:  tpl.subject,
      htmlContent: tpl.html,
    });
    console.log(`[Mailer] ✅ Notif résultat envoyée → ${submitterEmail}`);
    return true;
  } catch (e) {
    console.error(`[Mailer] ❌ Erreur envoi résultat:`, e.message);
    return false;
  }
}

async function testConnection() {
  if (!BREVO_API_KEY()) return { ok: false, error: 'Variable BREVO_API_KEY manquante dans Railway' };
  if (!BREVO_SENDER()) return { ok: false, error: 'Variable BREVO_SENDER manquante (adresse email expéditeur)' };
  return new Promise((resolve) => {
    https.get({
      hostname: 'api.brevo.com',
      path:     '/v3/account',
      headers:  { 'api-key': BREVO_API_KEY() }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const info = JSON.parse(data);
            resolve({ ok: true, plan: info.plan?.[0]?.type || 'free', email: info.email });
          } catch { resolve({ ok: true }); }
        } else {
          resolve({ ok: false, error: `Brevo API ${res.statusCode}: clé invalide ou expirée` });
        }
      });
    }).on('error', (e) => resolve({ ok: false, error: e.message }));
  });
}

async function sendAutoValidationNotification(submitterEmail, data) {
  if (!BREVO_API_KEY() || !submitterEmail) return false;
  try {
    const tpl = tplAutoValidation(data);
    await brevoSend({
      sender:   { name: BREVO_SENDER_NAME(), email: BREVO_SENDER() },
      to:       [{ email: submitterEmail, name: data.submitterName }],
      subject:  tpl.subject,
      htmlContent: tpl.html,
    });
    console.log(`[Mailer] ✅ Auto-validation envoyée → ${submitterEmail}`);
    return true;
  } catch (e) {
    console.error(`[Mailer] ❌ Erreur auto-validation:`, e.message);
    return false;
  }
}

module.exports = { sendNewValidationNotification, sendValidationResultNotification, sendAutoValidationNotification, testConnection };
