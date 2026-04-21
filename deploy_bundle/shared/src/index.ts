import { z } from "zod";

export type ColumnType = "numeric" | "categorical" | "ordinal" | "datetime" | "text";

export type ColumnMeta = {
  name: string;
  type: ColumnType;
  missingRate: number;
};

export type DatasetVersionMeta = {
  id: number;
  datasetId: number;
  datasetName?: string;
  version: number;
  path: string;
  rowCount: number;
  columns: ColumnMeta[];
  sampleRows: Record<string, unknown>[];
};

export type DatasetInfo = {
  id: number;
  name: string;
  originalFilename: string;
  createdAt: string;
  versions: DatasetVersionMeta[];
  canDelete?: boolean;
};

export type InputSlotSpec = {
  id: string;
  label: string;
  acceptedTypes: ColumnType[];
  min: number;
  max?: number;
};

export type ParamOption = { label: string; value: string | number | boolean };

export type ParamDef = {
  key: string;
  label: string;
  type: "number" | "string" | "boolean" | "select";
  min?: number;
  max?: number;
  step?: number;
  default?: number | string | boolean;
  options?: ParamOption[];
  placeholder?: string;
};

export type AlgorithmSpec = {
  id: string;
  name: string;
  category: "academic" | "ml";
  subcategory: string;
  description: string;
  explanation?: string;
  inputSpec: InputSlotSpec[];
  paramSchema: ParamDef[];
  citation: string;
};


export type ResultTable = {
  title: string;
  explanation?: string;
  columns: string[];
  rows: (string | number | null)[][];
};

export type ResultFigure = {
  title: string;
  explanation?: string;
  type: "echarts";
  option: unknown;
};

export type AnalysisResult = {
  tables: ResultTable[];
  figures: ResultFigure[];
  assumptions: string[];
  warnings: string[];
  narrative: string;
  citation: string;
  // 可选扩展字段，用于传递模型特定的附加信息（如预测所需的系数、缩放参数等）
  extras?: Record<string, unknown>;
};

export type RunRequest = {
  datasetVersionId: number;
  algorithmId: string;
  variables: Record<string, string[]>;
  params: Record<string, unknown>;
};

export const RunRequestSchema = z.object({
  datasetVersionId: z.number(),
  algorithmId: z.string(),
  variables: z.record(z.array(z.string())),
  params: z.record(z.any()).default({})
});

export type RunRecord = {
  id: number;
  algorithmId: string;
  datasetId: number | null;
  datasetVersionId: number | null;
  variables: Record<string, string[]>;
  params: Record<string, unknown>;
  status: string;
  createdAt: string;
  result?: AnalysisResult;
};

export type DbConnectionType = "mssql" | "postgres" | "mysql";

export type DbConnectionInfo = {
  id: string; // The UUID or string ID
  name: string;
  type: DbConnectionType;
  isPreset: boolean;
};

export type TreeNode = {
  name: string;
  children?: TreeNode[]; // if it has children, it's a schema/db. If not, it's a table
};

export type DbTablePreview = {
  columns: ColumnMeta[];
  rows: Record<string, unknown>[];
};
