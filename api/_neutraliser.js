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
   1.2 (21/10/2026, tranché par JFD) : trois manques comblés — (a) PROFESSION, COORDONNÉES (courriel, téléphone, références
   bancaires) et RÉFÉRENCES propres au dossier (numéro de permis, de dossier, de police, de rapport) deviennent [PROFESSION],
   [COORDONNÉES], [RÉFÉRENCE] ; (b) les SOMMES fixées par la loi (droit fixe, seuils, abattements) restent en clair comme les
   délais et taux légaux ; (c) les DATES qui sont des seuils ou des dates d'entrée en vigueur fixés par la loi (« avant le
   1er juillet 1997 », « avant 1949 ») restent en clair. La liste des rubriques qui protègent un champ devient une sécurité
   de plus, et non plus la seule protection.
   1.3 (24/10/2026, JFD) : SURLIGNEUR — les champs déjà posés à la main entre crochets ([NOM DU VENDEUR], [DURÉE EN MOIS]…)
   restent tels quels, et Claude reprend le même nom de champ pour toute autre mention de la même personne ou valeur.
   1.4 (24/10/2026, JFD) : CATALOGUE DES CHAMPS — la page transmet la liste des champs du cabinet ; Claude emploie le nom exact d'un
   champ du catalogue quand il convient, et sinon CRÉE un champ court et explicite ; la page relève ces champs nouveaux et les soumet
   à la validation de l'administrateur avant de les verser au catalogue.
   Même clé et même modèle que la lecture des scans (voir _lecture.js).
   ===================================================================== */
