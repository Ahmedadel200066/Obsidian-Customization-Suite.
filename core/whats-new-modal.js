const { Modal } = require("obsidian");
const { SUPPORT_URL, WHATS_NEW } = require("./whats-new");

class WhatsNewModal extends Modal {
  constructor(app, { version, entry = WHATS_NEW[version], showOnUpdate = true, onToggle = () => {} }) {
    super(app);
    this.version = version;
    this.entry = entry;
    this.showOnUpdate = showOnUpdate;
    this.onToggle = onToggle;
  }

  onOpen() {
    this.setTitle(`What's new in Customization Studio ${this.version}`);
    this.modalEl.addClass("customization-studio-whatsnew-modal");
    const content = this.contentEl;
    content.addClass("customization-studio-whatsnew");
    if (!this.entry) {
      content.createEl("p", { text: "There are no release notes for this version." });
    } else {
      content.createEl("p", { cls: "cs-whatsnew-summary", text: this.entry.summary });
      const list = content.createEl("ul", { cls: "cs-whatsnew-list" });
      for (const item of this.entry.highlights) list.createEl("li", { text: item });
    }
    const support = content.createEl("div", { cls: "cs-whatsnew-support" });
    support.createEl("p", { text: "If Customization Studio is useful to you, you can support its development. It is optional, and every feature stays free." });
    const coffee = support.createEl("a", {
      cls: "cs-support-button",
      attr: { href: SUPPORT_URL, target: "_blank", rel: "noopener", "aria-label": "Support on Ko-fi (opens Ko-fi)" }
    });
    // Build the bundled official logo as SVG nodes, with no remote image request.
    const svgNs = "http://www.w3.org/2000/svg";
    const buildLogo = ([tag, attributes, text, children]) => {
      const node = coffee.ownerDocument.createElementNS(svgNs, tag);
      for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
      if (text) node.textContent = text;
      for (const child of children) node.appendChild(buildLogo(child));
      return node;
    };
    const svg = buildLogo(require("./kofi-logo"));
    svg.setAttribute("width", "76");
    svg.setAttribute("height", "30");
    svg.setAttribute("aria-hidden", "true");
    coffee.appendChild(svg);
    coffee.createEl("span", { text: "Support on Ko-fi" });
    const footer = content.createEl("div", { cls: "cs-whatsnew-footer" });
    const label = footer.createEl("label", { cls: "cs-whatsnew-optout" });
    const box = label.createEl("input", { attr: { type: "checkbox" } });
    box.checked = !this.showOnUpdate;
    box.addEventListener("change", () => this.onToggle(!box.checked));
    label.createEl("span", { text: " Don't show this after updates" });
    const close = footer.createEl("button", { cls: "mod-cta", text: "Close" });
    close.addEventListener("click", () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }
}

module.exports = { WhatsNewModal };
