const { Modal } = require("obsidian");

class CustomizationStudioModal extends Modal {
  constructor(app, settingsTab) {
    super(app);
    this.settingsTab = settingsTab;
  }

  onOpen() {
    this.setTitle("Customization Studio");
    this.modalEl.addClass("customization-studio-modal");
    this.contentEl.addClass("customization-studio-modal");
    this.settingsTab.displayInto(this.contentEl, "ribbonModal");
  }

  onClose() {
    this.settingsTab.releaseDisplayTarget(this.contentEl);
    this.contentEl.empty();
  }
}

module.exports = { CustomizationStudioModal };
