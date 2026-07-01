"use client";

import "ol/ol.css";

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ChangeEvent,
} from "react";

import Feature from "ol/Feature.js";
import type Geometry from "ol/geom/Geometry.js";
import OlMap from "ol/Map.js";
import View from "ol/View.js";

import WebGLTileLayer from "ol/layer/WebGLTile.js";
import VectorLayer from "ol/layer/Vector.js";
import GeoTIFF from "ol/source/GeoTIFF.js";
import VectorSource from "ol/source/Vector.js";

import { transform, transformExtent } from "ol/proj.js";
import { register } from "ol/proj/proj4.js";
import { Stroke, Style } from "ol/style.js";

import LaneletImportDialog from "@/components/lanelet/LaneletImportDialog";
import {
    LANELET_SESSION_STORAGE_KEY,
    exportImportSession,
    hasImportSession,
    parseLaneletSource,
    parseProjectorInfo,
    persistCurrentView,
    readImportSession,
    writeImportSession,
} from "@/components/lanelet/importSession";
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
    const [hasExportableSession, setHasExportableSession] = useState(false);
    const [status, setStatus] = useState("Initialisation...");

    const applyLaneletImport = useCallback((
        laneletContent: string,
        projectorContent: string,
        options?: {
            laneletFileName: string;
            projectorFileName: string;
            persistedViewCenter?: [number, number];
            persistedViewZoom?: number;
        },
    ): void => {
        const projectorInfo = parseProjectorInfo(projectorContent);
        const laneletSource = parseLaneletSource(laneletContent);
        const laneletExtent = laneletSource.getExtent();

        laneletLayerRef.current?.setSource(laneletSource);

        const projectorSummary = projectorInfo.mgrsGrid
            ? `${projectorInfo.projectorType}, ${projectorInfo.mgrsGrid}`
            : projectorInfo.projectorType;

        const nextStatus = `Lanelet chargé : ${laneletSource.getFeatures().length} géométries (${projectorSummary}).`;

        setStatus(nextStatus);

        if (mapRef.current) {
            if (options?.persistedViewCenter && options.persistedViewZoom !== undefined) {
                mapRef.current.getView().setCenter(options.persistedViewCenter);
                mapRef.current.getView().setZoom(options.persistedViewZoom);
            } else if (laneletExtent) {
                mapRef.current.getView().fit(laneletExtent, {
                    padding: [48, 48, 48, 48],
                    maxZoom: 20,
                    duration: 250,
                });
            }

            writeImportSession({
                laneletContent,
                laneletFileName: options?.laneletFileName ?? "lanelet.osm",
                projectorContent,
                projectorFileName: options?.projectorFileName ?? "map_projector_info.yaml",
                status: nextStatus,
                viewCenter: mapRef.current.getView().getCenter() as [number, number] | undefined,
                viewZoom: mapRef.current.getView().getZoom(),
            });
        }
    }, []);

    const handleExportLaneletSession = useCallback(() => {
        const importSession = readImportSession();

        if (!importSession) {
            setStatus("Aucune session Lanelet à exporter.");
            setHasExportableSession(false);
            return;
        }

        exportImportSession(importSession);
        setStatus("Session Lanelet exportée.");
    }, []);

    const closeFileMenu = useCallback(() => {
        setIsFileMenuOpen(false);
    }, []);

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
        setHasExportableSession(hasImportSession());

        const restoreImportedSession = () => {
            const importSession = readImportSession();

            if (!importSession) {
                return;
            }

            try {
                applyLaneletImport(importSession.laneletContent, importSession.projectorContent, {
                    laneletFileName: importSession.laneletFileName,
                    projectorFileName: importSession.projectorFileName,
                    persistedViewCenter: importSession.viewCenter,
                    persistedViewZoom: importSession.viewZoom,
                });
            } catch (error) {
                console.error(error);
                sessionStorage.removeItem(LANELET_SESSION_STORAGE_KEY);
            }
        };

        map.on("moveend", () => {
            const importSession = readImportSession();

            if (!importSession) {
                return;
            }

            persistCurrentView(importSession, map);
        });

        orthoSource
            .getView()
            .then(() => {
                requestAnimationFrame(() => {
                    map.getView().fit(initialExtent, {
                        padding: [40, 40, 40, 40],
                        maxZoom: 20,
                        duration: 0,
                    });

                    restoreImportedSession();
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
    }, [applyLaneletImport]);

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

            applyLaneletImport(laneletContent, projectorContent, {
                laneletFileName: pendingLaneletFile.name,
                projectorFileName: pendingProjectorFile.name,
            });

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
                        <div className="menu-dropdown menu-dropdown--grouped">
                            <div className="menu-section">
                                <div className="menu-section-title">IMPORT</div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        openLaneletImportDialog();
                                        closeFileMenu();
                                    }}
                                >
                                    Import Lanelet2 map
                                </button>
                            </div>

                            <div className="menu-section">
                                <div className="menu-section-title">EXPORT</div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleExportLaneletSession();
                                        closeFileMenu();
                                    }}
                                    disabled={!hasExportableSession}
                                >
                                    Export Lanelet2Maps
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="app-title">
                    Lanelet Editor
                </div>

                <div className="status">
                    {status}
                </div>
            </header>

            <LaneletImportDialog
                isOpen={isImportDialogOpen}
                laneletFileName={pendingLaneletFile?.name ?? null}
                projectorFileName={pendingProjectorFile?.name ?? null}
                isImporting={isImportingLanelet}
                canExport={hasExportableSession}
                laneletFileInputRef={laneletFileInputRef}
                projectorFileInputRef={projectorFileInputRef}
                onClose={closeLaneletImportDialog}
                onImport={importPendingLaneletFiles}
                onExport={handleExportLaneletSession}
                onLaneletFileSelection={handleLaneletFileSelection}
                onProjectorFileSelection={handleProjectorFileSelection}
            />

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