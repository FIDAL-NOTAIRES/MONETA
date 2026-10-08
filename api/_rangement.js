// ============================================================
// MONETA — moteur de RANGEMENT (règles fixes, sans intelligence artificielle)
// Arbitrages de JFD du 08/10/2026 :
//   - le moteur PROPOSE une rubrique pour chaque point, l'humain VALIDE ou change ;
//   - le CONTENU l'emporte sur la position : le juge, ce sont les MOTS-CLÉS de la
//     rubrique retrouvés dans le texte du point ; la place du point dans l'acte
//     (titre sous lequel il se trouve) n'est qu'un indice FAIBLE ;
//   - trois origines de mots-clés : titre de la rubrique (amorce), tirés des
//     clauses validées (automatiques), saisis à la main ; le mot saisi à la main
//     pèse le plus, le mot automatique le moins ;
//   - on affiche la MEILLEURE rubrique et la DEUXIÈME candidate, avec les mots
//     qui ont déclenché la proposition ;
//   - l'étiquette « contexte » est proposée à partir de l'acte source.
// 1.1 (08/10/2026) : singulier et pluriel rapprochés (« prêt » / « prêts ») ;
//   une rubrique au titre générique (« Principe et textes ») emprunte, à poids
//   faible, les mots du titre de son article, sans quoi elle restait introuvable.
// 1.2 (08/10/2026) : un point de la forme « Terme : désigne… » est une définition
//   (règle de CONTENU) et va à la rubrique « Définitions » du plan.
// 1.3 (08/10/2026) : contextes — on écarte d'abord les tournures qui citent un mot
//   sans le viser (« Code de la construction et de l'habitation », « pas à usage
//   d'habitation », « hors copropriété »).
// 1.4 (08/10/2026) : le contexte se lit là où le BIEN EST DÉCRIT (points placés sous
//   un titre de désignation, d'identification du bien, d'usage, d'objet, de nature ou d'accès) ; l'acte entier
//   n'est lu qu'à défaut, et un contexte n'y est retenu qu'à partir de 3 mentions —
//   les mentions légales types (diagnostics, loi de 1989…) faussaient la lecture.
// Le fichier commence par « _ » : Vercel ne le compte pas comme une fonction.
// ============================================================
export const VERSION_RANGEMENT = "1.4";

const VIDES = new Set(["les","des","une","aux","par","pour","sur","dans","avec","sans","que","qui","est","sont","sera","seront",
  "son","ses","leur","leurs","cette","ces","tout","tous","toute","toutes","elle","il","ils","elles","lui","aux","du","de","la","le",
  "et","ou","en","au","un","ne","pas","plus","ainsi","dont","comme","entre","apres","avant","meme","autre","autres","fait","etre",
  "avoir","present","presentes","partie","parties","article","articles","non","oui","bien","biens"]);
const PRESQUE_VIDES = new Set(["principe","textes","rappel","generales","general","generaux","divers","diverses"]);

export const normaliser = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, " ").replace(/œ/g, "oe").replace(/\s+/g, " ");
// racine grossière : les mots longs sont comparés sur leurs six premières lettres
// (« hypothécaire » et « hypothèque » se rejoignent sur « hypoth »)
const sansPluriel = m => (m.length >= 4 && /[sx]$/.test(m) && !/ss$/.test(m)) ? m.slice(0, -1) : m;
const racine = m => { const b = sansPluriel(m); return b.length >= 7 ? b.slice(0, 6) : b; };
const mots = t => normaliser(t).split(/[^a-z0-9]+/).filter(m => m.length >= 3 && !VIDES.has(m));
const racines = t => new Set(mots(t).map(racine));
// racines d'un TITRE, mots presque vides écartés AVANT troncature
const racinesUtiles = t => new Set(mots(t).filter(m => !PRESQUE_VIDES.has(m)).map(racine));

const POIDS = { main: 3, titre: 2, auto: 1 };