import { MODELE, tarif } from "./_lecture.js";
export const VERSION_NEUTRALISATION = "1.4";
// sorte d'élément à laisser en clair → champs concernés
export const SORTES_EN_CLAIR = { "quotité": "les quotités", "durée": "les durées convenues", "taux": "les taux convenus", "date": "les dates", "montant": "les sommes d'argent et le prix" };
const CONSIGNE = `Tu es le clerc d'un office notarial français. Tu prépares un CLAUSIER : chaque clause d'un acte réel doit devenir un MODÈLE réutilisable dans un autre dossier.

Pour chaque point reçu, rends le MÊME TEXTE, mot pour mot, en remplaçant SEULEMENT les éléments propres à ce dossier par un champ entre crochets, en majuscules :
- personnes et sociétés parties à l'acte, selon leur rôle dans l'acte : [VENDEUR], [ACQUÉREUR], [PROMETTANT], [BÉNÉFICIAIRE], [DONATEUR], [DONATAIRE], [SOCIÉTÉ], [ASSOCIÉ] ; leurs représentants : [REPRÉSENTANT] ; si l'acte emploie déjà « le VENDEUR », « le PROMETTANT »… comme désignation générique, garde ces mots tels quels ;
- autres personnes nommées : [NOTAIRE], [AGENCE], [ÉTABLISSEMENT PRÊTEUR], [TIERS] ;
- profession d'une personne : [PROFESSION] ; courriel, téléphone, références bancaires (IBAN, RIB, numéro de compte) : [COORDONNÉES] ;
- sommes d'argent propres au dossier : [PRIX] pour le prix, [MONTANT] pour toute autre somme convenue ou propre à l'affaire ;
- dates propres au dossier (date d'un acte, d'un permis, d'un diagnostic, de naissance, d'une échéance convenue) : [DATE] ; adresses et lieux précis : [ADRESSE], [COMMUNE] ;
- durées et taux CONVENUS entre les parties (durée d'un prêt, d'un bail, d'une convention ; délai fixé par les parties ; taux d'intérêt convenu) : [DURÉE] pour une durée ou un délai, [TAUX] pour un taux ;
- quotités et fractions de droits (« la moitié indivise », « les trois dixièmes en pleine propriété », « 50 % ») : [QUOTITÉ] ;
- désignation cadastrale, lots, volumes, références de publication, numéros SIREN ou RCS : [CADASTRE], [LOT], [PUBLICATION], [SIREN] ;
- autres numéros propres au dossier (permis de construire, numéro de dossier, police d'assurance, rapport de diagnostic, immatriculation) : [RÉFÉRENCE].
CHAMPS DÉJÀ POSÉS : le texte peut contenir des champs déjà mis entre crochets à la main par le notaire (par exemple [NOM DU VENDEUR], [DURÉE EN MOIS], [INDEMNITÉ D'IMMOBILISATION]). Garde-les EXACTEMENT tels quels, sans les renommer ni les traduire dans la liste ci-dessus ; et si la même personne ou la même valeur apparaît ailleurs sous une autre forme, emploie ce même champ.
CATALOGUE : si un catalogue des champs du cabinet est fourni, emploie le nom EXACT du champ du catalogue qui convient le mieux (par exemple [PRÉNOM ET NOM DU NOTAIRE QUI REÇOIT L'ACTE] plutôt que [NOTAIRE], [SECTION CADASTRALE] et [NUMÉRO DE PARCELLE] plutôt que [CADASTRE]) ; si aucun champ du catalogue ni de la liste ci-dessus ne convient, CRÉE un champ court et explicite en majuscules (par exemple [DATE DU DIAGNOSTIC]).
Quand une même partie revient plusieurs fois, garde le même champ. S'il y a deux personnes de même rôle, numérote : [ACQUÉREUR 1], [ACQUÉREUR 2].

NE TOUCHE PAS : la rédaction, la ponctuation, les références de textes (articles de loi, codes, décrets, et leur date), les délais, taux et SOMMES FIXÉS PAR LA LOI (par exemple un délai de rétractation, un taux d'intérêt légal, le droit fixe d'enregistrement, un seuil ou un abattement fiscal : ils restent tels quels, avec leur chiffre), les DATES SEUILS fixées par la loi (par exemple « permis délivré avant le 1er juillet 1997 », « construit avant le 1er janvier 1949 »), les termes juridiques, les titres. Seuls les délais, durées et taux CONVENUS entre les parties sont remplacés par [DURÉE] ou [TAUX] ; dans le doute sur l'origine d'un délai, d'une somme ou d'une date (fixé par la loi ou propre au dossier), laisse-le tel quel. Ne corrige pas les fautes.
Certains points portent, après leur numéro, la mention « [laisser en clair dans ce point : … ] » : dans CE point seulement, ne remplace PAS les éléments de ces sortes (ils font alors partie de la clause) ; neutralise tout le reste normalement. Si un point ne contient rien de propre au dossier, rends-le à l'identique.

Réponds UNIQUEMENT par un objet JSON, sans texte autour : {"points":[{"num":"<numéro reçu>","texte":"<texte neutralisé>"}]}`;

export async function neutraliser({ points, nom, type, champs = [] }) {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) { const e = new Error("ANTHROPIC_API_KEY absente des variables d'environnement Vercel du projet MONETA"); e.code = "cle"; throw e; }
  const mention = p => { const g = [...new Set((Array.isArray(p.garder) ? p.garder : []).filter(x => SORTES_EN_CLAIR[x]))];
    return g.length ? ` [laisser en clair dans ce point : ${g.map(x => SORTES_EN_CLAIR[x]).join(", ")}]` : ""; };
  const corps = points.map(p => `— POINT ${p.num} —${mention(p)}\n${p.texte}`).join("\n\n");
  const longueur = points.reduce((n, p) => n + p.texte.length, 0);
  const catalogue = champs.length ? `\n\nCATALOGUE DES CHAMPS DU CABINET (à employer en priorité, nom exact entre crochets, en majuscules) : ${champs.map(c => `[${String(c).toLocaleUpperCase("fr-FR")}]`).join(", ")}.` : "";
  const rep = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": cle, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODELE, max_tokens: Math.min(16000, Math.ceil(longueur / 2.2) + 1500), temperature: 0, system: CONSIGNE,
      messages: [{ role: "user", content: `Acte : ${nom || "?"} (${type || "type non précisé"}). ${points.length} points à neutraliser.${catalogue}\n\n${corps}\n\nProduis le JSON.` }] }),
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
