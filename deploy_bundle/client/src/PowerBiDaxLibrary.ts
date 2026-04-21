export interface DaxFunction {
  name: string;
  category: 'Aggregation' | 'Filter' | 'Time Intelligence' | 'Logical' | 'Text' | 'Table' | 'Information' | 'Math';
  syntax: string;
  descriptionZh: string;
  descriptionEn: string;
  example: string;
  tipZh: string;
  tipEn: string;
}

export const DAX_FUNCTIONS: DaxFunction[] = [
  // Aggregation
  {
    name: 'SUM',
    category: 'Aggregation',
    syntax: 'SUM(<column>)',
    descriptionZh: '对列中的所有数值求和。',
    descriptionEn: 'Adds all the numbers in a column.',
    example: 'Total Sales = SUM(Sales[Amount])',
    tipZh: '最基础的聚合函数，仅接受列名作为参数。',
    tipEn: 'The most basic aggregation, only accepts a column name.'
  },
  {
    name: 'SUMX',
    category: 'Aggregation',
    syntax: 'SUMX(<table>, <expression>)',
    descriptionZh: '为表中的每一行计算表达式，并对结果求和。',
    descriptionEn: 'Returns the sum of an expression evaluated for each row in a table.',
    example: 'Revenue = SUMX(Sales, Sales[Price] * Sales[Quantity])',
    tipZh: '工业场景中计算“单价*数量”的必备工具。',
    tipEn: 'Essential for calculating "Price * Quantity" scenarios.'
  },
  {
    name: 'AVERAGEX',
    category: 'Aggregation',
    syntax: 'AVERAGEX(<table>, <expression>)',
    descriptionZh: '计算表中每一行表达式的平均值。',
    descriptionEn: 'Calculates the average of a set of expressions evaluated over a table.',
    example: 'Avg Order Value = AVERAGEX(Orders, Orders[Units] * 10)',
    tipZh: '属于迭代函数，性能次于简单 AVERAGE 但逻辑更灵活。',
    tipEn: 'An iterator. Less performant than AVERAGE but more flexible.'
  },
  {
    name: 'DISTINCTCOUNT',
    category: 'Aggregation',
    syntax: 'DISTINCTCOUNT(<column>)',
    descriptionZh: '统计列中不重复值的个数。',
    descriptionEn: 'Counts the number of distinct values in a column.',
    example: 'Unique Customers = DISTINCTCOUNT(Sales[CustomerID])',
    tipZh: '在统计独立设备数或独立订单号时非常常用。',
    tipEn: 'Commonly used for counting unique assets or order IDs.'
  },
  {
    name: 'COUNTROWS',
    category: 'Aggregation',
    syntax: 'COUNTROWS([<table>])',
    descriptionZh: '计算表中的行数。',
    descriptionEn: 'Counts the number of rows in the specified table.',
    example: 'Total Transactions = COUNTROWS(Sales)',
    tipZh: '比 COUNT(列) 更高效，因为不需要检查列中的空值。',
    tipEn: 'More efficient than COUNT(column) as it doesn\'t check for nulls.'
  },
  {
    name: 'MIN',
    category: 'Aggregation',
    syntax: 'MIN(<column> | <expression>)',
    descriptionZh: '返回列中或两个表达式之间的最小值。',
    descriptionEn: 'Returns the minimum value in a column or between two expressions.',
    example: 'Min Temp = MIN(Sensors[Temperature])',
    tipZh: '也可用于比较两个标量值，如 MIN(10, [Measure])。',
    tipEn: 'Also works for comparing two scalar values.'
  },
  {
    name: 'MAX',
    category: 'Aggregation',
    syntax: 'MAX(<column> | <expression>)',
    descriptionZh: '返回最大值。',
    descriptionEn: 'Returns the maximum value.',
    example: 'Peak Pressure = MAX(Sensors[Pressure])',
    tipZh: '常用于确定时间轴上的最新日期：MAX(Calendar[Date])。',
    tipEn: 'Often used to find the latest date: MAX(Calendar[Date]).'
  },
  {
    name: 'DIVIDE',
    category: 'Math',
    syntax: 'DIVIDE(<numerator>, <denominator> [, <alternate_result>])',
    descriptionZh: '安全除法，自动处理除以零的情况（返回空或备选值）。',
    descriptionEn: 'Safe division that handles division by zero automatically.',
    example: 'Success Rate = DIVIDE([Success], [Total], 0)',
    tipZh: '工业建模的黄金准则：永远不要使用 / 符号，始终使用 DIVIDE。',
    tipEn: 'Golden rule: Always use DIVIDE instead of the / operator.'
  },
  {
    name: 'ROUND',
    category: 'Math',
    syntax: 'ROUND(<number>, <num_digits>)',
    descriptionZh: '将数字四舍五入到指定的位数。',
    descriptionEn: 'Rounds a number to the specified number of digits.',
    example: 'Fixed Value = ROUND([Measure], 2)',
    tipZh: '在展示财务数据或百分比时非常重要。',
    tipEn: 'Crucial for financial data and percentage display.'
  },

  // Filter
  {
    name: 'CALCULATE',
    category: 'Filter',
    syntax: 'CALCULATE(<expression>, <filter1>, <filter2>, ...)',
    descriptionZh: '在由筛选器修改的上下文中计算表达式。DAX 的重中之重。',
    descriptionEn: 'Evaluates an expression in a context modified by filters. The most important function in DAX.',
    example: 'Global OEE = CALCULATE([OEE], ALL(Factory[Name]))',
    tipZh: '可以用来修改、添加或删除当前的筛选条件。',
    tipEn: 'Used to modify, add, or remove existing filter contexts.'
  },
  {
    name: 'ALL',
    category: 'Filter',
    syntax: 'ALL([<table> | <column>])',
    descriptionZh: '忽略指定的筛选条件，返回表或列的所有行（唯一值）。',
    descriptionEn: 'Returns all the rows in a table, or all the values in a column, ignoring any filters.',
    example: 'Ratio = [Actual] / CALCULATE([Actual], ALL(Products))',
    tipZh: '常用于作为百分比计算的分母。',
    tipEn: 'Often used as the denominator in percentage calculations.'
  },
  {
    name: 'FILTER',
    category: 'Filter',
    syntax: 'FILTER(<table>, <filter_expression>)',
    descriptionZh: '返回代表另一张表子集的表。',
    descriptionEn: 'Returns a table that represents a subset of another table.',
    example: 'High Sales = CALCULATE([Sales], FILTER(Sales, Sales[Amount] > 1000))',
    tipZh: '通常作为 CALCULATE 的参数使用，用于复杂条件的行过滤。',
    tipEn: 'Typically used inside CALCULATE for complex row-level filtering.'
  },
  {
    name: 'VALUES',
    category: 'Filter',
    syntax: 'VALUES(<column>)',
    descriptionZh: '返回包含列中唯一值的单列宽表。',
    descriptionEn: 'Returns a one-column table that contains the distinct values from the specified column.',
    example: 'Prod List = VALUES(Products[SubCategory])',
    tipZh: '由于返回的是表，常用于迭代函数或作为列表验证。',
    tipEn: 'Returns a table, useful for iterators or list validation.'
  },

  // Time Intelligence
  {
    name: 'SAMEPERIODLASTYEAR',
    category: 'Time Intelligence',
    syntax: 'SAMEPERIODLASTYEAR(<dates>)',
    descriptionZh: '返回当前筛选上下文中日期对应的去年同期日期。',
    descriptionEn: 'Returns a set of dates in the current selection from the previous year.',
    example: 'Sales LY = CALCULATE([Sales], SAMEPERIODLASTYEAR(\'Calendar\'[Date]))',
    tipZh: '实现“同比 (YoY)”分析的最快路径。',
    tipEn: 'The fastest way to implement Year-over-Year (YoY) analysis.'
  },
  {
    name: 'DATEADD',
    category: 'Time Intelligence',
    syntax: 'DATEADD(<dates>, <number_of_intervals>, <interval>)',
    descriptionZh: '按指定间隔（日/月/季度/年）移动日期。',
    descriptionEn: 'Moves the dates by a specified interval (Day, Month, Quarter, Year).',
    example: 'Prev Month = CALCULATE([OEE], DATEADD(\'Calendar\'[Date], -1, MONTH))',
    tipZh: '比专用的时间函数更通用，可实现前推 24 个月等复杂需求。',
    tipEn: 'More versatile than specific time functions for custom offsets.'
  },
  {
    name: 'TOTALYTD',
    category: 'Time Intelligence',
    syntax: 'TOTALYTD(<expression>, <dates>, [<filter>], [<year_end_date>])',
    descriptionZh: '计算从年初至今的累计值。',
    descriptionEn: 'Evaluates the year-to-date value of the expression.',
    example: 'YTD Yield = TOTALYTD([Yield], \'Calendar\'[Date])',
    tipZh: '内置了 CALCULATE 逻辑，简化了累计求和公式。',
    tipEn: 'Has built-in CALCULATE logic to simplify cumulative sums.'
  },
  {
    name: 'DATESINPERIOD',
    category: 'Time Intelligence',
    syntax: 'DATESINPERIOD(<dates>, <start_date>, <num_intervals>, <interval>)',
    descriptionZh: '返回一个日期范围，常用于滚动均值计算。',
    descriptionEn: 'Returns a range of dates, useful for rolling averages.',
    example: '30Day Moving Avg = CALCULATE([Sales], DATESINPERIOD(\'Date\'[Date], MAX(\'Date\'[Date]), -30, DAY))',
    tipZh: '计算“滚动 30 天平均”或“最近一季度趋势”的核心。',
    tipEn: 'Critical for "Rolling 30-day" or "Last Quarter" trends.'
  },
  {
    name: 'DATESYTD',
    category: 'Time Intelligence',
    syntax: 'DATESYTD(<dates>, [<year_end_date>])',
    descriptionZh: '返回当前筛选上下文中年初至今的所有日期。',
    descriptionEn: 'Returns a set of dates in the current selection from the beginning of the year.',
    example: 'YTD Dates = DATESYTD(\'Calendar\'[Date])',
    tipZh: '常作为 CALCULATE 的筛选参数，比 TOTALYTD 更灵活。',
    tipEn: 'More flexible as a filter argument in CALCULATE than TOTALYTD.'
  },
  {
    name: 'STARTOFMONTH',
    category: 'Time Intelligence',
    syntax: 'STARTOFMONTH(<dates>)',
    descriptionZh: '返回当前上下文中月份的第一天。',
    descriptionEn: 'Returns the first date of the month in the current context.',
    example: 'Month Start = STARTOFMONTH(\'Calendar\'[Date])',
    tipZh: '在计算月初开盘值或月初库存时很有用。',
    tipEn: 'Useful for start-of-month opening balances or inventory.'
  },
  {
    name: 'ENDOFMONTH',
    category: 'Time Intelligence',
    syntax: 'ENDOFMONTH(<dates>)',
    descriptionZh: '返回月份的最后一天。',
    descriptionEn: 'Returns the last date of the month.',
    example: 'Month End = ENDOFMONTH(\'Calendar\'[Date])',
    tipZh: '常用于确定月结或结算日期。',
    tipEn: 'Commonly used for month-end reconciliation points.'
  },

  // Logical
  {
    name: 'IF',
    category: 'Logical',
    syntax: 'IF(<logical_test>, <value_if_true> [, <value_if_false>])',
    descriptionZh: '根据逻辑测试返回对应结果，类似于 Excel IF。',
    descriptionEn: 'Checks a condition and returns one value when TRUE, otherwise a second value.',
    example: 'Status = IF([OEE] > 0.8, "Normal", "Alert")',
    tipZh: '尽量嵌套少于 3 层，多层嵌套推荐改用 SWITCH。',
    tipEn: 'Limit nesting to 3 levels; use SWITCH for complex branching.'
  },
  {
    name: 'SWITCH',
    category: 'Logical',
    syntax: 'SWITCH(<expression>, <value>, <result>[, <value>, <result>]...[, <else>])',
    descriptionZh: '类似于编程中的 Case 语句，根据表达式值进行多分支判断。',
    descriptionEn: 'Evaluates an expression against a list of values and returns the result corresponding to the first match.',
    example: 'Color = SWITCH(TRUE(), [OEE] < 0.6, "Red", [OEE] < 0.8, "Yellow", "Green")',
    tipZh: '使用 SWITCH(TRUE(), ...) 是处理区间逻辑的高级技巧。',
    tipEn: 'Using SWITCH(TRUE(), ...) is an expert trick for range logic.'
  },
  {
    name: 'SELECTEDVALUE',
    category: 'Logical',
    syntax: 'SELECTEDVALUE(<column>, [<alternateResult>])',
    descriptionZh: '当列被筛选为唯一一个值时返回该值，否则返回备选结果。',
    descriptionEn: 'Returns the value when the context for the column has been filtered down to one distinct value only. ',
    example: 'Selected Plant = SELECTEDVALUE(Factory[Name], "Multiple Plants")',
    tipZh: '用于在报表标题中显示当前选中的切片器选项。',
    tipEn: 'Perfect for dynamic report titles based on slicer selection.'
  },

  // Information
  {
    name: 'HASONEVALUE',
    category: 'Information',
    syntax: 'HASONEVALUE(<column>)',
    descriptionZh: '如果列被筛选为仅一个唯一值，则返回 TRUE。',
    descriptionEn: 'Returns TRUE when the context for column has been filtered down to one distinct value only.',
    example: 'Check = IF(HASONEVALUE(Product[ID]), [Calc], [Error])',
    tipZh: '用于防止在“总计行”执行不该执行的逻辑。',
    tipEn: 'Used to prevent logic from executing on "Total" lines.'
  },
  {
    name: 'ISFILTERED',
    category: 'Information',
    syntax: 'ISFILTERED(<column>)',
    descriptionZh: '如果列上存在直接筛选条件且不是交叉过滤，则返回 TRUE。',
    descriptionEn: 'Returns TRUE when the column is being filtered directly.',
    example: 'Detail View = IF(ISFILTERED(Users[ID]), "Show Details", "Select User")',
    tipZh: '用于控制视觉对象的显示隐藏。',
    tipEn: 'Useful for controlling visibility of report elements.'
  },

  // Text
  {
    name: 'CONCATENATE',
    category: 'Text',
    syntax: 'CONCATENATE(<text1>, <text2>)',
    descriptionZh: '连接两个文本字符串。建议使用 & 运算符代替。',
    descriptionEn: 'Joins two text strings into one text string.',
    example: 'Full Name = CONCATENATE([First], [Last])',
    tipZh: 'DAX 中建议直接使用 &，如 \`[A] & [B]\` 更简洁。',
    tipEn: 'Using the & operator is usually more concise in DAX.'
  },
  {
    name: 'FORMAT',
    category: 'Text',
    syntax: 'FORMAT(<value>, <format_string>)',
    descriptionZh: '将值转换为指定格式的文本（如百分比、货币）。',
    descriptionEn: 'Converts a value to text according to the specified format.',
    example: 'Label = FORMAT([Yield], "0.0%")',
    tipZh: '转换后的结果是文本，不能直接进行图表数值汇总。',
    tipEn: 'The output is Text; it cannot be used for chart aggregations.'
  },

  // Table
  {
    name: 'SUMMARIZE',
    category: 'Table',
    syntax: 'SUMMARIZE(<table>, <groupBy_columnName>, Name, Expression...)',
    descriptionZh: '根据一个或多个列对表进行分组汇合并返回汇总表。',
    descriptionEn: 'Returns a summary table for the requested groups.',
    example: 'Monthly Pivot = SUMMARIZE(Sales, \'Date\'[Month], "Revenue", [SumSales])',
    tipZh: '工业分析中创建中间临时表或汇总层级表的首选。',
    tipEn: 'Go-to for creating intermediate temporary summary tables.'
  },
  {
    name: 'ADDCOLUMNS',
    category: 'Table',
    syntax: 'ADDCOLUMNS(<table>, <name>, <expression>, ...)',
    descriptionZh: '向指定表添加计算列并返回结果。',
    descriptionEn: 'Adds calculated columns to the given table.',
    example: 'New Table = ADDCOLUMNS(Customers, "Sales Rank", RANKX(ALL(Customers), [Sales]))',
    tipZh: '常与 SUMMARIZE 配合使用，比单独用 SUMMARIZE 性能更好。',
    tipEn: 'Often paired with SUMMARIZE for better performance.'
  },
  {
    name: 'RELATED',
    category: 'Table',
    syntax: 'RELATED(<column>)',
    descriptionZh: '从另一张相关表中提取值。',
    descriptionEn: 'Returns a related value from another table.',
    example: 'Category = RELATED(ProductCategory[Name])',
    tipZh: '必须存在“一对多”关系，且由“多”端向“一”端取值。',
    tipEn: 'Requires a many-to-one relationship; pulls from the "one" side.'
  },
  {
    name: 'RELATEDTABLE',
    category: 'Table',
    syntax: 'RELATEDTABLE(<table>)',
    descriptionZh: '返回经当前行筛选后的相关表。',
    descriptionEn: 'Returns a table of values filtered by the current row.',
    example: 'OrderCount = COUNTROWS(RELATEDTABLE(Sales))',
    tipZh: '由“一”端向“多”端取值，常用于在维度表计算指标。',
    tipEn: 'Pulls from the "many" side; useful for measures in dimension tables.'
  },
  {
    name: 'TOPN',
    category: 'Table',
    syntax: 'TOPN(<n_value>, <table>, <orderBy_expression>, [<order>], ...)',
    descriptionZh: '返回表的前 N 行。',
    descriptionEn: 'Returns the top N rows of the specified table.',
    example: 'Top 5 Products = CALCULATE([Sales], TOPN(5, Products, [Sales]))',
    tipZh: '常配合 CALCULATE 使用，仅对销量前五的项目进行聚合。',
    tipEn: 'Often used with CALCULATE to aggregate only the top 5 items.'
  },
  {
    name: 'DISTINCT',
    category: 'Table',
    syntax: 'DISTINCT(<table> | <column>)',
    descriptionZh: '返回不重复行构成的表。',
    descriptionEn: 'Returns a table by removing duplicate rows.',
    example: 'Unique Prod = DISTINCT(Products[Name])',
    tipZh: '与 VALUES 类似，但在处理空行（自引用完整性）时有细微差别。',
    tipEn: 'Similar to VALUES, with subtle diffs in handling Blank rows.'
  },
  {
    name: 'USERELATIONSHIP',
    category: 'Filter',
    syntax: 'USERELATIONSHIP(<columnName1>, <columnName2>)',
    descriptionZh: '指定在计算中使用某个特定的（通常是非活动占用的）关系。',
    descriptionEn: 'Specifies a particular relationship to be used in a calculation.',
    example: 'ShipSales = CALCULATE([Sales], USERELATIONSHIP(Dates[Date], Sales[ShipDate]))',
    tipZh: '处理一张表有多个日期关联（下单日、发货日）时的利器。',
    tipEn: 'Crucial for tables with multiple date links (OrderDate, ShipDate).'
  },
  {
    name: 'LOOKUPVALUE',
    category: 'Filter',
    syntax: 'LOOKUPVALUE(<result_columnName>, <search_columnName>, <search_value> [, <search2_column>, <value2>]...)',
    descriptionZh: '在不依赖模型关系的情况下，根据搜索值查表取数。',
    descriptionEn: 'Looks up a value in a table without needing a relationship.',
    example: 'Price = LOOKUPVALUE(Prices[Value], Prices[SKU], Sales[SKU])',
    tipZh: '类似于 Excel 的 VLOOKUP，在没有物理关系时非常有用。',
    tipEn: 'Similar to Excel VLOOKUP; useful when no physical relationship exists.'
  },
  {
    name: 'CROSSFILTER',
    category: 'Filter',
    syntax: 'CROSSFILTER(<columnName1>, <columnName2>, <direction>)',
    descriptionZh: '在计算期间修改模型关系的交叉过滤方向。',
    descriptionEn: 'Specifies the cross-filtering direction for a relationship during calculation.',
    example: 'Bidirectional = CALCULATE([Sales], CROSSFILTER(Product[ID], Sales[ID], Both))',
    tipZh: '可以临时开启双向过滤，解决复杂的跨维度筛选问题。',
    tipEn: 'Temporarily enables bi-directional filtering for complex cross-dim filtering.'
  },
  {
    name: 'ALLSELECTED',
    category: 'Filter',
    syntax: 'ALLSELECTED([<tableName> | <columnName>])',
    descriptionZh: '忽略内部筛选，但保留切片器等外部筛选。',
    descriptionEn: 'Removes inner filters while keeping external slicer selections.',
    example: 'Running Total = CALCULATE([Sales], FILTER(ALLSELECTED(Date), Date[D] <= MAX(Date[D])))',
    tipZh: '制作“动态累加柱状图”时的标准配置。',
    tipEn: 'The standard for creating "Dynamic Running Totals" in charts.'
  },
  {
    name: 'KEEPFILTERS',
    category: 'Filter',
    syntax: 'KEEPFILTERS(<expression>)',
    descriptionZh: '在 CALCULATE 中防止显式筛选器覆盖现有的外部筛选。',
    descriptionEn: 'Modifies how filters are applied in CALCULATE, preventing overrides.',
    example: 'Black Sales = CALCULATE([Sales], KEEPFILTERS(Product[Color] = "Black"))',
    tipZh: '当你想“求交集”而不是“重写”筛选条件时使用。',
    tipEn: 'Use when you want to "Intersect" rather than "Overwrite" filters.'
  },
  {
    name: 'RANKX',
    category: 'Math',
    syntax: 'RANKX(<table>, <expression> [, <value>] [, <order>] [, <ties>])',
    descriptionZh: '根据表达式对表中的每一行进行排名。',
    descriptionEn: 'Returns the ranking of a number in a list of numbers for each row in a table.',
    example: 'Sales Rank = RANKX(ALL(Products), [Total Sales])',
    tipZh: '注意使用 ALL() 忽略当前筛选上下文，否则排名永远是 1。',
    tipEn: 'Use ALL() to ignore current filter context, otherwise all ranks will be 1.'
  },
  {
    name: 'ALLEXCEPT',
    category: 'Filter',
    syntax: 'ALLEXCEPT(<table>, <column>[, <column>[, ...]])',
    descriptionZh: '移除表中除指定列以外的所有筛选器。',
    descriptionEn: 'Removes all context filters in the table except filters that have been applied to the specified columns.',
    example: 'Sales Ratio = DIVIDE([Sales], CALCULATE([Sales], ALLEXCEPT(Products, Products[Category])))',
    tipZh: '常用于计算占分类总比的情况。',
    tipEn: 'Ideal for calculating percentages of a category total.'
  },
  {
    name: 'REMOVEFILTERS',
    category: 'Filter',
    syntax: 'REMOVEFILTERS([<table> | <column>[, <column>[, ...]]])',
    descriptionZh: '从指定的表或列中删除筛选器。',
    descriptionEn: 'Removes filters from the specified tables or columns.',
    example: 'Grand Total = CALCULATE([Sales], REMOVEFILTERS(Sales))',
    tipZh: 'ALL() 的现代化别名，语义更清晰。',
    tipEn: 'The modern alias for ALL(); more semantically clear.'
  },
  {
    name: 'ISBLANK',
    category: 'Information',
    syntax: 'ISBLANK(<value>)',
    descriptionZh: '如果值为空 (Blank)，则返回 TRUE。',
    descriptionEn: 'Returns TRUE if the value is blank.',
    example: 'Check = IF(ISBLANK([Sales]), "No Data", "Active")',
    tipZh: '在处理传感器孤立点或缺失数据时很有用。',
    tipEn: 'Useful for handling sensor gaps or missing data.'
  },
  {
    name: 'USERNAME',
    category: 'Information',
    syntax: 'USERNAME()',
    descriptionZh: '返回当前登录用户的域名和用户名。',
    descriptionEn: 'Returns the domain name and username of the current user.',
    example: 'WhoAmI = USERNAME()',
    tipZh: '实现行级安全性 (RLS) 的基础。',
    tipEn: 'Foundational for Row-Level Security (RLS).'
  },
  {
    name: 'USERPRINCIPALNAME',
    category: 'Information',
    syntax: 'USERPRINCIPALNAME()',
    descriptionZh: '通常返回用户的电子邮件地址。',
    descriptionEn: 'Returns the user principal name (usually email).',
    example: 'UserEmail = USERPRINCIPALNAME()',
    tipZh: '在 Power BI 服务中比 USERNAME 更常用。',
    tipEn: 'More commonly used in Power BI Service than USERNAME.'
  },
  {
    name: 'EARLIER',
    category: 'Filter',
    syntax: 'EARLIER(<column>, <number>)',
    descriptionZh: '获取前一个计算周期的变量值（行上下文嵌套）。',
    descriptionEn: 'Returns the current value of the specified column in an outer evaluation pass.',
    example: 'Running Sum = SUMX(FILTER(T, T[Date] <= EARLIER(T[Date])), T[Val])',
    tipZh: '虽然由于性能和变量 (VAR) 的出现已较少使用，但理解嵌套逻辑必学。',
    tipEn: 'Less used now thanks to VAR, but critical for understanding nested logic.'
  },
  {
    name: 'UNION',
    category: 'Table',
    syntax: 'UNION(<table>, <table>, ...)',
    descriptionZh: '将两张或多张表垂直堆叠。',
    descriptionEn: 'Returns the union of a set of tables.',
    example: 'All Years = UNION(Sales2022, Sales2023)',
    tipZh: '要求列的数量和类型必须匹配。',
    tipEn: 'Requires matching column counts and data types.'
  },
  {
    name: 'INTERSECT',
    category: 'Table',
    syntax: 'INTERSECT(<table1>, <table2>)',
    descriptionZh: '返回两张表的交集。',
    descriptionEn: 'Returns the row intersection of two tables.',
    example: 'Repeat Cust = INTERSECT(VALUES(Sales2022[ID]), VALUES(Sales2023[ID]))',
    tipZh: '查找在两个时间段都购买过的“回访客”非常方便。',
    tipEn: 'A convenient way to find "Returning Customers" between periods.'
  },
  {
    name: 'EXCEPT',
    category: 'Table',
    syntax: 'EXCEPT(<table1>, <table2>)',
    descriptionZh: '返回在表 1 中但不在表 2 中的行。',
    descriptionEn: 'Returns the rows of one table which do not appear in another table.',
    example: 'Churned = EXCEPT(VALUES(Sales2022[ID]), VALUES(Sales2023[ID]))',
    tipZh: '常用于流失分析（去年在但今年不在的用户）。',
    tipEn: 'Commonly used for churn analysis (present last year, absent this year).'
  },
  {
    name: 'SELECTCOLUMNS',
    category: 'Table',
    syntax: 'SELECTCOLUMNS(<table>, <name>, <expression>, ...)',
    descriptionZh: '从表中选择特定的列，或添加新列。',
    descriptionEn: 'Returns a table with selected columns from the table and new columns specified by the DAX expressions.',
    example: 'NameList = SELECTCOLUMNS(Users, "Full", [F] & [L])',
    tipZh: '类似于 SQL 的 SELECT 语句，非常强大。',
    tipEn: 'Similar to the SQL SELECT statement; very powerful.'
  },
  {
    name: 'CROSSJOIN',
    category: 'Table',
    syntax: 'CROSSJOIN(<table>, <table>, ...)',
    descriptionZh: '返回表的笛卡尔积。',
    descriptionEn: 'Returns a table that contains the Cartesian product of all rows from all tables in the arguments.',
    example: 'All Combos = CROSSJOIN(Products, Stores)',
    tipZh: '谨慎使用，结果集行数通常会爆炸式增长。',
    tipEn: 'Use with caution; row counts can explode quickly.'
  },
  {
    name: 'DATATABLE',
    category: 'Table',
    syntax: 'DATATABLE(<name>, <type>, { {<val1>, <val2>...}, ... })',
    descriptionZh: '手动创建一个数据表。',
    descriptionEn: 'Returns a table with data defined inline.',
    example: 'Manual = DATATABLE("Key", STRING, { {"A"}, {"B"} })',
    tipZh: '常用于创建参数表或辅助维度表。',
    tipEn: 'Often used for parameter tables or auxiliary dimensions.'
  },
  {
    name: 'ABS',
    category: 'Math',
    syntax: 'ABS(<number>)',
    descriptionZh: '返回数字的绝对值。',
    descriptionEn: 'Returns the absolute value of a number.',
    example: 'Variance = ABS([Actual] - [Target])',
    tipZh: '在计算 KPI 指标偏差时非常常用。',
    tipEn: 'Frequently used when calculating variance for KPIs.'
  },
  {
    name: 'CEILING',
    category: 'Math',
    syntax: 'CEILING(<number>, <significance>)',
    descriptionZh: '向上舍入到最接近的倍数。',
    descriptionEn: 'Rounds a number up, to the nearest integer or to the nearest multiple of significance.',
    example: 'Batch Count = CEILING([TotalItems] / 10, 1)',
    tipZh: '常用于计算批次或容器需求量。',
    tipEn: 'Useful for calculating batch or container requirements.'
  },
  {
    name: 'NATURALINNERJOIN',
    category: 'Table',
    syntax: 'NATURALINNERJOIN(<left_table>, <right_table>)',
    descriptionZh: '执行两张表的内部连接 (Inner Join)。',
    descriptionEn: 'Performs an inner join of two tables.',
    example: 'Inner = NATURALINNERJOIN(Fact, Dim)',
    tipZh: '要求两表有同名的列且类型匹配，且模型中不能存在现有的物理关系。',
    tipEn: 'Requires columns with same names/types and no existing physical relations.'
  },
  {
    name: 'NATURALLEFTOUTERJOIN',
    category: 'Table',
    syntax: 'NATURALLEFTOUTERJOIN(<left_table>, <right_table>)',
    descriptionZh: '执行两张表的左外部连接 (Left Outer Join)。',
    descriptionEn: 'Performs a left outer join of two tables.',
    example: 'LeftJoin = NATURALLEFTOUTERJOIN(Fact, Dim)',
    tipZh: '保留左表所有行，关联右表匹配行。',
    tipEn: 'Keeps all rows from the left table and matching rows from the right.'
  },
  {
    name: 'MOD',
    category: 'Math',
    syntax: 'MOD(<number>, <divisor>)',
    descriptionZh: '返回两数相除后的余数。',
    descriptionEn: 'Returns the remainder after a number is divided by a divisor.',
    example: 'IsEven = IF(MOD([ID], 2) = 0, "Even", "Odd")',
    tipZh: '在处理排班周期或 ID 分组时很有用。',
    tipEn: 'Handy for shift cycles or ID grouping logic.'
  }
];
