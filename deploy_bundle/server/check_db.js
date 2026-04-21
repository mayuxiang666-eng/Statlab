const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Search for .env
const pathsToTry = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
];

for (const p of pathsToTry) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    console.log(`Loaded .env from ${p}`);
    break;
  }
}

(async () => {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = mysql.createPool(process.env.DATABASE_URL);
  try {
    const [tables] = await pool.query('SHOW TABLES');
    console.log('Tables:', tables);
    
    // Find RunRecord table name (ignore case)
    const runRecordTable = Object.values(tables[0] || {}).find(v => String(v).toLowerCase() === 'runrecord');
    if (runRecordTable) {
        const [cols] = await pool.query(`SHOW COLUMNS FROM \`${runRecordTable}\``);
        console.log(`Columns for ${runRecordTable}:`, cols);
    } else {
        console.error('RunRecord table not found');
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
