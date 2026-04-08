
# Application Météo Parapente

## Vue d'ensemble
Application web responsive d'analyse météo pour le parapente avec deux panneaux synchronisés (analyse + carte), utilisant des données mock réalistes, prête à être connectée à Open-Meteo AROME.

## Architecture Frontend

### Layout
- **Desktop (≥1024px)** : deux panneaux côte à côte — analyse à gauche (40%), carte à droite (60%)
- **Mobile (<1024px)** : mono-colonne avec navigation par onglets (Analyse / Carte), état synchronisé entre les vues

### Barre de contrôle commune (en haut)
- Sélecteur de jour : Aujourd'hui / Demain
- Timeline heure par heure avec boutons ◀ ▶ et lecture auto (play/pause)
- Affichage date + heure locale
- Sélecteur de calque météo (vent, température, nébulosité, précipitations)

### Panneau d'analyse (gauche / onglet mobile)
**Onglet 1 — Windgram**
- Grille heures × altitudes avec fond coloré selon vitesse du vent
- Flèches de direction du vent à chaque cellule + valeur numérique
- Affichage des couches nuageuses (bas/moyen/haut) et précipitations
- Colonne de l'heure sélectionnée mise en évidence
- Sélecteur d'altitude max (0–5000m par pas de 1000m)
- Sélecteur d'unité : km/h, m/s, kt

**Onglet 2 — Émagramme**
- Diagramme thermodynamique avec axe vertical en altitude, axe horizontal en température
- Lignes obliques isothermes pour la lecture
- Courbe de température (rouge) et point de rosée (bleu/vert)
- Trajectoire de parcelle (toggle on/off)
- Barbules de vent par niveau sur le bord droit
- Mise en évidence visuelle de la couche convective / couche limite

### Carte interactive (droite / onglet mobile)
- Bibliothèque : **MapLibre GL JS** (rendu vectoriel performant, tuiles OSM)
- Fond topographique avec noms de villes et sommets
- Zoom, déplacement, recentrage GPS
- Marqueur de position sélectionnée
- Affichage de la valeur météo au point cliqué (tooltip)
- Superposition de calques météo (couche semi-transparente colorée)
- Clic → mise à jour instantanée du windgram et émagramme

## Données Mock
- Génération de profils verticaux réalistes (vent, température, humidité, point de rosée) pour toute position cliquée
- Simulation sur 24h × 2 jours, altitudes 0–5000m par pas de 100m
- Données nuages et précipitations incluses
- Structure de données conçue pour être remplaçable par l'API Open-Meteo AROME

## Design
- Thème sombre optionnel, par défaut clair
- Palette sobre orientée données : fond neutre, couleurs vives réservées aux données météo
- Typographie lisible, contraste élevé
- Transitions fluides entre onglets
- Graphiques SVG/Canvas performants via Recharts ou D3 pour les diagrammes

## Stack technique
- React + TypeScript + Tailwind CSS
- MapLibre GL JS pour la carte
- Recharts ou D3.js pour windgram et émagramme
- Zustand ou React Context pour l'état partagé (position, heure, jour, calque, unité)
- Structure modulaire avec services séparés pour les données (prêt pour Open-Meteo)

## Étapes d'implémentation
1. Créer le store d'état global (position, heure, jour, calque, unité)
2. Créer le service de données mock avec profils verticaux réalistes
3. Construire le layout responsive (split desktop / onglets mobile)
4. Construire la barre de contrôle (timeline, sélecteur jour, calque)
5. Construire le windgram avec toutes ses fonctionnalités
6. Construire l'émagramme avec diagramme thermodynamique
7. Intégrer la carte MapLibre avec fond OSM et interactions
8. Synchroniser tous les composants via le store partagé
