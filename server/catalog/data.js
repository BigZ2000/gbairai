// Pools de données réelles pour générer le catalogue Gbairai.
// ≥60% orienté Côte d'Ivoire / Afrique de l'Ouest. Faits vérifiables, non répétitifs.
// Chaque entrée alimente la génération de questions IMAGE / AUDIO / VIDEO.

// ───────────────────────────── IMAGE ─────────────────────────────

// Monuments & lieux emblématiques (Côte d'Ivoire en priorité).
export const monumentsCI = [
  { rep: 'La Pyramide', ville: 'Abidjan', cat: 'Monuments', diff: 'MOYEN', note: 'Immeuble emblématique du Plateau conçu par Rinaldo Olivieri (1973).' },
  { rep: 'La Basilique Notre-Dame de la Paix', ville: 'Yamoussoukro', cat: 'Monuments', diff: 'FACILE', note: 'Plus grande basilique du monde, inaugurée en 1990.' },
  { rep: "La Cathédrale Saint-Paul", ville: 'Abidjan', cat: 'Monuments', diff: 'MOYEN', note: "Cathédrale du Plateau à l'architecture moderne (1985).", },
  { rep: "L'Hôtel Ivoire", ville: 'Abidjan', cat: 'Monuments', diff: 'MOYEN', note: 'Complexe hôtelier historique de Cocody.' },
  { rep: 'Le Pont Henri Konan Bédié', ville: 'Abidjan', cat: 'Monuments', diff: 'MOYEN', note: 'Pont à péage reliant Marcory à Riviera, inauguré en 2014.' },
  { rep: 'La Tour F du Plateau', ville: 'Abidjan', cat: 'Monuments', diff: 'DIFFICILE', note: 'Gratte-ciel administratif du Plateau.' },
  { rep: 'Le Stade Félix Houphouët-Boigny', ville: 'Abidjan', cat: 'Monuments', diff: 'MOYEN', note: 'Stade historique du Plateau, dit « le Félicia ».' },
  { rep: "Le Stade Olympique Alassane Ouattara", ville: 'Ebimpé', cat: 'Monuments', diff: 'MOYEN', note: "Stade de 60 000 places construit pour la CAN 2023." },
  { rep: 'La Place de la République', ville: 'Abidjan', cat: 'Monuments', diff: 'DIFFICILE', note: 'Place centrale du Plateau.' },
  { rep: 'Le Parc national du Banco', ville: 'Abidjan', cat: 'Tourisme', diff: 'MOYEN', note: 'Forêt tropicale primaire en pleine ville.' },
  { rep: 'La Mosquée de la Riviera Golf', ville: 'Abidjan', cat: 'Monuments', diff: 'DIFFICILE', note: "Grande mosquée d'Abidjan." },
  { rep: 'Le Marché de Cocody', ville: 'Abidjan', cat: 'Tourisme', diff: 'DIFFICILE', note: 'Marché artisanal réputé.' },
  { rep: 'La Baie de Cocody', ville: 'Abidjan', cat: 'Tourisme', diff: 'MOYEN', note: 'Lagune Ébrié réaménagée.' },
  { rep: 'Le Plateau', ville: 'Abidjan', cat: 'Tourisme', diff: 'FACILE', note: 'Quartier des affaires et du centre-ville.' },
  { rep: 'Grand-Bassam', ville: 'Grand-Bassam', cat: 'Tourisme', diff: 'FACILE', note: 'Ancienne capitale coloniale, patrimoine UNESCO.' },
  { rep: 'La Cathédrale Sacré-Cœur de Daloa', ville: 'Daloa', cat: 'Monuments', diff: 'DIFFICILE', note: 'Édifice religieux du centre-ouest.' },
  { rep: 'Le Mont Nimba', ville: 'Région des Montagnes', cat: 'Tourisme', diff: 'MOYEN', note: 'Réserve naturelle UNESCO à la frontière guinéenne.' },
  { rep: 'La Dent de Man', ville: 'Man', cat: 'Tourisme', diff: 'MOYEN', note: 'Sommet emblématique de la région de Man.' },
  { rep: 'Le Pont de la liane à Man', ville: 'Man', cat: 'Tourisme', diff: 'DIFFICILE', note: 'Ponts de lianes traditionnels.' },
  { rep: 'Le Barrage de Kossou', ville: 'Kossou', cat: 'Tourisme', diff: 'DIFFICILE', note: 'Grand barrage hydroélectrique sur le Bandama.' },
  { rep: 'Le Palais présidentiel de Yamoussoukro', ville: 'Yamoussoukro', cat: 'Monuments', diff: 'DIFFICILE', note: 'Résidence officielle bordée de lacs aux caïmans.' },
  { rep: 'La Fondation Félix Houphouët-Boigny', ville: 'Yamoussoukro', cat: 'Monuments', diff: 'DIFFICILE', note: 'Centre de congrès et institution de la paix.' },
  { rep: "Le Musée des Civilisations de Côte d'Ivoire", ville: 'Abidjan', cat: 'Culture', diff: 'DIFFICILE', note: 'Musée national au Plateau.' },
  { rep: 'La Gare de Treichville', ville: 'Abidjan', cat: 'Tourisme', diff: 'DIFFICILE', note: 'Gare ferroviaire historique.' },
  { rep: 'Assinie', ville: 'Assinie', cat: 'Tourisme', diff: 'FACILE', note: 'Station balnéaire prisée du littoral.' },
]

