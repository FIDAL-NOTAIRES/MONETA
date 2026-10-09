/* =====================================================================
   MONETA — lecture des pages scannées par Claude (seconde passe, 1.3)
   Méthode du cabinet, reprise de TRENTE : reconnaissance gratuite d'abord
   (Tesseract, dans le navigateur), puis cette passe pour compléter, LANCÉE
   SEULEMENT sur validation explicite du collaborateur, après un estimatif
   de coût. La page envoie, par petits lots (limite Vercel de 4,5 Mo par
   requête), l'image de chaque page scannée et le texte que la
   reconnaissance gratuite en a tiré ; Claude rend la transcription fidèle,
   corrigée d'après l'image, y compris l'écriture manuscrite.

   Variables d'environnement (Vercel → Settings → Environment Variables) :
     ANTHROPIC_API_KEY   obligatoire pour cette passe (la même clé que TRENTE convient)
     ANTHROPIC_MODEL     facultatif, défaut ci-dessous (le même que TRENTE)
   ===================================================================== */
export const VERSION_LECTURE = "1.0";
export const MODELE = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
// Tarifs publics en dollars par million de jetons (entrée, sortie), relevés le 09/10/2026.
// Un modèle absent de la table est estimé au tarif Sonnet, et l'estimatif le dit.
const TARIFS = { "claude-sonnet-4-5": [3, 15], "claude-sonnet-4-6": [3, 15], "claude-sonnet-4": [3, 15],
                 "claude-haiku-4-5": [1, 5], "claude-opus-4-5": [5, 25], "claude-opus-4-6": [5, 25] };
export function tarif() {
  const cle = Object.keys(TARIFS).find(k => MODELE === k || MODELE.startsWith(k + "-"));
  return { modele: MODELE, entree: (TARIFS[cle] || TARIFS["claude-sonnet-4-5"])[0], sortie: (TARIFS[cle] || TARIFS["claude-sonnet-4-5"])[1], suppose: !cle,
           disponible: !!process.env.ANTHROPIC_API_KEY };
}
const CONSIGNE = `Tu es le clerc d'un office notarial français. Tu reçois des pages d'un acte notarié scanné : pour chaque page, son image et le texte qu'une reconnaissance automatique de caractères en a tiré (souvent fautif, parfois vide, notamment sur l'écriture manuscrite).

Ta tâche : rendre la TRANSCRIPTION FIDÈLE de chaque page, d'après l'image, en te servant du texte reconnu comme d'un simple appui.
- Recopie le texte tel qu'il est écrit : ne reformule rien, ne modernise rien, ne résume rien, n'ajoute rien.
- Corrige les erreurs de reconnaissance d'après l'image : chiffres, dates, numéros de volume, noms propres, accents.
- Ce que tu ne peux pas lire avec certitude, tu ne l'inventes pas : écris [illisible] à sa place.
- Garde la structure : un titre ou un paragraphe par ligne, une ligne vide entre deux paragraphes ; garde la numérotation des articles telle qu'elle apparaît.
- N'écris ni les en-têtes ni les pieds de page répétés (numéro de page, paraphes, mentions de l'imprimeur).

Réponds UNIQUEMENT par un objet JSON, sans texte autour : {"pages":[{"n":<numéro de page reçu>,"texte":"<transcription>"}]}`;

export async function lire({ pages, nom }) {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) { const e = new Error("ANTHROPIC_API_KEY absente des variables d'environnement Vercel du projet MONETA"); e.code = "cle"; throw e; }
  const contenu = [];
  for (const p of pages) {
    contenu.push({ type: "text", text: `— Page ${p.n} —\nTexte reconnu automatiquement (à corriger d'après l'image) :\n${(p.ocr || "").slice(0, 12000) || "(rien de reconnu)"}` });
    contenu.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: p.image } });
  }
  contenu.push({ type: "text", text: `Acte : ${nom || "?"}. Pages jointes : ${pages.map(p => p.n).join(", ")}. Produis le JSON.` });
  const rep = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": cle, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODELE, max_tokens: Math.min(16000, 2500 * pages.length), temperature: 0, system: CONSIGNE,
      messages: [{ role: "user", content: contenu }] }),
  });
  const brut = await rep.text();
  if (!rep.ok) { const e = new Error(`API ${rep.status} : ${brut.slice(0, 300)}`); e.code = "api"; throw e; }
  let j = {}; try { j = JSON.parse(brut); } catch { }
  const sortie = (j.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
  const m = sortie.match(/\{[\s\S]*\}/);
  let lu = null; if (m) { try { lu = JSON.parse(m[0]); } catch { } }
  if (!lu || !Array.isArray(lu.pages)) { const e = new Error("réponse de Claude non exploitable"); e.code = "reponse"; throw e; }
  const t = tarif(), u = j.usage || {};
  const cout = ((u.input_tokens || 0) * t.entree + (u.output_tokens || 0) * t.sortie) / 1e6;
  return { pages: lu.pages.map(p => ({ n: +p.n, texte: String(p.texte || "") })), modele: MODELE, usage: u, cout };
}
