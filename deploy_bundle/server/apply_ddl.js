const mysql = require('mysql2/promise');

const ddl = [
  `CREATE TABLE IF NOT EXISTS LearningProgress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci UNIQUE NOT NULL,
    score INT DEFAULT 0,
    completed LONGTEXT,
    badges LONGTEXT,
    quality LONGTEXT,
    updatedAt DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT LearningProgress_userId_fkey FOREIGN KEY (userId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS LabExerciseRecord (
    id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
    userId VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    ts DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    courseId VARCHAR(191) NOT NULL,
    courseTitle VARCHAR(191) NOT NULL,
    cellId VARCHAR(191) NOT NULL,
    cellLabel VARCHAR(191),
    code LONGTEXT NOT NULL,
    passed BOOLEAN NOT NULL,
    isFinalStep BOOLEAN NOT NULL,
    error LONGTEXT,
    checkpointResults LONGTEXT,
    tests LONGTEXT,
    CONSTRAINT LabExerciseRecord_userId_fkey FOREIGN KEY (userId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS WrongQuestion (
    id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
    userId VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    ts DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    courseId VARCHAR(191) NOT NULL,
    courseTitle VARCHAR(191) NOT NULL,
    questionId VARCHAR(191) NOT NULL,
    question LONGTEXT NOT NULL,
    selectedAnswer VARCHAR(191) NOT NULL,
    correctAnswer VARCHAR(191) NOT NULL,
    explanation LONGTEXT NOT NULL,
    CONSTRAINT WrongQuestion_userId_fkey FOREIGN KEY (userId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS ChallengeAttempt (
    id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
    userId VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    ts DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    courseId VARCHAR(191) NOT NULL,
    courseTitle VARCHAR(191) NOT NULL,
    score INT NOT NULL,
    passed BOOLEAN NOT NULL,
    correct INT NOT NULL,
    total INT NOT NULL,
    CONSTRAINT ChallengeAttempt_userId_fkey FOREIGN KEY (userId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
];

async function apply() {
  try {
    const connection = await mysql.createConnection("mysql://root:root@10.246.97.159:3306/Statlab");
    console.log('Applying corrected DDL...');
    for (const sql of ddl) {
      await connection.execute(sql);
      console.log('Executed:', sql.substring(0, 50) + '...');
    }
    console.log('DDL applied successfully');
    await connection.end();
  } catch (err) {
    console.error('DDL application failed:', err);
  }
}

apply();
