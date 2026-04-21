const mysql = require('mysql2/promise');

async function check() {
  try {
    const connection = await mysql.createConnection("mysql://root:root@10.246.97.159:3306/Statlab");
    const [rows] = await connection.execute("SHOW FULL COLUMNS FROM User WHERE Field = 'id'");
    console.log('User id collation:', rows);
    await connection.end();
  } catch (err) {
    console.error('Check failed:', err);
  }
}

check();
