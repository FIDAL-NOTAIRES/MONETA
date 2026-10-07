// ============================================================
// MONETA — les deux moteurs, en une seule fonction serveur à actions
// (limite de douze fonctions par déploiement sur l'offre gratuite de Vercel)
//   POST /api/moteurs  { action: "decouper", depot }  → moteur de DÉCOUPAGE
//                      { action: "comparer", depot }  → moteur de COMPARAISON
// État au 07/10/2026 : squelette. Les deux actions répondent « à venir »
// tant que le plan des parties de chaque type d'acte n'est pas construit.
// Le découpage appliquera la fiche de règles « acte pour clausier » de la
// bibliothèque d'anonymisation : noms, prix, dates, adresses remplacés par
// des champs à remplir ([VENDEUR], [ACQUÉREUR], [PRIX], [DATE], [ADRESSE]…).
// La comparaison rendra pour chaque clause : doublon (clause X) / variante
// utile (indication cachée rédigée) / nouvelle — l'humain tranche toujours.
// ============================================================
const ACTIONS = { decouper: "découpage", comparer: "comparaison" };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ moneta: { version: "0.1", moteurs: Object.keys(ACTIONS), etat: "squelette" } });
  if (req.method !== "POST") return res.status(405).json({ erreur: { code: "methode", message: "GET ou POST seulement." } });
  let corps = req.body;
  if (typeof corps === "string") { try { corps = JSON.parse(corps); } catch { corps = null; } }
  const action = corps?.action;
  if (!ACTIONS[action]) return res.status(400).json({ erreur: { code: "action", message: `Action inconnue : ${action ?? "(aucune)"}. Attendu : ${Object.keys(ACTIONS).join(" ou ")}.` } });
  return res.status(501).json({ erreur: { code: "moteur-a-venir", message: `Le moteur de ${ACTIONS[action]} n'est pas encore en service.` } });
}
