// ============================================================
// MONETA — les moteurs, en une seule fonction serveur à actions
// (limite de douze fonctions par déploiement sur l'offre gratuite de Vercel)
//   POST /api/moteurs  { action: "decouper", texte }                → moteur de DÉCOUPE (en service)
//                      { action: "ranger", points, rubriques, … }   → moteur de RANGEMENT (en service, 0.6)
//                      { action: "comparer", depot }                → moteur de COMPARAISON (à venir)
//   GET  /api/moteurs                                               → état des moteurs
// Les règles tournent ici, côté serveur : la page envoie le texte et ne reçoit
// que le résultat, jamais les règles (cœur caché, comme /api/filiation de HISTO).
// ============================================================
import { decouper, VERSION_DECOUPE } from "./_decoupe.js";
import { ranger, VERSION_RANGEMENT } from "./_rangement.js";
import { lire, tarif, VERSION_LECTURE } from "./_lecture.js";
import { neutraliser, VERSION_NEUTRALISATION } from "./_neutraliser.js";
import { indiquer, VERSION_INDICATION } from "./_indication.js";

const ACTIONS = { decouper: "découpe", ranger: "rangement", lire: "lecture des pages scannées", neutraliser: "neutralisation", indication: "indication de variante", comparer: "comparaison" };
const TAILLE_MAX = 3_000_000;   // caractères : un acte fait rarement plus de 300 000

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ moneta: { version: "2.0",
    moteurs: { decouper: { etat: "en service", version: VERSION_DECOUPE },
               ranger: { etat: "en service", version: VERSION_RANGEMENT },
               lire: { etat: tarif().disponible ? "en service" : "clé API absente", version: VERSION_LECTURE, ...tarif() },
               neutraliser: { etat: tarif().disponible ? "en service" : "clé API absente", version: VERSION_NEUTRALISATION },
               indication: { etat: tarif().disponible ? "en service" : "clé API absente", version: VERSION_INDICATION },
               comparer: { etat: "à venir" } } } });
  if (req.method !== "POST") return res.status(405).json({ erreur: { code: "methode", message: "GET ou POST seulement." } });
  let corps = req.body;
  if (typeof corps === "string") { try { corps = JSON.parse(corps); } catch { corps = null; } }
  const action = corps?.action;
  if (!ACTIONS[action]) return res.status(400).json({ erreur: { code: "action", message: `Action inconnue : ${action ?? "(aucune)"}. Attendu : ${Object.keys(ACTIONS).join(", ")}.` } });

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
