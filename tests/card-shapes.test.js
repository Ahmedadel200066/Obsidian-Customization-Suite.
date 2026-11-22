require("./host-path-stub.cjs");
const test = require("node:test");
const assert = require("node:assert/strict");
const { CARD_SHAPES, cardShapeStyles } = require("../modules/bases/card-shapes");
const bases = require("../modules/bases");
const { ProfileManager } = require("../core/profile-manager");

test("nine validated shapes are opt-in and legacy Bases settings default to Standard", () => {
  assert.deepEqual(Object.keys(CARD_SHAPES), ["standard", "book", "poster", "circle", "spine", "polaroid", "trading-card", "disc", "ticket"]);
  assert.equal(bases.validateSettings({}).cardsShape, "standard");
  for (const shape of Object.keys(CARD_SHAPES)) assert.equal(bases.validateSettings({cardsShape: shape}).cardsShape, shape);
  assert.throws(() => bases.validateSettings({cardsShape: "injected\""}));
});

test("Standard emits no shape CSS; other shapes require a target and preserve metadata", () => {
  assert.equal(cardShapeStyles("standard"), "");
  assert.throws(() => cardShapeStyles("unknown"));
  assert.throws(() => cardShapeStyles("book", "bad\"] body"));
  for (const shape of Object.keys(CARD_SHAPES).slice(1)) {
    const css = cardShapeStyles(shape, "cs-view-1");
    assert.match(css, /data-cs-bases-shape-target="cs-view-1"/);
    assert.match(css, /pointer-events: none/);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /forced-colors/);
    assert.doesNotMatch(css, /\.bases-cards-property[^{}]*\{[^}]*display:\s*none/);
    assert.doesNotMatch(css, /https?:|@import|animation:.*infinite/);
  }
});

test("Spine has keyboard and touch alternatives, and circular artwork does not mask the card", () => {
  assert.match(cardShapeStyles("spine"), /:focus-within/);
  assert.match(cardShapeStyles("spine"), /pointer: coarse/);
  const css = cardShapeStyles("circle");
  assert.match(css, /\.bases-cards-cover \{ scale: 1; border-radius: 50%; clip-path: circle\(closest-side\)/);
  assert.doesNotMatch(css, /\.bases-cards-item \{[^}]*border-radius: 50%/);
});

test("shape choice round-trips without saving a pane target or rewriting existing palettes", () => {
  const settingsManager = { settings: {customProfiles: [], moduleEnabled: {}, activeProfileId: "minimal"} };
  const pm = new ProfileManager(settingsManager);pm.load();pm.createCustomProfile("Library");
  const before = JSON.stringify(pm.getActiveProfile().variables);
  pm.updateModuleSettings("bases", { cardsShape: "book" });
  const parsed = JSON.parse(pm.exportProfile(pm.getActiveProfile().id));
  assert.equal(parsed.modules.bases.cardsShape, "book");
  assert.equal(JSON.stringify(parsed.variables), before);
  assert.doesNotMatch(JSON.stringify(parsed), /shapeTarget|cs-view-/);
  const imported = pm.importProfile(JSON.stringify(parsed));
  assert.equal(imported.modules.bases.cardsShape, "book");
});

function makeController() {
  const doc = {createElement() { return {dataset:{}, parentNode:null, textContent:"", remove(){this.parentNode=null;}}; }};
  doc.head = {appendChild(el){el.parentNode=this;}};
  const group = () => ({});
  function root() {
    const attrs = new Map();
    return {ownerDocument:doc, group:group(), getAttribute:k=>attrs.get(k)??null,
      setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),
      querySelector(s){return s === ".bases-cards-group" ? this.group : null;}};
  }
  const first=root(),second=root();
  doc.body={querySelectorAll:()=>[first,second]};
  const profile={id:"custom",modules:{bases:bases.validateSettings({cardsShape:"book"})},moduleEnabled:{bases:true}};
  const plugin={manifest:{id:"customization-studio"},profileManager:{customProfiles:[profile]}, app:{workspace:{containerEl:{ownerDocument:doc,querySelectorAll:()=>[]}}}};
  const manager={getDocuments:()=>new Set([doc]),isTargetPluginEnabled:()=>true};
  return {controller:bases.createController(plugin,manager,bases),first,second,profile,plugin};
}

