type LaneletInspectorPanelProps = {
    objectType: string;
    objectId: string;
    color: string;
    visible: boolean;
    locked: boolean;
    onColorChange: () => void;
    onToggleVisible: () => void;
    onToggleLocked: () => void;
};

export default function LaneletInspectorPanel({
    objectType,
    objectId,
    color,
    visible,
    locked,
    onColorChange,
    onToggleVisible,
    onToggleLocked,
}: LaneletInspectorPanelProps) {
    return (
        <div className="sidebar-card sidebar-card--inspector">
            <div className="inspector-tabs" role="tablist" aria-label="Inspector sections">
                <button type="button" className="inspector-tab inspector-tab--active">
                    Map
                </button>
                <button type="button" className="inspector-tab">
                    Object Search
                </button>
                <button type="button" className="inspector-tab">
                    Object List
                </button>
            </div>

            <section className="inspector-block inspector-block--tree">
                <div className="inspector-block__title">Lanelet2Maps</div>
                <div className="inspector-tree">
                    <div className="inspector-tree__root">lanelet2_map</div>
                    <div className="inspector-tree__item inspector-tree__item--active">All</div>
                    <div className="inspector-tree__item">Points (1789)</div>
                    <div className="inspector-tree__item">Linestrings (329)</div>
                    <div className="inspector-tree__item">Polygons (10)</div>
                    <div className="inspector-tree__item inspector-tree__item--selected">Lanelets (165)</div>
                    <div className="inspector-tree__item">Areas (0)</div>
                    <div className="inspector-tree__item">RegulatoryElements (22)</div>
                </div>
            </section>

            <section className="inspector-block inspector-block--objects">
                <div className="inspector-block__title">Raycasted Objects</div>
                <div className="inspector-chip">{objectType === "No selection" ? "Nothing selected" : `${objectType}:${objectId}`}</div>
            </section>

            <section className="inspector-block inspector-block--edit">
                <div className="inspector-block__title">Edit</div>

                <div className="inspector-edit-card">
                    <div className="inspector-edit-card__header">
                        <div>
                            <div className="inspector-edit-card__kicker">Object</div>
                            <div className="inspector-edit-card__title">{objectType} {objectId === "-" ? "" : objectId}</div>
                        </div>
                        <button type="button" className="inspector-trash-button" aria-label="Delete object">
                            Delete
                        </button>
                    </div>

                    <div className="inspector-field">
                        <span className="inspector-field__label">type</span>
                        <span className="inspector-field__value">{objectType.toLowerCase()}</span>
                    </div>
                    <div className="inspector-field">
                        <span className="inspector-field__label">subtype</span>
                        <span className="inspector-field__value">road</span>
                    </div>
                    <div className="inspector-field">
                        <span className="inspector-field__label">turn direction</span>
                        <span className="inspector-field__value">-</span>
                    </div>

                    <div className="inspector-section inspector-section--compact">
                        <div className="inspector-field__label">Color</div>
                        <button type="button" className="color-swatch-button" onClick={onColorChange}>
                            <span className="color-swatch" style={{ backgroundColor: color }} />
                            <span>{color}</span>
                            <span className="color-swatch-button__hint">Change</span>
                        </button>
                    </div>

                    <div className="inspector-section inspector-toggle-group">
                        <button type="button" className="sidebar-action-button" onClick={onToggleVisible}>
                            {visible ? "Visible" : "Hidden"}
                        </button>
                        <button type="button" className="sidebar-action-button" onClick={onToggleLocked}>
                            {locked ? "Locked" : "Unlocked"}
                        </button>
                    </div>
                </div>
            </section>

            <div className="inspector-note">
                Sélectionne un lanelet sur la carte pour remplir ce panneau.
            </div>
        </div>
    );
}