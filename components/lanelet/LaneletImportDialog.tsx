import type { ChangeEvent, RefObject } from "react";

type LaneletImportDialogProps = {
    isOpen: boolean;
    laneletFileName: string | null;
    isImporting: boolean;
    laneletFileInputRef: RefObject<HTMLInputElement | null>;
    onClose: () => void;
    onImport: () => void;
    onLaneletFileSelection: (event: ChangeEvent<HTMLInputElement>) => void;
};

export default function LaneletImportDialog({
    isOpen,
    laneletFileName,
    isImporting,
    laneletFileInputRef,
    onClose,
    onImport,
    onLaneletFileSelection,
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
                    <div className="import-file-block import-file-block-inline">
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

                    <div className="import-preview-panel" aria-hidden="true" />

                    <div className="import-selection-actions">
                        <button type="button" className="import-mini-button">Select all</button>
                        <button type="button" className="import-mini-button">Deselect all</button>
                    </div>

                    <label className="import-checkbox-row">
                        <input type="checkbox" checked readOnly />
                        <span>Focus camera to imported file</span>
                    </label>

                    <label className="import-checkbox-row import-checkbox-row-disabled">
                        <input type="checkbox" disabled />
                        <span>Import as read only</span>
                    </label>

                </div>

                <footer className="import-dialog-footer">
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

            </section>
        </div>
    );
}