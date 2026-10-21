// ============================================================
// MONETA — les moteurs, en une seule fonction serveur à actions
// (limite de douze fonctions par déploiement sur l'offre gratuite de Vercel)
//   POST /api/moteurs  { action: "decouper", texte }                → moteur de DÉCOUPE (en service)
//                      { action: "ranger", points, rubriques, … }   → moteur de RANGEMENT (en service, 0.6)
//                      { action: "assistant", question, plan, … } → ASSISTANT DE CLASSEMENT (3.7) : répond et propose, n'écrit rien
//                      comparaison : faite DANS LE NAVIGATEUR depuis la 1.5 (mot à mot) et la 1.6 (sens), aucune action serveur
//   GET  /api/moteurs                                               → état des moteurs
// Les règles tournent ici, côté serveur : la page envoie le texte et ne reçoit
// que le résultat, jamais les règles (cœur caché, comme /api/filiation de HISTO).
// ============================================================
import { decouper, VERSION_DECOUPE } from "./_decoupe.js";
import { ranger, VERSION_RANGEMENT } from "./_rangement.js";
import { lire, tarif, VERSION_LECTURE } from "./_lecture.js";
import { neutraliser, VERSION_NEUTRALISATION } from "./_neutraliser.js";
import { indiquer, VERSION_INDICATION } from "./_indication.js";
import { proposer, VERSION_PROPOSITION } from "./_proposer.js";
import { repondre, VERSION_ASSISTANT } from "./_assistant.js";
import { timingSafeEqual } from "node:crypto";

