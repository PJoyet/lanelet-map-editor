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
import { Fill, Stroke, Style } from "ol/style.js";

import LaneletImportDialog from "@/components/lanelet/LaneletImportDialog";
import { parseLaneletAreaSource, parseLaneletSource } from "@/components/lanelet/importSession";
import {
    LANELET_SESSION_STORAGE_KEY,
    exportImportSession,
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

const laneletAreaStyle = new Style({
    fill: new Fill({
        color: "rgba(0, 153, 255, 0.03)",
    }),
    stroke: new Stroke({
        color: "rgba(0, 153, 255, 0.25)",
        width: 1,
    }),
});

proj4.defs(
    "EPSG:2154",
    "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 " +
        "+x_0=700000 +y_0=6600000 +ellps=GRS80 " +
        "+towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs",
);

proj4.defs(
    "EPSG:3857",
    "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 " +
        "+x_0=0.0 +y_0=0.0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +type=crs",
);

register(proj4);

const MAP_INFO = {
    source: "ORTHO THR 06",
    crs: "EPSG:2154 / EPSG:3857",
    zoom: 18,
    label: "Carte",
};

const TOOL_ITEMS = [
    { label: "Sélection", icon: "◌" },
    { label: "Navigation", icon: "↕" },
    { label: "Dessin", icon: "✦" },
    { label: "Mesure", icon: "⌁" },
    { label: "Calques", icon: "▦" },
];
export default function MapEditor() {
    const mapElementRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<OlMap | null>(null);
    const laneletLayerRef = useRef<VectorLayer<VectorSource<Feature<Geometry>>> | null>(null);
    const laneletAreaLayerRef = useRef<VectorLayer<VectorSource<Feature<Geometry>>> | null>(null);
    const laneletFileInputRef = useRef<HTMLInputElement | null>(null);

    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [pendingLaneletFile, setPendingLaneletFile] = useState<File | null>(null);
    const [isImportingLanelet, setIsImportingLanelet] = useState(false);

    const applyLaneletImport = useCallback((
        laneletContent: string,
        options?: {
            laneletFileName: string;
            persistedViewCenter?: [number, number];
            persistedViewZoom?: number;
        },
    ): void => {
        const laneletSource = parseLaneletSource(laneletContent);
        const laneletAreaSource = parseLaneletAreaSource(laneletContent);
        const laneletExtent = laneletSource.getExtent();

        laneletLayerRef.current?.setSource(laneletSource);
        laneletAreaLayerRef.current?.setSource(laneletAreaSource);


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
                status: `Lanelet chargé : ${laneletSource.getFeatures().length} géométries.`,
                viewCenter: mapRef.current.getView().getCenter() as [number, number] | undefined,
                viewZoom: mapRef.current.getView().getZoom(),
            });
        }
    }, []);

    const handleExportLaneletSession = useCallback(() => {
        const importSession = readImportSession();

        if (!importSession) {
            return;
        }

        exportImportSession(importSession);
    }, []);

    const openLaneletImportDialog = useCallback(() => {
        setIsImportDialogOpen(true);
        setPendingLaneletFile(null);
    }, []);

    const closeLaneletImportDialog = useCallback(() => {
        setIsImportDialogOpen(false);
        setPendingLaneletFile(null);
    }, []);

    const handleLaneletFileSelection = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const laneletFile = event.target.files?.[0];

        if (!laneletFile) {
            return;
        }

        setPendingLaneletFile(laneletFile);
        event.target.value = "";
    }, []);

    const importPendingLaneletFiles = useCallback(async () => {
        if (!pendingLaneletFile) {
            return;
        }

        setIsImportingLanelet(true);

        try {
            const laneletContent = await pendingLaneletFile.text();

            applyLaneletImport(laneletContent, {
                laneletFileName: pendingLaneletFile.name,
            });

            closeLaneletImportDialog();
        } catch (error: unknown) {
            console.error(error);
        } finally {
            setIsImportingLanelet(false);
        }
    }, [applyLaneletImport, closeLaneletImportDialog, pendingLaneletFile]);

    useEffect(() => {
        if (!mapElementRef.current || mapRef.current) {
            return;
        }

        const orthoSource = new GeoTIFF({
            sources: [{ url: ORTHO_THR_06_COG_URL }],
            convertToRGB: true,
            interpolate: true,
        });

        const rasterLayer = new WebGLTileLayer({ source: orthoSource });

        const laneletLayer = new VectorLayer({
            source: new VectorSource(),
            style: laneletStyle,
            zIndex: 10,
        });

        const laneletAreaLayer = new VectorLayer({
            source: new VectorSource(),
            style: laneletAreaStyle,
            zIndex: 9,
            opacity: 0.25,
        });

        const initialCenter = transform(INITIAL_CENTER_EPSG_2154, "EPSG:2154", "EPSG:3857");
        const initialExtent = transformExtent(INITIAL_BBOX_EPSG_2154, "EPSG:2154", "EPSG:3857");

        const map = new OlMap({
            target: mapElementRef.current,
            layers: [rasterLayer, laneletAreaLayer, laneletLayer],
            view: new View({
                center: initialCenter,
                zoom: 18,
            }),
        });

        mapRef.current = map;
        laneletLayerRef.current = laneletLayer;
        laneletAreaLayerRef.current = laneletAreaLayer;

        const restoreImportedSession = () => {
            const importSession = readImportSession();

            if (!importSession) {
                return;
            }

            try {
                applyLaneletImport(importSession.laneletContent, {
                    laneletFileName: importSession.laneletFileName,
                    persistedViewCenter: importSession.viewCenter,
                    persistedViewZoom: importSession.viewZoom,
                });
            } catch (error) {
                console.error(error);
                sessionStorage.removeItem(LANELET_SESSION_STORAGE_KEY);
            }
        };

        restoreImportedSession();

        map.on("moveend", () => {
            const importSession = readImportSession();

            if (!importSession) {
                return;
            }

            persistCurrentView(importSession, map);
        });

        const resizeObserver = new ResizeObserver(() => {
            map.updateSize();
        });

        resizeObserver.observe(mapElementRef.current);

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
            })
            .catch((error: unknown) => {
                console.error(error);
            });

        return () => {
            resizeObserver.disconnect();
            map.setTarget(undefined);
            mapRef.current = null;
            laneletLayerRef.current = null;
            laneletAreaLayerRef.current = null;
        };
    }, []);

    return (
        <main className="map-editor">
            <header className="map-editor__topbar" aria-label="Barre de navigation">
                <div className="topbar-actions">
                    <button type="button" className="topbar-button topbar-button--primary" onClick={openLaneletImportDialog}>
                        Import Lanelet
                    </button>
                    <button type="button" className="topbar-button" onClick={handleExportLaneletSession}>
                        Export Lanelet
                    </button>
                </div>
            </header>

            <aside className="map-editor__rail map-editor__rail--left" aria-label="Outils">
                <div />
            </aside>

            <aside className="map-editor__rail map-editor__rail--right" aria-label="Navigation et paramètres">
                <div />
            </aside>
            <div className="map-editor__stage">
                <div className="map-editor__stage-frame">
                    <section ref={mapElementRef} className="map" aria-label="Carte Lanelet" />
                </div>
            </div>

            <LaneletImportDialog
                isOpen={isImportDialogOpen}
                laneletFileName={pendingLaneletFile?.name ?? null}
                isImporting={isImportingLanelet}
                laneletFileInputRef={laneletFileInputRef}
                onClose={closeLaneletImportDialog}
                onImport={importPendingLaneletFiles}
                onLaneletFileSelection={handleLaneletFileSelection}
            />

            <footer className="map-footer" aria-label="Informations de la carte">
                <span className="map-footer__attribution">
                    Fond orthophoto : {" "}
                    <a
                        href="https://www.datasud.fr/explorer/fr/jeux-de-donnees/orthophotographie-tres-haute-resolution-du-departement-des-alpes-maritimes/info"
                        target="_blank"
                        rel="noreferrer"
                    >
                        ORTHO THR 06
                    </a>
                    {", Région Sud / DataSud, Licence Ouverte 2.0"}
                </span>
            </footer>
        </main>
    );
}