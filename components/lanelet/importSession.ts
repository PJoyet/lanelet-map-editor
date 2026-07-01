import Feature from "ol/Feature.js";
import type Geometry from "ol/geom/Geometry.js";
import LineString from "ol/geom/LineString.js";
import type OlMap from "ol/Map.js";
import VectorSource from "ol/source/Vector.js";

export const LANELET_SESSION_STORAGE_KEY = "lanelet-editor.import-session";

export type LaneletImportSession = {
    laneletContent: string;
    laneletFileName: string;
    projectorContent: string;
    projectorFileName: string;
    status: string;
    viewCenter?: [number, number];
    viewZoom?: number;
};

export type ProjectorInfo = {
    projectorType: string;
    verticalDatum?: string;
    mgrsGrid?: string;
};

export function parseProjectorInfo(content: string): ProjectorInfo {
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

export function parseLaneletSource(content: string): VectorSource<Feature<Geometry>> {
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

export function readImportSession(): LaneletImportSession | null {
    const rawSession = sessionStorage.getItem(LANELET_SESSION_STORAGE_KEY);

    if (!rawSession) {
        return null;
    }

    try {
        return JSON.parse(rawSession) as LaneletImportSession;
    } catch {
        sessionStorage.removeItem(LANELET_SESSION_STORAGE_KEY);
        return null;
    }
}

export function writeImportSession(session: LaneletImportSession): void {
    sessionStorage.setItem(LANELET_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function persistCurrentView(session: LaneletImportSession, map: OlMap): void {
    const view = map.getView();
    const center = view.getCenter();
    const zoom = view.getZoom();

    if (!center || zoom === undefined) {
        return;
    }

    writeImportSession({
        ...session,
        viewCenter: [center[0], center[1]],
        viewZoom: zoom,
    });
}

export function hasImportSession(): boolean {
    return sessionStorage.getItem(LANELET_SESSION_STORAGE_KEY) !== null;
}

function downloadTextFile(fileName: string, content: string): void {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = "none";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

export function exportImportSession(session: LaneletImportSession): void {
    downloadTextFile(session.laneletFileName, session.laneletContent);
    downloadTextFile(session.projectorFileName, session.projectorContent);
}