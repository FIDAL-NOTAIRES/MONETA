// ============================================================
// MONETA — moteur de DÉCOUPE (règles fixes, sans intelligence artificielle)
// Transposition des règles validées par JFD le 08/10/2026 sur la simulation
// R3S (promesse unilatérale du 28/09/2026 : 40 articles, 347 points).
//   - un titre numéroté (1., 1.1., 1.1.1.…) ouvre un article ou une rubrique ;
//   - un POINT = un paragraphe, sauf :
//       · une liste reste avec la phrase qui l'annonce (« : »),
//       · une citation de texte reste entière avec son introduction,
//       · un paragraphe ouvert par un mot de liaison (Toutefois, Cette…) reste avec le précédent,
//       · un intertitre (ligne courte sans ponctuation) reste avec ce qu'il annonce,
//       · une mention d'annexe reste avec son point ;
//   - une définition = un point ;
//   - un « ou » isolé entre deux options les réunit dans le même point ;
//   - les lignes de sommaire (titre suivi de pointillés) sont ignorées (1.1) ;
//   - acte sans numérotation : titres déduits de la mise en forme transmise par la page (1.4).
// Entrée : le texte de l'acte, ligne à ligne (lignes vides = séparations de paragraphes).
// Le fichier commence par « _ » : Vercel ne le compte pas comme une fonction.
// ============================================================
export const VERSION_DECOUPE = "1.5";

