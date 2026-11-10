const { BaseModuleController } = require("../base-controller");
const selectors = require("./selectors");

function styles(settings) {
  const shadowAlpha = settings.cardShadow / 100;
  const shadows = `0 8px 28px rgba(0, 0, 0, ${shadowAlpha * 0.3}), 0 2px 6px rgba(0, 0, 0, ${shadowAlpha * 0.2})`;
  return `
.sr-card-container {
  --cs-sr-card-background: ${settings.cardBackground};
  --cs-sr-border-color: ${settings.cardBorderColor};
  --cs-sr-again: ${settings.againColor};
  --cs-sr-hard: ${settings.hardColor};
  --cs-sr-good: ${settings.goodColor};
  --cs-sr-easy: ${settings.easyColor};
  --cs-sr-show-answer: ${settings.showAnswerColor};
  --cs-sr-transition: ${settings.transitionDuration}ms;
  box-sizing: border-box;
  background-color: var(--cs-sr-card-background);
  color: ${settings.contentColor};
  border: 1px solid var(--cs-sr-border-color);
  border-radius: ${settings.cardRadius}px;
  box-shadow: ${shadows};
  padding: ${settings.cardPadding}px;
  transition: box-shadow var(--cs-sr-transition) ease, background-color var(--cs-sr-transition) ease;
}
.sr-card-container .sr-scroll-wrapper {
  margin-block-end: ${settings.cardSpacing}px;
}
.sr-card-container .sr-content {
  color: ${settings.contentColor};
  font-size: ${settings.contentFontSize}%;
  font-weight: ${settings.contentFontWeight};
}
.sr-card-container .sr-response {
  gap: ${settings.buttonGap}px;
  padding: ${settings.reviewAreaPadding}px;
  background-color: ${settings.reviewAreaBackground};
  border-radius: ${Math.max(0, settings.cardRadius - 2)}px;
}
.sr-card-container ${selectors.button} {
  min-height: ${settings.buttonHeight}px;
  height: auto;
  line-height: 1.25;
  border-radius: ${settings.buttonRadius}px;
  transition: background-color var(--cs-sr-transition) ease, box-shadow var(--cs-sr-transition) ease;
}
.sr-card-container ${selectors.showAnswer} {
  background-color: var(--cs-sr-show-answer) !important;
}
.sr-card-container ${selectors.again},
.sr-card-container ${selectors.statusAgain} {
  background-color: var(--cs-sr-again) !important;
}
.sr-card-container ${selectors.hard},
.sr-card-container ${selectors.statusHard} {
  background-color: var(--cs-sr-hard) !important;
}
.sr-card-container ${selectors.good},
.sr-card-container ${selectors.statusGood} {
  background-color: var(--cs-sr-good) !important;
}
.sr-card-container ${selectors.easy},
.sr-card-container ${selectors.statusEasy} {
  background-color: var(--cs-sr-easy) !important;
}
.sr-card-container ${selectors.button}:hover:not(:disabled) {
  filter: brightness(1.08);
  box-shadow: 0 3px 12px rgba(0, 0, 0, ${Math.min(shadowAlpha, 0.45)});
}
.sr-card-container ${selectors.button}:focus-visible {
  outline: 2px solid var(--interactive-accent);
  outline-offset: 2px;
}
.sr-card-container ${selectors.button}:disabled {
  opacity: 0.6;
}`;
}

class SpacedRepetitionController extends BaseModuleController {
  refresh(profile) {
    super.refresh(profile);
    if (!this.settings.diagnostics) return;

    const detected = this.manager.isTargetPluginEnabled(this.module);
    let cards = 0;
    let controls = 0;
    let visibleViews = 0;
    for (const root of this.roots.keys()) {
      cards += root.matches?.(selectors.root) ? 1 : 0;
      controls += root.querySelectorAll(selectors.button).length;
      if (!root.matches?.(selectors.hidden)) visibleViews += 1;
    }
    console.info("[Customization Studio] Spaced Repetition diagnostics", {
      detected,
      enabled: profile.moduleEnabled[this.module.id] !== false,
      reviewViewOpen: visibleViews > 0,
      matchedRoots: this.roots.size,
      cards,
      reviewControls: controls,
      stylesInjected: Boolean(this.style?.parentNode)
    });
  }
}

module.exports = { SpacedRepetitionController, styles };
