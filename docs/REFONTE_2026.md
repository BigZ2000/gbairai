# Gbairai — refonte produit, UX/UI, positionnement et création de quiz par IA

*Novembre 2026. Branche `feat/refonte-ia-quiz`. Ce document dit ce qui a été analysé, décidé, livré et ce qui reste à faire. Le détail technique de l'IA est dans [GENERATION_IA.md](GENERATION_IA.md).*

Chaque affirmation de la partie marché est étiquetée : **[Fait]** (source primaire citée), **[Observation]** (source secondaire ou déclarative), **[Hypothèse]** (non vérifiée), **[Recommandation]**.

---

## 1. Ce qui change, en une page

| Avant | Après |
|---|---|
| Interface sombre indigo, proche d'un outil de gestion | Identité « soleil & cacao » : crème, orange, vert, jaune ; thème sombre cacao en option |
| Accueil : 6 rangées de packs qui se répètent, 3 filtres, bandeau de quota en tête | Accueil en 3 gestes : **rejoindre** (un code), **créer** (une phrase), **choisir** un pack |
| Lancer un pack : 2 interrupteurs + 4 modes au vocabulaire technique | « Jouer seul » ou « Jouer à plusieurs » ; à plusieurs, une seule question : où sont les joueurs ? |
| Seul l'administrateur peut créer des questions | Chaque compte a « Mes quiz » : écrits à la main ou générés par IA, puis relus |
| Aucune IA | Création par IA (Claude) avec quotas par offre, contrôle serveur et journal des coûts |
| Un plan payé n'expirait jamais | L'échéance (`planExpireAt`) est appliquée partout |
| Les codes de vérification revenaient dans la réponse de connexion | Retirés (ils permettaient de valider son email sans l'avoir reçu) |

**Deuxième livraison (même jour)**

| Avant | Après |
|---|---|
| N'importe quel joueur pouvait, depuis la console du navigateur, valider sa propre réponse, passer la question ou terminer la partie | Commandes de régie réservées à l'hôte ; réponse, vote et buzz liés au compte du joueur ; buzz matériel lié à la connexion du buzzer |
| En production sans CinetPay, le règlement « simulé » et le webhook acceptaient tout : Premium gratuit pour qui le demandait | Paiement fermé tant que CinetPay n'est pas configuré ; offre activée seulement sur statut vérifié auprès de CinetPay |
| Chacun pour soi uniquement | Jeu par équipes (2 à 4 au lancement, jusqu'à 6), score d'équipe partout |
| Fiche de partie : classement et déroulé | Bilan d'événement imprimable (taux de réussite, question piège, plus rapide, équipes) |
| Le drapeau `branding` existait sans effet | Logo de l'organisation sur l'écran public, la salle d'attente et le bilan |
| Médias réservés à l'administration | Images personnelles pour les comptes Premium, privées et hors médiathèque |
| Salle d'attente : QR sous la liste | Invitation en premier, colonnes par équipe ; l'écran public sert de salle d'accueil (QR géant) |
| Régie inutilisable sur téléphone (débordement) ; animateur listé parmi les joueurs | Régie adaptable ; animateur hors liste |
| Le joueur ne voyait pas son rang final (mauvais identifiant) | Rang, équipe gagnante et lien vers le bilan |
| Aucun test frontend, CI sans tests d'intégration | 21 tests de composants, 30 tests d'intégration et un parcours WebSocket réel ; la CI lance les trois premiers |

**Non fait, dit clairement :**
- La génération par IA n'a **pas été exécutée contre l'API réelle** (reportée à une session dédiée).
- CinetPay n'a **pas été appelé pour de vrai** : l'intégration suit le SDK officiel `cinetpay-js` (la documentation web était injoignable) et est testée contre un CinetPay simulé. À faire : compte marchand, clés `sk_test_`, un paiement de bout en bout dans le bac à sable.
- Les buzzers ont été rejoués avec le **protocole simulé** (même messages que le firmware), pas avec un boîtier ESP32 physique.
- La mise en page d'impression du bilan n'a pas été contrôlée visuellement (l'outil de test n'imprime pas).
- L'étiquetage de la médiathèque reste à faire sur vos vraies données : c'est du contenu, pas du code.

---

## 2. Inventaire de l'existant

**Architecture.** Backend Node (ESM) + Express + Prisma/PostgreSQL + WebSocket ; frontend React 18 + Vite + Tailwind ; firmware ESP32. Environ 20 000 lignes. Moteur de jeu temps réel dans `server/src/ws/gameHandler.js`.

**Ce qui était déjà solide et a été réutilisé tel quel**
- Moteur de jeu : 3 modes (automatique, animateur, vote), option distanciel, barème à la rapidité, reprise après reconnexion, buzzers physiques.
- Packs : un pack `MANUEL` lance une partie avec une liste précise de questions (`PackQuestion`). **C'est ce mécanisme qui porte « Mes quiz »** : aucune logique de jeu n'a été dupliquée.
- Médias découplés du type de question (une image peut illustrer un QCM, un Vrai/Faux ou une question buzzer).
- Plans et quotas centralisés dans `config/plans.js` ; organisations, sièges, groupes ; invités sans compte.

**Règles métier que l'IA doit respecter** (vérifiées dans le code, pas supposées)
- Une question est « à choix » dès qu'elle a des `choix` : tout le monde répond en même temps, le serveur compare le texte choisi au texte de `reponse`. → la bonne réponse d'un QCM doit être **exactement** l'une des propositions.
- Vrai/Faux : `reponse` vaut `Vrai` ou `Faux`.
- Sans choix, la question est ouverte : buzzer en présentiel, saisie comparée par correspondance approchée en automatique à distance (au moins 3 caractères). → réponse courte obligatoire.
- La lecture synchronisée d'un son ou d'une vidéo exige le type `AUDIO` / `VIDEO` ; la mécanique reste portée par la présence de `choix`.

**Dettes techniques relevées**

| Dette | Gravité | État |
|---|---|---|
| Plan payant jamais expiré (`planExpireAt` non lu) | Haute (revenu) | **Corrigé** (`effectivePlan`) |
| Codes de vérification / réinitialisation renvoyés à la connexion | Haute (sécurité) | **Corrigé** |
| Aucun test automatisé | Haute | **Amorcé** : 11 tests unitaires + 14 d'intégration ; le moteur de jeu reste sans tests |
| Création de questions et médiathèque réservées à l'admin | Moyenne (produit) | **Levé** pour les quiz personnels ; envoi de médias par les utilisateurs non ouvert (stockage, modération) |
| Médiathèque sans titres ni étiquettes | Moyenne | Contournée (un média est décrit par la question qui l'utilise) ; à étiqueter |
| Logique de correspondance des réponses dupliquée client / serveur | Basse | Alignée, toujours dupliquée |
| Couleurs codées en dur dans ~40 fichiers | Basse | Remappées ; l'écran joueur garde ses couleurs en dur (toujours sombre) |
| `seedOffres` écrase les offres modifiées par l'admin | Basse | Non traité : ne pas le relancer en production sans relire |
| Inversion de deux lettres comptée comme 2 fautes (« cacoa » refusé) | Basse | **Corrigé** côté serveur et client |

---

## 3. Marché ivoirien : ce qu'on sait, ce qu'on suppose

### Faits vérifiés

- **[Fait]** 60,4 millions d'abonnements mobiles actifs, **41,2 millions d'abonnements à l'internet mobile** (+13,6 % en un an) et **28 millions d'abonnements mobile money** (+5,4 %) fin juin 2026. L'internet fixe progresse de 54,5 % mais ne compte que 938 000 abonnements. — ARTCI, statistiques du 2ᵉ trimestre 2026.
- **[Fait]** 14,0 millions d'internautes (41,4 % de la population) et 8,7 millions d'identités sur les réseaux sociaux en octobre 2026 ; âge médian 18,5 ans. Facebook : 8,7 millions (portée publicitaire) ; LinkedIn : 2,2 millions de membres inscrits (+22 % en un an) ; Instagram : 0,9 million. — DataReportal, *Digital 2027: Côte d'Ivoire*.
- **[Fait]** DataReportal ne publie **aucun chiffre TikTok ni WhatsApp** pour la Côte d'Ivoire. Les « 8 millions d'utilisateurs TikTok » qui circulent ne sont pas dans la source à laquelle ils sont attribués.
- **[Fait]** Les entreprises ivoiriennes cotisent à la formation continue (taxe de 1,2 % de la masse salariale, FDFP) ; 14 262 entreprises et 290 583 salariés ont bénéficié de plans agréés selon un bilan de 2024. — AIP.

À lire avec prudence : un abonnement n'est pas une personne (60 millions de SIM pour 33,7 millions d'habitants), et une portée publicitaire n'est pas une audience active.

### Observations (sources secondaires ou déclaratives)

- **[Observation]** Wave revendique 60 % de part de marché et 21 millions de comptes en Côte d'Ivoire (déclaration de l'entreprise, avril 2026). Non confirmé par une source indépendante.
- **[Observation]** WhatsApp est décrit comme la plateforme la plus utilisée du pays par la presse spécialisée ; les estimations TikTok vont de 2 à 8 millions selon les blogs, sans méthode publiée.
- **[Observation]** Le prix du gigaoctet varie de quelques dizaines à environ 1 000 FCFA selon le forfait et les promotions.
- **[Observation]** Des agences d'Abidjan proposent team building et séminaires ; aucune grille de prix publique n'a été trouvée. Aucune offre récurrente de « soirée quiz » en maquis ou restaurant n'apparaît dans les recherches — ce qui ne prouve pas qu'il n'y en a pas.
- **[Observation]** « Génies en herbe » a été diffusé en Côte d'Ivoire de 1980 à 2001 puis relancé en 2013 avec un sponsor télécom ; aucune saison scolaire 2026 n'a été trouvée. Le concours « Génies en herbe OHADA » (étudiants en droit) existe toujours.
- **[Observation]** Kahoot facture ses offres professionnelles par animateur, en dollars, par carte bancaire, de l'ordre de 15 à 49 $ par mois selon les sources.

### Ce que cela implique pour le produit

- **[Recommandation]** Mobile d'abord, sans application à installer, sobre en données : c'est déjà le cas (PWA, invités par QR). Garder les médias optionnels et légers ; un quiz doit rester jouable sans image.
- **[Recommandation]** Payer en mobile money, **par pass prépayé** et non par prélèvement : le code le permet déjà (`Offre.dureeJours`). La page des offres dit désormais « pass de 30 jours, payé une fois ».
- **[Recommandation]** Le partage se fait par lien et QR (WhatsApp, affichage en salle), pas par une intégration à un réseau social.
- **[Hypothèse]** Les entreprises paieraient pour animer leurs événements internes. Rien dans les recherches ne le chiffre : c'est à vérifier par 10 à 15 entretiens (RH, communication interne, agences événementielles) avant d'investir dans des fonctions dédiées.
- **[Hypothèse]** Les maquis et restaurants adopteraient une soirée quiz hebdomadaire si elle remplit la salle un soir creux. À tester avec 3 à 5 établissements pilotes, gratuitement.

### Quiz « actualité et réseaux sociaux » : avis franc

L'idée est bonne pour la viralité, mais **une IA seule ne peut pas la tenir** : le modèle ne connaît pas l'actualité postérieure à son entraînement et se trompera sur ce qui est récent. Le générateur le signale (drapeau « à vérifier » sur chaque fait récent), mais cela ne remplace pas une source.

| Format | Renouvellement | Rétention attendue | Production |
|---|---|---|---|
| Culture ivoirienne durable (histoire, géographie, musique, gastronomie, expressions) | Faible | Bonne pour découvrir, s'épuise | IA + relecture : fiable |
| Football (Éléphants, CAN, clubs) | Calendrier des compétitions | Forte autour des matchs | IA pour l'historique ; humain pour le récent |
| « Le quiz de la semaine » (actualité, tendances) | Hebdomadaire | La plus forte : rendez-vous | **Éditorial humain**, assisté par l'IA à partir d'articles collés en contexte |
| Blind test musical | Mensuel | Forte en soirée | Bloqué par les droits et le manque de sons dans la médiathèque |

**[Recommandation]** Un seul rendez-vous éditorial hebdomadaire, écrit par un humain (le champ « contexte » de la création par IA sert à cela : coller trois articles, obtenir un brouillon, corriger). Ne pas promettre de l'actualité générée automatiquement.

---

## 4. Positionnement

**Une phrase :** *Gbairai met l'ambiance d'un jeu télé dans n'importe quelle salle : on scanne, on joue.*

| | Grand public (axe A) | Organisations (axe B, priorité) |
|---|---|---|
| Promesse | Jouer tout de suite, gratuitement, seul ou entre amis | Animer un événement sans technicien ni préparation |
| Porte d'entrée | Un code reçu, un pack tapé | « Prépare un quiz pour notre séminaire de vendredi » |
| Rôle dans le modèle | Volume, notoriété, habitude | Revenu |
| Ce qui fait payer | Créer ses quiz par IA, parties à plusieurs au-delà de 10 par mois | Joueurs illimités, quiz sur l'entreprise, membres, buzzers |

**Face à Kahoot :** pas de carte bancaire en dollars, pas de compte pour les participants, du contenu ivoirien, de vrais buzzers. Ne pas chercher à l'égaler en fonctions.

**Cohérence avec le modèle économique validé en juin 2026** (pas d'abonnement récurrent, la marque paie plus que le joueur) : Premium est un **pass prépayé de 30 jours**, sans reconduction — ce n'est pas un abonnement au sens du prélèvement. Les crédits de jeu et les packs sponsorisés restent en place et inchangés. **Point à trancher par vous :** si « aucun abonnement » excluait aussi un pass mensuel, la création par IA devrait se vendre en crédits (par exemple 10 créations pour un prix fixe). Le code le permettrait sans refonte : le quota se calcule sur un journal.

### Ce que Premium veut dire maintenant

| | Gratuit | Premium (5 000 FCFA / 30 jours) | Organisation |
|---|---|---|---|
| Jouer seul | Illimité | Illimité | Illimité |
| Parties à plusieurs | 10 par mois, 20 joueurs | Illimitées, 100 joueurs | Illimitées, joueurs illimités |
| Mes quiz enregistrés | 3 | Illimités | Illimités |
| Création par IA | 1 essai offert, 10 questions | 30 par mois, 30 questions | 100 par mois et par membre, 40 questions |

Ces seuils sont dans `config/plans.js` et se changent en une ligne. L'essai gratuit est délibéré : au lancement le paiement n'est pas actif, et une fonction que personne ne peut essayer ne convainc personne. Son coût est borné par le budget quotidien global.

### Fonctions pour les organisations : livré, proposé, écarté

- **Livré — quiz sur l'entreprise.** Le champ « contexte » de la création par IA accepte jusqu'à 6 000 caractères (valeurs, produits, histoire, programme). C'est ce qui rend possibles l'intégration des nouveaux, la connaissance de l'entreprise et la formation, sans nouvelle table.
- **Livré (deuxième livraison)** : jeu par équipes, bilan d'événement imprimable, logo de l'organisation. Ils restent à valider par les entretiens de la section 3 : ce qui est construit n'est pas encore prouvé utile.
- **Proposé, non construit** : **quiz partagés entre membres** d'une organisation. Coût : faible.
- **Écarté pour l'instant :** parcours de formation avec suivi individuel, intégrations RH, certificats. Cela ferait de Gbairai un outil de formation, un autre métier avec d'autres concurrents.

---

## 5. Direction artistique

**Intention.** Le plaisir d'un jeu, la chaleur d'une soirée, le sérieux d'un outil qu'on peut projeter en entreprise. Une seule couleur vive, de l'air, de gros boutons.

| Jeton | Valeur | Rôle |
|---|---|---|
| `--brand` | `#F26A1B` orange solaire | Action principale, marque |
| `--leaf` | `#12995F` vert feuille | Réussite, bonne réponse, en ligne |
| `--mango` | `#FFC23D` jaune mangue | Premium, étoiles, IA |
| `--bg` jour / nuit | `#FFF7EC` crème / `#1A120E` cacao | Fond |
| `--text` jour / nuit | `#2B1A10` / `#FFF3E6` | Texte |

- **Typographie :** Bricolage Grotesque pour les titres (du caractère), Inter pour le texte (lisibilité sur petits écrans).
- **Formes :** cartes à 18 px, boutons à 12 px. Le bouton principal a une tranche qui s'écrase au clic, comme une touche.
- **Thème clair par défaut** (lisible dehors et en salle éclairée) ; sombre « cacao » à un clic. L'écran du joueur reste toujours sombre.
- **Marque :** une bulle (le *gbairai*, la causerie) dont le cœur est un buzzer.
- **Ce qu'on s'interdit :** dégradés décoratifs, plus d'une rangée de cartes qui défile par écran, vocabulaire technique visible (auto, distanciel, manche…), tableaux de bord chiffrés à l'accueil.
- **Accessibilité :** contour de focus visible, animations coupées si le système le demande, libellés sur les boutons icônes. Le contraste du rouge d'erreur hérité (`#F87171`) sur fond clair reste à corriger dans les anciens écrans.

Tous les jetons sont dans `client/src/index.css`.

---

## 6. Parcours : ce qui a été retiré

| Parcours | Avant | Maintenant |
|---|---|---|
| Rejoindre | Champ parmi d'autres | Premier bloc de l'accueil et de la page publique ; invité sans compte (inchangé) |
| Découvrir un quiz | 6 rangées, 3 menus déroulants | Recherche + puces de catégories + une grille ; recherche vide → « créer ce quiz avec l'IA » |
| Jouer seul | Ouvrir le pack, ignorer 2 interrupteurs, cliquer | 2 clics : le pack, puis « Jouer seul, tout de suite » |
| Jouer à plusieurs | Choisir parmi 3 modes + 2 interrupteurs | « Jouer à plusieurs » → « Chacun son téléphone » ou « Un grand écran » → ouvrir la salle. Le mode conseillé du pack s'applique ; « Qui anime ? » est replié |
| Créer un quiz | Impossible hors admin | Une phrase → brouillon → relecture → jouer |
| Modifier un quiz | Impossible | « Mes quiz » → Modifier (même écran que la relecture) |
| Animateur / automatique / vote | Trois cartes au même niveau | Sous « Qui anime ? », avec une phrase chacune |
| Buzzer virtuel | Automatique (inchangé) | Inchangé : le téléphone est le buzzer |
| Buzzer ESP32 | Bloc « Mes buzzers » en bas d'accueil | Une ligne discrète ; l'association automatique à la partie est inchangée |
| Événement d'entreprise | Pas de chemin | Créer (avec contexte) → « Un grand écran » → QR en salle |

**Décisions automatisées :** seul = automatique + réponses sur téléphone + démarrage immédiat ; à plusieurs = mode conseillé du pack ; un quiz personnel = 1 manche, 30 secondes par question ; la taille du quiz est plafonnée à ce que l'offre permet sans message d'erreur.

**Reste à faire sur les parcours** (non livré)
1. **Salle d'attente :** le QR et le code sont sous la liste des participants ; ils devraient occuper le haut de l'écran, et les « manches configurées » disparaître derrière un détail.
2. **« Sur mesure »** (`/parties/new`) : toujours les 4 modes d'origine ; à aligner sur la feuille de lancement.
3. **Un grand écran + réponses libres :** en automatique sur place, une question ouverte se joue au réflexe (le premier qui buzze marque, sans vérification). Pour un quiz personnel qui en contient, il faudrait proposer « J'anime » par défaut.
4. **Mon compte** et l'administration : non revus (palette seulement).

---

## 7. Feuille de route

**Fait dans cette livraison**
- Identité visuelle, jetons, navigation à 4 destinations (barre d'onglets sur mobile), accueil, page publique, feuille de lancement.
- « Mes quiz » et studio de création (IA + manuel), contrôle serveur, quotas, journal des coûts.
- Explication de la réponse affichée sur le téléphone du joueur (elle n'apparaissait que sur l'écran public).
- Corrections : expiration des plans, fuite des codes, tolérance aux lettres inversées, débordement horizontal sur mobile.

**Ensuite, dans l'ordre**

| # | Chantier | Pourquoi | Effort |
|---|---|---|---|
| 1 | Brancher la clé API, générer 20 quiz réels, mesurer coût et taux d'erreurs, choisir le modèle | Rien d'autre sur l'IA n'a de sens avant | 1 jour |
| 2 | 10 à 15 entretiens entreprises et agences ; 3 à 5 maquis pilotes | Valider les deux hypothèses commerciales | 2 semaines |
| 3 | CinetPay : compte marchand, clés de test, un paiement réel dans le bac à sable, puis clés `sk_live_` | Pas de revenu sans cela ; l'intégration n'a jamais parlé au vrai CinetPay | 1 jour après l'homologation |
| 4 | Une soirée réelle avec 2 buzzers ESP32 et l'écran public en équipes | Seul essai qui valide matériel + réseau + écran ensemble | 1 soirée |
| 5 | Étiqueter la médiathèque | L'IA n'associe des médias que si la médiathèque est décrite | Continu |
| 6 | Quiz de la semaine (éditorial) | Rétention grand public | Continu |
| 7 | Quiz partagés entre membres d'une organisation | Demande probable des RH (à confirmer en entretien) | 2 jours |

Faits depuis la première livraison : salle d'attente (QR en premier), jeu par équipes, bilan, logo, envoi d'images Premium, refonte des écrans de jeu, tests du moteur de jeu et du client.

---

## 8. Sources

- ARTCI — [Statistiques du marché des télécommunications, 2ᵉ trimestre 2026](https://artci.ci/wp-content/uploads/2026/09/RAPPORT-ARTCI-T2-2026_26.08.26.pdf) (pages 4 et 5)
- DataReportal — [Digital 2027: Côte d'Ivoire](https://datareportal.com/reports/digital-2027-cote-divoire) (5 novembre 2026) et [Digital 2026: Côte d'Ivoire](https://datareportal.com/reports/digital-2026-cote-divoire)
- Digital Mag — [Wave Côte d'Ivoire : 60 % de parts de marché, 21 millions de comptes](https://digitalmag.ci/wave-cote-divoire-60-de-parts-de-marche-21-millions-de-comptes/) (déclaratif)
- Adweknow — [Senegalese and Ivorian television channels conquer social media](https://adweknow.com/?p=27140)
- AIP — [bilan du FDFP](https://www.aip.ci/?p=81005)
- Abidjan.net — [Génies en herbe de retour en Côte d'Ivoire](https://news.abidjan.net/articles/480795/societe-genies-en-herbe-de-retour-en-cote-d8217ivoire) (2013)
- Kahoot — [tarifs professionnels](https://kahoot.com/business/pricing-variant) ; les montants varient selon les sources et la date
