"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.numericValues = numericValues;
exports.categoricalCounts = categoricalCounts;
exports.inferType = inferType;
exports.safeMean = safeMean;
exports.safeSd = safeSd;
exports.safeMedian = safeMedian;
exports.safeSkew = safeSkew;
exports.safeKurt = safeKurt;
exports.quartiles = quartiles;
exports.variance = variance;
exports.corr = corr;
exports.covariance = covariance;
exports.spearmanCorr = spearmanCorr;
exports.kendallTau = kendallTau;
exports.winsorize = winsorize;
exports.processMLFeatures = processMLFeatures;
exports.splitAndScale = splitAndScale;
exports.biweightMidcorrelation = biweightMidcorrelation;
exports.distanceCorrelation = distanceCorrelation;
exports.partialCorrelationMatrix = partialCorrelationMatrix;
exports.ksNormalTest = ksNormalTest;
exports.shapiroWilk = shapiroWilk;
exports.normalCDF = normalCDF;
exports.normalQuantile = normalQuantile;
exports.chiSquareTest = chiSquareTest;
exports.cronbachAlpha = cronbachAlpha;
var ss = require("simple-statistics");
function numericValues(data, column) {
    return data
        .map(function (row) { return Number(row[column]); })
        .filter(function (v) { return !isNaN(v) && isFinite(v); });
}
function categoricalCounts(data, column) {
    var counts = {};
    data.forEach(function (row) {
        var _a;
        var key = String((_a = row[column]) !== null && _a !== void 0 ? _a : "missing");
        counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
}
function inferType(values) {
    var numericCount = values.filter(function (v) { return !isNaN(Number(v)); }).length;
    return numericCount / Math.max(values.length, 1) > 0.7 ? "numeric" : "categorical";
}
function safeMean(values) {
    return values.length ? ss.mean(values) : NaN;
}
function safeSd(values) {
    return values.length ? ss.standardDeviation(values) : NaN;
}
function safeMedian(values) {
    return values.length ? ss.median(values) : NaN;
}
function safeSkew(values) {
    return values.length ? ss.sampleSkewness(values) : NaN;
}
function safeKurt(values) {
    return values.length ? ss.sampleKurtosis(values) : NaN;
}
function quartiles(values) {
    if (!values.length)
        return { q1: NaN, q3: NaN };
    var sorted = __spreadArray([], values, true).sort(function (a, b) { return a - b; });
    return {
        q1: ss.quantileSorted(sorted, 0.25),
        q3: ss.quantileSorted(sorted, 0.75)
    };
}
function variance(values) {
    return values.length ? ss.variance(values) : NaN;
}
function corr(x, y) {
    if (x.length !== y.length || x.length === 0)
        return NaN;
    return ss.sampleCorrelation(x, y);
}
function covariance(x, y) {
    if (x.length !== y.length || x.length === 0)
        return NaN;
    return ss.sampleCovariance(x, y);
}
function spearmanCorr(x, y) {
    var rank = function (arr) {
        return arr
            .map(function (v, i) { return ({ v: v, i: i }); })
            .sort(function (a, b) { return a.v - b.v; })
            .map(function (item, _idx, sorted) {
            var ties = sorted.filter(function (s) { return s.v === item.v; }).map(function (s) { return sorted.indexOf(s); });
            var avgRank = ties.reduce(function (a, b) { return a + b; }, 0) / ties.length;
            return { i: item.i, r: avgRank + 1 };
        })
            .sort(function (a, b) { return a.i - b.i; })
            .map(function (item) { return item.r; });
    };
    var rx = rank(x);
    var ry = rank(y);
    var n = Math.min(rx.length, ry.length);
    var mean = function (arr) { return arr.slice(0, n).reduce(function (a, b) { return a + b; }, 0) / Math.max(n, 1); };
    var mx = mean(rx);
    var my = mean(ry);
    var num = 0, dx = 0, dy = 0;
    for (var i = 0; i < n; i++) {
        num += (rx[i] - mx) * (ry[i] - my);
        dx += Math.pow((rx[i] - mx), 2);
        dy += Math.pow((ry[i] - my), 2);
    }
    return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
}
function kendallTau(x, y) {
    var n = Math.min(x.length, y.length);
    if (n < 2)
        return NaN;
    var concordant = 0, discordant = 0, ties = 0;
    for (var i = 0; i < n - 1; i++) {
        for (var j = i + 1; j < n; j++) {
            var dx = x[j] - x[i];
            var dy = y[j] - y[i];
            if (dx === 0 || dy === 0) {
                ties++;
                continue;
            }
            var prod = dx * dy;
            if (prod > 0)
                concordant++;
            else if (prod < 0)
                discordant++;
        }
    }
    var denom = concordant + discordant;
    return denom === 0 ? 0 : (concordant - discordant) / denom;
}
function winsorize(values, alpha) {
    if (alpha === void 0) { alpha = 0.05; }
    if (!values.length)
        return [];
    var sorted = __spreadArray([], values, true).sort(function (a, b) { return a - b; });
    var loIdx = Math.floor(alpha * (sorted.length - 1));
    var hiIdx = Math.ceil((1 - alpha) * (sorted.length - 1));
    var lo = sorted[loIdx];
    var hi = sorted[hiIdx];
    return values.map(function (v) { return Math.max(lo, Math.min(hi, v)); });
}
function processMLFeatures(dataset, feats, impute, oneHot) {
    var catFeats = [];
    var numFeats = [];
    feats.forEach(function (f) {
        var vals = dataset.map(function (r) { return r[f]; }).filter(function (v) { return v !== null && v !== undefined && v !== ""; });
        var numCount = vals.filter(function (v) { return !isNaN(Number(v)); }).length;
        if (numCount / Math.max(vals.length, 1) < 0.7)
            catFeats.push(f);
        else
            numFeats.push(f);
    });
    var numImputeValues = {};
    numFeats.forEach(function (f) {
        var vals = dataset.map(function (r) { return Number(r[f]); }).filter(function (v) { return !isNaN(v); });
        var val = 0;
        if (impute === "mean")
            val = safeMean(vals) || 0;
        else if (impute === "median")
            val = safeMedian(vals) || 0;
        numImputeValues[f] = val;
    });
    var catImputeValues = {};
    catFeats.forEach(function (f) {
        var counts = categoricalCounts(dataset, f);
        delete counts["missing"];
        delete counts["null"];
        var mode = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0] || "Unknown";
        catImputeValues[f] = mode;
    });
    var finalFeatureNames = __spreadArray([], numFeats, true);
    var oheMap = {};
    var labelMap = {};
    catFeats.forEach(function (f) {
        var rawUnique = new Set(dataset.map(function (r) {
            var _a;
            var v = String((_a = r[f]) !== null && _a !== void 0 ? _a : "");
            return v === "" || v === "null" ? catImputeValues[f] : v;
        }));
        var uniqueVals = Array.from(rawUnique).filter(function (v) { return v !== "missing" && v !== "null"; });
        if (oneHot) {
            oheMap[f] = uniqueVals;
            uniqueVals.forEach(function (v) { return finalFeatureNames.push("".concat(f, "_").concat(v)); });
        }
        else {
            labelMap[f] = {};
            uniqueVals.forEach(function (v, i) { return labelMap[f][v] = i; });
            finalFeatureNames.push(f);
        }
    });
    var extractX = function (row) {
        var x = [];
        numFeats.forEach(function (f) {
            var v = Number(row[f]);
            x.push(isNaN(v) ? numImputeValues[f] : v);
        });
        catFeats.forEach(function (f) {
            var _a, _b;
            var v = String((_a = row[f]) !== null && _a !== void 0 ? _a : "");
            if (v === "" || v === "null")
                v = catImputeValues[f];
            if (oneHot) {
                oheMap[f].forEach(function (uv) { return x.push(v === uv ? 1 : 0); });
            }
            else {
                x.push((_b = labelMap[f][v]) !== null && _b !== void 0 ? _b : 0);
            }
        });
        return x;
    };
    return { extractX: extractX, finalFeatureNames: finalFeatureNames, catFeats: catFeats };
}
function splitAndScale(rows, testSize, scale) {
    if (testSize === void 0) { testSize = 0.3; }
    if (scale === void 0) { scale = "standard"; }
    if (!rows.length)
        return { trainX: [], trainY: [], testX: [], testY: [] };
    var split = Math.max(1, Math.floor(rows.length * (1 - testSize)));
    var train = rows.slice(0, split);
    var test = rows.slice(split);
    var trainX = train.map(function (r) { return __spreadArray([], r.x, true); });
    var trainY = train.map(function (r) { return r.y; });
    var testX = test.map(function (r) { return __spreadArray([], r.x, true); });
    var testY = test.map(function (r) { return r.y; });
    if (scale !== "none" && trainX.length) {
        var cols = trainX[0].length;
        var means_1 = Array(cols).fill(0);
        var stds_1 = Array(cols).fill(0);
        var mins_1 = Array(cols).fill(Infinity);
        var maxs_1 = Array(cols).fill(-Infinity);
        trainX.forEach(function (row) {
            row.forEach(function (v, i) {
                means_1[i] += v;
                mins_1[i] = Math.min(mins_1[i], v);
                maxs_1[i] = Math.max(maxs_1[i], v);
            });
        });
        means_1.forEach(function (_, i) { means_1[i] /= trainX.length; });
        trainX.forEach(function (row) {
            row.forEach(function (v, i) { stds_1[i] += Math.pow((v - means_1[i]), 2); });
        });
        stds_1.forEach(function (_, i) { stds_1[i] = Math.sqrt(stds_1[i] / Math.max(trainX.length, 1)) || 1; });
        var applyScale = function (mat) {
            mat.forEach(function (row) {
                row.forEach(function (v, i) {
                    if (scale === "standard") {
                        row[i] = (v - means_1[i]) / stds_1[i];
                    }
                    else if (scale === "minmax") {
                        var range = maxs_1[i] - mins_1[i] || 1;
                        row[i] = (v - mins_1[i]) / range;
                    }
                });
            });
        };
        applyScale(trainX);
        applyScale(testX);
    }
    return { trainX: trainX, trainY: trainY, testX: testX, testY: testY };
}
function biweightMidcorrelation(x, y) {
    var bx = biweightTransform(x);
    var by = biweightTransform(y);
    return corr(bx, by);
}
function biweightTransform(arr) {
    if (!arr.length)
        return [];
    var m = ss.median(arr);
    var mad = ss.median(arr.map(function (v) { return Math.abs(v - m); })) || 1e-8;
    var u = arr.map(function (v) { return (v - m) / (9 * mad); });
    return u.map(function (ui, i) {
        if (Math.abs(ui) >= 1)
            return 0;
        var w = Math.pow((1 - Math.pow(ui, 2)), 2);
        return (arr[i] - m) * w;
    });
}
function distanceCorrelation(x, y) {
    var n = Math.min(x.length, y.length);
    if (n < 2)
        return NaN;
    var ax = doubleCenter(distanceMatrix(x.slice(0, n)));
    var ay = doubleCenter(distanceMatrix(y.slice(0, n)));
    var dcov = meanProduct(ax, ay);
    var dvarx = meanProduct(ax, ax);
    var dvary = meanProduct(ay, ay);
    if (dvarx <= 0 || dvary <= 0)
        return 0;
    return dcov / Math.sqrt(dvarx * dvary);
}
function distanceMatrix(vec) {
    var n = vec.length;
    var m = Array.from({ length: n }, function () { return Array(n).fill(0); });
    for (var i = 0; i < n; i++) {
        for (var j = i + 1; j < n; j++) {
            var d = Math.abs(vec[i] - vec[j]);
            m[i][j] = d;
            m[j][i] = d;
        }
    }
    return m;
}
function doubleCenter(mat) {
    var n = mat.length;
    var rowMeans = mat.map(function (row) { return row.reduce(function (a, b) { return a + b; }, 0) / Math.max(n, 1); });
    var colMeans = Array.from({ length: n }, function (_, j) { return mat.reduce(function (a, row) { return a + row[j]; }, 0) / Math.max(n, 1); });
    var totalMean = mat.flat().reduce(function (a, b) { return a + b; }, 0) / Math.max(n * n, 1);
    return mat.map(function (row, i) { return row.map(function (val, j) { return val - rowMeans[i] - colMeans[j] + totalMean; }); });
}
function meanProduct(a, b) {
    var n = a.length;
    var sum = 0;
    for (var i = 0; i < n; i++) {
        for (var j = 0; j < n; j++)
            sum += a[i][j] * b[i][j];
    }
    return sum / Math.max(n * n, 1);
}
function partialCorrelationMatrix(data, vars) {
    var n = data.length;
    var k = vars.length;
    if (k < 2)
        return { rho: [[]], vars: vars };
    var matrix = vars.map(function (v) { return numericValues(data, v).slice(0, n); });
    // Correlation matrix
    var corrMat = Array.from({ length: k }, function () { return Array(k).fill(0); });
    for (var i = 0; i < k; i++) {
        corrMat[i][i] = 1;
        for (var j = i + 1; j < k; j++) {
            var r = corr(matrix[i], matrix[j]);
            corrMat[i][j] = r;
            corrMat[j][i] = r;
        }
    }
    // Invert (simple Gauss-Jordan); fallback to identity on failure
    var inv = invertMatrix(corrMat) || identity(k);
    var rho = Array.from({ length: k }, function () { return Array(k).fill(0); });
    for (var i = 0; i < k; i++) {
        for (var j = 0; j < k; j++) {
            if (i === j) {
                rho[i][j] = 1;
                continue;
            }
            rho[i][j] = -inv[i][j] / Math.sqrt(Math.max(inv[i][i] * inv[j][j], 1e-12));
        }
    }
    return { rho: rho, vars: vars };
}
function identity(n) {
    return Array.from({ length: n }, function (_, i) { return Array.from({ length: n }, function (__, j) { return (i === j ? 1 : 0); }); });
}
function invertMatrix(mat) {
    var _a, _b;
    var n = mat.length;
    var a = mat.map(function (row) { return __spreadArray([], row, true); });
    var inv = identity(n);
    for (var i = 0; i < n; i++) {
        var pivot = a[i][i];
        var pivotRow = i;
        for (var r = i + 1; r < n; r++) {
            if (Math.abs(a[r][i]) > Math.abs(pivot)) {
                pivot = a[r][i];
                pivotRow = r;
            }
        }
        if (Math.abs(pivot) < 1e-10)
            return null;
        if (pivotRow !== i) {
            _a = [a[pivotRow], a[i]], a[i] = _a[0], a[pivotRow] = _a[1];
            _b = [inv[pivotRow], inv[i]], inv[i] = _b[0], inv[pivotRow] = _b[1];
        }
        var factor = a[i][i];
        for (var j = 0; j < n; j++) {
            a[i][j] /= factor;
            inv[i][j] /= factor;
        }
        for (var r = 0; r < n; r++) {
            if (r === i)
                continue;
            var f = a[r][i];
            for (var c = 0; c < n; c++) {
                a[r][c] -= f * a[i][c];
                inv[r][c] -= f * inv[i][c];
            }
        }
    }
    return inv;
}
/** Kolmogorov-Smirnov one-sample test against N(0,1) with p-value approximation */
function ksNormalTest(values) {
    var n = values.length;
    if (n < 2)
        return { D: NaN, p: NaN };
    var mean = safeMean(values);
    var sd = safeSd(values);
    if (!isFinite(mean) || !isFinite(sd) || sd === 0)
        return { D: 0, p: 1 };
    var z = __spreadArray([], values, true).sort(function (a, b) { return a - b; }).map(function (v) { return (v - mean) / sd; });
    var D = 0;
    for (var i = 0; i < n; i++) {
        var F = normalCDF(z[i]);
        var empUpper = (i + 1) / n;
        var empLower = i / n;
        D = Math.max(D, Math.abs(F - empUpper), Math.abs(F - empLower));
    }
    var p = ksPValue(D, n);
    return { D: D, p: p };
}
function ksPValue(D, n) {
    if (isNaN(D) || n <= 0)
        return NaN;
    var x = (Math.sqrt(n) + 0.12 + 0.11 / Math.sqrt(n)) * D;
    // Survival function for Kolmogorov distribution
    var sum = 0;
    for (var k = 1; k < 100; k++) {
        var term = Math.exp(-2 * k * k * x * x);
        sum += (k % 2 ? 1 : -1) * term * 2;
        if (term < 1e-8)
            break;
    }
    return Math.max(0, Math.min(1, sum));
}
/**
 * Shapiro-Wilk W 统计量近似实现（Based on Royston 1992 normality approximation）
 * 对于 n < 5000 的小样本给出 W 和近似 p 值（优于之前的占位符）
 */
function shapiroWilk(values) {
    var n = values.length;
    if (n < 3)
        return { W: NaN, p: NaN };
    var sorted = __spreadArray([], values, true).sort(function (a, b) { return a - b; });
    var mean = safeMean(sorted);
    var sd = safeSd(sorted);
    if (sd === 0)
        return { W: 1, p: 1 };
    // Normalize to z-scores
    var z = sorted.map(function (x) { return (x - mean) / sd; });
    // Compute expected order statistics from standard normal (Blom approximation)
    var m = z.map(function (_, i) {
        var p = (i + 1 - 0.375) / (n + 0.25);
        return normalQuantile(p);
    });
    var mSum2 = m.reduce(function (a, b) { return a + b * b; }, 0);
    // Coefficient approximation (a_i = m_i / sqrt(mSum2))
    var a = m.map(function (mi) { return mi / Math.sqrt(mSum2); });
    // W statistic
    var numerator = a.reduce(function (sum, ai, i) { return sum + ai * sorted[i]; }, 0);
    var denominator = sorted.reduce(function (sum, x) { return sum + Math.pow((x - mean), 2); }, 0);
    var W = denominator === 0 ? 1 : Math.min(1, (numerator * numerator) / denominator);
    // p value approximation via log transformation (Royston 1992)
    var mu = -1.2725 + 1.0521 * Math.log(n);
    var sigma = 1.0308 - 0.26763 * Math.log(n);
    var y = Math.log(1 - W);
    var z_stat = (y - mu) / sigma;
    var p = 1 - normalCDF(z_stat);
    return { W: Number(W.toFixed(4)), p: Number(Math.max(0, Math.min(1, p)).toFixed(4)) };
}
/** Standard normal CDF (Abramowitz & Stegun approximation) */
function normalCDF(x) {
    var t = 1 / (1 + 0.2316419 * Math.abs(x));
    var d = 0.3989423 * Math.exp(-x * x / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
}
/** Standard normal quantile (probit) via rational approximation */
function normalQuantile(p) {
    if (p <= 0)
        return -Infinity;
    if (p >= 1)
        return Infinity;
    var a = [2.515517, 0.802853, 0.010328];
    var b = [1.432788, 0.189269, 0.001308];
    var t = p < 0.5 ? Math.sqrt(-2 * Math.log(p)) : Math.sqrt(-2 * Math.log(1 - p));
    var num = a[0] + a[1] * t + a[2] * t * t;
    var den = 1 + b[0] * t + b[1] * t * t + b[2] * t * t * t;
    var z = t - num / den;
    return p < 0.5 ? -z : z;
}
function chiSquareTest(counts) {
    var rows = counts.length;
    var cols = counts[0].length;
    var rowTotals = counts.map(function (row) { return row.reduce(function (a, b) { return a + b; }, 0); });
    var colTotals = counts[0].map(function (_, j) { return counts.reduce(function (a, row) { return a + row[j]; }, 0); });
    var total = rowTotals.reduce(function (a, b) { return a + b; }, 0);
    var chi = 0;
    for (var i = 0; i < rows; i++) {
        for (var j = 0; j < cols; j++) {
            var expected = (rowTotals[i] * colTotals[j]) / total;
            if (expected > 0)
                chi += (Math.pow((counts[i][j] - expected), 2)) / expected;
        }
    }
    var df = (rows - 1) * (cols - 1);
    return { chi2: chi, df: df };
}
function cronbachAlpha(matrix) {
    var _a;
    var k = ((_a = matrix[0]) === null || _a === void 0 ? void 0 : _a.length) || 0;
    if (k < 2)
        return NaN;
    var itemVariances = [];
    var totalScores = [];
    for (var i = 0; i < matrix.length; i++) {
        var row = matrix[i];
        totalScores.push(row.reduce(function (a, b) { return a + b; }, 0));
        for (var j = 0; j < k; j++) {
            if (!itemVariances[j])
                itemVariances[j] = 0;
        }
    }
    var _loop_1 = function (j) {
        var vals = matrix.map(function (row) { return row[j]; });
        itemVariances[j] = variance(vals);
    };
    for (var j = 0; j < k; j++) {
        _loop_1(j);
    }
    var totalVar = variance(totalScores);
    var sumItemVar = itemVariances.reduce(function (a, b) { return a + b; }, 0);
    return (k / (k - 1)) * (1 - sumItemVar / totalVar);
}
