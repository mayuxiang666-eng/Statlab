export type Language = 'zh' | 'en' | 'de';

export const locales = {
    zh: {
        // Sidebar
        nav: {
            home: "首页概览",
            data: "我的数据",
            proc: "数据处理",
            academic: "学术统计",
            ml: "机器学习",
            builder: "可视化搭建",
            report: "报告中心",
            help: "帮助文档"
        },
        sidebar: {
            myData: "我的数据集",
            uploadData: "上传新数据",
            ready: "就绪",
            computing: "计算中...",
            success: "上次运行成功",
            version: "v2.1"
        },
        // ML Workspace
        ml: {
            runAnalysis: "运行分析",
            running: "运行中...",
            saveAsTemplate: "保存为模板",
            basicInfo: "基础信息",
            analysisNamePlaceholder: "本次分析命名 (例如: Q3质量预测)...",
            analystPlaceholder: "分析人员姓名...",
            algoLibrary: "算法库",
            searchAlgo: "搜索算法...",
            regression: "回归预测",
            classification: "分类识别",
            variableList: "变量一览",
            searchVar: "过滤...",
            targetVar: "目标(数值)",
            featureVars: "特征",
            dragHere: "点击选择 或 拖拽变量至此",
            required: "必填",
            selectAll: "全选",
            params: "超参数配置",
            paramsSub: "包含特征工程 & 交叉验证",
            trainingLog: "训练日志 (TRAINING LOG)",
            metrics: "模型评估",
            charts: "图表视图",
            filterData: "数据筛选 (可选)",
            manualPredict: "手动输入特征，快速试算预测",
            manualPredictSub: "（仅线性模型可公式预测，其他模型请用下方批量预测）",
            batchPredict: "批量预测（≤2000 行）",
            batchPredictSub: "请粘贴 JSON 数组，每行字段需匹配训练特征：",
            calculate: "计算预测值",
            result: "预测结果",
            predictionHint: "提示：若训练时使用了特征缩放/独热编码，请按照对应处理后的数值输入（独热列填 0 或 1）。"
        }
    },
    en: {
        nav: {
            home: "Overview",
            data: "My Data",
            proc: "Data Processing",
            academic: "Academic Stats",
            ml: "ML Workspace",
            builder: "Visualization",
            report: "Reports",
            help: "Help"
        },
        sidebar: {
            myData: "My Datasets",
            uploadData: "Upload Data",
            ready: "Ready",
            computing: "Computing...",
            success: "Last run success",
            version: "v2.1"
        },
        ml: {
            runAnalysis: "Run Analysis",
            running: "Running...",
            saveAsTemplate: "Save Template",
            basicInfo: "Basic Info",
            analysisNamePlaceholder: "Analysis Name (e.g., Q3 Quality Prediction)...",
            analystPlaceholder: "Analyst Name...",
            algoLibrary: "Algorithms",
            searchAlgo: "Search algorithms...",
            regression: "Regression",
            classification: "Classification",
            variableList: "Variables",
            searchVar: "Filter...",
            targetVar: "Target",
            featureVars: "Features",
            dragHere: "Click to select or drag here",
            required: "Required",
            selectAll: "Select All",
            params: "Hyperparameters",
            paramsSub: "Includes Feature Eng. & CV",
            trainingLog: "TRAINING LOG",
            metrics: "Metrics",
            charts: "Charts",
            filterData: "Data Filter (Optional)",
            manualPredict: "Manual Feature Input & Trial Calculation",
            manualPredictSub: "(Local calculation available for linear models only)",
            batchPredict: "Batch Prediction (max 2000 rows)",
            batchPredictSub: "Paste JSON array with fields matching features: ",
            calculate: "Calculate",
            result: "Result",
            predictionHint: "Note: If scaling/OHE was used, enter the transformed values (0/1 for OHE columns)."
        }
    },
    de: {
        nav: {
            home: "Übersicht",
            data: "Meine Daten",
            proc: "Datenverarbeitung",
            academic: "Statistik",
            ml: "ML-Arbeitsbereich",
            builder: "Visualisierung",
            report: "Berichte",
            help: "Hilfe"
        },
        sidebar: {
            myData: "Meine Datensätze",
            uploadData: "Daten hochladen",
            ready: "Bereit",
            computing: "Berechnung...",
            success: "Letzter Lauf erfolgreich",
            version: "v2.1"
        },
        ml: {
            runAnalysis: "Analyse ausführen",
            running: "Läuft...",
            saveAsTemplate: "Als Vorlage speichern",
            basicInfo: "Basisinfo",
            analysisNamePlaceholder: "Analyse-Name (z.B. Q3 Qualität)...",
            analystPlaceholder: "Name des Analytikers...",
            algoLibrary: "Algorithmen",
            searchAlgo: "Algorithmen suchen...",
            regression: "Regression",
            classification: "Klassifikation",
            variableList: "Variablen",
            searchVar: "Filtern...",
            targetVar: "Zielvariable",
            featureVars: "Features",
            dragHere: "Klicken oder hierher ziehen",
            required: "Erforderlich",
            selectAll: "Alle",
            params: "Hyperparameter",
            paramsSub: "Inklusive Feature Eng. & CV",
            trainingLog: "TRAININGSPROTOKOLL",
            metrics: "Metriken",
            charts: "Diagramme",
            filterData: "Datenfilter (Optional)"
        }
    }
};

export const t = (lang: Language, section: keyof typeof locales.en, key: string): string => {
    return (locales[lang] as any)?.[section]?.[key] || (locales.en as any)?.[section]?.[key] || key;
};
