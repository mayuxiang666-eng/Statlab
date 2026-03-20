import RandomForestClassifier from "ml-random-forest";
import { RandomForestRegression } from "ml-random-forest";
import { FeaturePipeline, StoredScaler, applyStoredScaler as scaleFn, transformWithPipeline as utilsTransform } from "../analysis/utils";

export const MAX_PREDICT_ROWS = 2000;

export type ModelPackage = {
  type: string;
  algoId: string;
  featureNames: string[];
  target?: string;
  labels?: string[];
  paramsUsed?: Record<string, unknown>;
  pipeline?: FeaturePipeline;
  scaler?: StoredScaler | null;
  modelJson?: any;
  weights?: number[];
  intercept?: number;
};

export type PredictResponse = {
  predictions: any[];
  modelType: string;
  count: number;
};

export function predictFromModelPackage(model: ModelPackage, rows: any[]): PredictResponse {
  if (!Array.isArray(rows)) throw new Error("rows 应为数组");
  const pip = model.pipeline || buildLegacyPipeline(model, rows);
  const { X } = safeTransformWithPipeline(rows, pip);
  const scaled = safeApplyScaler(X, model.scaler as any);

  switch (model.type) {
    case "ridge-regression":
    case "lasso-regression":
      return linearPredict(model, scaled);
    case "rf-regression":
    case "xgboost-regression":
    case "lightgbm-regression":
      return rfRegressionPredict(model, scaled);
    case "rf-classification":
      return rfClassificationPredict(model, scaled);
    case "logistic-classification":
      return logisticPredict(model, scaled);
    default:
      throw new Error(`不支持的模型类型: ${model.type}`);
  }
}

function safeTransformWithPipeline(rows: any[], pipeline: FeaturePipeline) {
  // 防御：若旧编译产物缺少 transformWithPipeline，使用本地实现兜底
  if (typeof utilsTransform === "function") {
    return utilsTransform(rows, pipeline as any);
  }
  const X: number[][] = [];
  rows.forEach((row) => {
    const x: number[] = [];
    pipeline.numFeats.forEach((f) => {
      const v = Number(row?.[f]);
      x.push(isNaN(v) ? pipeline.numImputeValues[f] : v);
    });
    pipeline.catFeats.forEach((f) => {
      let v = String(row?.[f] ?? "");
      if (v === "" || v === "null") v = pipeline.catImputeValues[f];
      if (pipeline.oneHot) {
        (pipeline.oheMap[f] || []).forEach((uv) => x.push(v === uv ? 1 : 0));
      } else {
        x.push(pipeline.labelMap?.[f]?.[v] ?? 0);
      }
    });
    X.push(x);
  });
  return { X, finalFeatureNames: pipeline.finalFeatureNames };
}

function safeApplyScaler(X: number[][], scaler?: StoredScaler | null) {
  if (typeof scaleFn === "function") return scaleFn(X, scaler);
  if (!scaler || !X.length) return X;
  const mode = scaler.mode || "none";
  if (mode === "none") return X;
  return X.map((row) => row.map((v, i) => {
    if (mode === "standard") {
      const sd = scaler.stds?.[i] || 1;
      const mean = scaler.means?.[i] || 0;
      return (v - mean) / (sd || 1);
    }
    if (mode === "minmax") {
      const min = scaler.mins?.[i] ?? 0;
      const max = scaler.maxs?.[i] ?? 1;
      const range = max - min || 1;
      return (v - min) / range;
    }
    return v;
  }));
}

// Backward compatibility: older runs may not have stored pipeline; assume numeric features in order
function buildLegacyPipeline(model: ModelPackage, rows: any[]): FeaturePipeline {
  if (!model.featureNames || model.featureNames.length === 0) {
    throw new Error("模型缺少特征流水线元数据，且无法推断特征列");
  }
  const sampleRows = Array.isArray(rows) && rows.length ? rows : [{}];
  const numImputeValues: Record<string, number> = {};
  model.featureNames.forEach((f) => {
    const vals = sampleRows
      .map((r: any) => Number(r?.[f]))
      .filter((v: number) => !isNaN(v));
    if (vals.length) {
      const sum = vals.reduce((a, b) => a + b, 0);
      numImputeValues[f] = sum / vals.length;
    } else {
      numImputeValues[f] = 0;
    }
  });

  return {
    numFeats: [...model.featureNames],
    catFeats: [],
    oneHot: false,
    numImputeValues,
    catImputeValues: {},
    oheMap: {},
    labelMap: {},
    finalFeatureNames: [...model.featureNames]
  };
}

function linearPredict(model: ModelPackage, X: number[][]): PredictResponse {
  const weights = model.weights || [];
  const b = model.intercept || 0;
  const preds = X.map((row) => row.reduce((acc, v, i) => acc + v * (weights[i] || 0), b));
  return { predictions: preds.map((p) => Number(p.toFixed(6))), modelType: model.type, count: preds.length };
}

function rfRegressionPredict(model: ModelPackage, X: number[][]): PredictResponse {
  const rf = loadRFRegression(model);
  const preds = rf.predict(X);
  return { predictions: preds.map((p: number) => Number(p.toFixed(6))), modelType: model.type, count: preds.length };
}

function rfClassificationPredict(model: ModelPackage, X: number[][]): PredictResponse {
  const rf = loadRFClassifier(model);
  const labels = model.labels || [];
  const preds = rf.predict(X);
  const mapped = preds.map((idx: number) => labels[idx] ?? idx);
  return { predictions: mapped, modelType: model.type, count: mapped.length };
}

function logisticPredict(model: ModelPackage, X: number[][]): PredictResponse {
  const weights = model.weights || [];
  const b = model.intercept || 0;
  const labels = model.labels || ["0", "1"];
  const preds = X.map((row) => {
    const z = row.reduce((acc, v, i) => acc + v * (weights[i] || 0), b);
    const prob = 1 / (1 + Math.exp(-z));
    return { label: prob >= 0.5 ? labels[1] ?? labels[0] ?? "1" : labels[0] ?? "0", probability: Number(prob.toFixed(6)) };
  });
  return { predictions: preds, modelType: model.type, count: preds.length };
}

function loadRFRegression(model: ModelPackage) {
  const RF: any = RandomForestRegression as any;
  if (!model.modelJson) throw new Error("缺少模型结构，无法加载随机森林回归模型");
  if (RF.load) return RF.load(model.modelJson);
  if (RF.fromJSON) return RF.fromJSON(model.modelJson);
  throw new Error("当前环境无法反序列化随机森林回归模型");
}

function loadRFClassifier(model: ModelPackage) {
  const RFCls: any = (RandomForestClassifier as any).RandomForestClassifier || RandomForestClassifier;
  if (!model.modelJson) throw new Error("缺少模型结构，无法加载随机森林分类模型");
  if (RFCls.load) return RFCls.load(model.modelJson);
  if (RFCls.fromJSON) return RFCls.fromJSON(model.modelJson);
  throw new Error("当前环境无法反序列化随机森林分类模型");
}