// Monuments du monde (hors CI, ~40%).
export const monumentsMonde = [
  { rep: 'La Tour Eiffel', ville: 'Paris', cat: 'Monuments', diff: 'FACILE', note: 'Monument français érigé en 1889.' },
  { rep: 'Les Pyramides de Gizeh', ville: 'Égypte', cat: 'Monuments', diff: 'FACILE', note: 'Tombeaux des pharaons.' },
  { rep: 'Le Colisée', ville: 'Rome', cat: 'Monuments', diff: 'FACILE', note: 'Amphithéâtre antique romain.' },
  { rep: 'La Statue de la Liberté', ville: 'New York', cat: 'Monuments', diff: 'FACILE', note: 'Cadeau de la France aux États-Unis.' },
  { rep: 'La Grande Muraille de Chine', ville: 'Chine', cat: 'Monuments', diff: 'FACILE', note: 'Fortification longue de milliers de km.' },
  { rep: 'Le Taj Mahal', ville: 'Inde', cat: 'Monuments', diff: 'MOYEN', note: 'Mausolée de marbre blanc à Agra.' },
  { rep: 'La Mosquée Hassan II', ville: 'Casablanca', cat: 'Monuments', diff: 'MOYEN', note: 'Plus grande mosquée du Maroc.' },
  { rep: 'Big Ben', ville: 'Londres', cat: 'Monuments', diff: 'FACILE', note: 'Tour de l\'horloge du Palais de Westminster.' },
  { rep: 'Le Christ Rédempteur', ville: 'Rio de Janeiro', cat: 'Monuments', diff: 'FACILE', note: 'Statue surplombant Rio.' },
  { rep: 'La Sagrada Família', ville: 'Barcelone', cat: 'Monuments', diff: 'MOYEN', note: 'Basilique de Gaudí toujours en construction.' },
  { rep: 'La Mosquée de Djenné', ville: 'Mali', cat: 'Monuments', diff: 'DIFFICILE', note: 'Plus grand édifice en terre crue du monde.' },
  { rep: 'Le Mémorial de Gorée', ville: 'Sénégal', cat: 'Monuments', diff: 'MOYEN', note: "Île-mémoire de la traite négrière." },
  { rep: 'La Place de l\'Indépendance', ville: 'Dakar', cat: 'Monuments', diff: 'DIFFICILE', note: 'Place centrale de la capitale sénégalaise.' },
  { rep: 'Le Monument de la Renaissance africaine', ville: 'Dakar', cat: 'Monuments', diff: 'MOYEN', note: 'Statue monumentale au Sénégal.' },
]

// Personnalités ivoiriennes (politiques, sportifs, artistes, figures).
export const personnalitesCI = [
  { rep: 'Félix Houphouët-Boigny', cat: 'Histoire', diff: 'FACILE', note: "Premier président de la Côte d'Ivoire (1960-1993)." },
  { rep: 'Henri Konan Bédié', cat: 'Histoire', diff: 'MOYEN', note: "Président de 1993 à 1999." },
  { rep: 'Laurent Gbagbo', cat: 'Histoire', diff: 'FACILE', note: "Président de 2000 à 2011." },
  { rep: 'Alassane Ouattara', cat: 'Histoire', diff: 'FACILE', note: "Président depuis 2011, ancien du FMI." },
  { rep: 'Didier Drogba', cat: 'Sport', diff: 'FACILE', note: 'Légende des Éléphants et de Chelsea.' },
  { rep: 'Yaya Touré', cat: 'Sport', diff: 'FACILE', note: 'Milieu de terrain, ex-Manchester City et Barcelone.' },
  { rep: 'Kolo Touré', cat: 'Sport', diff: 'MOYEN', note: 'Défenseur, frère de Yaya, ex-Arsenal.' },
  { rep: 'Salomon Kalou', cat: 'Sport', diff: 'MOYEN', note: 'Attaquant international ivoirien.' },
  { rep: 'Gervinho', cat: 'Sport', diff: 'MOYEN', note: 'Ailier des Éléphants, vainqueur CAN 2015.' },
  { rep: 'Sébastien Haller', cat: 'Sport', diff: 'MOYEN', note: 'Buteur décisif de la CAN 2023.' },
  { rep: 'Franck Kessié', cat: 'Sport', diff: 'MOYEN', note: 'Milieu vainqueur de la CAN 2023.' },
  { rep: 'Serey Dié', cat: 'Sport', diff: 'DIFFICILE', note: 'Milieu de terrain international.' },
  { rep: 'Emerse Faé', cat: 'Sport', diff: 'MOYEN', note: 'Sélectionneur vainqueur de la CAN 2023.' },
  { rep: 'Wilfried Zaha', cat: 'Sport', diff: 'MOYEN', note: 'Ailier international ivoirien.' },
  { rep: 'Cheick Cissé', cat: 'Sport', diff: 'DIFFICILE', note: "Champion olympique de taekwondo (Rio 2016)." },
  { rep: 'Gabriel Tiacoh', cat: 'Sport', diff: 'DIFFICILE', note: 'Médaillé olympique ivoirien en athlétisme (1984).' },
  { rep: 'Marie-Josée Ta Lou', cat: 'Sport', diff: 'MOYEN', note: 'Sprinteuse ivoirienne de niveau mondial.' },
  { rep: 'Bernard Dadié', cat: 'Culture', diff: 'MOYEN', note: 'Écrivain majeur, auteur de « Climbié ».' },
  { rep: 'Ahmadou Kourouma', cat: 'Culture', diff: 'MOYEN', note: 'Romancier, auteur des « Soleils des indépendances ».' },
  { rep: 'Henriette Diabaté', cat: 'Histoire', diff: 'DIFFICILE', note: 'Historienne et femme politique.' },
  { rep: 'Simone Gbagbo', cat: 'Histoire', diff: 'MOYEN', note: 'Ancienne Première dame et femme politique.' },
  { rep: 'Guillaume Soro', cat: 'Histoire', diff: 'MOYEN', note: 'Ancien Premier ministre et président de l\'Assemblée.' },
  { rep: 'Tidjane Thiam', cat: 'Actualité', diff: 'MOYEN', note: 'Financier, ex-PDG de Credit Suisse, président du PDCI.' },
  { rep: 'Werewere-Liking', cat: 'Culture', diff: 'DIFFICILE', note: 'Artiste et écrivaine panafricaine établie à Abidjan.' },
]

