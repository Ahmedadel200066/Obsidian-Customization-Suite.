const { BaseModuleController } = require("../base-controller");
const { cardShapeStyles, SHAPE_ATTRIBUTE } = require("./card-shapes");

let nextShapeTargetToken = 0;

function styles(settings, controller) {
  const shadowAlpha = settings.cardsShadow / 100;
  const cardShadow = `0 3px 12px rgba(0, 0, 0, ${shadowAlpha * 0.25})`;
  const hoverShadow = `0 8px 24px rgba(0, 0, 0, ${shadowAlpha * 0.4})`;
  return `
.bases-view {
  --bases-table-text-size: ${settings.tableTextSize}px;
  --bases-table-row-height: ${settings.tableRowHeight}px;
  --bases-table-column-min-width: ${settings.tableMinColumnWidth};
  --bases-table-column-max-width: ${settings.tableMaxColumnWidth};
  --bases-table-container-border-width: ${settings.tableContainerBorderWidth}px;
  --bases-table-container-border-radius: ${settings.tableContainerRadius}px;
  --bases-table-header-background: ${settings.tableHeaderBackground};
  --bases-table-header-background-hover: ${settings.tableHeaderHover};
  --bases-table-header-color: ${settings.tableHeaderColor};
  --bases-table-header-weight: ${settings.tableHeaderWeight};
  --bases-table-header-icon-display: ${settings.tableHeaderIcons ? "flex" : "none"};
  --bases-table-border-color: ${settings.tableBorderColor};
  --bases-table-column-border-width: ${settings.tableColumnBorderWidth}px;
  --bases-table-row-border-width: ${settings.tableRowBorderWidth}px;
  --bases-table-row-background-hover: ${settings.tableRowHover};
  --bases-table-cell-radius-active: ${settings.tableActiveCellRadius}px;
  --bases-table-cell-background-active: ${settings.tableActiveCellBackground};
  --bases-table-cell-background-disabled: ${settings.tableDisabledCellBackground};
  --bases-cards-container-background: ${settings.cardsContainerBackground};
  --bases-cards-background: ${settings.cardsBackground};
  --bases-cards-cover-background: ${settings.cardsCoverBackground};
  --bases-cards-scale: ${settings.cardsScale};
  --bases-cards-group-padding: ${settings.cardsGroupPadding}px;
  --bases-cards-line-height: ${settings.cardsLineHeight}px;
  --bases-cards-border-width: ${settings.cardsBorderWidth}px;
  --bases-cards-shadow: ${cardShadow};
  --bases-cards-shadow-hover: ${hoverShadow};
}
`;
}

class BasesController extends BaseModuleController {
  constructor(...args) {
    super(...args);
    this.shapeTarget = null;
    this.shapeViews = new Map();
    this.nextShapeViewId = 0;
  }

  additionalStyles() {
    if(!this.shapeTarget?.written)return "";
    const options=this.plugin.presentation?.getShapeOptions(this.settings.cardsShape)||{};
    const keys=this.profile?.studio?.moduleKeys.bases||[];
    const scale=this.profile?.studio?.neutral&&!keys.includes("cardsScale")?this.shapeTarget.baseScale:this.settings.cardsScale;
    return cardShapeStyles(this.settings.cardsShape,this.shapeTarget.token,options,scale||1);
  }

  autoSelectShapeTarget() {
    if(this.shapeTarget)return;
    const workspace=this.plugin.app.workspace,leaf=workspace.getMostRecentLeaf?.()||workspace.activeLeaf;
    const views=[...this.shapeViews].filter(([,root])=>root.querySelector(".bases-cards-group")&&(!root.getClientRects||root.getClientRects().length));
    const selected=views.find(([,root])=>leaf?.view?.containerEl?.contains(root))||(views.length===1?views[0]:null);
    if(selected)this.selectShapeTarget(selected[0]);
    else this.plugin.notifyUser?.("Choose the cards pane under Temporary shape target so the change applies to the right pane.");
  }

  onRootsUpdated(roots) {
    const known = new Set(this.shapeViews.values());
    for (const [id, root] of this.shapeViews) if (!roots.has(root)) this.shapeViews.delete(id);
    for (const root of roots) {
      if (!known.has(root)) this.shapeViews.set(`view-${++this.nextShapeViewId}`, root);
    }
    this.syncShapeTarget();
  }

