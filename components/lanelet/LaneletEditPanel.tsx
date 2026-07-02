type LaneletEditPanelProps = {
    hasSelection: boolean;
    selectionLabel: string;
    onSelectLanelet: () => void;
    onSplitMerge: () => void;
    onEditTags: () => void;
};

export default function LaneletEditPanel({
    hasSelection,
    selectionLabel,
    onSelectLanelet,
    onSplitMerge,
    onEditTags,
}: LaneletEditPanelProps) {
    return (
        <div className="sidebar-card sidebar-card--editing">
            <div className="sidebar-kicker">Tools</div>
            <h3>Editing</h3>
            <p>
                Barre d’outils inspirée d’un espace de dessin pour sélectionner et modifier les Lanelet.
            </p>

            <div className="editing-toolbar">
                <button type="button" className="sidebar-action-button" onClick={onSelectLanelet}>
                    Select
                </button>
                <button
                    type="button"
                    className="sidebar-action-button sidebar-action-button--disabled"
                    onClick={onSplitMerge}
                    aria-disabled="true"
                >
                    Split
                </button>
                <button
                    type="button"
                    className="sidebar-action-button sidebar-action-button--disabled"
                    onClick={onEditTags}
                    aria-disabled="true"
                >
                    Tags
                </button>
            </div>

            <div className="editing-selection">
                <div className="editing-selection__label">Selection</div>
                <div className="editing-selection__value">
                    {hasSelection ? selectionLabel : "Aucune sélection active"}
                </div>
            </div>
        </div>
    );
}