// Artistes ivoiriens (visage) — sert aussi pour AUDIO/VIDEO.
export const artistesCI = [
  { rep: 'DJ Arafat', cat: 'Musique', diff: 'FACILE', note: 'Roi du coupé-décalé, alias Yôrôbô (1986-2019).' },
  { rep: 'Alpha Blondy', cat: 'Musique', diff: 'FACILE', note: 'Star du reggae ivoirien.' },
  { rep: 'Tiken Jah Fakoly', cat: 'Musique', diff: 'FACILE', note: 'Chanteur reggae engagé.' },
  { rep: 'Magic System', cat: 'Musique', diff: 'FACILE', note: 'Groupe zouglou, « Premier Gaou ».' },
  { rep: 'Meiway', cat: 'Musique', diff: 'MOYEN', note: 'Créateur du zoblazo.' },
  { rep: 'Serge Beynaud', cat: 'Musique', diff: 'MOYEN', note: 'Star du coupé-décalé moderne.' },
  { rep: 'Debordo Leekunfa', cat: 'Musique', diff: 'MOYEN', note: 'Artiste coupé-décalé.' },
  { rep: 'Bebi Philip', cat: 'Musique', diff: 'MOYEN', note: 'Chanteur et producteur ivoirien.' },
  { rep: 'Josey', cat: 'Musique', diff: 'MOYEN', note: 'Chanteuse ivoirienne populaire.' },
  { rep: 'Aïcha Koné', cat: 'Musique', diff: 'MOYEN', note: 'Diva de la musique ivoirienne.' },
  { rep: 'Monique Séka', cat: 'Musique', diff: 'MOYEN', note: 'Créatrice de l\'afro-zouk.' },
  { rep: 'Yodé & Siro', cat: 'Musique', diff: 'MOYEN', note: 'Duo zouglou emblématique.' },
  { rep: 'Espoir 2000', cat: 'Musique', diff: 'MOYEN', note: 'Groupe zouglou.' },
  { rep: 'Kerozen', cat: 'Musique', diff: 'MOYEN', note: 'Chanteur ivoirien, « La vie est belle ».' },
  { rep: 'Suspect 95', cat: 'Musique', diff: 'MOYEN', note: 'Rappeur ivoirien.' },
  { rep: 'Didi B', cat: 'Musique', diff: 'MOYEN', note: 'Rappeur, ex-Kiff No Beat.' },
  { rep: 'Safarel Obiang', cat: 'Musique', diff: 'DIFFICILE', note: 'Artiste coupé-décalé.' },
  { rep: 'Vetcho Lolas', cat: 'Musique', diff: 'DIFFICILE', note: 'Chanteur ivoirien.' },
  { rep: 'Roseline Layo', cat: 'Musique', diff: 'MOYEN', note: 'Chanteuse révélée récemment.' },
  { rep: 'Ariel Sheney', cat: 'Musique', diff: 'DIFFICILE', note: 'Disciple de DJ Arafat.' },
]

// Gastronomie ivoirienne / ouest-africaine.
export const gastronomie = [
  { rep: "L'attiéké", cat: 'Gastronomie', diff: 'FACILE', note: 'Semoule de manioc fermenté, plat national.' },
  { rep: 'Le foutou', cat: 'Gastronomie', diff: 'FACILE', note: 'Pâte de banane plantain ou d\'igname pilée.' },
  { rep: "L'alloco", cat: 'Gastronomie', diff: 'FACILE', note: 'Bananes plantain frites.' },
  { rep: 'Le kedjenou', cat: 'Gastronomie', diff: 'MOYEN', note: 'Poulet ou pintade mijoté à l\'étouffée.' },
  { rep: 'Le garba', cat: 'Gastronomie', diff: 'FACILE', note: 'Attiéké au thon frit, plat de rue populaire.' },
  { rep: 'La sauce graine', cat: 'Gastronomie', diff: 'MOYEN', note: 'Sauce à base de noix de palme.' },
  { rep: 'Le placali', cat: 'Gastronomie', diff: 'MOYEN', note: 'Pâte de manioc fermenté.' },
  { rep: 'La sauce gombo', cat: 'Gastronomie', diff: 'MOYEN', note: 'Sauce gluante au gombo.' },
  { rep: 'Le bangui', cat: 'Gastronomie', diff: 'DIFFICILE', note: 'Vin de palme traditionnel.' },
  { rep: "L'aloko poisson", cat: 'Gastronomie', diff: 'MOYEN', note: 'Alloco accompagné de poisson braisé.' },
  { rep: 'Le poisson braisé', cat: 'Gastronomie', diff: 'FACILE', note: 'Poisson grillé épicé, classique du maquis.' },
  { rep: 'Le tchep / riz gras', cat: 'Gastronomie', diff: 'MOYEN', note: 'Riz au poisson d\'origine sénégalaise (thiéboudienne).' },
  { rep: "L'igname braisée", cat: 'Gastronomie', diff: 'MOYEN', note: 'Tubercule grillé.' },
  { rep: 'Le gnamakoudji', cat: 'Gastronomie', diff: 'DIFFICILE', note: 'Jus de gingembre épicé.' },
  { rep: 'Le bissap', cat: 'Gastronomie', diff: 'FACILE', note: "Boisson à base de fleurs d'hibiscus." },
  { rep: 'Le claqudou / dêguê', cat: 'Gastronomie', diff: 'DIFFICILE', note: 'Dessert à base de mil et de lait.' },
]

