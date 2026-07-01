"use client";

import "ol/ol.css";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

import Feature from "ol/Feature.js";
import type Geometry from "ol/geom/Geometry.js";
import LineString from "ol/geom/LineString.js";
import OlMap from "ol/Map.js";
import View from "ol/View.js";

import WebGLTileLayer from "ol/layer/WebGLTile.js";
import VectorLayer from "ol/layer/Vector.js";
import GeoTIFF from "ol/source/GeoTIFF.js";
import VectorSource from "ol/source/Vector.js";

import { transform, transformExtent } from "ol/proj.js";
import { register } from "ol/proj/proj4.js";
import { Stroke, Style } from "ol/style.js";

import proj4 from "proj4";

const ORTHO_THR_06_COG_URL =
    "https://imageries.datasud.fr/cog/orthothr/ORTHOTHR_RVB_0M05_COG_L93_D06_2024.tif";

const INITIAL_BBOX_EPSG_2154: [number, number, number, number] = [
    1032740,
    6284740,
    1033350,
    6285400,
];

const INITIAL_CENTER_EPSG_2154: [number, number] = [
    (INITIAL_BBOX_EPSG_2154[0] + INITIAL_BBOX_EPSG_2154[2]) / 2,
    (INITIAL_BBOX_EPSG_2154[1] + INITIAL_BBOX_EPSG_2154[3]) / 2,
];

const laneletStyle = new Style({
    stroke: new Stroke({
        color: "#ff6b00",
        width: 3,
    }),
});

type ProjectorInfo = {
    projectorType: string;
    verticalDatum?: string;
    mgrsGrid?: string;
};

function parseProjectorInfo(content: string): ProjectorInfo {
    const entries = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("#"))
        .map((line) => {
            const separatorIndex = line.indexOf(":");

            if (separatorIndex === -1) {
                return null;
            }

            const key = line.slice(0, separatorIndex).trim();
            const value = line.slice(separatorIndex + 1).trim();

            return [key, value] as const;
        })
        .filter((entry): entry is readonly [string, string] => entry !== null);

    const values = new Map(entries);
    const projectorType = values.get("projector_type");

    if (!projectorType) {
        throw new Error("Le fichier map_projector_info.yaml ne contient pas projector_type.");
    }

    return {
        projectorType,
        verticalDatum: values.get("vertical_datum"),
        mgrsGrid: values.get("mgrs_grid"),
    };
}

function parseLaneletSource(content: string): VectorSource<Feature<Geometry>> {
    const document = new DOMParser().parseFromString(content, "application/xml");

    if (document.getElementsByTagName("parsererror").length > 0) {
        throw new Error("Le fichier Lanelet .osm n'est pas un XML valide.");
    }

    const nodeCoordinates = new Map<string, [number, number]>();

    for (const nodeElement of Array.from(document.getElementsByTagName("node"))) {
        const id = nodeElement.getAttribute("id");
        const lat = Number.parseFloat(nodeElement.getAttribute("lat") ?? "");
        const lon = Number.parseFloat(nodeElement.getAttribute("lon") ?? "");

        if (!id || Number.isNaN(lat) || Number.isNaN(lon)) {
            continue;
        }

        nodeCoordinates.set(id, [lon, lat]);
    }

    const features: Feature<Geometry>[] = [];

    for (const wayElement of Array.from(document.getElementsByTagName("way"))) {
        const coordinates = Array.from(wayElement.getElementsByTagName("nd"))
            .map((nodeRefElement) => nodeRefElement.getAttribute("ref"))
            .flatMap((nodeRef) => {
                if (!nodeRef) {
                    return [];
                }

                const coordinate = nodeCoordinates.get(nodeRef);

                return coordinate ? [coordinate] : [];
            });

        if (coordinates.length < 2) {
            continue;
        }

        const geometry = new LineString(coordinates);
        geometry.transform("EPSG:4326", "EPSG:3857");

        features.push(new Feature({ geometry }));
    }

    if (features.length === 0) {
        throw new Error("Aucune géométrie exploitable n'a été trouvée dans le fichier Lanelet.");
    }

    return new VectorSource({
        features,
    });
}

proj4.defs(
    "EPSG:2154",
    "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 " +
        "+x_0=700000 +y_0=6600000 +ellps=GRS80 " +
        "+towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs",
);

register(proj4);

