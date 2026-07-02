import Feature from "ol/Feature.js";
import type Geometry from "ol/geom/Geometry.js";
import Polygon from "ol/geom/Polygon.js";
import LineString from "ol/geom/LineString.js";
import type OlMap from "ol/Map.js";
import VectorSource from "ol/source/Vector.js";

export const LANELET_SESSION_STORAGE_KEY = "lanelet-editor.import-session";

let cachedSessionRaw: string | null | undefined;
let cachedSessionValue: LaneletImportSession | null | undefined;

export type LaneletImportSession = {
    laneletContent: string;
    laneletFileName: string;
    status: string;
    viewCenter?: [number, number];
    viewZoom?: number;
};

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
        const wayId = wayElement.getAttribute("id") ?? undefined;
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

        const feature = new Feature({ geometry });

        if (wayId) {
            feature.setId(wayId);
        }

        features.push(feature);
    }

    if (features.length === 0) {
        throw new Error("Aucune géométrie exploitable n'a été trouvée dans le fichier Lanelet.");
    }

    return new VectorSource({
        features,
    });
}

export function parseLaneletAreaSource(content: string): VectorSource<Feature<Geometry>> {
    const document = new DOMParser().parseFromString(content, "application/xml");

    if (document.getElementsByTagName("parsererror").length > 0) {
        throw new Error("Le fichier Lanelet .osm n'est pas un XML valide.");
    }

    const nodeCoordinates = new Map<string, [number, number]>();
    const wayCoordinates = new Map<string, [number, number][]>();

    for (const nodeElement of Array.from(document.getElementsByTagName("node"))) {
        const id = nodeElement.getAttribute("id");
        const lat = Number.parseFloat(nodeElement.getAttribute("lat") ?? "");
        const lon = Number.parseFloat(nodeElement.getAttribute("lon") ?? "");

        if (!id || Number.isNaN(lat) || Number.isNaN(lon)) {
            continue;
        }

        nodeCoordinates.set(id, [lon, lat]);
    }

    for (const wayElement of Array.from(document.getElementsByTagName("way"))) {
        const wayId = wayElement.getAttribute("id");
        const coordinates = Array.from(wayElement.getElementsByTagName("nd"))
            .map((nodeRefElement) => nodeRefElement.getAttribute("ref"))
            .flatMap((nodeRef) => {
                if (!nodeRef) {
                    return [];
                }

                const coordinate = nodeCoordinates.get(nodeRef);

                return coordinate ? [coordinate] : [];
            });

        if (wayId && coordinates.length >= 2) {
            wayCoordinates.set(wayId, coordinates);
        }
    }

    const features: Feature<Geometry>[] = [];

    const isLaneletRelation = (relationElement: Element): boolean => {
        const tags = Array.from(relationElement.getElementsByTagName("tag"));

        return tags.some((tagElement) => {
            const key = tagElement.getAttribute("k");
            const value = tagElement.getAttribute("v");

            return (key === "type" && value === "lanelet") || (key === "subtype" && value === "road");
        });
    };

    const getRelationMemberRef = (relationElement: Element, roles: string[]): string | undefined => {
        for (const memberElement of Array.from(relationElement.getElementsByTagName("member"))) {
            const role = memberElement.getAttribute("role") ?? "";

            if (roles.includes(role)) {
                return memberElement.getAttribute("ref") ?? undefined;
            }
        }

        return undefined;
    };

    for (const relationElement of Array.from(document.getElementsByTagName("relation"))) {
        if (!isLaneletRelation(relationElement)) {
            continue;
        }

        const leftWayId = getRelationMemberRef(relationElement, ["left", "left_bound", "outer_left"]);
        const rightWayId = getRelationMemberRef(relationElement, ["right", "right_bound", "outer_right"]);

        const leftCoordinates = leftWayId ? wayCoordinates.get(leftWayId) : undefined;
        const rightCoordinates = rightWayId ? wayCoordinates.get(rightWayId) : undefined;

        if (!leftCoordinates || !rightCoordinates || leftCoordinates.length < 2 || rightCoordinates.length < 2) {
            continue;
        }

        const leftRing = [...leftCoordinates];
        const rightRing = [...rightCoordinates].reverse();

        if (leftRing.length > 0 && rightRing.length > 0) {
            const firstLeft = leftRing[0];
            const lastLeft = leftRing[leftRing.length - 1];
            const firstRight = rightRing[0];
            const lastRight = rightRing[rightRing.length - 1];

            if (lastLeft[0] !== firstRight[0] || lastLeft[1] !== firstRight[1]) {
                leftRing.push(firstRight);
            }

            if (lastRight[0] !== firstLeft[0] || lastRight[1] !== firstLeft[1]) {
                rightRing.push(firstLeft);
            }
        }

        const polygonRing = [...leftRing, ...rightRing];

        if (polygonRing.length < 4) {
            continue;
        }

        const polygon = new Polygon([polygonRing]);
        polygon.transform("EPSG:4326", "EPSG:3857");

        const feature = new Feature({ geometry: polygon });
        const relationId = relationElement.getAttribute("id");

        if (relationId) {
            feature.setId(`lanelet:${relationId}`);
        }

        features.push(feature);
    }

    return new VectorSource({
        features,
    });
}

export function readImportSession(): LaneletImportSession | null {
    if (typeof window === "undefined") {
        return null;
    }

    const rawSession = sessionStorage.getItem(LANELET_SESSION_STORAGE_KEY);

    if (rawSession === cachedSessionRaw && cachedSessionValue !== undefined) {
        return cachedSessionValue;
    }

    if (!rawSession) {
        cachedSessionRaw = rawSession;
        cachedSessionValue = null;
        return null;
    }

    try {
        const parsedSession = JSON.parse(rawSession) as LaneletImportSession;
        cachedSessionRaw = rawSession;
        cachedSessionValue = parsedSession;
        return parsedSession;
    } catch {
        sessionStorage.removeItem(LANELET_SESSION_STORAGE_KEY);
        cachedSessionRaw = null;
        cachedSessionValue = null;
        return null;
    }
}

export function writeImportSession(session: LaneletImportSession): void {
    if (typeof window === "undefined") {
        return;
    }

    const rawSession = JSON.stringify(session);
    sessionStorage.setItem(LANELET_SESSION_STORAGE_KEY, rawSession);
    cachedSessionRaw = rawSession;
    cachedSessionValue = session;
    window.dispatchEvent(new Event("lanelet-session-change"));
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
    if (typeof window === "undefined") {
        return false;
    }

    return readImportSession() !== null;
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
}