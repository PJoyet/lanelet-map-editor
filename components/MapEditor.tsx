"use client";

import "ol/ol.css";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

import OlMap from "ol/Map.js";
import View from "ol/View.js";

import WebGLTileLayer from "ol/layer/WebGLTile.js";
import GeoTIFF from "ol/source/GeoTIFF.js";

import { transform, transformExtent } from "ol/proj.js";
import { register } from "ol/proj/proj4.js";

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
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
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
            layers: [rasterLayer],
            view: new View({
                center: initialCenter,
                zoom: 18,
            }),
        });

        mapRef.current = map;

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
        };
    }, []);

    function openLaneletImportDialog(): void {
        setIsFileMenuOpen(false);
        fileInputRef.current?.click();
    }

    async function handleLaneletFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        try {
            const content = await file.text();

            console.log("Lanelet file name:", file.name);
            console.log("Lanelet file content:", content);

            setStatus(`Fichier sélectionné : ${file.name}`);
        } catch (error: unknown) {
            console.error(error);
            setStatus("Erreur de lecture du fichier Lanelet.");
        } finally {
            event.target.value = "";
        }
    }

    return (
        <main className="map-editor">
            <header className="topbar">
                <div className="menu-root">
                    <button
                        className="menu-button"
                        onClick={() => setIsFileMenuOpen((value) => !value)}
                    >
                        File
                    </button>

                    {isFileMenuOpen && (
                        <div className="menu-dropdown">
                            <button onClick={openLaneletImportDialog}>
                                Import Lanelet (.osm)
                            </button>
                        </div>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".osm,.xml"
                        className="hidden-file-input"
                        onChange={handleLaneletFileChange}
                    />
                </div>

                <div className="app-title">
                    Lanelet Editor
                </div>

                <div className="status">
                    {status}
                </div>
            </header>

            <section ref={mapElementRef} className="map" />

            <div className="map-attribution">
                Fond orthophoto : ORTHO THR 06, Région Sud / DataSud, Licence Ouverte 2.0
            </div>
        </main>
    );
}