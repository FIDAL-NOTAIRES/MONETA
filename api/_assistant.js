/* =====================================================================
   MONETA — ASSISTANT DE CLASSEMENT (3.7, cadrage de JFD du 21/10/2026)
   L'assistant RÉPOND et PROPOSE, il n'agit jamais seul :
   - il explique pourquoi une clause est rangée dans telle rubrique (avec
     la confiance du moteur, relue par la page) ou dit où irait un passage ;
   - s'il voit une erreur de rangement sur une clause DÉSIGNÉE, il peut
     proposer UN déplacement ; la page le met dans la file « À valider »
     (collaborateur) ou le montre à appliquer (administrateur) ;
   - tout le cabinet peut l'interroger, par écrit ou à la voix (la voix est
     transcrite dans le navigateur, le serveur ne reçoit que du texte).
   Garde-fous côté serveur : une proposition qui vise une rubrique absente
   du plan, ou une autre clause que celle désignée, est supprimée.
   Même clé et même modèle que la lecture des scans (voir _lecture.js).
   ===================================================================== */
import { MODELE, tarif } from "./_lecture.js";
export const VERSION_ASSISTANT = "1.0";

const CONSIGNE = `Tu es l'assistant de classement de MONETA, le clausier d'un office notarial français. Le clausier range les clauses d'actes (neutralisées : les éléments propres au dossier sont remplacés par des champs entre crochets) dans des RUBRIQUES définies par leur OBJET JURIDIQUE, regroupées en articles. Principe de la maison : le fond vaut plus que la forme, c'est le contenu qui identifie la clause, pas sa place dans l'acte.

Tu réponds aux questions des notaires et collaborateurs sur le classement : pourquoi une clause est dans telle rubrique, où ranger un passage, quelle rubrique couvre telle question, combien de clauses compte une rubrique. Tu t'appuies UNIQUEMENT sur ce que la page te transmet : le plan du type d'acte (identifiant, titre, article, nombre de clauses), et le cas échéant la clause désignée (texte, rubrique actuelle, rangée d'office ou à la main, propositions du moteur de mots-clés avec leur score et le niveau de confiance) ou le passage soumis (propositions du moteur). Le moteur de mots-clés est un indice, pas un juge : tu peux le contredire si l'objet juridique du texte relève d'une autre rubrique, en le disant.

Règles :
- Réponds en français, en quelques phrases claires, sans jargon informatique et sans aucun mot anglais. Cite les rubriques par leur titre suivi de leur identifiant entre parenthèses.
- N'invente jamais une rubrique : seules existent celles du plan transmis.
- Tu ne déplaces rien et n'écris rien. Si, et seulement si, une CLAUSE DÉSIGNÉE te paraît mal rangée, tu peux proposer UN déplacement vers une rubrique du plan, avec un motif d'une phrase sur le fond. Pour un passage soumis, ou sans clause désignée, aucune proposition : tu dis seulement où il irait.
- Si la question sort du classement (rédaction, conseil juridique sur un dossier), dis-le en une phrase et ramène au classement.
- Dans le doute entre deux rubriques, dis-le et explique ce qui les départage.

Réponds UNIQUEMENT par un objet JSON, sans texte autour : {"reponse":"<ta réponse>","proposition":null} ou {"reponse":"<ta réponse>","proposition":{"clause":"<identifiant de la clause désignée>","vers":"<identifiant de la rubrique>","motif":"<une phrase>"}}`;

const coupe = (t, n) => String(t ?? "").slice(0, n);

export async function repondre({ question, type, plan, clause, passage, historique }) {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) { const e = new Error("ANTHROPIC_API_KEY absente des variables d'environnement Vercel du projet MONETA"); e.code = "cle"; throw e; }
  const rubs = (Array.isArray(plan) ? plan : []).slice(0, 400);
  const ids = new Set(rubs.map(r => String(r.id)));
  const ligneCand = c => `${c.id}${c.titre ? " « " + coupe(c.titre, 120) + " »" : ""} : score ${Number(c.score || 0).toFixed(2)}${c.appris ? " (reprise d'une correction humaine)" : ""}`;
  let corps = `TYPE D'ACTE : ${coupe(type, 80) || "?"}\n\nPLAN (identifiant | article | rubrique | clauses rangées) :\n`
    + rubs.map(r => `${r.id} | ${coupe(r.article_titre, 80)} | ${coupe(r.titre, 120)} | ${+r.nb || 0}`).join("\n");
  if (clause && clause.id) {
    corps += `\n\nCLAUSE DÉSIGNÉE : ${coupe(clause.id, 30)}\nRubrique actuelle : ${coupe(clause.rubrique_id, 30)} « ${coupe(clause.rubrique_titre, 120)} »\n`
      + `Rangement : ${clause.office ? "d'office par le moteur" : "à la main"}${clause.corrigee ? " (après correction humaine)" : ""}\n`
      + `Confiance du moteur sur ce texte : ${coupe(clause.confiance, 40) || "non calculée"}\n`
      + `Propositions du moteur de mots-clés :\n${(clause.candidats || []).slice(0, 4).map(ligneCand).join("\n") || "aucune"}\n`
      + `Texte :\n${coupe(clause.texte, 6000)}`;
  }
  if (passage && passage.texte) {
    corps += `\n\nPASSAGE SOUMIS (pas encore au clausier) :\n${coupe(passage.texte, 6000)}\nPropositions du moteur de mots-clés :\n${(passage.candidats || []).slice(0, 4).map(ligneCand).join("\n") || "aucune"}`;
  }
  const messages = [];
  for (const h of (Array.isArray(historique) ? historique : []).slice(-4)) {
    if (h?.question && h?.reponse) { messages.push({ role: "user", content: coupe(h.question, 1500) }); messages.push({ role: "assistant", content: JSON.stringify({ reponse: coupe(h.reponse, 2500), proposition: null }) }); }
  }
  messages.push({ role: "user", content: `${corps}\n\nQUESTION : ${coupe(question, 2000)}\n\nProduis le JSON.` });
  const rep = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": cle, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODELE, max_tokens: 1500, temperature: 0, system: CONSIGNE, messages }),
  });
  const brut = await rep.text();
  if (!rep.ok) { const e = new Error(`API ${rep.status} : ${brut.slice(0, 300)}`); e.code = "api"; throw e; }
  let j = {}; try { j = JSON.parse(brut); } catch { }
  const sortie = (j.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
  const m = sortie.match(/\{[\s\S]*\}/); let lu = null; if (m) { try { lu = JSON.parse(m[0]); } catch { } }
  if (!lu || typeof lu.reponse !== "string" || !lu.reponse.trim()) { const e = new Error("réponse de Claude non exploitable"); e.code = "reponse"; throw e; }
  // garde-fous : seule la clause désignée peut être déplacée, et seulement vers une rubrique du plan, différente de l'actuelle
  let proposition = null; const p = lu.proposition;
  if (p && clause?.id && String(p.clause) === String(clause.id) && ids.has(String(p.vers)) && String(p.vers) !== String(clause.rubrique_id)) {
    proposition = { clause: String(p.clause), vers: String(p.vers), motif: coupe(p.motif, 400).trim() };
  }
  const t = tarif(), u = j.usage || {};
  return { reponse: lu.reponse.trim(), proposition, modele: MODELE, version: VERSION_ASSISTANT,
    cout: ((u.input_tokens || 0) * t.entree + (u.output_tokens || 0) * t.sortie) / 1e6 };
}