  getShapeViews() {
    return [...this.shapeViews].filter(([, root]) => root.querySelector(".bases-cards-group"))
      .map(([id, root], index) => {
        let name = `Open Bases cards pane ${index + 1}`;
        this.plugin.app.workspace.iterateAllLeaves?.((leaf) => {
          if (leaf.view?.containerEl?.contains(root)) {
            const displayName = leaf.view.getDisplayText?.();
            if (typeof displayName === "string" && displayName.trim()) name = displayName;
          }
        });
        return { id, name: `${name} (${index + 1})` };
      });
  }

  selectShapeTarget(id) {
    this.clearShapeTarget();
    if (!id) { this.updateStyle(); return; }
    const root = this.shapeViews.get(id);
    const group = root?.querySelector(".bases-cards-group");
    if (!root || !this.roots.has(root) || !group || !this.plugin.profileManager.customProfiles.some(p => p.id === this.profile.id)) {
      throw new Error("Choose an open Bases cards pane while a custom profile is active.");
    }
    if (root.getAttribute(SHAPE_ATTRIBUTE) !== null || root.getAttribute("data-cs-bases-shape-target") !== null) throw new Error("This view already has an external shape marker.");
    const baseScale=parseFloat(root.ownerDocument.defaultView?.getComputedStyle?.(root).getPropertyValue("--bases-cards-scale"))||1;
    this.shapeTarget = { id, root, group, baseScale, profileId: this.profile.id, written: null, token: `cs-view-${++nextShapeTargetToken}` };
    root.setAttribute("data-cs-bases-shape-target", this.shapeTarget.token);
    this.syncShapeTarget();
    this.updateStyle();
  }

  syncShapeTarget() {
    const target = this.shapeTarget;
    if (!target) return;
    if (target.profileId !== this.profile?.id || !this.roots.has(target.root) ||
        target.root.querySelector(".bases-cards-group") !== target.group) {
      this.clearShapeTarget();
      return;
    }
    if (target.root.getAttribute("data-cs-bases-shape-target") !== target.token) { this.clearShapeTarget(); return; }
    const existing = target.root.getAttribute(SHAPE_ATTRIBUTE);
    if (existing !== target.written) { this.clearShapeTarget(); return; }
    const options=this.plugin.presentation?.getShapeOptions(this.settings.cardsShape);
    if (this.settings.cardsShape === "standard"&&(!options||(options.size===100&&options.hover==="off"))) {
      target.root.removeAttribute(SHAPE_ATTRIBUTE);
      target.written = null;
    } else {
      target.written = this.settings.cardsShape;
      target.root.setAttribute(SHAPE_ATTRIBUTE, target.written);
    }
  }

  clearShapeTarget() {
    const target = this.shapeTarget;
    if (target?.written && target.root.getAttribute(SHAPE_ATTRIBUTE) === target.written) {
      target.root.removeAttribute(SHAPE_ATTRIBUTE);
    }
    if (target && target.root.getAttribute("data-cs-bases-shape-target") === target.token) {
      target.root.removeAttribute("data-cs-bases-shape-target");
    }
    this.shapeTarget = null;
  }

  onDomChanged() { this.syncShapeTarget(); }
  onRootRemoved(root) {
    if (this.shapeTarget?.root === root) this.clearShapeTarget();
    for (const [id, view] of this.shapeViews) if (view === root) this.shapeViews.delete(id);
  }
  deactivate() {
    this.clearShapeTarget();
    this.shapeViews.clear();
    super.deactivate();
  }

  refresh(profile) {
    super.refresh(profile);
    if (!this.settings.diagnostics) return;
    const detected = this.manager.isTargetPluginEnabled(this.module);
    const appliedVariables = this.style?.textContent
      ? [...this.style.textContent.matchAll(/(--bases-[a-z-]+)\s*:/g)].map((match) => match[1])
      : [];
    console.info("[Customization Studio] Bases diagnostics", {
      detected,
      enabled: profile.moduleEnabled[this.module.id] !== false,
      matchedViews: this.roots.size,
      stylesInjected: Boolean(this.style?.parentNode),
      appliedVariables: [...new Set(appliedVariables)]
    });
  }
}

module.exports = { BasesController, styles };