// Drapeaux & pays africains (réel : 1 question par pays).
export const paysAfrique = [
  { pays: "Côte d'Ivoire", capitale: 'Yamoussoukro', diff: 'FACILE' },
  { pays: 'Sénégal', capitale: 'Dakar', diff: 'FACILE' },
  { pays: 'Mali', capitale: 'Bamako', diff: 'FACILE' },
  { pays: 'Ghana', capitale: 'Accra', diff: 'FACILE' },
  { pays: 'Nigeria', capitale: 'Abuja', diff: 'MOYEN' },
  { pays: 'Burkina Faso', capitale: 'Ouagadougou', diff: 'MOYEN' },
  { pays: 'Guinée', capitale: 'Conakry', diff: 'MOYEN' },
  { pays: 'Bénin', capitale: 'Porto-Novo', diff: 'MOYEN' },
  { pays: 'Togo', capitale: 'Lomé', diff: 'MOYEN' },
  { pays: 'Niger', capitale: 'Niamey', diff: 'MOYEN' },
  { pays: 'Liberia', capitale: 'Monrovia', diff: 'MOYEN' },
  { pays: 'Sierra Leone', capitale: 'Freetown', diff: 'DIFFICILE' },
  { pays: 'Cameroun', capitale: 'Yaoundé', diff: 'MOYEN' },
  { pays: 'Gabon', capitale: 'Libreville', diff: 'MOYEN' },
  { pays: 'Congo', capitale: 'Brazzaville', diff: 'MOYEN' },
  { pays: 'RD Congo', capitale: 'Kinshasa', diff: 'MOYEN' },
  { pays: 'Maroc', capitale: 'Rabat', diff: 'MOYEN' },
  { pays: 'Algérie', capitale: 'Alger', diff: 'MOYEN' },
  { pays: 'Tunisie', capitale: 'Tunis', diff: 'MOYEN' },
  { pays: 'Égypte', capitale: 'Le Caire', diff: 'FACILE' },
  { pays: 'Afrique du Sud', capitale: 'Pretoria', diff: 'MOYEN' },
  { pays: 'Kenya', capitale: 'Nairobi', diff: 'MOYEN' },
  { pays: 'Éthiopie', capitale: 'Addis-Abeba', diff: 'MOYEN' },
  { pays: 'Tanzanie', capitale: 'Dodoma', diff: 'DIFFICILE' },
  { pays: 'Ouganda', capitale: 'Kampala', diff: 'DIFFICILE' },
  { pays: 'Rwanda', capitale: 'Kigali', diff: 'MOYEN' },
  { pays: 'Angola', capitale: 'Luanda', diff: 'DIFFICILE' },
  { pays: 'Mozambique', capitale: 'Maputo', diff: 'DIFFICILE' },
  { pays: 'Zimbabwe', capitale: 'Harare', diff: 'DIFFICILE' },
  { pays: 'Zambie', capitale: 'Lusaka', diff: 'DIFFICILE' },
  { pays: 'Madagascar', capitale: 'Antananarivo', diff: 'MOYEN' },
  { pays: 'Mauritanie', capitale: 'Nouakchott', diff: 'DIFFICILE' },
  { pays: 'Gambie', capitale: 'Banjul', diff: 'DIFFICILE' },
  { pays: 'Guinée-Bissau', capitale: 'Bissau', diff: 'DIFFICILE' },
  { pays: 'Cap-Vert', capitale: 'Praia', diff: 'DIFFICILE' },
  { pays: 'Tchad', capitale: "N'Djamena", diff: 'DIFFICILE' },
]

// Animaux d'Afrique.
export const animaux = [
  { rep: "L'éléphant", cat: 'Nature', diff: 'FACILE', note: "Symbole de la Côte d'Ivoire (les Éléphants)." },
  { rep: 'Le lion', cat: 'Nature', diff: 'FACILE', note: 'Grand félin de la savane.' },
  { rep: 'La girafe', cat: 'Nature', diff: 'FACILE', note: 'Plus grand animal terrestre.' },
  { rep: "L'hippopotame", cat: 'Nature', diff: 'FACILE', note: 'Mammifère semi-aquatique.' },
  { rep: 'Le buffle', cat: 'Nature', diff: 'MOYEN', note: 'Bovidé sauvage africain.' },
  { rep: 'Le léopard', cat: 'Nature', diff: 'MOYEN', note: 'Félin tacheté arboricole.' },
  { rep: 'Le chimpanzé', cat: 'Nature', diff: 'MOYEN', note: 'Grand singe présent dans le parc de Taï.' },
  { rep: 'Le crocodile', cat: 'Nature', diff: 'FACILE', note: 'Reptile des lacs de Yamoussoukro.' },
  { rep: "L'antilope", cat: 'Nature', diff: 'MOYEN', note: 'Herbivore de savane.' },
  { rep: 'Le pangolin', cat: 'Nature', diff: 'DIFFICILE', note: 'Mammifère à écailles.' },
  { rep: 'Le calao', cat: 'Nature', diff: 'DIFFICILE', note: 'Oiseau au grand bec.' },
  { rep: 'Le mandrill', cat: 'Nature', diff: 'DIFFICILE', note: 'Primate au visage coloré.' },
]