export default function MapEditor() {
    const mapElementRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<OlMap | null>(null);
    const laneletLayerRef = useRef<VectorLayer<VectorSource<Feature<Geometry>>> | null>(null);
    const laneletFileInputRef = useRef<HTMLInputElement | null>(null);
    const projectorFileInputRef = useRef<HTMLInputElement | null>(null);

    const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [pendingLaneletFile, setPendingLaneletFile] = useState<File | null>(null);
    const [pendingProjectorFile, setPendingProjectorFile] = useState<File | null>(null);
    const [isImportingLanelet, setIsImportingLanelet] = useState(false);
    const [status, setStatus] = useState("Initialisation...");

    useEffect(() => {
        if (!mapElementRef.current || mapRef.current) {
            return;
        }

        const orthoSource = new GeoTIFF({
            sources: [
                {
                    url: ORTHO_THR_06_COG_URL,
                },
            ],
            convertToRGB: true,
            interpolate: true,
        });

        const rasterLayer = new WebGLTileLayer({
            source: orthoSource,
        });

        const laneletLayer = new VectorLayer({
            source: new VectorSource(),
            style: laneletStyle,
            zIndex: 10,
        });

        const initialCenter = transform(
            INITIAL_CENTER_EPSG_2154,
            "EPSG:2154",
            "EPSG:3857",
        );

        const initialExtent = transformExtent(
            INITIAL_BBOX_EPSG_2154,
            "EPSG:2154",
            "EPSG:3857",
        );

        const map = new OlMap({
            target: mapElementRef.current,
            layers: [rasterLayer, laneletLayer],
            view: new View({
                center: initialCenter,
                zoom: 18,
            }),
        });

        mapRef.current = map;
        laneletLayerRef.current = laneletLayer;

        orthoSource
            .getView()
            .then(() => {
                requestAnimationFrame(() => {
                    map.getView().fit(initialExtent, {
                        padding: [40, 40, 40, 40],
                        maxZoom: 20,
                        duration: 0,
                    });
                });

                setStatus("Carte chargée.");
            })
            .catch((error: unknown) => {
                console.error(error);
                setStatus("Erreur de chargement de l’orthophoto.");
            });

        return () => {
            map.setTarget(undefined);
            mapRef.current = null;
            laneletLayerRef.current = null;
        };
    }, []);

    function openLaneletImportDialog(): void {
        setIsFileMenuOpen(false);
        setIsImportDialogOpen(true);
        setPendingLaneletFile(null);
        setPendingProjectorFile(null);
    }

    function closeLaneletImportDialog(): void {
        setIsImportDialogOpen(false);
        setPendingLaneletFile(null);
        setPendingProjectorFile(null);
    }

    function handleLaneletFileSelection(
        event: ChangeEvent<HTMLInputElement>,
    ): void {
        const laneletFile = event.target.files?.[0];

        if (!laneletFile) {
            return;
        }

        if (!/\.(osm|xml)$/i.test(laneletFile.name)) {
            setStatus("Sélectionnez un fichier Lanelet .osm ou .xml.");
            event.target.value = "";
            return;
        }

        setPendingLaneletFile(laneletFile);
        setStatus(`Fichier Lanelet sélectionné : ${laneletFile.name}.`);
        event.target.value = "";
    }

    function handleProjectorFileSelection(
        event: ChangeEvent<HTMLInputElement>,
    ): void {
        const projectorFile = event.target.files?.[0];

        if (!projectorFile) {
            return;
        }

        if (!/map_projector_info\.(yaml|yml)$/i.test(projectorFile.name)) {
            setStatus("Sélectionnez le fichier map_projector_info.yaml.");
            event.target.value = "";
            return;
        }

        setPendingProjectorFile(projectorFile);
        setStatus(`Fichier projector sélectionné : ${projectorFile.name}.`);
        event.target.value = "";
    }

    async function importPendingLaneletFiles(): Promise<void> {
        if (!pendingLaneletFile) {
            setStatus("Sélectionnez d'abord un fichier Lanelet .osm.");
            return;
        }

        if (!pendingProjectorFile) {
            setStatus("Sélectionnez le fichier map_projector_info.yaml.");
            return;
        }

        setIsImportingLanelet(true);

        try {
            const [laneletContent, projectorContent] = await Promise.all([
                pendingLaneletFile.text(),
                pendingProjectorFile.text(),
            ]);

            const projectorInfo = parseProjectorInfo(projectorContent);
            const laneletSource = parseLaneletSource(laneletContent);
            const laneletExtent = laneletSource.getExtent();

            laneletLayerRef.current?.setSource(laneletSource);

            if (mapRef.current && laneletExtent) {
                mapRef.current.getView().fit(laneletExtent, {
                    padding: [48, 48, 48, 48],
                    maxZoom: 20,
                    duration: 250,
                });
            }

            const projectorSummary = projectorInfo.mgrsGrid
                ? `${projectorInfo.projectorType}, ${projectorInfo.mgrsGrid}`
                : projectorInfo.projectorType;

            setStatus(
                `Lanelet chargé : ${laneletSource.getFeatures().length} géométries (${projectorSummary}).`,
            );

            closeLaneletImportDialog();
        } catch (error: unknown) {
            console.error(error);
            setStatus(
                error instanceof Error
                    ? error.message
                    : "Erreur de lecture des fichiers Lanelet.",
            );
        } finally {
            setIsImportingLanelet(false);
        }
    }

    return (
        <main className="map-editor">
            <header className="topbar">
                <div className="menu-root">
                    <button
                        className="menu-button"
                        type="button"
                        onClick={() => setIsFileMenuOpen((value) => !value)}
                    >
                        File
                    </button>

                    {isFileMenuOpen && (
                        <div className="menu-dropdown">
                            <button
                                type="button"
                                onClick={openLaneletImportDialog}
                            >
                                Import Lanelet (.osm + projector)
                            </button>
                        </div>
                    )}

                    <input
                        ref={laneletFileInputRef}
                        type="file"
                        accept=".osm,.xml"
                        className="hidden-file-input"
                        onChange={handleLaneletFileSelection}
                    />

                    <input
                        ref={projectorFileInputRef}
                        type="file"
                        accept=".yaml,.yml"
                        className="hidden-file-input"
                        onChange={handleProjectorFileSelection}
                    />
                </div>

                <div className="app-title">
                    Lanelet Editor
                </div>

                <div className="status">
                    {status}
                </div>
            </header>

            {isImportDialogOpen && (
                <div className="import-dialog-backdrop">
                    <section className="import-dialog" aria-modal="true" role="dialog">
                        <header className="import-dialog-header">
                            <h2>Import Lanelet2 Map</h2>
                        </header>

                        <div className="import-dialog-body">
                            <div className="import-file-block">
                                <div className="import-file-label">Lanelet map (.osm)</div>
                                <div className="import-file-picker-row">
                                    <button
                                        type="button"
                                        className="import-browse-button"
                                        onClick={() => laneletFileInputRef.current?.click()}
                                    >
                                        Browse...
                                    </button>
                                    <div className="import-file-name">
                                        {pendingLaneletFile?.name ?? "No file selected."}
                                    </div>
                                </div>
                            </div>

                            <label className="import-checkbox-row">
                                <input type="checkbox" checked readOnly />
                                <span>Focus camera to imported file</span>
                            </label>

                            <label className="import-checkbox-row import-checkbox-row-disabled">
                                <input type="checkbox" disabled />
                                <span>Import as read only</span>
                            </label>

                            <label className="import-checkbox-row">
                                <input type="checkbox" checked readOnly />
                                <span>Import map projector info</span>
                            </label>

                            <div className="import-file-block import-file-block-projector">
                                <div className="import-projector-caption">map_projector_info.yaml</div>
                                <div className="import-file-picker-row">
                                    <button
                                        type="button"
                                        className="import-browse-button"
                                        onClick={() => projectorFileInputRef.current?.click()}
                                    >
                                        Browse...
                                    </button>
                                    <div className="import-file-name">
                                        {pendingProjectorFile?.name ?? "No file selected."}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <footer className="import-dialog-footer">
                            <button
                                type="button"
                                className="import-cancel-button"
                                onClick={closeLaneletImportDialog}
                                disabled={isImportingLanelet}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="import-confirm-button"
                                onClick={importPendingLaneletFiles}
                                disabled={isImportingLanelet}
                            >
                                {isImportingLanelet ? "Importing..." : "Import"}
                            </button>
                        </footer>
                    </section>
                </div>
            )}

            <section ref={mapElementRef} className="map" />

            <div className="map-attribution">
                Fond orthophoto :{" "}
                <a
                    href="https://www.datasud.fr/explorer/fr/jeux-de-donnees/orthophotographie-tres-haute-resolution-du-departement-des-alpes-maritimes/info"
                    target="_blank"
                    rel="noreferrer"
                >
                    ORTHO THR 06
                </a>
                {", Région Sud / DataSud, Licence Ouverte 2.0"}
            </div>
        </main>
    );
}