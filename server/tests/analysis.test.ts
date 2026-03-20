import { describe, it, expect } from "vitest";
import descriptive from "../analysis/modules/descriptive";
import correlation from "../analysis/modules/correlation";
import ttest from "../analysis/modules/ttest";
import logistic from "../analysis/modules/logistic";

const sample = [
  { x: 1, y: 2, group: "A", cls: "yes" },
  { x: 2, y: 4, group: "A", cls: "yes" },
  { x: 3, y: 6, group: "B", cls: "no" },
  { x: 4, y: 8, group: "B", cls: "no" }
];

describe("analysis modules", () => {
  it("descriptive stats produces mean", async () => {
    const res = await descriptive.run({ dataset: sample, variables: { variables: ["x"] }, params: {} });
    expect(res.tables[0].rows[0][0]).toBeCloseTo(2.5, 1);
  });

  it("correlation computes Pearson", async () => {
    const res = await correlation.run({ dataset: sample, variables: { variables: ["x", "y"] }, params: {} });
    const pearson = res.tables[0].rows[0][1] as number;
    expect(pearson).toBeGreaterThan(0.9);
  });

  it("independent t-test separates groups", async () => {
    const res = await ttest.run({ dataset: sample, variables: { target: ["x"], group: ["group"] }, params: { equalVar: true } });
    const t = res.tables[0].rows[0][1] as number;
    expect(Math.abs(t)).toBeGreaterThan(2);
  });

  it("logistic regression returns metrics", async () => {
    const res = await logistic.run({ dataset: sample, variables: { target: ["cls"], features: ["x", "y"] }, params: { testSize: 0.25 } });
    expect(res.tables[0].rows[0][0]).toBeTypeOf("number");
  });
});
