const { RandomForestRegression } = require("ml-random-forest");

const X = [[1, 2], [2, 3], [3, 4]];
const Y = [10, 20, 30];

const rf = new RandomForestRegression({ nEstimators: 10 });
rf.train(X, Y);

const p1 = rf.predict([[1, 2], [2, 3]]);
const p2 = rf.predict([[1, 5], [2, 5]]);

console.log("p1 === p2:", p1 === p2); // Is the array reference the same?
console.log("p1:", p1);
console.log("p2:", p2);
