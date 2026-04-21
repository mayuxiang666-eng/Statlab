const mysql = require('mysql2/promise');

async function test() {
  try {
    const connection = await mysql.createConnection("mysql://root:root@10.246.97.159:3306/Statlab");
    console.log('Successfully connected to MySQL');
    const [rows] = await connection.execute('SHOW TABLES');
    console.log('Tables:', rows);
    await connection.end();
  } catch (err) {
    console.error('MySQL Connection failed:', err);
  }
}

test();
