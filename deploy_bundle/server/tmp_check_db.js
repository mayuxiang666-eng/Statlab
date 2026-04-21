const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
  const pool = mysql.createPool(process.env.DATABASE_URL);
  try {
    const [rows] = await pool.execute('SELECT userId, score, completed FROM LearningProgress');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
check();