test("shapes do not activate before explicit selection and only selected root is marked", () => {
  const {controller:c,first,second,profile}=makeController();c.refresh(profile);
  assert.doesNotMatch(c.style.textContent,/data-cs-bases-shape=/);
  c.selectShapeTarget(c.getShapeViews()[0].id);
  assert.equal(first.getAttribute("data-cs-bases-shape"),"book");
  assert.equal(second.getAttribute("data-cs-bases-shape"),null);
  assert.match(c.style.textContent,/data-cs-bases-shape="book"/);
  c.selectShapeTarget("");assert.equal(first.getAttribute("data-cs-bases-shape"),null);
  assert.doesNotMatch(c.style.textContent,/data-cs-bases-shape=/);
});

test("shape targets fail closed on profile switch, layout replacement and disable", () => {
  for (const scenario of ["profile", "layout", "disable", "unload", "remove"]) {
    const {controller:c,first,profile}=makeController();c.refresh(profile);c.selectShapeTarget(c.getShapeViews()[0].id);
    if(scenario==="profile")c.refresh({...profile,id:"different"});
    if(scenario==="layout"){first.group={};c.onDomChanged();}
    if(scenario==="disable")c.refresh({...profile,moduleEnabled:{bases:false}});
    if(scenario==="unload")c.unload();
    if(scenario==="remove")c.onRootRemoved(first);
    assert.equal(c.shapeTarget,null,scenario);
    assert.equal(first.getAttribute("data-cs-bases-shape"),null,scenario);
    assert.equal(first.getAttribute("data-cs-bases-shape-target"),null,scenario);
  }
});

test("external markers are not overwritten or removed and built-ins are read-only", () => {
  const {controller:c,first,profile,plugin}=makeController();c.refresh(profile);
  first.setAttribute("data-cs-bases-shape","external");
  assert.throws(()=>c.selectShapeTarget(c.getShapeViews()[0].id),/external shape marker/);
  assert.equal(first.getAttribute("data-cs-bases-shape"),"external");
  first.removeAttribute("data-cs-bases-shape");plugin.profileManager.customProfiles=[];
  assert.throws(()=>c.selectShapeTarget(c.getShapeViews()[0].id),/custom profile/);
});


test("shape effects do not replace native absolute positioning or metadata geometry", () => {
  for (const shape of Object.keys(CARD_SHAPES).slice(1)) {
    const css=cardShapeStyles(shape);
    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [,selector,declarations]=match;
      if (/\.bases-cards-property/.test(selector)) {
        assert.doesNotMatch(declarations, /(?:position|inset|top|bottom|height|width|margin|display|visibility|opacity|transform|font)[a-z-]*\s*:/, shape);
      }
      if (/\.bases-cards-cover\s*$/.test(selector.trim())) {
        assert.doesNotMatch(declarations, /(?:^|[;\s])(?:position|height|margin[a-z-]*|aspect-ratio)\s*:/, shape);
      }
    }
  }
});


test("Book draws a portrait cover inside the native slot with a visible page block and safe fallback", () => {
  const css=cardShapeStyles("book");
  assert.match(css,/container-type: size/);
  assert.match(css,/background-image: inherit; background-size: contain/);
  assert.match(css,/perspective\(800px\) rotateY\(-12deg\)/);
  assert.match(css,/repeating-linear-gradient\(#ede4d1/);
  assert.match(css,/@supports not \(container-type: size\)/);
  assert.match(css,/background-size: contain !important/);
  assert.doesNotMatch(css,/contain:\s*(?:none|layout style)/);
});
