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
      cls: "cs-bmc-button",
      attr: { href: SUPPORT_URL, target: "_blank", rel: "noopener", "aria-label": "Buy me a coffee (opens Buy Me a Coffee)" }
    });
    const svgNs = "http://www.w3.org/2000/svg";
    const doc = coffee.ownerDocument;
    const svg = doc.createElementNS(svgNs, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.setAttribute("aria-hidden", "true");
    for (const [tag, attrs] of [
      ["path", { d: "M5 8h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z", fill: "#fff", stroke: "#0d0c22", "stroke-width": "1.8", "stroke-linejoin": "round" }],
      ["path", { d: "M17 9h1.5a2.5 2.5 0 0 1 0 5H16.6", fill: "none", stroke: "#0d0c22", "stroke-width": "1.8", "stroke-linecap": "round" }],
      ["path", { d: "M4 20.5h14", fill: "none", stroke: "#0d0c22", "stroke-width": "1.8", "stroke-linecap": "round" }],
      ["path", { d: "M9 3.5c-.8 1 .8 1.5 0 2.5M13 3.5c-.8 1 .8 1.5 0 2.5", fill: "none", stroke: "#0d0c22", "stroke-width": "1.5", "stroke-linecap": "round" }]
    ]) {
      const node = doc.createElementNS(svgNs, tag);
      for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
      svg.appendChild(node);
    }
    coffee.appendChild(svg);
    coffee.createEl("span", { text: "Buy me a coffee" });
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