// Marques, logos & objets ivoiriens / panafricains (image).
export const marquesObjets = [
  { rep: 'Le pagne wax', cat: 'Culture', diff: 'FACILE', note: 'Tissu imprimé emblématique, très porté en Afrique de l\'Ouest.' },
  { rep: 'Le billet de 10 000 FCFA', cat: 'Actualité', diff: 'MOYEN', note: 'Coupure de la monnaie ouest-africaine.' },
  { rep: 'Le masque Baoulé', cat: 'Culture', diff: 'MOYEN', note: 'Masque facial du peuple Baoulé.' },
  { rep: 'Le masque Gouro', cat: 'Culture', diff: 'DIFFICILE', note: 'Masque rituel du peuple Gouro (Zaouli).' },
  { rep: 'Le masque Dan', cat: 'Culture', diff: 'DIFFICILE', note: 'Masque du peuple Dan de l\'ouest ivoirien.' },
  { rep: 'La cabosse de cacao', cat: 'Nature', diff: 'FACILE', note: "La Côte d'Ivoire est le 1er producteur mondial de cacao." },
  { rep: 'La noix de cola', cat: 'Culture', diff: 'MOYEN', note: 'Fruit symbolique de l\'hospitalité.' },
  { rep: 'Le café', cat: 'Nature', diff: 'FACILE', note: 'Culture d\'exportation majeure.' },
  { rep: "L'anacarde (noix de cajou)", cat: 'Nature', diff: 'MOYEN', note: "La Côte d'Ivoire est un grand producteur d'anacarde." },
  { rep: 'Le ballon d\'Or de Drogba', cat: 'Sport', diff: 'DIFFICILE', note: 'Trophées et distinctions du football.' },
  { rep: 'Le maillot des Éléphants', cat: 'Sport', diff: 'FACILE', note: 'Maillot orange de la sélection ivoirienne.' },
  { rep: 'Le gbaka', cat: 'Actualité', diff: 'MOYEN', note: 'Minibus de transport en commun d\'Abidjan.' },
  { rep: 'Le woro-woro', cat: 'Actualité', diff: 'MOYEN', note: 'Taxi collectif communal d\'Abidjan.' },
  { rep: 'La pirogue', cat: 'Culture', diff: 'FACILE', note: 'Embarcation traditionnelle de la lagune.' },
]

// Clubs & équipes (image : blasons / équipes).
export const equipesSport = [
  { rep: "L'ASEC Mimosas", cat: 'Sport', diff: 'MOYEN', note: 'Club historique d\'Abidjan.', ci: true },
  { rep: 'Le Africa Sports', cat: 'Sport', diff: 'MOYEN', note: 'Grand rival de l\'ASEC à Abidjan.', ci: true },
  { rep: 'Les Éléphants', cat: 'Sport', diff: 'FACILE', note: 'Surnom de la sélection nationale ivoirienne.', ci: true },
  { rep: 'Le Stade d\'Abidjan', cat: 'Sport', diff: 'DIFFICILE', note: 'Club abidjanais.', ci: true },
  { rep: 'Le Séwé Sport', cat: 'Sport', diff: 'DIFFICILE', note: 'Club de San-Pédro.', ci: true },
  { rep: 'Les Lions de la Teranga', cat: 'Sport', diff: 'MOYEN', note: 'Sélection du Sénégal.', ci: false },
  { rep: 'Les Black Stars', cat: 'Sport', diff: 'MOYEN', note: 'Sélection du Ghana.', ci: false },
  { rep: 'Les Super Eagles', cat: 'Sport', diff: 'MOYEN', note: 'Sélection du Nigeria.', ci: false },
  { rep: 'Les Lions indomptables', cat: 'Sport', diff: 'MOYEN', note: 'Sélection du Cameroun.', ci: false },
]

// ───────────────────────────── AUDIO ─────────────────────────────

