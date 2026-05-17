const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { getDb, DB_PATH, initializeDatabase } = require('../db/init');

let maintenanceInProgress = false;

function buildTempPath(prefix) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return path.join(os.tmpdir(), `${prefix}-${stamp}.db`);
}

function cleanupTempFile(filePath) {
  if (!filePath) {
    return;
  }

  try {
    fs.rmSync(filePath, { force: true });
  } catch {
    // Ignore temp cleanup failures.
  }
}

function clearSidecarFiles(filePath) {
  cleanupTempFile(`${filePath}-wal`);
  cleanupTempFile(`${filePath}-shm`);
}

function ensureMaintenanceAvailable() {
  if (maintenanceInProgress) {
    throw new Error('Database maintenance already in progress');
  }
}

function validateRestoreFile(filePath) {
  const db = new Database(filePath, { readonly: true, fileMustExist: true });

  try {
    const integrity = db.prepare('PRAGMA integrity_check').pluck().get();
    if (integrity !== 'ok') {
      throw new Error('Backup file failed integrity check');
    }

    const tables = new Set(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all()
    );

    for (const table of ['users', 'transactions', 'recurring_templates', 'debts', 'monthly_archives', 'system_metadata']) {
      if (!tables.has(table)) {
        throw new Error(`Backup file is missing required table: ${table}`);
      }
    }
  } finally {
    db.close();
  }
}

async function createBackupFile() {
  ensureMaintenanceAvailable();
  maintenanceInProgress = true;

  const backupPath = buildTempPath('finance-backup');

  try {
    const db = getDb();
    try {
      await db.backup(backupPath);
    } finally {
      db.close();
    }

    const fileName = `finance-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
    return {
      backupPath,
      fileName,
      size: fs.statSync(backupPath).size,
    };
  } catch (err) {
    cleanupTempFile(backupPath);
    throw err;
  } finally {
    maintenanceInProgress = false;
  }
}

async function restoreBackupBuffer(buffer) {
  ensureMaintenanceAvailable();

  if (!buffer || buffer.length === 0) {
    throw new Error('Backup file is empty');
  }

  maintenanceInProgress = true;

  const uploadedPath = buildTempPath('finance-restore-upload');
  const rollbackPath = buildTempPath('finance-restore-rollback');

  try {
    fs.writeFileSync(uploadedPath, buffer);
    validateRestoreFile(uploadedPath);

    const currentDb = getDb();
    try {
      await currentDb.backup(rollbackPath);
    } finally {
      currentDb.close();
    }

    clearSidecarFiles(DB_PATH);
    fs.copyFileSync(uploadedPath, DB_PATH);
    clearSidecarFiles(DB_PATH);

    try {
      initializeDatabase();
    } catch (err) {
      clearSidecarFiles(DB_PATH);
      fs.copyFileSync(rollbackPath, DB_PATH);
      clearSidecarFiles(DB_PATH);
      initializeDatabase();
      throw err;
    }

    return {
      restoredAt: new Date().toISOString(),
      size: fs.statSync(DB_PATH).size,
    };
  } finally {
    cleanupTempFile(uploadedPath);
    cleanupTempFile(rollbackPath);
    maintenanceInProgress = false;
  }
}

module.exports = {
  cleanupTempFile,
  createBackupFile,
  restoreBackupBuffer,
};