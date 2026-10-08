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
//   - les lignes de sommaire (titre suivi de pointillés) sont ignorées (1.1).
// Entrée : le texte de l'acte, ligne à ligne (lignes vides = séparations de paragraphes).
// Le fichier commence par « _ » : Vercel ne le compte pas comme une fonction.
// ============================================================
export const VERSION_DECOUPE = "1.3";

const PUCE = /^\s*(?:[•▪\uf0b7\uf0a7\uf0d8\uf0d7\uf076\uf0fc]|o\s|-\s|–\s)/u;
const TITRE = /^\s*(\d{1,2})((?:\.\d{1,2}){0,3})\.?\s{1,8}(\S.*)$/u;
const TERMINAL = /[.;:!?»”"]\s*$/u;
const PARASITE = /^\s*(\d{1,3}|\d{6,}|[A-Z]{2,4}\s*\/\s*[A-Z]{2,4}\s*\/?|[A-ZÉ' ]+(?:\s•\s[A-ZÉ' -]+){2,}|https?:\/\/\S+)\s*$/u;
const SOMMAIRE = /\.{5,}\s*\d*\s*$/u;   // ligne de sommaire (titre … pointillés … page) : ignorée
const LIAISON_FIN = /(\b(de|des|du|et|la|le|les|au|aux|à|en)|[,’'–-])\s*$/iu;
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

function estTitre(p) {
  const m = TITRE.exec(p); if (!m) return null;
  const reste = m[3];
  if (reste.length > 140 || /\b(EUR|euros)\b|€/u.test(reste)) return null;
  if (+m[1] > 45 || !majuscule(reste[0])) return null;
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
export function decouper(texte) {
  let lignes = String(texte || "").replace(/\r/g, "").split("\n");
  const debut = lignes.findIndex(l => /^\s*(A PARIS|A reçu|L'AN DEUX MILLE|L’AN DEUX MILLE|PAR-DEVANT|PAR DEVANT)/u.test(l));
  const fin = lignes.findIndex(l => /DONT ACTE/u.test(l));
  lignes = lignes.slice(debut >= 0 ? debut : 0, fin >= 0 ? fin + 1 : undefined);
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