const PUCE = /^\s*(?:[•▪\uf0b7\uf0a7\uf0d8\uf0d7\uf076\uf0fc]|o\s|-\s|–\s)/u;
const TITRE = /^\s*(\d{1,2})((?:\.\d{1,2}){0,3})\.?\s{1,8}(\S.*)$/u;
const TERMINAL = /[.;:!?»”"]\s*$/u;
const PARASITE = /^\s*(\d{1,3}|\d{6,}|[A-Z]{2,4}\s*\/\s*[A-Z]{2,4}\s*\/?|[A-ZÉ' ]+(?:\s•\s[A-ZÉ' -]+){2,}|https?:\/\/\S+)\s*$/u;
const SOMMAIRE = /\.{5,}\s*\d*\s*$/u;   // ligne de sommaire (titre … pointillés … page) : ignorée
const LIAISON_FIN = /(\b(de|des|du|et|la|le|les|au|aux|à|en)|[,’'–-])\s*$/iu;
const LIAISON_DEBUT = /^(de|des|du|et|à|a|au|aux|en|la|le|les|sur|pour|d’|d'|l’|l')\b/iu;
const MAJ = /^\p{Lu}/u, MIN = /^\p{Ll}/u;
const LIENS = ["Toutefois","En conséquence","Par suite","Il en résulte","En outre","Cette ","Ce ","Ces ","Celle","Celui",
  "Ladite","Ledit","Lesdit","Dans ce cas","Dans cette hypothèse","A cet effet","À cet effet","A défaut","À défaut",
  "Etant","Étant","Il est précisé","Il est ici précisé","De même","Pour ce faire","Lequel","Laquelle","Lesquel",
  "En tant que de besoin","Sauf ","Si cette","Ceci","Cela","Néanmoins","Sous réserve","Au surplus"];

const net = t => t.trim();
const majuscule = c => MAJ.test(c);

// 1) Reconstitution des paragraphes à partir des lignes
function paragraphes(lignes) {
  const paras = []; let cur = [], vide = false;
  const pousser = () => { if (cur.length) { const t = cur.map(net).join(" ").replace(/\s+/g, " ").trim(); if (t) paras.push(t); } cur = []; };
  const titreLigne = l => {
    const m = TITRE.exec(l); if (!m || !majuscule(m[3][0])) return false;
    return !cur.length || vide || TERMINAL.test(cur.at(-1)) || (TITRE.test(cur[0]) && cur.length === 1) || net(cur.at(-1)).length < 80;
  };
  for (let l of lignes) {
    if (/^\f/.test(l) && !net(l.replace(/\f/g, ""))) continue;          // saut de page : ni ligne ni séparation
    l = l.replace(/\f/g, "");
    if (PARASITE.test(l) || SOMMAIRE.test(l)) continue;
    if (!net(l)) { if (cur.length && TERMINAL.test(cur.at(-1))) pousser(); vide = true; continue; }
    const s = net(l);
    if (cur.length === 1 && TITRE.test(cur[0]) && !TERMINAL.test(cur[0]) && !TITRE.test(l) &&
        (MIN.test(s[0]) || (s[0] === "(" && s.length < 60) || LIAISON_FIN.test(net(cur[0])) ||
         (net(cur[0]).toUpperCase() === net(cur[0]) && s.toUpperCase() === s))) { cur.push(l); pousser(); vide = false; continue; }
    const seul = cur.length === 1 && net(cur[0]).length < 80 && !TERMINAL.test(cur[0]) && majuscule(s[0]) && !PUCE.test(cur[0]);
    const apresTitre = cur.length === 1 && TITRE.test(cur[0]) && net(cur[0]).length < 150 && (majuscule(s[0]) || "(«\"".includes(s[0]));
    const nouveau = apresTitre || !cur.length || PUCE.test(l) || titreLigne(l) ||
                    (TERMINAL.test(cur.at(-1)) && (majuscule(s[0]) || "«\"(“".includes(s[0]))) || seul;
    if (nouveau) pousser();
    cur.push(l); vide = false;
  }
  pousser();
  return paras;
}

let ARTICLE_MAX = 45;   // relevé à 300 quand les titres sont déduits de la mise en forme
function estTitre(p) {
  const m = TITRE.exec(p); if (!m) return null;
  const reste = m[3];
  if (reste.length > 140 || /\b(EUR|euros)\b|€/u.test(reste)) return null;
  if (+m[1] > ARTICLE_MAX || !majuscule(reste[0])) return null;
  return { num: m[1] + (m[2] || ""), reste };
}
const intertitre = p => p.length < 90 && !TERMINAL.test(p) && majuscule(p[0]) && !PUCE.test(p) && !p.startsWith("Annexe");
function bilanCitation(p, ouvert) {
  const n = (p.match(/[«“]/gu) || []).length - (p.match(/[»”]/gu) || []).length;
  if (n > 0) ouvert = true; else if (n < 0) ouvert = false;
  if ((p.match(/"/g) || []).length % 2) ouvert = !ouvert;
  return ouvert;
}
const COUPE_TITRE = /^((?:[A-ZÉÈÀÂÎÔÛÇ0-9'’ ,\-–()/«».]|d’|l’|de |du |des |et |au |aux |à |en |la |le |les )+?)\s+((?:Le |La |Les |Il |Un |Une |Aux |Par |A |À |Cette |Conformément|Dans |En |L’|Sur |Pour |Suivant |Monsieur |Madame |- La |La Société).*)$/u;

// 2) Titres et points
// La page peut préfixer une ligne d'une marque de mise en forme : ⟦G⟧ gras, ⟦C⟧ centré, ⟦GC⟧ les deux.
const MARQUE = /^⟦([GC]+)⟧/u;
// 1.5 (09/10/2026) — la PARTIE FINALE (DONT ACTE, lecture, signatures) est VERSÉE au clausier comme
// les autres clauses (JFD) : la découpe ne s'arrête plus à « DONT ACTE » ; un titre « Clôture et
// signature » est posé devant, numéroté à la suite du dernier article, pour la ranger à part.
const DONT_ACTE = /^\s*(?:⟦[GC]+⟧)?\s*DONT\s+ACTE\b/u;
const TITRE_CLOTURE = "Clôture et signature";
const debutFin = lignes => {
  const debut = lignes.findIndex(l => /^\s*(A PARIS|À PARIS|A reçu|L'AN DEUX MILLE|L’AN DEUX MILLE|PAR-DEVANT|PAR DEVANT)/u.test(l));
  return [debut >= 0 ? debut : 0, lignes.length];
};
function poserCloture(lignes, max = ARTICLE_MAX) {
  let i = -1; for (let k = lignes.length - 1; k >= 0; k--) if (DONT_ACTE.test(lignes[k])) { i = k; break; }
  if (i < 0) return lignes;
  let dernier = 0;
  for (const l of lignes.slice(0, i)) { const m = TITRE.exec(l); if (m && !m[2] && +m[1] <= max && +m[1] > dernier && majuscule(m[3][0])) dernier = +m[1]; }
  if (!dernier) return lignes;
  return [...lignes.slice(0, i), "", `${dernier + 1}. ${TITRE_CLOTURE}`, "", ...lignes.slice(i)];
}

// ============================================================
// NETTOYAGE AVANT DÉCOUPE (1.5, 09/10/2026 — arbitrage JFD) : on retire les mentions propres
// aux PDF signés électroniquement, pour qu'aucune ne se colle au début ou à la fin d'une clause :
//  (1) lignes courtes RÉPÉTÉES en haut ou en bas de la plupart des pages (identifiant d'acte,
//      bandeau de certification, numéro de page), chiffres neutralisés pour les reconnaître ;
//  (2) mentions connues des plateformes de signature et numéros de page ;
//  (3) CARTOUCHES de signature (« M. X … a signé / à LILLE / le 22 septembre 2017 »).
// Le texte des clauses n'est jamais touché : seules des lignes courtes et isolées sont retirées.
// ============================================================
const MENTION_TECHNIQUE = [
  /^DocuSign Envelope ID\b/iu, /^(?:document|acte|copie)?\s*sign[ée]{1,2}s?\s+(?:électroniquement|numériquement)\b.{0,80}$/iu,
  /^(?:copie\s+)?(?:authentique\s+)?certifi[ée]{1,2}\s+conforme\b.{0,60}$/iu, /^copie\s+authentique\b.{0,60}$/iu,
  /^(?:page\s*)?\d{1,3}\s*(?:\/|sur)\s*\d{1,3}$/iu, /^r[ée]f(?:[ée]rence)?\s*:\s*\S{1,30}$/iu,
  /^(?:identifiant|n°\s*d['’]acte|num[ée]ro\s+d['’]acte)\s*:?\s*\S{1,40}$/iu, /^paraphes?\b.{0,40}$/iu,
  /^acte\s+authentique\s+(?:sur\s+support\s+)?électronique$/iu,
];
const A_SIGNE = /\ba\s+sign[ée]\s*$/iu;
const SUITE_CARTOUCHE = /^(?:à|a)\s+\S.{0,40}$|^le\s+\d{1,2}(?:er)?\s+\p{L}+\s+\d{4}$|^L['’]AN\s+[A-ZÉÈ -]+$|^LE\s+[A-ZÉÈ -]+$/u;
export function nettoyer(texte) {
  const pages = String(texte || "").split("\f");
  const sans = l => l.replace(MARQUE, "").trim();
  const forme = l => sans(l).toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ");
  // (1) repérage des lignes répétées aux bords des pages
  const compte = new Map();
  if (pages.length >= 3) for (const pg of pages) {
    const ls = pg.split("\n").filter(l => sans(l));
    const bords = new Set([...ls.slice(0, 3), ...ls.slice(-4)].map(forme).filter(f => f.length >= 2 && f.length <= 140));
    for (const f of bords) compte.set(f, (compte.get(f) || 0) + 1);
  }
  const seuil = Math.max(3, Math.ceil(pages.length * 0.4));
  const repetees = new Set([...compte].filter(([, n]) => n >= seuil).map(([f]) => f));
  const retirees = [];
  const sortie = pages.map(pg => {
    const ls = pg.split("\n"), garde = ls.map(() => true);
    ls.forEach((l, i) => {
      const t = sans(l); if (!t) return;
      if (TITRE.test(t) && t.length > 6) return;                       // un titre d'article n'est jamais retiré
      if (repetees.has(forme(l)) || (t.length <= 140 && MENTION_TECHNIQUE.some(r => r.test(t)))) { garde[i] = false; retirees.push(t); }
    });
    // (3) cartouches : « … a signé » en ligne courte, avec les lignes courtes non ponctuées qui le précèdent
    //     (nom, qualité, société) et les lignes de lieu et de date qui le suivent
    ls.forEach((l, i) => {
      const t = sans(l); if (!(t.length <= 90 && A_SIGNE.test(t))) return;
      let a = i; while (a - 1 >= 0 && i - a < 6) { const u = sans(ls[a - 1]); if (!u || u.length > 60 || /[.;:]$/.test(u)) break; a--; }
      let b = i; while (b + 1 < ls.length && b - i < 4) { const u = sans(ls[b + 1]); if (!u || !SUITE_CARTOUCHE.test(u)) break; b++; }
      for (let k = a; k <= b; k++) if (garde[k]) { garde[k] = false; retirees.push(sans(ls[k])); }
    });
    return ls.filter((_, i) => garde[i]).join("\n");
  });
  const exemples = [...new Set(retirees)].slice(0, 8);
  return { texte: sortie.join("\f"), nettoyage: { lignes: retirees.length, exemples } };
}
export function decouper(texteBrut) {
  const { texte, nettoyage } = nettoyer(String(texteBrut || "").replace(/\r/g, ""));
  const r0 = decouperNet(texte);
  r0.nettoyage = nettoyage;
  return r0;
}
function decouperNet(texte) {
  const brutes = String(texte || "").replace(/\r/g, "").split("\n");
  const marques = brutes.map(l => (MARQUE.exec(l) || [])[1] || "");
  const nettes = brutes.map(l => l.replace(MARQUE, ""));
  const [d, f] = debutFin(nettes);
  ARTICLE_MAX = 45;
  const r = decouperLignes(poserCloture(nettes.slice(d, f)));
  const numerotes = r.structure.filter(e => e.t === "titre").length;
  if (numerotes >= 3 || !marques.some(m => m.includes("G"))) return r;
  // ---- ACTE SANS NUMÉROTATION : titres déduits de la mise en forme (08/10/2026) ----
  // gras + majuscules + ligne courte = titre d'article ; une suite de titres sans texte
  // entre eux (plan annoncé, sommaire) est écartée ; un titre sur deux lignes est réuni.
  const zone = nettes.slice(d, f), zm = marques.slice(d, f);
  const lettresDe = t => (t.match(/\p{L}/gu) || []).length;
  const candidat = i => {
    const t = net(zone[i]);
    return zm[i].includes("G") && t.length >= 3 && t.length < 110 && lettresDe(t) >= 3 &&
           t.toUpperCase() === t && !/[.,;]$/.test(t) && !/^\d+([ ,.]\d+)*$/.test(t);
  };
  const est = zone.map((_, i) => candidat(i));
  // titre sur deux lignes : deux candidats qui se suivent, le premier sans ponctuation de fin et se terminant par un mot de liaison
  const titres = []; // { debut, fin, texte }
  for (let i = 0; i < zone.length; i++) {
    if (!est[i]) continue;
    let j = i, t = net(zone[i]);
    // suite d'un titre sur deux lignes : ligne suivante, sans ligne vide, et liaison évidente ou première ligne longue
    while (j + 1 < zone.length && est[j + 1] &&
           (LIAISON_FIN.test(t) || LIAISON_DEBUT.test(net(zone[j + 1])) || t.length > 55)) { j++; t += " " + net(zone[j]); }
    titres.push({ debut: i, fin: j, texte: t }); i = j;
  }
  // sommaire : trois titres ou plus d'affilée sans aucun texte entre eux, et pour la plupart NON centrés
  // (les vrais titres de ces trames sont centrés ; le plan annoncé en tête d'acte ne l'est pas)
  const texteEntre = (a, b) => zone.slice(a + 1, b).some(l => net(l) && !MARQUE.test(l));
  const garder = titres.map(() => true);
  for (let k = 0; k < titres.length; ) {
    let m = k; while (m + 1 < titres.length && !texteEntre(titres[m].fin, titres[m + 1].debut)) m++;
    const centres = titres.slice(k, m + 1).filter(T => zm[T.debut].includes("C")).length;
    // dans un sommaire, seules les lignes non centrées sont écartées : le vrai titre centré qui le suit reste
    if (m - k >= 2 && centres * 2 < (m - k + 1)) for (let q = k; q <= m; q++) if (!zm[titres[q].debut].includes("C")) garder[q] = false;
    k = m + 1;
  }
  const lignes2 = []; let n = 0, ti = 0;
  for (let i = 0; i < zone.length; i++) {
    const T = titres[ti];
    if (T && i === T.debut) {
      if (garder[ti]) { n++; lignes2.push("", `${n}. ${T.texte}`, ""); }
      i = T.fin; ti++; continue;
    }
    // une ligne de texte qui ressemble à un titre numéroté (« 56 RUE DE LILLE… ») ne doit pas en devenir un :
    // un espace sans chasse placé devant la neutralise, il est retiré ensuite
    lignes2.push(TITRE.test(zone[i]) ? "\u200b" + zone[i] : zone[i]);
  }
  ARTICLE_MAX = 300;
  const r2 = decouperLignes(poserCloture(lignes2, 300));
  ARTICLE_MAX = 45;
  for (const e of r2.structure) if (e.t === "point") e.paras = e.paras.map(x => x.replace(/\u200b/g, ""));
  if (r2.articles < 3) return r;
  r2.titres_deduits = true;
  r2.controles.unshift({ niveau: "jaune", code: "titres-deduits",
    message: `Acte sans numérotation : ${r2.articles} titres déduits de la mise en forme (gras, majuscules). La hiérarchie entre parties et articles n'est pas connue : tous sont traités comme des articles.` });
  r2.controles = r2.controles.filter(c => c.code !== "sans-titres");
  r2.etat = r2.controles.some(c => c.niveau === "carmin") ? "carmin" : "jaune";
  return r2;
}

function decouperLignes(lignes) {
  const paras = paragraphes(lignes);
  const structure = []; const compteur = {};
  let courant = null, rubrique = "0", attache = false, citation = false;
  const nouveauPoint = () => {
    compteur[rubrique] = (compteur[rubrique] || 0) + 1;
    courant = { t: "point", num: `${rubrique}.${compteur[rubrique]}`, rubrique, paras: [] };
    structure.push(courant);
  };
  for (const p of paras) {
    const r = estTitre(p);
    if (r) {
      const m = COUPE_TITRE.exec(r.reste);
      const coupe = m && r.reste.length > 60 && /[a-zéèàç]{3}/u.test(m[2].slice(0, 40));
      const titre = coupe ? m[1].trim() : r.reste, corps = coupe ? m[2] : null;
      structure.push({ t: "titre", num: r.num, texte: titre, niveau: r.num.split(".").length });
      rubrique = r.num; courant = null; attache = false; citation = false;
      if (corps) { nouveauPoint(); courant.paras.push(corps); attache = corps.trimEnd().endsWith(":"); }
      continue;
    }
    if (!courant || !courant.paras.length) {
      if (!courant) nouveauPoint();
      courant.paras.push(p); attache = p.trimEnd().endsWith(":") || intertitre(p); citation = bilanCitation(p, citation); continue;
    }
    const puce = PUCE.test(p);
    const cite = "«\"“".includes(p[0]) || courant.paras.at(-1).trimEnd().endsWith("«");
    const lien = LIENS.some(x => p.startsWith(x));
    const charniere = /^(ou|et|OU|ET|Ou|Et)$/u.test(p) || p.length <= 3;   // « ou » entre deux options : un seul point
    if (attache || puce || cite || lien || charniere || p.startsWith("Annexe") || citation) courant.paras.push(p);
    else { nouveauPoint(); courant.paras.push(p); }
    attache = p.trimEnd().endsWith(":") || intertitre(p) || charniere;
    citation = bilanCitation(p, citation);
  }
  const titres = structure.filter(e => e.t === "titre");
  const resultat = {
    version: VERSION_DECOUPE,
    articles: titres.filter(e => e.niveau === 1).length,
    rubriques: titres.filter(e => e.niveau > 1).length,
    points: structure.filter(e => e.t === "point").length,
    structure,
  };
  resultat.controles = controler(resultat, lignes);
  resultat.etat = resultat.controles.some(c => c.niveau === "carmin") ? "carmin" : resultat.controles.length ? "jaune" : "vert";
  return resultat;
}

// ============================================================
// CONTRÔLES DE VRAISEMBLANCE (08/10/2026) — une découpe douteuse n'est jamais silencieuse
//   carmin : découpe impossible (texte absent ou quasi absent : acte scanné en image) ;
//   jaune  : à vérifier (aucun titre, trou de numérotation, point très long, texte perdu) ;
//   vert   : aucune anomalie détectée.
// ============================================================
export const SEUIL_POINT_LONG = 2500;   // caractères
function controler(r, lignes) {
  const c = [];
  const lettres = t => (t.match(/\p{L}/gu) || []).length;
  const source = lignes.filter(l => !PARASITE.test(l.replace(/\f/g, "")) && !SOMMAIRE.test(l)).join(" ");
  const nSource = lettres(source);
  if (nSource < 400) {
    c.push({ niveau: "carmin", code: "texte-absent", message: "Aucun texte lisible : l'acte est sans doute scanné en image. Il faut d'abord le passer par une reconnaissance de caractères." });
    return c;
  }
  const titres = r.structure.filter(e => e.t === "titre");
  if (titres.length < 3) c.push({ niveau: "jaune", code: "sans-titres", message: `Presque aucun titre reconnu (${titres.length}) : la structure de l'acte n'a pas été retrouvée, les points ne sont rattachés à aucune rubrique.` });
  // trous de numérotation : 15.1 puis 15.3, ou article 7 puis 9
  const vus = new Map();
  for (const t of titres) {
    const parts = t.num.split(".").map(Number), parent = parts.slice(0, -1).join("."), n = parts.at(-1);
    const prec = vus.get(parent);
    if (prec !== undefined && n > prec + 1) c.push({ niveau: "jaune", code: "trou", titre: t.num,
      message: `Trou de numérotation avant ${t.num} (après ${parent ? parent + "." : ""}${prec}) : un titre n'a peut-être pas été reconnu.` });
    if (prec === undefined || n > prec) vus.set(parent, n);
  }
  for (const p of r.structure.filter(e => e.t === "point")) {
    const tout = p.paras.join(" "), long = tout.length;
    // une citation de texte (de loi, d'un rapport) est longue par nature : pas d'alerte si elle fait l'essentiel du point
    const cite = (tout.match(/[«“"][^«»“”"]{40,}[»”"]/gu) || []).reduce((a, x) => a + x.length, 0);
    if (long > SEUIL_POINT_LONG && cite / long < 0.5) c.push({ niveau: "jaune", code: "point-long", point: p.num, message: `Point ${p.num} très long (${long.toLocaleString("fr-FR")} caractères) : peut-être à couper.` });
  }
  const nDecoupe = lettres(r.structure.map(e => e.t === "titre" ? e.num + " " + e.texte : e.paras.join(" ")).join(" "));
  const perte = (nSource - nDecoupe) / nSource;
  if (perte > 0.01) c.push({ niveau: "jaune", code: "perte", message: `Environ ${Math.round(perte * 100)} % du texte lu ne se retrouve pas dans la découpe.` });
  return c;
}
