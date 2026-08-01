import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ControlsHint from "./ControlsHint";
import PowerUpBanner from "./PowerUpBanner";

describe("React game status components", () => {
  it("renders the controls hint", () => {
    const markup = renderToStaticMarkup(createElement(ControlsHint));

    expect(markup).toContain("Move: ← → or A D • Shoot: SPACE");
    expect(markup).toContain("text-xs");
  });

  it("renders active power-ups and hides inactive ones", () => {
    const markup = renderToStaticMarkup(
      createElement(PowerUpBanner, { rapidFireTime: 4, shieldTime: 0 })
    );
    const emptyMarkup = renderToStaticMarkup(
      createElement(PowerUpBanner, { rapidFireTime: 0, shieldTime: 0 })
    );

    expect(markup).toContain("Rapid Fire: 4s");
    expect(markup).not.toContain("Shield:");
    expect(emptyMarkup).toBe("");
  });
});
