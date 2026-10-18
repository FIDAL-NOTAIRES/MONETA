/* =====================================================================
   MONETA — NEUTRALISATION DES CLAUSES PAR CLAUDE (amorçage du socle, 1.9)
   Arbitrage du 09/10/2026 (soir) confirmé le 10/10 : pendant l'amorçage,
   c'est Claude qui neutralise réellement chaque clause ; le socle naît
   propre. Lancée à la main depuis le rangement d'un dépôt, après un
   estimatif ; la page envoie les points par lots (limite Vercel 4,5 Mo,
   durée 300 s). Rien d'autre que les éléments propres au dossier n'est
   touché : aucune reformulation.
   1.1 (17/10/2026, tranché par JFD) : les DURÉES et TAUX CONVENUS entre les parties (durée d'un prêt, taux d'intérêt, durée d'un
   bail, délai fixé par les parties) et les QUOTITÉS (« moitié indivise », « trois dixièmes ») deviennent des champs [DURÉE],
   [TAUX], [QUOTITÉ], pour que deux clauses qui ne diffèrent que par ces valeurs deviennent identiques ; les délais et taux
   FIXÉS PAR LA LOI restent tels quels. Chaque point peut porter une liste « garder » : les sortes d'éléments à laisser en clair
   dans CE point (rubriques qui protègent un champ). Sans liste, tout est neutralisé.
   Même clé et même modèle que la lecture des scans (voir _lecture.js).
   ===================================================================== */
import { MODELE, tarif } from "./_lecture.js";
export const VERSION_NEUTRALISATION = "1.1";
// sorte d'élément à laisser en clair → champs concernés
export const SORTES_EN_CLAIR = { "quotité": "les quotités", "durée": "les durées convenues", "taux": "les taux convenus", "date": "les dates", "montant": "les sommes d'argent et le prix" };
const CONSIGNE = `Tu es le clerc d'un office notarial français. Tu prépares un CLAUSIER : chaque clause d'un acte réel doit devenir un MODÈLE réutilisable dans un autre dossier.

Pour chaque point reçu, rends le MÊME TEXTE, mot pour mot, en remplaçant SEULEMENT les éléments propres à ce dossier par un champ entre crochets, en majuscules :
- personnes et sociétés parties à l'acte, selon leur rôle dans l'acte : [VENDEUR], [ACQUÉREUR], [PROMETTANT], [BÉNÉFICIAIRE], [DONATEUR], [DONATAIRE], [SOCIÉTÉ], [ASSOCIÉ] ; leurs représentants : [REPRÉSENTANT] ; si l'acte emploie déjà « le VENDEUR », « le PROMETTANT »… comme désignation générique, garde ces mots tels quels ;
- autres personnes nommées : [NOTAIRE], [AGENCE], [ÉTABLISSEMENT PRÊTEUR], [TIERS] ;
- sommes d'argent : [PRIX] pour le prix, [MONTANT] pour toute autre somme ;
- dates précises : [DATE] ; adresses et lieux précis : [ADRESSE], [COMMUNE] ;
- durées et taux CONVENUS entre les parties (durée d'un prêt, d'un bail, d'une convention ; délai fixé par les parties ; taux d'intérêt convenu) : [DURÉE] pour une durée ou un délai, [TAUX] pour un taux ;
- quotités et fractions de droits (« la moitié indivise », « les trois dixièmes en pleine propriété », « 50 % ») : [QUOTITÉ] ;
- désignation cadastrale, lots, volumes, références de publication, numéros SIREN ou RCS : [CADASTRE], [LOT], [PUBLICATION], [SIREN].
Quand une même partie revient plusieurs fois, garde le même champ. S'il y a deux personnes de même rôle, numérote : [ACQUÉREUR 1], [ACQUÉREUR 2].

NE TOUCHE PAS : la rédaction, la ponctuation, les références de textes (articles de loi, codes, décrets), les délais et taux FIXÉS PAR LA LOI (par exemple un délai de rétractation, un taux d'intérêt légal : ils restent tels quels, avec leur chiffre), les termes juridiques, les titres. Seuls les délais, durées et taux CONVENUS entre les parties sont remplacés par [DURÉE] ou [TAUX] ; dans le doute sur l'origine d'un délai (légal ou convenu), laisse-le tel quel. Ne corrige pas les fautes.
Certains points portent, après leur numéro, la mention « [laisser en clair dans ce point : … ] » : dans CE point seulement, ne remplace PAS les éléments de ces sortes (ils font alors partie de la clause) ; neutralise tout le reste normalement. Si un point ne contient rien de propre au dossier, rends-le à l'identique.

Réponds UNIQUEMENT par un objet JSON, sans texte autour : {"points":[{"num":"<numéro reçu>","texte":"<texte neutralisé>"}]}`;

export async function neutraliser({ points, nom, type }) {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) { const e = new Error("ANTHROPIC_API_KEY absente des variables d'environnement Vercel du projet MONETA"); e.code = "cle"; throw e; }
  const mention = p => { const g = [...new Set((Array.isArray(p.garder) ? p.garder : []).filter(x => SORTES_EN_CLAIR[x]))];
    return g.length ? ` [laisser en clair dans ce point : ${g.map(x => SORTES_EN_CLAIR[x]).join(", ")}]` : ""; };
  const corps = points.map(p => `— POINT ${p.num} —${mention(p)}\n${p.texte}`).join("\n\n");
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
  return { points: lu.points.map(p => ({ num: String(p.num), texte: String(p.texte ?? "") })), modele: MODELE, version: VERSION_NEUTRALISATION, usage: u,
           cout: ((u.input_tokens || 0) * t.entree + (u.output_tokens || 0) * t.sortie) / 1e6 };
}
