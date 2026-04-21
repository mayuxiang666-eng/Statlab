export interface SqlQuizQuestion {
  id: string;
  questionZh: string;
  questionEn: string;
  optionsZh: string[];
  optionsEn: string[];
  correctIndex: number;
  explanationZh: string;
  explanationEn: string;
}

export interface SqlLesson {
  id: string;
  stage: number;
  titleZh: string;
  titleEn: string;
  objectiveZh: string;
  objectiveEn: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Practical';
  duration: string;
  tags: string[];
  contentZh: string;
  contentEn: string;
  quiz: SqlQuizQuestion[];
  points: number;
  badgeId: string;
}

export const SQL_LESSONS: SqlLesson[] = [
  {
    id: 'sql_1',
    stage: 1,
    titleZh: 'SQL 基础：SELECT 与 FROM',
    titleEn: 'SQL Basics: SELECT & FROM',
    objectiveZh: '掌握如何从数据库表中检索指定列的数据。',
    objectiveEn: 'Learn how to retrieve data from specific columns in a database table.',
    difficulty: 'Beginner',
    duration: '10 min',
    tags: ['Basics', 'Query'],
    points: 100,
    badgeId: 'sql_badge_1',
    contentZh: `
### 1. 什么是 SQL？
SQL (Structured Query Language) 是用于管理和处理关系数据库的标准语言。

### 2. SELECT 语句
\`SELECT\` 是 SQL 中最常用的命令，用于从数据库中选取数据。

**语法：**
\`\`\`sql
SELECT column1, column2, ...
FROM table_name;
\`\`\`

如果你想选取表中的所有列，可以使用通配符 \`*\`：
\`\`\`sql
SELECT * FROM table_name;
\`\`\`

### 3. 示例
假设我们有一个名为 \`Production\` 的表：
\`\`\`sql
SELECT PartName, Quantity FROM Production;
\`\`\`
这条语句将从生产表中提取“零件名称”和“数量”两列。
`,
    contentEn: `
### 1. What is SQL?
SQL (Structured Query Language) is the standard language for managing and manipulating relational databases.

### 2. The SELECT Statement
\`SELECT\` is the most commonly used command in SQL, used to select data from a database.

**Syntax:**
\`\`\`sql
SELECT column1, column2, ...
FROM table_name;
\`\`\`

If you want to select all columns in a table, use the wildcard \`*\`:
\`\`\`sql
SELECT * FROM table_name;
\`\`\`

### 3. Example
Suppose we have a table named \`Production\`:
\`\`\`sql
SELECT PartName, Quantity FROM Production;
\`\`\`
This statement extracts the "PartName" and "Quantity" columns from the production table.
`,
    quiz: [
      {
        id: 'sql_1_q1',
        questionZh: '哪条 SQL 语句用于从表中提取所有列？',
        questionEn: 'Which SQL statement is used to extract all columns from a table?',
        optionsZh: ['SELECT ALL FROM Table', 'SELECT * FROM Table', 'GET ALL FROM Table', 'SHOW ALL FROM Table'],
        optionsEn: ['SELECT ALL FROM Table', 'SELECT * FROM Table', 'GET ALL FROM Table', 'SHOW ALL FROM Table'],
        correctIndex: 1,
        explanationZh: '"*" 符号在 SQL 中代表“所有列”。',
        explanationEn: 'The "*" symbol represents "all columns" in SQL.'
      },
      {
        id: 'sql_1_q2',
        questionZh: 'SQL 的全称是什么？',
        questionEn: 'What does SQL stand for?',
        optionsZh: ['Strong Question Language', 'Structured Query Language', 'Simple Query Language', 'Standard Question Language'],
        optionsEn: ['Strong Question Language', 'Structured Query Language', 'Simple Query Language', 'Standard Question Language'],
        correctIndex: 1,
        explanationZh: 'SQL 代表结构化查询语言 (Structured Query Language)。',
        explanationEn: 'SQL stands for Structured Query Language.'
      }
    ]
  },
  {
    id: 'sql_2',
    stage: 2,
    titleZh: '条件筛选：WHERE 子句',
    titleEn: 'Filtering Data: WHERE Clause',
    objectiveZh: '学习如何使用 WHERE 子句对查询结果进行过滤。',
    objectiveEn: 'Learn how to use the WHERE clause to filter query results.',
    difficulty: 'Beginner',
    duration: '12 min',
    tags: ['Filter', 'Logic'],
    points: 120,
    badgeId: 'sql_badge_2',
    contentZh: `
### 1. WHERE 子句
\`WHERE\` 子句用于过滤记录，仅提取满足指定条件的记录。

**语法：**
\`\`\`sql
SELECT column1, column2, ...
FROM table_name
WHERE condition;
\`\`\`

### 2. 运算符
常用的运算符包括：
- \`=\` 等于
- \`<>\` 或 \`!=\` 不等于
- \`>\` 大于
- \`<\` 小于
- \`BETWEEN\` 在某个范围内
- \`LIKE\` 搜索某种模式
- \`IN\` 指定针对某个列的多个可能值

### 3. 示例
查询良率 (Yield) 小于 95% 的记录：
\`\`\`sql
SELECT * FROM Production
WHERE Yield < 95;
\`\`\`
`,
    contentEn: `
### 1. The WHERE Clause
The \`WHERE\` clause is used to filter records, extracting only those that fulfill a specified condition.

**Syntax:**
\`\`\`sql
SELECT column1, column2, ...
FROM table_name
WHERE condition;
\`\`\`

### 2. Operators
Common operators include:
- \`=\` Equal
- \`<>\` or \`!=\` Not equal
- \`>\` Greater than
- \`<\` Less than
- \`BETWEEN\` Between a certain range
- \`LIKE\` Search for a pattern
- \`IN\` Specify multiple possible values for a column

### 3. Example
Query records where the Yield is less than 95%:
\`\`\`sql
SELECT * FROM Production
WHERE Yield < 95;
\`\`\`
`,
    quiz: [
      {
        id: 'sql_2_q1',
        questionZh: '哪个运算符代表“不等于”？',
        questionEn: 'Which operator stands for "not equal"?',
        optionsZh: ['=', '==', '!=', '><'],
        optionsEn: ['=', '==', '!=', '><'],
        correctIndex: 2,
        explanationZh: '在大多数 SQL 方言中，!= 和 <> 都代表不等于。',
        explanationEn: 'In most SQL dialects, both != and <> represent not equal.'
      },
      {
        id: 'sql_2_q2',
        questionZh: '如何查询温度在 20 到 30 之间的记录？',
        questionEn: 'How do you query records where Temperature is between 20 and 30?',
        optionsZh: ['WHERE Temp IN (20, 30)', 'WHERE Temp BETWEEN 20 AND 30', 'WHERE Temp FROM 20 TO 30', 'WHERE Temp > 20 OR < 30'],
        optionsEn: ['WHERE Temp IN (20, 30)', 'WHERE Temp BETWEEN 20 AND 30', 'WHERE Temp FROM 20 TO 30', 'WHERE Temp > 20 OR < 30'],
        correctIndex: 1,
        explanationZh: 'BETWEEN 运算符用于选取介于两个值之间的数据范围。',
        explanationEn: 'The BETWEEN operator selects values within a given range.'
      }
    ]
  },
  {
    id: 'sql_3',
    stage: 3,
    titleZh: '排序与限制：ORDER BY 与 LIMIT',
    titleEn: 'Sorting & Limiting: ORDER BY & LIMIT',
    objectiveZh: '掌握如何对查询结果进行排序，并限制返回的行数。',
    objectiveEn: 'Learn how to sort query results and limit the number of rows returned.',
    difficulty: 'Beginner',
    duration: '10 min',
    tags: ['Sort', 'Limit'],
    points: 130,
    badgeId: 'sql_badge_3',
    contentZh: `
### 1. ORDER BY 关键字
\`ORDER BY\` 关键字用于对结果集进行排序。默认是升序 (\`ASC\`)，可以使用 \`DESC\` 关键字进行降序。

**语法：**
\`\`\`sql
SELECT * FROM table_name
ORDER BY column1 [ASC|DESC];
\`\`\`

### 2. LIMIT 子句
\`LIMIT\` 子句用于规定要返回的记录数目。这在处理包含数千条记录的大表时非常有用。

**语法：**
\`\`\`sql
SELECT * FROM table_name
LIMIT number;
\`\`\`

### 3. 示例
按良率降序排列并只取前 5 条：
\`\`\`sql
SELECT * FROM Production
ORDER BY Yield DESC
LIMIT 5;
\`\`\`
`,
    contentEn: `
### 1. ORDER BY Keyword
The \`ORDER BY\` keyword is used to sort the result-set. Records are sorted in ascending order (\`ASC\`) by default. To sort in descending order, use the \`DESC\` keyword.

**Syntax:**
\`\`\`sql
SELECT * FROM table_name
ORDER BY column1 [ASC|DESC];
\`\`\`

### 2. The LIMIT Clause
The \`LIMIT\` clause is used to specify the number of records to return. This is useful for large tables with thousands of records.

**Syntax:**
\`\`\`sql
SELECT * FROM table_name
LIMIT number;
\`\`\`

### 3. Example
Sort by Yield in descending order and keep only the top 5:
\`\`\`sql
SELECT * FROM Production
ORDER BY Yield DESC
LIMIT 5;
\`\`\`
`,
    quiz: [
      {
        id: 'sql_3_q1',
        questionZh: '如何让结果按降序排列？',
        questionEn: 'How can you return result set in descending order?',
        optionsZh: ['ORDER BY col REVERSE', 'ORDER BY col DESC', 'SORT BY col DESC', 'ORDER BY col DOWN'],
        optionsEn: ['ORDER BY col REVERSE', 'ORDER BY col DESC', 'SORT BY col DESC', 'ORDER BY col DOWN'],
        correctIndex: 1,
        explanationZh: 'DESC 是 Descending (降序) 的缩写。',
        explanationEn: 'DESC is short for Descending.'
      },
      {
        id: 'sql_3_q2',
        questionZh: '如果只想查看查询结果的第一行，应该怎么写？',
        questionEn: 'How to view only the first row of the query results?',
        optionsZh: ['LIMIT 1', 'TOP 1', 'FIRST 1', 'ONLY 1'],
        optionsEn: ['LIMIT 1', 'TOP 1', 'FIRST 1', 'ONLY 1'],
        correctIndex: 0,
        explanationZh: 'LIMIT 1 会限制结果集只包含 1 条记录。',
        explanationEn: 'LIMIT 1 restricts the result set to 1 record.'
      }
    ]
  },
  {
    id: 'sql_4',
    stage: 4,
    titleZh: '聚合函数：COUNT, SUM, AVG',
    titleEn: 'Aggregate Functions: COUNT, SUM, AVG',
    objectiveZh: '学习如何对多行数据进行计算并返回单个值。',
    objectiveEn: 'Learn how to perform calculations on multiple rows and return a single value.',
    difficulty: 'Intermediate',
    duration: '15 min',
    tags: ['Aggregation', 'Math'],
    points: 150,
    badgeId: 'sql_badge_4',
    contentZh: `
### 1. COUNT() 函数
返回符合指定条件的行数。
\`\`\`sql
SELECT COUNT(JobID) FROM Production;
\`\`\`

### 2. SUM() 函数
返回数值列的总和。
\`\`\`sql
SELECT SUM(Quantity) FROM Production;
\`\`\`

### 3. AVG() 函数
返回数值列的平均值。
\`\`\`sql
SELECT AVG(Yield) FROM Production;
\`\`\`

### 4. 其他
- \`MIN()\`: 返回最小值
- \`MAX()\`: 返回最大值
`,
    contentEn: `
### 1. The COUNT() Function
Returns the number of rows that matches a specified criterion.
\`\`\`sql
SELECT COUNT(JobID) FROM Production;
\`\`\`

### 2. The SUM() Function
Returns the total sum of a numeric column.
\`\`\`sql
SELECT SUM(Quantity) FROM Production;
\`\`\`

### 3. The AVG() Function
Returns the average value of a numeric column.
\`\`\`sql
SELECT AVG(Yield) FROM Production;
\`\`\`

### 4. Others
- \`MIN()\`: Returns the smallest value
- \`MAX()\`: Returns the largest value
`,
    quiz: [
      {
        id: 'sql_4_q1',
        questionZh: '哪个函数用于计算某一列的平均值？',
        questionEn: 'Which function is used to calculate the average of a column?',
        optionsZh: ['MEAN()', 'AVERAGE()', 'AVG()', 'SUM() / COUNT()'],
        optionsEn: ['MEAN()', 'AVERAGE()', 'AVG()', 'SUM() / COUNT()'],
        correctIndex: 2,
        explanationZh: 'AVG() 是 SQL 标准中计算平均值的函数。',
        explanationEn: 'AVG() is the standard SQL function for averaging.'
      },
      {
        id: 'sql_4_q2',
        questionZh: '如何获取生产总量的最大值？',
        questionEn: 'How to get the maximum value of the production quantity?',
        optionsZh: ['SELECT LARGE(Quantity)', 'SELECT MAX(Quantity)', 'SELECT HIGH(Quantity)', 'SELECT TOP(Quantity)'],
        optionsEn: ['SELECT LARGE(Quantity)', 'SELECT MAX(Quantity)', 'SELECT HIGH(Quantity)', 'SELECT TOP(Quantity)'],
        correctIndex: 1,
        explanationZh: 'MAX() 用于返回一列中的最大值。',
        explanationEn: 'MAX() returns the largest value in a column.'
      }
    ]
  },
  {
    id: 'sql_5',
    stage: 5,
    titleZh: '分组统计：GROUP BY 与 HAVING',
    titleEn: 'Grouping Data: GROUP BY & HAVING',
    objectiveZh: '掌握如何将结果集按一个或多个列进行分组统计。',
    objectiveEn: 'Learn how to group result-sets by one or more columns.',
    difficulty: 'Intermediate',
    duration: '18 min',
    tags: ['Grouping', 'Pivot'],
    points: 180,
    badgeId: 'sql_badge_5',
    contentZh: `
### 1. GROUP BY 语句
\`GROUP BY\` 语句通常结合聚合函数使用，根据一个或多个列对结果集进行分组。

**语法：**
\`\`\`sql
SELECT column_name, COUNT(*)
FROM table_name
GROUP BY column_name;
\`\`\`

### 2. HAVING 子句
在 SQL 中增加 \`HAVING\` 子句是因为 \`WHERE\` 关键字无法与聚合函数一起使用。\`HAVING\` 用于对分组后的结果进行过滤。

**语法：**
\`\`\`sql
SELECT column_name, SUM(Quantity)
FROM table_name
GROUP BY column_name
HAVING SUM(Quantity) > 1000;
\`\`\`
`,
    contentEn: `
### 1. The GROUP BY Statement
The \`GROUP BY\` statement is often used with aggregate functions to group the result-set by one or more columns.

**Syntax:**
\`\`\`sql
SELECT column_name, COUNT(*)
FROM table_name
GROUP BY column_name;
\`\`\`

### 2. The HAVING Clause
The \`HAVING\` clause was added to SQL because the \`WHERE\` keyword cannot be used with aggregate functions. \`HAVING\` is used to filter results after grouping.

**Syntax:**
\`\`\`sql
SELECT column_name, SUM(Quantity)
FROM table_name
GROUP BY column_name
HAVING SUM(Quantity) > 1000;
\`\`\`
`,
    quiz: [
      {
        id: 'sql_5_q1',
        questionZh: 'GROUP BY 通常与什么一起使用？',
        questionEn: 'What is GROUP BY usually used with?',
        optionsZh: ['ORDER BY', '聚合函数 (Aggregate Functions)', 'WHERE', 'LIMIT'],
        optionsEn: ['ORDER BY', 'Aggregate Functions', 'WHERE', 'LIMIT'],
        correctIndex: 1,
        explanationZh: 'GROUP BY 常用于结合 COUNT, SUM 等函数进行分类汇总。',
        explanationEn: 'GROUP BY is commonly used with functions like COUNT, SUM, etc.'
      },
      {
        id: 'sql_5_q2',
        questionZh: '为什么我们需要 HAVING 而不是 WHERE 来过滤聚合结果？',
        questionEn: 'Why do we need HAVING instead of WHERE to filter aggregate results?',
        optionsZh: ['WHERE 语法太复杂', 'WHERE 无法与聚合函数一起使用', 'HAVING 速度更快', 'HAVING 是新标准'],
        optionsEn: ['WHERE is too complex', 'WHERE cannot be used with aggregate functions', 'HAVING is faster', 'HAVING is the new standard'],
        correctIndex: 1,
        explanationZh: 'WHERE 作用于原始行，HAVING 作用于聚合后的分组。',
        explanationEn: 'WHERE acts on raw rows; HAVING acts on aggregated groups.'
      }
    ]
  },
  {
    id: 'sql_6',
    stage: 6,
    titleZh: '多表连接：INNER JOIN',
    titleEn: 'Joining Tables: INNER JOIN',
    objectiveZh: '学习如何根据两个或多个表之间的相关列从这些表中查询数据。',
    objectiveEn: 'Learn how to combine rows from two or more tables based on a related column.',
    difficulty: 'Practical',
    duration: '25 min',
    tags: ['Join', 'Relational'],
    points: 200,
    badgeId: 'sql_badge_6',
    contentZh: `
### 1. JOIN 的作用
在一个关系数据库中，数据通常分布在多个表中。\`JOIN\` 用于将这些表连接起来。

### 2. INNER JOIN
\`INNER JOIN\` 关键字在表中存在至少一个匹配时返回行。

**语法：**
\`\`\`sql
SELECT t1.col, t2.col
FROM table1 t1
INNER JOIN table2 t2 ON t1.id = t2.id;
\`\`\`

### 3. 示例
将“订单表”与“产品表”连接：
\`\`\`sql
SELECT Orders.OrderID, Products.ProductName
FROM Orders
INNER JOIN Products ON Orders.ProductID = Products.ProductID;
\`\`\`
`,
    contentEn: `
### 1. The Purpose of JOIN
In a relational database, data is often distributed across multiple tables. \`JOIN\` is used to connect these tables.

### 2. INNER JOIN
The \`INNER JOIN\` keyword selects records that have matching values in both tables.

**Syntax:**
\`\`\`sql
SELECT t1.col, t2.col
FROM table1 t1
INNER JOIN table2 t2 ON t1.id = t2.id;
\`\`\`

### 3. Example
Join the "Orders" table with the "Products" table:
\`\`\`sql
SELECT Orders.OrderID, Products.ProductName
FROM Orders
INNER JOIN Products ON Orders.ProductID = Products.ProductID;
\`\`\`
`,
    quiz: [
      {
        id: 'sql_6_q1',
        questionZh: '哪个连接类型只返回两个表中都有匹配的记录？',
        questionEn: 'Which join type returns only records that have matches in both tables?',
        optionsZh: ['LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN'],
        optionsEn: ['LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN'],
        correctIndex: 2,
        explanationZh: 'INNER JOIN 只保留交集部分。',
        explanationEn: 'INNER JOIN only keeps the intersection.'
      },
      {
        id: 'sql_6_q2',
        questionZh: '在 JOIN 语句中，ON 关键字的作用是什么？',
        questionEn: 'In a JOIN statement, what is the purpose of the ON keyword?',
        optionsZh: ['选择表', '指定连接条件（关联列）', '排序结果', '过滤行'],
        optionsEn: ['Select tables', 'Specify the join condition (related columns)', 'Sort results', 'Filter rows'],
        correctIndex: 1,
        explanationZh: 'ON 用于定义两个表如何通过公共列建立联系。',
        explanationEn: 'ON defines how two tables are linked via a common column.'
      }
    ]
  }
];
