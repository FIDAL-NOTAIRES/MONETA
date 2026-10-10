/* =====================================================================
   MONETA — « POURQUOI CETTE VARIANTE » (2.0, arbitrage JFD du 10/10/2026)
   Quand un point est gardé comme variante, Claude rédige en UNE ligne ce
   que cette rédaction apporte par rapport à la clause de référence de la
   rubrique (la clause étoile, ou à défaut la clause la plus proche).
   Coût de l'ordre d'un dixième de centime par variante ; corrigeable dans
   la fiche de la clause. Même clé et même modèle que la lecture des scans.
   ===================================================================== */
import { MODELE, tarif } from "./_lecture.js";
export const VERSION_INDICATION = "1.0";
const CONSIGNE = `Tu es notaire. On te donne deux rédactions d'une même clause d'acte notarié : la RÉFÉRENCE (clause habituelle) et une VARIANTE.
Dis en UNE SEULE phrase courte (25 mots au plus), en commençant par un verbe à l'indicatif (« Ajoute… », « Supprime… », « Prévoit… », « Restreint… », « Étend… », « Allège… »), ce que la variante change sur le FOND par rapport à la référence : protection d'une partie, condition, délai, garantie, sanction, cas visé.
Ignore les simples différences de mots, de ponctuation ou de mise en forme. Si la variante ne change rien sur le fond, réponds exactement : « Même portée que la référence, rédaction différente. »
Réponds par la phrase seule, sans guillemets ni préambule.`;
export async function indiquer({ reference, variante, rubrique }) {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) { const e = new Error("ANTHROPIC_API_KEY absente des variables d'environnement Vercel du projet MONETA"); e.code = "cle"; throw e; }
  const rep = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": cle, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODELE, max_tokens: 200, temperature: 0, system: CONSIGNE,
      messages: [{ role: "user", content: `Rubrique : ${rubrique || "?"}\n\nRÉFÉRENCE :\n${String(reference).slice(0, 8000)}\n\nVARIANTE :\n${String(variante).slice(0, 8000)}` }] }),
  });
  const brut = await rep.text();
  if (!rep.ok) { const e = new Error(`API ${rep.status} : ${brut.slice(0, 300)}`); e.code = "api"; throw e; }
  let j = {}; try { j = JSON.parse(brut); } catch { }
  const texte = (j.content || []).filter(b => b.type === "text").map(b => b.text).join(" ").replace(/\s+/g, " ").replace(/^["«\s]+|["»\s]+$/g, "").trim();
  if (!texte) { const e = new Error("réponse vide"); e.code = "reponse"; throw e; }
  const t = tarif(), u = j.usage || {};
  return { texte, modele: MODELE, cout: ((u.input_tokens || 0) * t.entree + (u.output_tokens || 0) * t.sortie) / 1e6 };
}
