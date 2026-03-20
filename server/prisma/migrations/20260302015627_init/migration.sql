-- CreateTable
CREATE TABLE "Dataset" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DatasetVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "datasetId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "path" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    CONSTRAINT "DatasetVersion_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RunRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "datasetId" INTEGER,
    "datasetVersionId" INTEGER,
    "algorithmId" TEXT NOT NULL,
    "variables" TEXT NOT NULL,
    "params" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" TEXT,
    "log" TEXT,
    CONSTRAINT "RunRecord_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RunRecord_datasetVersionId_fkey" FOREIGN KEY ("datasetVersionId") REFERENCES "DatasetVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