function noter(point, rub, R) {
  const texteN = point._n, jeu = point._r;
  let gagne = 0, total = 0; const declencheurs = [];
  for (const k of rub.mots_cles || []) {
    const p = POIDS[k.origine] ?? 1, kn = normaliser(k.mot).trim();
    if (!kn) continue;
    const vide = PRESQUE_VIDES.has(kn);
    total += vide ? p / 3 : p;
    const touche = kn.includes(" ") ? texteN.includes(kn) : jeu.has(racine(kn));
    if (touche) { gagne += vide ? p / 3 : p; declencheurs.push(k.mot); }
  }
  // rubrique au titre générique : mots du titre de son article, au poids le plus faible
  for (const [r, mot] of rub._generique || []) {
    total += 1;
    if (jeu.has(r)) { gagne += 1; declencheurs.push(mot); }
  }
  // contenu : part des mots-clés retrouvés, plus le nombre absolu de mots retrouvés
  let score = total ? (gagne / Math.sqrt(total)) : 0;
  // mots du titre de l'ARTICLE de la rubrique retrouvés dans le texte : petit appoint
  const motsArt = R.articles.get(rub.article) || [];
  const artTouches = motsArt.filter(r => jeu.has(r)).length;
  score += Math.min(0.6, artTouches * 0.2);
  // position (indice faible) : le titre sous lequel le point se trouve dans l'acte
  if (point._t.size) {
    const tRub = rub._t, tArt = new Set(motsArt);
    const commun = s => [...s].filter(r => point._t.has(r)).length;
    if (tRub.size) score += 0.8 * commun(tRub) / tRub.size;
    else if (rub._tGen?.size) score += 0.4 * commun(rub._tGen) / rub._tGen.size;
    if (tArt.size) score += 0.4 * commun(tArt) / tArt.size;
  }
  // définition : « Terme : désigne… » — signal de contenu fort vers la rubrique « Définitions »
  if (point._def && rub._def) { score += 3; declencheurs.push("désigne (définition)"); }
  return { id: rub.id, score: Math.round(score * 100) / 100, mots: declencheurs };
}

const CONTEXTES = [
  ["habitation", /\b(habitation|logement|residence principale|loi du 6 juillet 1989|appartement|maison individuelle)\b/],
  ["bien professionnel ou industriel", /\b(industriel|entrepot|local d.activite|locaux d.activite|bureaux|atelier|usage professionnel|stockage)\b/],
  ["copropriété", /\b(copropriete|syndicat des coproprietaires|reglement de copropriete|lots? de copropriete)\b/],
  ["lotissement", /\blotissement\b/],
  ["cession d'activité", /\b(cession d.activite|asset purchase agreement|universalite (totale|partielle)? ?de biens|fonds de commerce)\b/],
  ["terrain", /\b(terrain a batir|terrain nu|parcelle de terrain)\b/],
  ["entre sociétés", /\b(societe civile immobiliere|societe par actions simplifiee|societe anonyme|sarl|sas)\b/],
];

// points : [{ num, texte, titres: [titre de l'article, titre de la sous-partie…] }]
// rubriques : [{ id, titre, article, article_titre, mots_cles: [{ mot, origine }] }]
export function ranger({ points, rubriques, texte_acte }) {
  const R = { articles: new Map() };
  for (const r of rubriques) {
    if (!R.articles.has(r.article)) R.articles.set(r.article, [...racinesUtiles(r.article_titre || "")]);
    r._t = racinesUtiles(r.titre);
    r._generique = null;
    r._def = /^definitions?$/.test(normaliser(r.titre).trim());
    if (!r._t.size) {
      const vus = new Set();
      r._generique = mots(r.article_titre || "").filter(m => !PRESQUE_VIDES.has(m)).map(m => [racine(m), m]).filter(([x]) => !vus.has(x) && vus.add(x));
      r._tGen = new Set(r._generique.map(([x]) => x));   // indice de position emprunté à l'article, à mi-poids
    }
  }
  const propositions = points.map(p => {
    p._def = /^\s*[^:\n]{1,90}:\s*(designe|designent|s.entend|s.entendent)\b/.test(normaliser(p.texte).replace(/^definitions?\s+/, ""));
    p._n = " " + normaliser(p.texte) + " "; p._r = racines(p.texte); p._t = racines((p.titres || []).join(" "));
    const notes = rubriques.map(r => noter(p, r, R)).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
    return { num: p.num, candidats: notes.slice(0, 2) };
  });
  const nettoyer = t => (" " + normaliser(t) + " ")
    .replace(/code de la construction et de l habitation/g, " ")
    .replace(/\b(ne (sont|soit|est|serait) pas|n est pas|ni|non|hors|autre qu|autres qu)\s+(a usage d |a l usage d |affecte a l |affectes a l |d |de |en |a l |a )?(habitation|logement|copropriete)\b/g, " ")
    .replace(/\b(audit energetique|dpe) hors copropriete\b/g, " ");
  const ZONE = /\b(designation|identification du bien|identification des biens|biens? vendus?|usage du bien|usage des biens|objet|nature des biens|nature du bien|acces au bien|consistance)\b/;
  const decrits = points.filter(p => ZONE.test(normaliser((p.titres || []).join(" ")))).map(p => p.texte).join(" ");
  let contextes;
  if (decrits.length > 200) {
    const z = nettoyer(decrits);
    contextes = CONTEXTES.filter(([, re]) => re.test(z)).map(([nom]) => nom);
  } else {
    const a = nettoyer(texte_acte || points.map(p => p.texte).join(" "));
    contextes = CONTEXTES.filter(([, re]) => (a.match(new RegExp(re.source, "g")) || []).length >= 3).map(([nom]) => nom);
  }
  return { version: VERSION_RANGEMENT, propositions, contextes };
}
