const { BaseModuleController } = require("../base-controller");

function styles(settings) {
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
}`;
}

class BasesController extends BaseModuleController {
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