// Morceaux célèbres ivoiriens (artiste + titre).
export const morceauxCI = [
  { artiste: 'Magic System', titre: '1er Gaou', diff: 'FACILE', note: 'Tube zouglou planétaire (1999).' },
  { artiste: 'DJ Arafat', titre: 'Jonathan', diff: 'MOYEN', note: 'Titre culte du Daishikan.' },
  { artiste: 'DJ Arafat', titre: 'Kpangor', diff: 'MOYEN', note: 'Danse et tube du coupé-décalé.' },
  { artiste: 'Alpha Blondy', titre: 'Brigadier Sabari', diff: 'MOYEN', note: 'Classique du reggae ivoirien.' },
  { artiste: 'Alpha Blondy', titre: 'Cocody Rock', diff: 'MOYEN', note: 'Reggae emblématique.' },
  { artiste: 'Tiken Jah Fakoly', titre: 'Plus rien ne m\'étonne', diff: 'MOYEN', note: 'Reggae engagé.' },
  { artiste: 'Meiway', titre: '200% Zoblazo', diff: 'MOYEN', note: 'Hymne du zoblazo.' },
  { artiste: 'Serge Beynaud', titre: 'Kababble', diff: 'MOYEN', note: 'Tube coupé-décalé.' },
  { artiste: 'Serge Beynaud', titre: 'Talahi', diff: 'MOYEN', note: 'Succès dansant.' },
  { artiste: 'Bebi Philip', titre: 'Tu es mon ami', diff: 'MOYEN', note: 'Chanson populaire.' },
  { artiste: 'Kerozen', titre: 'La vie est belle', diff: 'MOYEN', note: 'Tube de la résilience.' },
  { artiste: 'Josey', titre: 'Diplôme', diff: 'MOYEN', note: 'Ballade ivoirienne.' },
  { artiste: 'Yodé & Siro', titre: 'Brindolê', diff: 'DIFFICILE', note: 'Zouglou.' },
  { artiste: 'Espoir 2000', titre: 'Gloire à Dieu', diff: 'DIFFICILE', note: 'Zouglou populaire.' },
  { artiste: 'Monique Séka', titre: 'Okaman', diff: 'DIFFICILE', note: 'Afro-zouk.' },
  { artiste: 'Aïcha Koné', titre: 'Mariam', diff: 'DIFFICILE', note: 'Classique mandingue.' },
  { artiste: 'Debordo Leekunfa', titre: 'Spécialiste', diff: 'DIFFICILE', note: 'Coupé-décalé.' },
  { artiste: 'Didi B', titre: 'Daishi', diff: 'MOYEN', note: 'Rap ivoirien.' },
  { artiste: 'Suspect 95', titre: 'Bouche bée', diff: 'DIFFICILE', note: 'Rap ivoirien.' },
  { artiste: 'Roseline Layo', titre: 'Mon Africain', diff: 'MOYEN', note: 'Tube récent.' },
  { artiste: 'Ariel Sheney', titre: 'Amena', diff: 'DIFFICILE', note: 'Coupé-décalé.' },
  { artiste: 'Kiff No Beat', titre: 'Jusqu\'à la gare', diff: 'DIFFICILE', note: 'Groupe de rap.' },
  { artiste: 'Safarel Obiang', titre: 'Ban Galant', diff: 'DIFFICILE', note: 'Coupé-décalé.' },
  { artiste: 'Vetcho Lolas', titre: 'Faut pas Aragnan', diff: 'DIFFICILE', note: 'Coupé-décalé.' },
]

// Artistes ouest-africains / africains (audio).
export const morceauxAfrique = [
  { artiste: 'Youssou N\'Dour', titre: '7 Seconds', diff: 'MOYEN', note: 'Duo avec Neneh Cherry (Sénégal).' },
  { artiste: 'Salif Keïta', titre: 'Madan', diff: 'DIFFICILE', note: 'Voix d\'or du Mali.' },
  { artiste: 'Angélique Kidjo', titre: 'Agolo', diff: 'DIFFICILE', note: 'Star béninoise.' },
  { artiste: 'Fally Ipupa', titre: 'Original', diff: 'MOYEN', note: 'Rumba congolaise.' },
  { artiste: 'Koffi Olomidé', titre: 'Loi', diff: 'DIFFICILE', note: 'Rumba congolaise.' },
  { artiste: 'Burna Boy', titre: 'Last Last', diff: 'FACILE', note: 'Afrobeats nigérian.' },
  { artiste: 'Wizkid', titre: 'Essence', diff: 'FACILE', note: 'Afrobeats nigérian.' },
  { artiste: 'Davido', titre: 'Fall', diff: 'MOYEN', note: 'Afrobeats nigérian.' },
  { artiste: 'Sidiki Diabaté', titre: 'Fais-moi confiance', diff: 'DIFFICILE', note: 'Prince de la kora (Mali).' },
  { artiste: 'Oumou Sangaré', titre: 'Diaraby Nene', diff: 'DIFFICILE', note: 'Diva malienne.' },
  { artiste: 'Toofan', titre: 'Gaou', diff: 'DIFFICILE', note: 'Duo togolais.' },
  { artiste: 'Sexion d\'Assaut', titre: 'Désolé', diff: 'MOYEN', note: 'Rap français.' },
]

