const { validateShapeOptions } = require("./shape-options");
const CARD_SHAPES = Object.freeze({
  standard: "Standard", book: "Book", poster: "Poster", circle: "Circle",
  spine: "Spine", polaroid: "Polaroid", "trading-card": "Trading card", disc: "Disc", ticket: "Ticket"
});
const SHAPE_ATTRIBUTE = "data-cs-bases-shape";

// These are presentation-only selectors. No note, cover URL, or property is rewritten.
// Standard emits nothing; non-standard shapes require an explicitly targeted root.
// Bases virtualizes cards with inline sizes/top offsets. Keep its absolute cover
// and property layout untouched; normal-flow positioning pushes text outside
// the native card's strict paint containment.
function cardShapeStyles(shape, targetToken = "preview", inputOptions = {}, cardsScale = 1) {
  const options=validateShapeOptions(shape,inputOptions);
  if (shape === "standard"&&options.size===100&&options.hover==="off") return "";
  if (!Object.hasOwn(CARD_SHAPES, shape)) throw new Error("Unknown Bases card shape.");
  if (!/^cs-view-[0-9]+$|^preview$/.test(targetToken)) throw new Error("Invalid shape target token.");
  const root = `.bases-view[data-cs-bases-shape-target="${targetToken}"][${SHAPE_ATTRIBUTE}="${shape}"]`;
  const card = `${root} .bases-cards-item`;
  const cover = `${card} .bases-cards-cover`;
  const effects = {
    standard: "",
    book: `${cover} {
      container-type: size;
      --cs-book-width: min(90cqw, 56cqh);
      --cs-book-height: min(135cqw, 84cqh);
      --cs-book-shadow: #18382b30;
      background-size: 0 0 !important;
      background-color: transparent;
    }
    .theme-dark ${cover} { --cs-book-shadow: #0007; }
    ${cover}::before, ${cover} img {
      width: var(--cs-book-width); height: var(--cs-book-height);
      top: 50%; left: 50%;
      transform: translate(-50%, -50%) perspective(800px) rotateY(-${options.angle||0}deg);
      border-radius: 2px 5px 5px 2px;
    }
    ${cover} img { position: absolute; object-fit: contain; z-index: 0; }
    ${cover}::before {
      background-image: inherit; background-size: contain; background-position: center; background-repeat: no-repeat;
      z-index: 1;
      box-shadow: 8px 11px 12px var(--cs-book-shadow), inset 0 0 0 1px #0003,
        inset 3px 0 1px #ffffff35, inset 8px 0 4px -4px #0009;
    }
    ${cover}::after {
      top: calc((100% - var(--cs-book-height)) / 2 + 3px);
      left: calc((100% + var(--cs-book-width)) / 2 - 2px);
      height: calc(var(--cs-book-height) - 5px); width: ${options.pages}px;
      ${options.pages===0?"display: none;":""}
      transform: perspective(800px) rotateY(30deg); transform-origin: left;
      border: 1px solid #b9ad94; border-left: 0; z-index: 0;
      background: repeating-linear-gradient(#ede4d1 0 ${options.detail/2}px, #c9bfa8 ${options.detail/2}px ${options.detail}px);
      box-shadow: 2px 2px 1px #4b3e2e40;
    }`,
    poster: `${cover} { border: ${options.frame}px solid #faf8ef; outline: 1px solid #7775;
      box-shadow: 0 5px 12px rgba(0,0,0,${options.shadow/200}); border-radius: 0; }`,
    circle: `${cover} { scale: ${options.diameter/100}; border-radius: 50%; clip-path: circle(closest-side); overflow: hidden;
      background-size: cover !important; background-position: center ${options.crop}% !important; border: 3px solid var(--background-secondary);
      box-shadow: 0 3px 10px #0003; }
    ${cover} img { object-fit: cover; object-position: center ${options.crop}%; border-radius: 50%; }`,
    spine: `${card} { perspective: 850px; }
    ${cover} { transform: scale(.8) rotateY(-${options.angle}deg); transform-origin: 20% center;
      border-radius: 2px 5px 5px 2px; box-shadow: 7px 5px 9px #0004;
      transition: transform 180ms ease; }
    ${cover}::before { inset: 0; background: linear-gradient(90deg, #0006, #fff4 8%, transparent 18%); }
    ${options.reveal?`${card}:is(:hover, :focus-within) .bases-cards-cover { transform: none; }`:""}
    ${cover}:dir(rtl) { transform: scale(.8) rotateY(${options.angle}deg); transform-origin: 80% center; }
    ${options.reveal?`${card}:dir(rtl):is(:hover, :focus-within) .bases-cards-cover { transform: none; }`:""}
    @media (hover: none), (pointer: coarse) { ${cover}, ${cover}:dir(rtl) { transform: none; } }`,
    polaroid: `${cover} { border: 8px solid #fffdf7; border-block-end-width: ${options.bottom}px;
      border-radius: 1px; transform: rotate(${options.tilt}deg); box-shadow: 0 4px 10px #0003; }
    ${cover}:dir(rtl) { transform: rotate(${-options.tilt}deg); }
`,
    "trading-card": `${cover} { border: ${options.frame}px solid #bca269; border-radius: 9px;
      outline: 1px solid #67542b; box-shadow: 0 3px 10px #0004; }
    ${cover}::before { inset: -4px; border-radius: 7px; border: 1px solid #fff9;
      background: linear-gradient(125deg, transparent 22%, rgba(255,255,255,${options.sheen/100}) 33%, transparent 44%, transparent 65%, #8ad3dd33 78%, transparent); }`,
    disc: `${card} { isolation: isolate; }
    ${cover} { isolation: auto; container-type: size; width: 82%;
      border: 1px solid #7775; border-radius: 1px; box-shadow: 0 3px 8px #0004; }
    ${cover}::after { width: min(${options.diameter}cqw, ${options.diameter}cqh); height: min(${options.diameter}cqw, ${options.diameter}cqh); inset-inline-start: ${options.protrusion}%; top: 4%;
      border-radius: 50%; z-index: -1;
      background: radial-gradient(circle, var(--background-primary) 0 4%, #d1b685 4% 16%, #27272b 16% 18%, transparent 18%),
        repeating-radial-gradient(circle, #161619 0 2px, #34343b 2px 3px, #17171b 3px 5px);
      box-shadow: 2px 3px 7px #0004; }
    ${cover} img { border-radius: 0; }`,
    ticket: `${cover} { border-block: 3px solid var(--background-modifier-border);
      border-inline: 2px ${options.perforation?"dashed":"solid"} var(--text-muted); border-radius: 9px; }
    ${cover}::before, ${cover}::after { width: ${options.notch*2}px; height: ${options.notch*2}px; top: calc(66% - ${options.notch}px);
      border-radius: 50%; background: var(--background-primary); }
    ${cover}::before { inset-inline-start: -${options.notch+2}px; }
    ${cover}::after { inset-inline-end: -${options.notch+2}px; }`
  };
  const bookFallback = shape === "book" ? `${cover} { background-size: contain !important; }
    ${cover}::before, ${cover}::after { display: none; }
    ${cover} img { width: 100%; height: 100%; top: 0; left: 0; transform: none; object-fit: contain; }` : "";
  const motionName=`cs-${targetToken}-${shape}-${options.hover}`;
  const animations={flip:`@keyframes ${motionName}{from{rotate:y 0deg}to{rotate:y 360deg}}`,wiggle:`@keyframes ${motionName}{0%,100%{rotate:0deg}25%{rotate:2deg}75%{rotate:-2deg}}`,lift:""};
  let hover="";
  if(options.hover!=="off"){
    const effect=options.hover==="glow"?"filter: drop-shadow(0 0 7px var(--interactive-accent));":options.hover==="lift"?"translate: 0 -4px;":`animation: ${motionName} ${options.hover==="flip"?"650":"360"}ms ease 1;`;
    hover=`${animations[options.hover]||""}@media(hover:hover) and (pointer:fine){${card}:is(:hover,:focus-within) .bases-cards-cover{${effect}}}`;
  }
  const sizing=options.size===100?"":`${root}{--bases-cards-scale:${cardsScale*options.size/100};}`;
  if(shape==="standard")return `${sizing}${hover}@media(prefers-reduced-motion:reduce){${cover}{animation:none!important;translate:none!important;rotate:none!important;}}`;
  return `${sizing}${card} { overflow: visible; }
${cover} { box-sizing: border-box; isolation: isolate; overflow: visible; background-size: contain;
  background-position: center; background-repeat: no-repeat;
  background-color: var(--background-secondary); }
${cover} img { width: 100%; height: 100%; object-fit: contain; display: block; }
${cover}::before, ${cover}::after { content: ""; position: absolute; pointer-events: none; }
${card} .bases-cards-property { z-index: 1; }
${card}:focus-within { outline: 2px solid var(--interactive-accent); outline-offset: 4px; }
${effects[shape]}
${hover}
@media (prefers-reduced-motion: reduce) { ${cover} { transition: none !important; animation: none !important; rotate: none !important; translate: none !important; } }
@media (forced-colors: active) { ${cover} { border: 1px solid CanvasText; box-shadow: none; }
  ${cover}::before, ${cover}::after { display: none; } ${bookFallback} }
${shape === "book" ? `@supports not (container-type: size) { ${bookFallback} }` : ""}
`;
}
module.exports = { CARD_SHAPES, SHAPE_ATTRIBUTE, cardShapeStyles };
