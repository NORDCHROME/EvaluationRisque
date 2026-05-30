// mailer.js — Service d'envoi d'emails (nodemailer)
// Variables d'environnement requises :
//   SMTP_HOST    ex: smtp.gmail.com  ou  smtp.office365.com
//   SMTP_PORT    ex: 587
//   SMTP_SECURE  "true" pour SSL/465, "false" pour STARTTLS/587
//   SMTP_USER    adresse email expéditeur
//   SMTP_PASS    mot de passe ou App Password
//   SMTP_FROM    ex: "EvalRisque NORDCHROME <noreply@nordchrome.fr>"  (optionnel)
//   APP_URL      URL publique de l'app ex: https://evalrisque.up.railway.app

const nodemailer = require('nodemailer');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('[Mailer] ⚠️  Variables SMTP manquantes — notifications désactivées');
    return null;
  }

  _transporter = nodemailer.createTransport({
    host:   SMTP_HOST,
    port:   parseInt(SMTP_PORT || '587', 10),
    secure: SMTP_SECURE === 'true',
    auth:   { user: SMTP_USER, pass: SMTP_PASS },
    tls:    { rejectUnauthorized: false }, // évite les erreurs de cert auto-signé
  });

  return _transporter;
}

const FROM = process.env.SMTP_FROM || `"EvalRisque" <${process.env.SMTP_USER}>`;
const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

// ── Templates HTML ────────────────────────────────────────────────────────────

function tplNewValidation({ managerName, submitterName, interventionTitle, location, date, riskCount, validationId }) {
  const title = interventionTitle || 'Évaluation sans titre';
  const dateStr = date ? new Date(date).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }) : '—';
  return {
    subject: `⚠️ Nouvelle évaluation à valider — ${title}`,
    html: `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#f0f4f8; margin:0; padding:20px; color:#1a2533; }
  .wrap { max-width:580px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.10); }
  .hdr  { background:#0a121a; padding:28px 32px; }
  .hdr-title { color:#ffffff; font-size:22px; font-weight:700; margin:0; }
  .hdr-sub   { color:#7ab3d4; font-size:13px; margin-top:4px; }
  .body { padding:28px 32px; }
  .alert { background:#fff8f3; border-left:4px solid #c84b31; border-radius:4px; padding:14px 18px; margin-bottom:22px; font-size:14px; color:#374151; }
  .meta  { background:#f5f8fa; border-radius:6px; padding:16px 20px; margin-bottom:22px; }
  .meta-row { display:flex; gap:12px; padding:5px 0; font-size:13px; }
  .meta-label { color:#6b7280; min-width:110px; font-weight:600; }
  .meta-value { color:#1a2533; }
  .btn { display:inline-block; background:#c84b31; color:#ffffff !important; text-decoration:none; padding:13px 28px; border-radius:5px; font-weight:700; font-size:15px; margin:8px 0; }
  .footer { background:#f0f4f8; padding:16px 32px; font-size:11px; color:#9ca3af; text-align:center; border-top:1px solid #e5e7eb; }
  .badge { display:inline-block; padding:2px 10px; border-radius:12px; font-size:11px; font-weight:700; background:#fde8e6; color:#c84b31; }
</style></head><body>
<div class="wrap">
  <div class="hdr">
    <div class="hdr-title">🛡 EvalRisque — Nouvelle validation requise</div>
    <div class="hdr-sub">NORDCHROME — Système de gestion des risques</div>
  </div>
  <div class="body">
    <div class="alert">
      Bonjour <strong>${managerName}</strong>,<br/><br/>
      <strong>${submitterName}</strong> vient de soumettre une évaluation des risques qui nécessite votre validation.
    </div>
    <div class="meta">
      <div class="meta-row"><span class="meta-label">🏷️ Intervention</span><span class="meta-value"><strong>${title}</strong></span></div>
      <div class="meta-row"><span class="meta-label">👤 Intervenant</span><span class="meta-value">${submitterName}</span></div>
      <div class="meta-row"><span class="meta-label">📍 Lieu</span><span class="meta-value">${location || '—'}</span></div>
      <div class="meta-row"><span class="meta-label">📅 Date</span><span class="meta-value">${dateStr}</span></div>
      <div class="meta-row"><span class="meta-label">⚠️ Risques</span><span class="meta-value"><span class="badge">${riskCount} risque(s) identifié(s)</span></span></div>
    </div>
    <p style="font-size:13px;color:#4b5563;margin-bottom:20px">
      Connectez-vous à l'application pour consulter le détail complet (risques, mesures de prévention, EPI/EPC) et valider ou refuser ce rapport.
    </p>
    <a href="${APP_URL}" class="btn">👁 Accéder à l'application</a>
  </div>
  <div class="footer">EvalRisque • NORDCHROME • Ce message est automatique, ne pas répondre directement.</div>
</div>
</body></html>`
  };
}