// Morceaux ivoiriens supplémentaires (extension du pool audio).
export const morceauxCI2 = [
  { artiste: 'Magic System', titre: 'Magic in the Air', diff: 'FACILE', note: 'Hymne festif repris dans les stades.' },
  { artiste: 'Magic System', titre: 'Bouger Bouger', diff: 'MOYEN', note: 'Tube dansant avec Khaled.' },
  { artiste: 'DJ Arafat', titre: 'Dégaine', diff: 'MOYEN', note: 'Coupé-décalé.' },
  { artiste: 'DJ Arafat', titre: 'Moto Moto', diff: 'MOYEN', note: 'Succès du Daishikan.' },
  { artiste: 'DJ Arafat', titre: 'Yorobo', diff: 'MOYEN', note: 'L\'un de ses surnoms et titres.' },
  { artiste: 'Serge Beynaud', titre: 'Adjamais', diff: 'MOYEN', note: 'Coupé-décalé.' },
  { artiste: 'Serge Beynaud', titre: 'Yababy', diff: 'DIFFICILE', note: 'Coupé-décalé.' },
  { artiste: 'Bebi Philip', titre: 'Personne', diff: 'DIFFICILE', note: 'Chanson populaire.' },
  { artiste: 'Kerozen', titre: 'Décibel', diff: 'DIFFICILE', note: 'Tube ivoirien.' },
  { artiste: 'Kerozen', titre: 'Victoire', diff: 'MOYEN', note: 'Chanson gospel urbaine.' },
  { artiste: 'Josey', titre: 'Espérance', diff: 'DIFFICILE', note: 'Ballade.' },
  { artiste: 'Josey', titre: 'Idolâtre', diff: 'DIFFICILE', note: 'Chanson sentimentale.' },
  { artiste: 'Tiken Jah Fakoly', titre: 'Françafrique', diff: 'DIFFICILE', note: 'Reggae engagé.' },
  { artiste: 'Tiken Jah Fakoly', titre: 'Le pays va mal', diff: 'MOYEN', note: 'Reggae engagé.' },
  { artiste: 'Alpha Blondy', titre: 'Jérusalem', diff: 'MOYEN', note: 'Reggae.' },
  { artiste: 'Alpha Blondy', titre: 'Sweet Fanta Diallo', diff: 'DIFFICILE', note: 'Reggae.' },
  { artiste: 'Meiway', titre: 'Miss Lolo', diff: 'DIFFICILE', note: 'Zoblazo.' },
  { artiste: 'Yodé & Siro', titre: 'On a tout compris', diff: 'DIFFICILE', note: 'Zouglou engagé.' },
  { artiste: 'Espoir 2000', titre: 'Bouche A', diff: 'DIFFICILE', note: 'Zouglou.' },
  { artiste: 'Didi B', titre: 'Père Noël', diff: 'DIFFICILE', note: 'Rap ivoirien.' },
  { artiste: 'Suspect 95', titre: 'Année blanche', diff: 'DIFFICILE', note: 'Rap ivoirien.' },
  { artiste: 'Roseline Layo', titre: 'Awoulaba', diff: 'MOYEN', note: 'Tube ivoirien.' },
  { artiste: 'Fior 2 Bior', titre: 'Affaire d\'État', diff: 'DIFFICILE', note: 'Zouglou.' },
  { artiste: 'Petit Denis', titre: 'Bobaraba', diff: 'DIFFICILE', note: 'Coupé-décalé culte.' },
  { artiste: 'DJ Mix', titre: 'Atalaku', diff: 'DIFFICILE', note: 'Coupé-décalé.' },
  { artiste: 'Molare', titre: 'La Jet Set', diff: 'DIFFICILE', note: 'Pionnier du coupé-décalé.' },
  { artiste: 'Douk Saga', titre: 'Sagacité', diff: 'DIFFICILE', note: 'Père du coupé-décalé.' },
  { artiste: 'Lewis Camara', titre: 'Plus fort', diff: 'DIFFICILE', note: 'Coupé-décalé.' },
]

// L'hymne et chants patriotiques.
export const chantsCI = [
  { artiste: 'Côte d\'Ivoire', titre: "L'Abidjanaise", diff: 'MOYEN', note: 'Hymne national ivoirien depuis 1960.' },
]

// Sons & ambiances à reconnaître (audio).
export const sonsAmbiance = [
  { rep: 'Le chant du coq', diff: 'FACILE', note: 'Son matinal familier.', cat: 'Nature' },
  { rep: 'Le rugissement du lion', diff: 'FACILE', note: 'Cri du roi de la savane.', cat: 'Nature' },
  { rep: 'Le barrissement de l\'éléphant', diff: 'MOYEN', note: 'Cri de l\'éléphant.', cat: 'Nature' },
  { rep: 'Le cri du singe', diff: 'MOYEN', note: 'Vocalise de primate.', cat: 'Nature' },
  { rep: 'Le bruit de la pluie tropicale', diff: 'MOYEN', note: 'Ambiance de saison des pluies.', cat: 'Nature' },
  { rep: 'Les vagues de l\'océan', diff: 'FACILE', note: 'Ambiance du littoral (Assinie, Grand-Bassam).', cat: 'Nature' },
  { rep: 'L\'ambiance d\'un marché', diff: 'MOYEN', note: 'Brouhaha d\'un marché abidjanais.', cat: 'Culture' },
  { rep: 'Le klaxon d\'un gbaka', diff: 'DIFFICILE', note: 'Son du transport urbain d\'Abidjan.', cat: 'Culture' },
  { rep: 'L\'appel à la prière', diff: 'MOYEN', note: 'Adhan depuis une mosquée.', cat: 'Culture' },
  { rep: 'Le sifflet de l\'arbitre', diff: 'FACILE', note: 'Son du terrain de football.', cat: 'Sport' },
]

// Instruments traditionnels.
export const instruments = [
  { rep: 'Le djembé', diff: 'FACILE', note: 'Tambour ouest-africain en forme de calice.' },
  { rep: 'Le balafon', diff: 'MOYEN', note: 'Xylophone à lames de bois et calebasses.' },
  { rep: 'La kora', diff: 'MOYEN', note: 'Harpe-luth mandingue à 21 cordes.' },
  { rep: 'Le tam-tam', diff: 'FACILE', note: 'Tambour traditionnel.' },
  { rep: 'Le ngoni', diff: 'DIFFICILE', note: 'Luth traditionnel mandingue.' },
  { rep: 'Le tambour parlant', diff: 'MOYEN', note: 'Tambour à tension (dundun).' },
  { rep: 'Le tabala', diff: 'DIFFICILE', note: 'Grand tambour cérémoniel.' },
  { rep: 'La sanza', diff: 'DIFFICILE', note: 'Piano à pouces (mbira).' },
]

// ───────────────────────────── VIDEO ─────────────────────────────