const ACTIONS = { decouper: "découpe", ranger: "rangement", lire: "lecture des pages scannées", neutraliser: "neutralisation", indication: "indication de variante", proposer: "propositions de l'IA", assistant: "assistant de classement", comparer: "comparaison", acces: "contrôle du code d'administrateur" };
// 2.4 — code d'administrateur : posé dans la variable MONETA_CODE_ADMIN du projet Vercel, jamais dans la page.
// Sans variable, personne n'est administrateur (refus par défaut).
function codeValide(code) {
  const attendu = process.env.MONETA_CODE_ADMIN || "";
  if (!attendu || typeof code !== "string" || !code) return false;
  const a = Buffer.from(code), b = Buffer.from(attendu);
  return a.length === b.length && timingSafeEqual(a, b);
}
const TAILLE_MAX = 3_000_000;   // caractères : un acte fait rarement plus de 300 000

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ moneta: { version: "2.5",
    moteurs: { decouper: { etat: "en service", version: VERSION_DECOUPE },
               ranger: { etat: "en service", version: VERSION_RANGEMENT },
               lire: { etat: tarif().disponible ? "en service" : "clé API absente", version: VERSION_LECTURE, ...tarif() },
               neutraliser: { etat: tarif().disponible ? "en service" : "clé API absente", version: VERSION_NEUTRALISATION },
               indication: { etat: tarif().disponible ? "en service" : "clé API absente", version: VERSION_INDICATION },
               proposer: { etat: tarif().disponible ? "en service" : "clé API absente", version: VERSION_PROPOSITION },
               assistant: { etat: tarif().disponible ? "en service" : "clé API absente", version: VERSION_ASSISTANT },
               comparer: { etat: "dans le navigateur", version: "mot à mot 1.0 + sens 1.0" },
               acces: { etat: process.env.MONETA_CODE_ADMIN ? "en service" : "code absent" } } } });
  if (req.method !== "POST") return res.status(405).json({ erreur: { code: "methode", message: "GET ou POST seulement." } });
  let corps = req.body;
  if (typeof corps === "string") { try { corps = JSON.parse(corps); } catch { corps = null; } }
  const action = corps?.action;
  if (!ACTIONS[action]) return res.status(400).json({ erreur: { code: "action", message: `Action inconnue : ${action ?? "(aucune)"}. Attendu : ${Object.keys(ACTIONS).join(", ")}.` } });

  if (action === "acces") {
    if (!process.env.MONETA_CODE_ADMIN) return res.status(503).json({ erreur: { code: "code-absent", message: "Le code d'administrateur n'est pas encore posé sur le serveur (variable MONETA_CODE_ADMIN du projet Vercel)." } });
    if (codeValide(corps.code)) return res.status(200).json({ acces: { ok: true } });
    await new Promise(r => setTimeout(r, 600));   // ralentit les essais au hasard
    return res.status(403).json({ erreur: { code: "code", message: "Code incorrect." } });
  }
  if (action === "proposer" && !codeValide(corps.code)) return res.status(403).json({ erreur: { code: "droits", message: "Cette action est réservée aux administrateurs : identifiez-vous avec votre code." } });

  if (action === "decouper") {
    const texte = corps.texte;
    if (typeof texte !== "string" || !texte.trim()) return res.status(400).json({ erreur: { code: "texte", message: "Le texte de l'acte est vide." } });
    if (texte.length > TAILLE_MAX) return res.status(413).json({ erreur: { code: "trop-long", message: "Texte trop long pour un seul acte." } });
    try { return res.status(200).json({ decoupe: decouper(texte) }); }
    catch (e) { return res.status(500).json({ erreur: { code: "decoupe", message: "Découpe en échec : " + (e.message || e) } }); }
  }
  if (action === "ranger") {
    const { points, rubriques, texte_acte } = corps;
    if (!Array.isArray(points) || !points.length) return res.status(400).json({ erreur: { code: "points", message: "Aucun point à ranger." } });
    if (!Array.isArray(rubriques) || !rubriques.length) return res.status(400).json({ erreur: { code: "rubriques", message: "Le plan du clausier est vide." } });
    try { return res.status(200).json({ rangement: ranger({ points, rubriques, texte_acte }) }); }
    catch (e) { return res.status(500).json({ erreur: { code: "rangement", message: "Rangement en échec : " + (e.message || e) } }); }
  }
  if (action === "proposer") {
    const { rubrique, etoile, variantes, appui } = corps;
    if (typeof etoile !== "string" || !etoile.trim()) return res.status(400).json({ erreur: { code: "etoile", message: "Clause de référence absente." } });
    try { return res.status(200).json({ proposition: await proposer({ rubrique, etoile, variantes, appui }) }); }
    catch (e) { return res.status(e.code === "cle" ? 503 : 502).json({ erreur: { code: e.code || "proposition", message: "Proposition en échec : " + (e.message || e) } }); }
  }
  if (action === "assistant") {
    const { question, type, plan, clause, passage, historique } = corps;
    if (typeof question !== "string" || !question.trim()) return res.status(400).json({ erreur: { code: "question", message: "La question est vide." } });
    if (!Array.isArray(plan) || !plan.length) return res.status(400).json({ erreur: { code: "plan", message: "Le plan du clausier est vide." } });
    try { return res.status(200).json({ assistant: await repondre({ question, type, plan, clause, passage, historique }) }); }
    catch (e) { return res.status(e.code === "cle" ? 503 : 502).json({ erreur: { code: e.code || "assistant", message: "Assistant en échec : " + (e.message || e) } }); }
  }
  if (action === "indication") {
    const { reference, variante, rubrique } = corps;
    if (typeof reference !== "string" || typeof variante !== "string" || !reference.trim() || !variante.trim()) return res.status(400).json({ erreur: { code: "textes", message: "Deux textes sont nécessaires." } });
    try { return res.status(200).json({ indication: await indiquer({ reference, variante, rubrique }) }); }
    catch (e) { return res.status(e.code === "cle" ? 503 : 502).json({ erreur: { code: e.code || "indication", message: "Indication en échec : " + (e.message || e) } }); }
  }
  if (action === "neutraliser") {
    const { points, nom, type } = corps;
    if (!Array.isArray(points) || !points.length || points.some(p => !p || typeof p.texte !== "string")) return res.status(400).json({ erreur: { code: "points", message: "Aucun point à neutraliser." } });
    if (points.reduce((n, p) => n + p.texte.length, 0) > 30000) return res.status(400).json({ erreur: { code: "lot", message: "Lot trop long (30 000 signes au plus)." } });
    try { return res.status(200).json({ neutralisation: await neutraliser({ points, nom, type }) }); }
    catch (e) { return res.status(e.code === "cle" ? 503 : 502).json({ erreur: { code: e.code || "neutralisation", message: "Neutralisation en échec : " + (e.message || e) } }); }
  }
  if (action === "lire") {
    const { pages, nom } = corps;
    if (!Array.isArray(pages) || !pages.length || pages.some(p => !p || typeof p.image !== "string")) return res.status(400).json({ erreur: { code: "pages", message: "Aucune page à lire." } });
    if (pages.length > 6) return res.status(400).json({ erreur: { code: "lot", message: "Six pages au plus par lot." } });
    try { return res.status(200).json({ lecture: await lire({ pages, nom }) }); }
    catch (e) { return res.status(e.code === "cle" ? 503 : 502).json({ erreur: { code: e.code || "lecture", message: "Lecture par Claude en échec : " + (e.message || e) } }); }
  }
  return res.status(501).json({ erreur: { code: "moteur-a-venir", message: `Le moteur de ${ACTIONS[action]} n'est pas encore en service.` } });
}
