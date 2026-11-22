const { Modal } = require("obsidian");

function applyModalScrollLayout(modalEl, contentEl, viewportHeight) {
  const height = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 800;
  const modalHeight = Math.max(100, Math.floor(height * 0.92));
  const contentHeight = Math.max(60, modalHeight - 110);
  const apply = (el, rules) => {
    for (const [name, value] of Object.entries(rules)) el.style?.setProperty(name, value, "important");
  };
  // Keep the scroll fix in the runtime too: a main.js-only update can retain old styles.css.
  apply(modalEl, { display: "flex", "flex-direction": "column", "max-height": `${modalHeight}px`, "min-height": "0", overflow: "hidden" });
  apply(contentEl, { display: "block", position: "relative", flex: "1 1 auto", height: "auto", "min-height": "0", "max-height": `${contentHeight}px`, "overflow-x": "hidden", "overflow-y": "auto", "overscroll-behavior": "contain", "touch-action": "pan-y", "pointer-events": "auto" });
}

class CustomizationStudioModal extends Modal {
  constructor(app, settingsTab) {
    super(app);
    this.settingsTab = settingsTab;
  }

  onOpen() {
    this.setTitle("Customization Studio");
    this.modalEl.addClass("customization-studio-modal");
    this.contentEl.addClass("customization-studio-modal");
    this.contentEl.setAttribute("tabindex", "0");
    this.settingsTab.displayInto(this.contentEl, "ribbonModal");
    const win = this.contentEl.ownerDocument?.defaultView;
    this.resizeScrollLayout = () => applyModalScrollLayout(this.modalEl, this.contentEl, win?.visualViewport?.height || win?.innerHeight);
    this.resizeScrollLayout();
    win?.addEventListener("resize", this.resizeScrollLayout);
    win?.visualViewport?.addEventListener("resize", this.resizeScrollLayout);
    this.removeScrollResize = () => {
      win?.removeEventListener("resize", this.resizeScrollLayout);
      win?.visualViewport?.removeEventListener("resize", this.resizeScrollLayout);
    };
  }

  onClose() {
    this.removeScrollResize?.();
    this.removeScrollResize = null;
    this.settingsTab.releaseDisplayTarget(this.contentEl);
    this.contentEl.empty();
  }
}

module.exports = { CustomizationStudioModal, applyModalScrollLayout };
