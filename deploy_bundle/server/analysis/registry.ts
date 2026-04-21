import descriptive from "./modules/descriptive";
import frequency from "./modules/frequency";
import normality from "./modules/normality";
import correlation from "./modules/correlation";
import corrKendall from "./modules/corrKendall";
import corrBicor from "./modules/corrBicor";
import corrWinsor from "./modules/corrWinsor";
import corrDistance from "./modules/corrDistance";
import ttest from "./modules/ttest";
import anova from "./modules/anova";
import chisquare from "./modules/chisquare";
import ols from "./modules/ols";
import reliability from "./modules/reliability";
import efa from "./modules/efa";
import logistic from "./modules/logistic";
import randomForest from "./modules/randomForest";
import randomForestReg from "./modules/randomForestReg";
import decisionTree from "./modules/decisionTree";
import ridge from "./modules/ridge";
import lasso from "./modules/lasso";
import kmeans from "./modules/kmeans";
import xgboostReg from "./modules/xgboostReg";
import lightgbmReg from "./modules/lightgbmReg";
import interpret from "./modules/interpret";
import partialNetwork from "./modules/partialCorrNetwork";
import industrialEffect from "./modules/industrialEffect";
import aprioriRule from "./modules/aprioriRule";
import mars from "./modules/mars";
import mic from "./modules/mic";
import timeSeries from "./modules/timeSeries";

const registry = [
  descriptive,
  frequency,
  normality,
  correlation,
  corrKendall,
  corrBicor,
  corrWinsor,
  corrDistance,
  ttest,
  anova,
  chisquare,
  ols,
  reliability,
  efa,
  logistic,
  decisionTree,
  randomForest,
  randomForestReg,
  ridge,
  lasso,
  xgboostReg,
  lightgbmReg,
  industrialEffect,
  kmeans,
  partialNetwork,
  aprioriRule,
  mars,
  mic,
  timeSeries,
  interpret
];

export default registry;
