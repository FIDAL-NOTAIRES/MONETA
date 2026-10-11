/* =====================================================================
   MONETA — PROPOSITIONS DE L'IA POUR CHALLENGER LA CLAUSE ÉTOILE (2.2)
   Principe validé par JFD le 10/10/2026 : lancé à la main depuis une
   rubrique, après un estimatif. Claude reçoit la clause étoile, les
   variantes de la rubrique et les documents de la bibliothèque d'appui
   qui y sont rattachés ; il rend une ou deux rédactions améliorées, chacune
   avec son fondement tiré EXCLUSIVEMENT de ces documents. Rien n'entre au
   clausier sans décision : la proposition s'adopte comme variante ou s'écarte.
   ===================================================================== */
import { MODELE, tarif } from "./_lecture.js";
export const VERSION_PROPOSITION = "1.0";
const CONSIGNE = `Tu es notaire, rédacteur exigeant. On te donne, pour une rubrique d'un clausier notarial, la CLAUSE ÉTOILE (rédaction de référence du cabinet), ses VARIANTES, et des DOCUMENTS D'APPUI (doctrine, jurisprudence, textes) numérotés.

Propose AU PLUS DEUX rédactions améliorées de la clause étoile, seulement si une amélioration de FOND est justifiée : sécurité juridique, conformité à la jurisprudence ou aux textes fournis, lacune, ambiguïté, déséquilibre.
Règles impératives :
- Tu ne t'appuies QUE sur les documents d'appui fournis et sur les variantes. Tu n'invoques AUCUN arrêt, article ou auteur qui n'y figure pas. Si aucun document n'est fourni, tu ne cites rien et tu te limites à la qualité de rédaction (clarté, cohérence, lacunes).
- Tu gardes le style des actes du cabinet et les champs entre crochets ([VENDEUR], [PRIX]…) tels qu'ils sont.
- Si la clause étoile est déjà satisfaisante, réponds avec une liste vide.

Réponds UNIQUEMENT par un objet JSON, sans texte autour :
{"propositions":[{"texte":"<rédaction complète proposée>","apport":"<une phrase : ce qu'elle change sur le fond>","fondements":[{"document":"<identifiant exact d'un document fourni>","explication":"<une phrase>"}]}]}`;
export async function proposer({ rubrique, etoile, variantes, appui }) {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) { const e = new Error("ANTHROPIC_API_KEY absente des variables d'environnement Vercel du projet MONETA"); e.code = "cle"; throw e; }
  const docs = (appui || []).slice(0, 6);
  const corps = `RUBRIQUE : ${rubrique}\n\nCLAUSE ÉTOILE :\n${String(etoile).slice(0, 8000)}\n\n`
    + ((variantes || []).length ? `VARIANTES :\n${variantes.slice(0, 6).map((v, i) => `— Variante ${i + 1} —\n${String(v).slice(0, 4000)}`).join("\n\n")}\n\n` : "VARIANTES : aucune.\n\n")
    + (docs.length ? `DOCUMENTS D'APPUI :\n${docs.map(d => `=== ${d.id} — ${d.titre}${d.reference ? ` (${d.reference})` : ""}${d.date ? `, ${d.date}` : ""} ===\n${String(d.texte || "").slice(0, 12000)}`).join("\n\n")}` : "DOCUMENTS D'APPUI : aucun.");
  const rep = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": cle, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODELE, max_tokens: 4000, temperature: 0.2, system: CONSIGNE, messages: [{ role: "user", content: corps + "\n\nProduis le JSON." }] }),
  });
  const brut = await rep.text();
  if (!rep.ok) { const e = new Error(`API ${rep.status} : ${brut.slice(0, 300)}`); e.code = "api"; throw e; }
  let j = {}; try { j = JSON.parse(brut); } catch { }
  const sortie = (j.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
  const m = sortie.match(/\{[\s\S]*\}/); let lu = null; if (m) { try { lu = JSON.parse(m[0]); } catch { } }
  if (!lu || !Array.isArray(lu.propositions)) { const e = new Error("réponse de Claude non exploitable"); e.code = "reponse"; throw e; }
  const ids = new Set(docs.map(d => d.id));
  const propositions = lu.propositions.slice(0, 2).filter(p => p && String(p.texte || "").trim()).map(p => ({
    texte: String(p.texte).trim(), apport: String(p.apport || "").trim(),
    // garde-fou : un fondement qui ne renvoie pas à un document fourni est écarté
    fondements: (Array.isArray(p.fondements) ? p.fondements : []).filter(f => ids.has(String(f.document))).map(f => ({ document: String(f.document), explication: String(f.explication || "") })) }));
  const t = tarif(), u = j.usage || {};
  return { propositions, modele: MODELE, cout: ((u.input_tokens || 0) * t.entree + (u.output_tokens || 0) * t.sortie) / 1e6 };
}
