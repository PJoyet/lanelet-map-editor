# Lanelet Map Editor

Prototype d'interface web pour l'affichage et l'édition future de cartes Lanelet2 sur fond orthophoto.

Le projet est actuellement centré sur une interface minimale :

- affichage d'une orthophoto COG DataSud avec OpenLayers ;
- centrage initial sur une BBox Lambert-93 / EPSG:2154 ;
- menu `File` ;
- sélection locale d'un fichier Lanelet `.osm` côté navigateur.

L'import Lanelet2 n'est pas encore parsé : le fichier sélectionné est uniquement lu côté navigateur et affiché dans la console.

## Stack

- Next.js
- React
- TypeScript
- OpenLayers
- Proj4js

## Requirements

- Node.js >= 20.9.0
- npm

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Puis ouvrir :

```text
http://localhost:3000
```

## Build

```bash
npm run build
```

## Orthophoto background

The orthophoto background currently used by the prototype is:

**ORTHO THR 06 : Orthophotographie très haute résolution du département des Alpes-Maritimes**, Région Sud / DataSud.

COG URL currently used by the application:

```text
https://imageries.datasud.fr/cog/orthothr/ORTHOTHR_RVB_0M05_COG_L93_D06_2024.tif
```

The application loads the COG directly in the browser through OpenLayers.

The GDAL `/vsicurl/...` syntax is not used in the frontend.

## Data attribution

License: **Licence Ouverte / Open Licence 2.0**.

Attribution displayed in the application:

> Fond orthophoto : ORTHO THR 06, Région Sud / DataSud, Licence Ouverte 2.0.

Dataset page:

```text
https://www.datasud.fr/explorer/fr/jeux-de-donnees/orthophotographie-tres-haute-resolution-du-departement-des-alpes-maritimes/info
```

DataSud open data information page:

```text
https://www.datasud.fr/portal/donnee
```

Important: before public production use, add the exact last update date from the DataSud dataset page, as required by Licence Ouverte / Open Licence 2.0.

## License

The source code of this project is licensed under the MIT License.

See [`LICENSE`](./LICENSE).

## Third-party notices

See [`NOTICE.md`](./NOTICE.md).
