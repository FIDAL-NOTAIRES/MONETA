/* =====================================================================
   MONETA — NEUTRALISATION DES CLAUSES PAR CLAUDE (amorçage du socle, 1.9)
   Arbitrage du 09/10/2026 (soir) confirmé le 10/10 : pendant l'amorçage,
   c'est Claude qui neutralise réellement chaque clause ; le socle naît
   propre. Lancée à la main depuis le rangement d'un dépôt, après un
   estimatif ; la page envoie les points par lots (limite Vercel 4,5 Mo,
   durée 300 s). Rien d'autre que les éléments propres au dossier n'est
   touché : aucune reformulation.
   Même clé et même modèle que la lecture des scans (voir _lecture.js).
   ===================================================================== */
import { MODELE, tarif } from "./_lecture.js";
export const VERSION_NEUTRALISATION = "1.0";
const CONSIGNE = `Tu es le clerc d'un office notarial français. Tu prépares un CLAUSIER : chaque clause d'un acte réel doit devenir un MODÈLE réutilisable dans un autre dossier.

Pour chaque point reçu, rends le MÊME TEXTE, mot pour mot, en remplaçant SEULEMENT les éléments propres à ce dossier par un champ entre crochets, en majuscules :
- personnes et sociétés parties à l'acte, selon leur rôle dans l'acte : [VENDEUR], [ACQUÉREUR], [PROMETTANT], [BÉNÉFICIAIRE], [DONATEUR], [DONATAIRE], [SOCIÉTÉ], [ASSOCIÉ] ; leurs représentants : [REPRÉSENTANT] ; si l'acte emploie déjà « le VENDEUR », « le PROMETTANT »… comme désignation générique, garde ces mots tels quels ;
- autres personnes nommées : [NOTAIRE], [AGENCE], [ÉTABLISSEMENT PRÊTEUR], [TIERS] ;
- sommes d'argent : [PRIX] pour le prix, [MONTANT] pour toute autre somme ;
- dates précises : [DATE] ; adresses et lieux précis : [ADRESSE], [COMMUNE] ;
- désignation cadastrale, lots, volumes, références de publication, numéros SIREN ou RCS : [CADASTRE], [LOT], [PUBLICATION], [SIREN].
Quand une même partie revient plusieurs fois, garde le même champ. S'il y a deux personnes de même rôle, numérote : [ACQUÉREUR 1], [ACQUÉREUR 2].

NE TOUCHE PAS : la rédaction, la ponctuation, les références de textes (articles de loi, codes, décrets), les délais et taux fixés par la loi, les termes juridiques, les titres. Les délais, durées et taux convenus entre les parties restent tels quels (ils font partie de la clause). Ne corrige pas les fautes. Si un point ne contient rien de propre au dossier, rends-le à l'identique.

Réponds UNIQUEMENT par un objet JSON, sans texte autour : {"points":[{"num":"<numéro reçu>","texte":"<texte neutralisé>"}]}`;

export async function neutraliser({ points, nom, type }) {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) { const e = new Error("ANTHROPIC_API_KEY absente des variables d'environnement Vercel du projet MONETA"); e.code = "cle"; throw e; }
  const corps = points.map(p => `— POINT ${p.num} —\n${p.texte}`).join("\n\n");
  const longueur = points.reduce((n, p) => n + p.texte.length, 0);
  const rep = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": cle, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODELE, max_tokens: Math.min(16000, Math.ceil(longueur / 2.2) + 1500), temperature: 0, system: CONSIGNE,
      messages: [{ role: "user", content: `Acte : ${nom || "?"} (${type || "type non précisé"}). ${points.length} points à neutraliser.\n\n${corps}\n\nProduis le JSON.` }] }),
  });
  const brut = await rep.text();
  if (!rep.ok) { const e = new Error(`API ${rep.status} : ${brut.slice(0, 300)}`); e.code = "api"; throw e; }
  let j = {}; try { j = JSON.parse(brut); } catch { }
  const sortie = (j.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
  const m = sortie.match(/\{[\s\S]*\}/); let lu = null; if (m) { try { lu = JSON.parse(m[0]); } catch { } }
  if (!lu || !Array.isArray(lu.points)) { const e = new Error("réponse de Claude non exploitable" + (j.stop_reason === "max_tokens" ? " (réponse coupée : lot trop long)" : "")); e.code = "reponse"; throw e; }
  const t = tarif(), u = j.usage || {};
  return { points: lu.points.map(p => ({ num: String(p.num), texte: String(p.texte ?? "") })), modele: MODELE, usage: u,
           cout: ((u.input_tokens || 0) * t.entree + (u.output_tokens || 0) * t.sortie) / 1e6 };
}
