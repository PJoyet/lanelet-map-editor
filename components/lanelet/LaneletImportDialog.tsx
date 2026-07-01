import type { ChangeEvent, RefObject } from "react";

type LaneletImportDialogProps = {
    isOpen: boolean;
    laneletFileName: string | null;
    projectorFileName: string | null;
    isImporting: boolean;
    canExport: boolean;
    laneletFileInputRef: RefObject<HTMLInputElement | null>;
    projectorFileInputRef: RefObject<HTMLInputElement | null>;
    onClose: () => void;
    onImport: () => void;
    onExport: () => void;
    onLaneletFileSelection: (event: ChangeEvent<HTMLInputElement>) => void;
    onProjectorFileSelection: (event: ChangeEvent<HTMLInputElement>) => void;
};

export default function LaneletImportDialog({
    isOpen,
    laneletFileName,
    projectorFileName,
    isImporting,
    canExport,
    laneletFileInputRef,
    projectorFileInputRef,
    onClose,
    onImport,
    onExport,
    onLaneletFileSelection,
    onProjectorFileSelection,
}: LaneletImportDialogProps) {
    if (!isOpen) {
        return null;
    }

    return (
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
                                {laneletFileName ?? "No file selected."}
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
                                {projectorFileName ?? "No file selected."}
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="import-dialog-footer">
                    <button
                        type="button"
                        className="import-export-button"
                        onClick={onExport}
                        disabled={!canExport}
                    >
                        Export
                    </button>
                    <button
                        type="button"
                        className="import-cancel-button"
                        onClick={onClose}
                        disabled={isImporting}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="import-confirm-button"
                        onClick={onImport}
                        disabled={isImporting}
                    >
                        {isImporting ? "Importing..." : "Import"}
                    </button>
                </footer>

                <input
                    ref={laneletFileInputRef}
                    type="file"
                    accept=".osm,.xml"
                    className="hidden-file-input"
                    onChange={onLaneletFileSelection}
                />

                <input
                    ref={projectorFileInputRef}
                    type="file"
                    accept=".yaml,.yml"
                    className="hidden-file-input"
                    onChange={onProjectorFileSelection}
                />
            </section>
        </div>
    );
}