function tplValidationResult({ submitterName, interventionTitle, status, comment, managerName }) {
  const title = interventionTitle || 'Évaluation sans titre';
  const isApproved = status === 'approved';
  const statusColor = isApproved ? '#2d7a4f' : '#c84b31';
  const statusBg    = isApproved ? '#e6f4ec'  : '#fde8e6';
  const statusLabel = isApproved ? '✅ Rapport VALIDÉ' : '❌ Rapport REFUSÉ';
  const statusMsg   = isApproved
    ? 'Votre rapport a été approuvé et signé par votre responsable. Vous pouvez le télécharger depuis l\'onglet "Mes Évaluations".'
    : 'Votre rapport a été refusé par votre responsable. Consultez le commentaire ci-dessous et corrigez votre évaluation.';
  return {
    subject: `${isApproved ? '✅' : '❌'} Rapport ${isApproved ? 'validé' : 'refusé'} — ${title}`,
    html: `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#f0f4f8; margin:0; padding:20px; color:#1a2533; }
  .wrap { max-width:580px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.10); }
  .hdr  { background:#0a121a; padding:28px 32px; }
  .hdr-title { color:#ffffff; font-size:22px; font-weight:700; margin:0; }
  .hdr-sub   { color:#7ab3d4; font-size:13px; margin-top:4px; }
  .body { padding:28px 32px; }
  .status-badge { background:${statusBg}; border:1.5px solid ${statusColor}; border-radius:6px; padding:14px 20px; font-size:16px; font-weight:700; color:${statusColor}; margin-bottom:20px; }
  .msg  { font-size:13.5px; color:#374151; margin-bottom:18px; line-height:1.6; }
  .comment-box { background:#f9fafb; border-left:4px solid #6b7280; padding:12px 16px; border-radius:4px; font-size:13px; color:#374151; font-style:italic; margin-bottom:20px; }
  .btn { display:inline-block; background:#0a121a; color:#ffffff !important; text-decoration:none; padding:13px 28px; border-radius:5px; font-weight:700; font-size:14px; }
  .footer { background:#f0f4f8; padding:16px 32px; font-size:11px; color:#9ca3af; text-align:center; border-top:1px solid #e5e7eb; }
</style></head><body>
<div class="wrap">
  <div class="hdr">
    <div class="hdr-title">🛡 EvalRisque — Résultat de validation</div>
    <div class="hdr-sub">NORDCHROME — Système de gestion des risques</div>
  </div>
  <div class="body">
    <p class="msg">Bonjour <strong>${submitterName}</strong>,</p>
    <div class="status-badge">${statusLabel}</div>
    <p class="msg">Votre évaluation <strong>"${title}"</strong> a été traitée par <strong>${managerName}</strong>.<br/>${statusMsg}</p>
    ${comment ? `<div><p style="font-size:12px;font-weight:700;color:#6b7280;margin-bottom:6px">COMMENTAIRE DU RESPONSABLE :</p><div class="comment-box">${comment}</div></div>` : ''}
    <a href="${APP_URL}" class="btn">📋 Voir mes évaluations</a>
  </div>
  <div class="footer">EvalRisque • NORDCHROME • Ce message est automatique, ne pas répondre directement.</div>
</div>
</body></html>`
  };
}

// ── Fonctions d'envoi ─────────────────────────────────────────────────────────

async function sendNewValidationNotification(managerEmail, data) {
  const transport = getTransporter();
  if (!transport || !managerEmail) return false;
  try {
    const tpl = tplNewValidation(data);
    await transport.sendMail({ from: FROM, to: managerEmail, subject: tpl.subject, html: tpl.html });
    console.log(`[Mailer] ✅ Notif nouvelle validation envoyée à ${managerEmail}`);
    return true;
  } catch (e) {
    console.error(`[Mailer] ❌ Erreur envoi à ${managerEmail}:`, e.message);
    return false;
  }
}

async function sendValidationResultNotification(submitterEmail, data) {
  const transport = getTransporter();
  if (!transport || !submitterEmail) return false;
  try {
    const tpl = tplValidationResult(data);
    await transport.sendMail({ from: FROM, to: submitterEmail, subject: tpl.subject, html: tpl.html });
    console.log(`[Mailer] ✅ Notif résultat envoyée à ${submitterEmail}`);
    return true;
  } catch (e) {
    console.error(`[Mailer] ❌ Erreur envoi à ${submitterEmail}:`, e.message);
    return false;
  }
}

async function testConnection() {
  const transport = getTransporter();
  if (!transport) return { ok: false, error: 'Variables SMTP manquantes' };
  try {
    await transport.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { sendNewValidationNotification, sendValidationResultNotification, testConnection };
