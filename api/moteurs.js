// ============================================================
// MONETA — les deux moteurs, en une seule fonction serveur à actions
// (limite de douze fonctions par déploiement sur l'offre gratuite de Vercel)
//   POST /api/moteurs  { action: "decouper", texte }  → moteur de DÉCOUPE (en service)
//                      { action: "comparer", depot }  → moteur de COMPARAISON (à venir)
//   GET  /api/moteurs                                 → état des moteurs
// La découpe tourne ici, côté serveur : la page envoie le texte et ne reçoit
// que le résultat, jamais les règles (cœur caché, comme /api/filiation de HISTO).
// ============================================================
import { decouper, VERSION_DECOUPE } from "./_decoupe.js";

const ACTIONS = { decouper: "découpe", comparer: "comparaison" };
const TAILLE_MAX = 3_000_000;   // caractères : un acte fait rarement plus de 300 000

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ moneta: { version: "0.4",
    moteurs: { decouper: { etat: "en service", version: VERSION_DECOUPE }, comparer: { etat: "à venir" } } } });
  if (req.method !== "POST") return res.status(405).json({ erreur: { code: "methode", message: "GET ou POST seulement." } });
  let corps = req.body;
  if (typeof corps === "string") { try { corps = JSON.parse(corps); } catch { corps = null; } }
  const action = corps?.action;
  if (!ACTIONS[action]) return res.status(400).json({ erreur: { code: "action", message: `Action inconnue : ${action ?? "(aucune)"}. Attendu : ${Object.keys(ACTIONS).join(" ou ")}.` } });

  if (action === "decouper") {
    const texte = corps.texte;
    if (typeof texte !== "string" || !texte.trim()) return res.status(400).json({ erreur: { code: "texte", message: "Le texte de l'acte est vide." } });
    if (texte.length > TAILLE_MAX) return res.status(413).json({ erreur: { code: "trop-long", message: "Texte trop long pour un seul acte." } });
    try { return res.status(200).json({ decoupe: decouper(texte) }); }
    catch (e) { return res.status(500).json({ erreur: { code: "decoupe", message: "Découpe en échec : " + (e.message || e) } }); }
  }
  return res.status(501).json({ erreur: { code: "moteur-a-venir", message: `Le moteur de ${ACTIONS[action]} n'est pas encore en service.` } });
}
