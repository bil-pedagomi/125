# Répartition automatique des groupes — Formation 125

Ce document décrit ce que fait le bouton **Générer / Regénérer** du panneau
Groupes (`src/components/GroupesPanel.jsx`, algorithme dans
`repartirGroupes()` — `src/utils.js`).

## Ce que l'algorithme produit

Une **proposition** de répartition, jamais une décision définitive : l'heure,
la capacité, le nombre de groupes, le rôle scooter/voiture et l'affectation de
chaque élève restent modifiables à la main et chaque modification est
sauvegardée. Une modification manuelle est marquée d'un crayon ✏️ et n'est
écrasée que par un **Regénérer** explicite.

Le nombre de groupes et leur effectif ne dépendent que de l'effectif total :
`nbGroupes = ceil(effectif / capacité)`, le groupe du matin absorbant le
reliquat (11 élèves à 6 par groupe → 5 le matin, 6 l'après-midi). Les critères
ci-dessous ne changent jamais ces effectifs : ils décident **qui** va dans
**quel** groupe, par échanges.

## Les critères, du plus fort au plus souple

Aucun n'est une obligation dure : ils sont pondérés, et l'écart entre les poids
garantit qu'un critère souple ne peut jamais « acheter » un critère fort.

| Priorité | Critère | Source (Typeform) | Poids |
|---|---|---|---|
| 1 | **Créneau demandé** — on ne contredit jamais un « je veux l'après-midi » | `creneau_prefere` | 500 |
| 2 | **Amis ensemble** — les élèves qui viennent à plusieurs restent groupés | `avec_un_proche`, `accompagnant_nom_complet` | 60 / ami retrouvé |
| 3 | **Temps de trajet** — plus on vient de loin, plus le matin est souhaitable | `temps_trajet` | 10 / palier, dégressif du matin vers le soir |
| 4 | **Scooters armables** — assez de pilotes par groupe pour ne pas laisser un PCX au garage | `niveau_scooter` | 20 / scooter non armable |
| 5 | **Équilibre des niveaux** — éviter un groupe 100 % débutants face à un groupe 100 % confirmés | `niveau_scooter` | 6 / point d'écart |

### Pourquoi « loin → le matin »

Un élève qui a 2 h de route et qui termine sa formation en fin d'après-midi
rentre trop tard. À préférence égale, les longs trajets passent donc devant pour
les places du matin. Le critère est **neutralisé** pour un élève qui a lui-même
demandé l'après-midi : on ne le contredit pas « pour son bien ».

Paliers reconnus (libellés Typeform) : `Moins de 30 min` (0), `30 min à 1h` (1),
`1h à 2h` (2), `Plus de 2h` (3), `autre département / +4h` (4). À partir du
palier 2 (≥ 1 h) l'élève est considéré comme « venant de loin » et l'interface
signale un placement l'après-midi. Un libellé inconnu est affiché tel quel mais
ne pèse pas dans le calcul.

### Comment les amis sont détectés

Le formulaire demande le nom du proche en **texte libre** : « Rachid LADIB »,
« Rachid LADIB et Muhammed ALTUNDAG », « Pol edouard pelé ». `buildAmisClusters()`
rapproche ces noms des inscrits de la session :

- accents, casse, ponctuation et tirets normalisés (`Jean-Chiraze` → `jean`, `chiraze`) ;
- plusieurs noms dans un même champ séparés par ` et `, `,`, `&`, `+`, `/`, `;` ;
- liens de parenté ignorés (« mon frère Adem » → `adem`) ;
- il faut **2 mots communs** (prénom + nom) pour lier deux personnes ; avec un
  seul mot, le lien n'est retenu que s'il ne désigne qu'une personne de la
  session. En cas d'ambiguïté, **rien n'est lié** — un faux rapprochement
  déplacerait un élève sans raison ;
- une déclaration **unilatérale suffit** : si A dit venir avec B, ils sont amis
  même si B n'a rien déclaré ;
- un proche cité mais absent de la session est signalé « (non inscrit) » et
  n'influence pas la répartition.

Une grappe d'amis est déplacée **en bloc**, sauf si :

- ses membres ont demandé des créneaux opposés (le créneau demandé passe
  devant l'amitié) ;
- elle est plus grande qu'un groupe (elle est alors éclatée).

## Comment la répartition est calculée

1. **Score « matin »** par élève : créneau demandé (×10) puis trajet (×2), le
   niveau ne servant que de départage.
2. **Unités indivisibles** : chaque grappe d'amis devient une unité unique.
3. **Remplissage** des groupes par score décroissant, unités entières d'abord.
4. **Amélioration locale** : on note la répartition entière avec les poids du
   tableau ci-dessus, puis on essaie tous les échanges entre deux groupes en
   gardant le meilleur, jusqu'à ne plus rien améliorer. C'est cette étape qui
   rattrape les impasses du remplissage glouton — par exemple une grappe de 3
   amis qui ne rentre plus dans le groupe du matin et s'y ferait doubler par des
   élèves moins prioritaires.

Les effectifs ne bougeant jamais (on échange, on ne déplace pas), le
dimensionnement matin/après-midi reste celui décrit plus haut.

## Ce que l'interface affiche

Sous chaque élève du panneau Groupes :

- pastille de créneau et badge `Matin` / `Après-midi` / `Indifférent`
  (⚠️ si le groupe ne correspond pas à la demande) ;
- badge `📍 <trajet>` (⚠️ si ≥ 1 h de trajet et placé l'après-midi sans
  l'avoir demandé) ;
- badge `👥 <ami>` et pastille colorée de la grappe (⚠️ si un ami est dans un
  autre groupe), ou `👥 <nom> (non inscrit)` ;
- badge `⚠️ niveau non vérifié` si un scooter a été forcé à la main.

Le récapitulatif au-dessus des groupes résume les trois critères souples :
préférences respectées, trajets longs placés le matin, grappes d'amis réunies.

La vue **Liste** de la session affiche une colonne `Trajet / Amis`, et la fiche
élève détaille `Temps de trajet`, `Accompagnement` et `Vient avec`.

## Dépendance côté données

Les trois champs viennent de la vue `v_125_formulaires` et sont exposés par
l'edge function `dashboard-125` : `temps_trajet`, `avec_un_proche`,
`accompagnant_nom_complet`. Toute modification de ces champs côté Typeform doit
être répercutée dans `TRAJET_NIVEAUX` (`src/utils.js`) pour les paliers de
trajet.