// Moments de football / CAN (Éléphants).
export const footballCI = [
  { rep: 'La victoire à la CAN 2023', diff: 'FACILE', note: "La Côte d'Ivoire championne d'Afrique à domicile (finale 2-1 vs Nigeria)." },
  { rep: 'La victoire à la CAN 2015', diff: 'MOYEN', note: "Titre remporté aux tirs au but face au Ghana (Bata)." },
  { rep: 'Le sacre de la CAN 1992', diff: 'DIFFICILE', note: "Premier titre continental face au Ghana (11-10 aux tirs au but)." },
  { rep: 'Le but de Sébastien Haller en finale 2023', diff: 'MOYEN', note: 'But de la victoire face au Nigeria.' },
  { rep: 'La qualification au Mondial 2006', diff: 'MOYEN', note: 'Première Coupe du monde des Éléphants.' },
  { rep: "L'appel de Drogba pour la paix (2005)", diff: 'MOYEN', note: 'Drogba implore la fin de la guerre civile.' },
  { rep: 'Le penalty manqué de Kolo Touré (CAN 2012)', diff: 'DIFFICILE', note: 'Finale perdue face à la Zambie.' },
]

// Danses & phénomènes culturels (vidéo).
export const dansesCI = [
  { rep: 'Le coupé-décalé', diff: 'FACILE', note: 'Mouvement musical et chorégraphique né à Paris/Abidjan (2000s).' },
  { rep: 'Le Zoblazo', diff: 'MOYEN', note: 'Danse créée par Meiway, mouchoir blanc à la main.' },
  { rep: 'Le Mapouka', diff: 'MOYEN', note: 'Danse traditionnelle du sud-est ivoirien.' },
  { rep: 'Le Gnakpa', diff: 'DIFFICILE', note: 'Danse popularisée par DJ Arafat.' },
  { rep: 'Le Boucan', diff: 'DIFFICILE', note: 'Pas de danse coupé-décalé.' },
  { rep: 'La danse de l\'Abodan', diff: 'DIFFICILE', note: 'Danse traditionnelle akan.' },
  { rep: 'Le Zaouli', diff: 'MOYEN', note: 'Danse masquée gouro, patrimoine UNESCO.' },
]

// Phénomènes / lieux touristiques en vidéo (réutilise monuments).
// Humoristes & figures du divertissement ivoirien (vidéo).
export const humoristesCI = [
  { rep: 'Adama Dahico', cat: 'Culture', diff: 'MOYEN', note: 'Humoriste et « président des humoristes ».' },
  { rep: 'Le Magnific', cat: 'Culture', diff: 'MOYEN', note: 'Humoriste ivoirien populaire.' },
  { rep: 'Digbeu Cravate', cat: 'Culture', diff: 'DIFFICILE', note: 'Humoriste ivoirien.' },
  { rep: 'Agalawal', cat: 'Culture', diff: 'DIFFICILE', note: 'Humoriste et danseur.' },
  { rep: 'Gohou Michel', cat: 'Culture', diff: 'MOYEN', note: 'Acteur de la série « Ma famille ».' },
  { rep: 'Michel Bohiri', cat: 'Culture', diff: 'DIFFICILE', note: 'Acteur ivoirien.' },
  { rep: 'Clémentine Papouet', cat: 'Culture', diff: 'DIFFICILE', note: 'Actrice et humoriste.' },
  { rep: 'Prince Toupoli', cat: 'Culture', diff: 'DIFFICILE', note: 'Humoriste et animateur.' },
]

// Séries & émissions cultes (vidéo).
export const seriesCI = [
  { rep: 'Ma famille', cat: 'Culture', diff: 'FACILE', note: 'Série télé ivoirienne culte des années 2000.' },
  { rep: 'Les Coups de la vie', cat: 'Culture', diff: 'MOYEN', note: 'Série télévisée ivoirienne.' },
  { rep: 'Class A', cat: 'Culture', diff: 'DIFFICILE', note: 'Série télévisée ivoirienne.' },
  { rep: 'Brouteur.com', cat: 'Culture', diff: 'DIFFICILE', note: 'Série humoristique ivoirienne.' },
  { rep: 'Le Grand Show', cat: 'Culture', diff: 'DIFFICILE', note: 'Émission de divertissement.' },
]

// Évènements historiques filmés (vidéo).
export const evenementsHistoire = [
  { rep: "La proclamation de l'indépendance (1960)", cat: 'Histoire', diff: 'MOYEN', note: "La Côte d'Ivoire devient indépendante le 7 août 1960." },
  { rep: "L'inauguration de la Basilique de Yamoussoukro (1990)", cat: 'Histoire', diff: 'DIFFICILE', note: 'Consacrée par le pape Jean-Paul II.' },
  { rep: 'Les funérailles de Félix Houphouët-Boigny (1994)', cat: 'Histoire', diff: 'DIFFICILE', note: 'Hommage national au premier président.' },
  { rep: "L'investiture présidentielle", cat: 'Histoire', diff: 'DIFFICILE', note: 'Cérémonie d\'investiture d\'un président ivoirien.' },
  { rep: 'La célébration du titre de la CAN 2023', cat: 'Sport', diff: 'FACILE', note: 'Liesse populaire à Abidjan.' },
]

// Films & culture africaine (vidéo).
export const filmsAfrique = [
  { rep: 'Bal poussière', diff: 'DIFFICILE', note: 'Film ivoirien d\'Henri Duparc (1989).' },
  { rep: 'Le Boucher de Cocody', diff: 'DIFFICILE', note: 'Film d\'action tourné à Abidjan.' },
  { rep: 'Run', diff: 'DIFFICILE', note: 'Film ivoirien de Philippe Lacôte (Cannes 2014).' },
  { rep: 'La Nuit des rois', diff: 'DIFFICILE', note: 'Film de Philippe Lacôte sur la MACA.' },
  { rep: 'Black Panther', diff: 'FACILE', note: 'Film Marvel sur le Wakanda.' },
  { rep: 'Sarafina', diff: 'DIFFICILE', note: 'Film sur l\'apartheid sud-africain.' },
]
