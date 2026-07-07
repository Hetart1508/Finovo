import { db, execute, queryOne } from "./client";
import { logger } from "../config/logger";

const tableColumnExists = async (tableName: string, columnName: string) =>
  Boolean(await queryOne(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      LIMIT 1
    `,
    [tableName, columnName]
  ));

const ensureColumn = async (tableName: string, columnName: string, definition: string) => {
  if (!(await tableColumnExists(tableName, columnName))) {
    await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
};

const ensureIndex = async (tableName: string, indexName: string, columns: string) => {
  const existing = await queryOne(
    `
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = ?
      LIMIT 1
    `,
    [tableName, indexName]
  );

  if (!existing) {
    await db.query(`CREATE INDEX ${indexName} ON ${tableName}(${columns})`);
  }
};

export const runMigrations = async () => {
  logger.info("Running MySQL schema check...");

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      daily_threshold DECIMAL(10,2) DEFAULT 1000.00,
      failed_login_attempts INT NOT NULL DEFAULT 0,
      locked_until BIGINT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS otps (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      otp VARCHAR(20) NOT NULL,
      expires_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL,
      UNIQUE KEY unique_otp_email (email)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS pending_registrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      otp VARCHAR(255) NOT NULL,
      attempt_count INT NOT NULL DEFAULT 0,
      expires_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      otp VARCHAR(255) NOT NULL,
      attempt_count INT NOT NULL DEFAULT 0,
      expires_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      type ENUM('expense', 'income') NOT NULL,
      category VARCHAR(100) NOT NULL,
      date DATE NOT NULL,
      payment_mode VARCHAR(100) NOT NULL,
      description TEXT,
      bill_url TEXT,
      CONSTRAINT fk_transactions_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS statement_imports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      file_hash CHAR(64) NOT NULL,
      transaction_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_statement_import_user_file (user_id, file_hash),
      CONSTRAINT fk_statement_imports_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS merchant_aliases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      vpa VARCHAR(320) NOT NULL,
      company_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_merchant_alias_user_vpa (user_id, vpa),
      CONSTRAINT fk_merchant_aliases_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS recurring_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      day_of_month INT NOT NULL,
      category VARCHAR(100) NOT NULL,
      type VARCHAR(100) NOT NULL,
      frequency VARCHAR(50) NOT NULL DEFAULT 'monthly',
      interval_count INT NOT NULL DEFAULT 1,
      start_date DATE NULL,
      payment_mode VARCHAR(50) NOT NULL DEFAULT 'manual',
      autopay_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      payment_account VARCHAR(100) NULL,
      CONSTRAINT chk_day_of_month CHECK (day_of_month BETWEEN 1 AND 31),
      CONSTRAINT fk_recurring_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS mutual_fund_sip_investments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      investment_type VARCHAR(20) NOT NULL DEFAULT 'sip',
      sip_name VARCHAR(255) NOT NULL,
      fund_name VARCHAR(255) NOT NULL,
      monthly_sip_amount DECIMAL(14,2) NOT NULL,
      total_invested_amount DECIMAL(14,2) NOT NULL,
      current_value DECIMAL(14,2) NOT NULL,
      expected_cagr DECIMAL(7,4) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      notes TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT chk_investment_monthly_sip CHECK (monthly_sip_amount > 0),
      CONSTRAINT chk_investment_total_invested CHECK (total_invested_amount >= 0),
      CONSTRAINT chk_investment_current_value CHECK (current_value >= 0),
      CONSTRAINT chk_investment_expected_cagr CHECK (expected_cagr >= 0),
      CONSTRAINT chk_investment_dates CHECK (end_date >= start_date),
      CONSTRAINT fk_investments_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_advisor_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      session_id VARCHAR(64) NOT NULL,
      role ENUM('user', 'assistant') NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_ai_advisor_messages_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ai_advisor_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      session_id VARCHAR(64) NOT NULL,
      title VARCHAR(25) NOT NULL DEFAULT 'New Chat',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_ai_advisor_session_user (user_id, session_id),
      CONSTRAINT fk_ai_advisor_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      date_of_birth DATE NULL,
      occupation VARCHAR(255) NULL,
      city VARCHAR(120) NULL,
      country VARCHAR(120) NULL DEFAULT 'India',
      monthly_income DECIMAL(14,2) NULL,
      monthly_expense_target DECIMAL(14,2) NULL,
      emergency_fund_target DECIMAL(14,2) NULL,
      risk_appetite ENUM('low', 'moderate', 'high') NULL,
      investment_goal TEXT NULL,
      financial_dependents INT NULL,
      preferred_currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      ai_personalization_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      profile_context_version INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_profiles_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS monthly_report_preferences (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      report_frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
      custom_interval_days INT NOT NULL DEFAULT 30,
      send_day_of_month INT NOT NULL DEFAULT 1,
      include_ai_summary BOOLEAN NOT NULL DEFAULT FALSE,
      include_next_month_planning BOOLEAN NOT NULL DEFAULT TRUE,
      delivery_email VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT chk_monthly_report_send_day CHECK (send_day_of_month BETWEEN 1 AND 28),
      CONSTRAINT fk_monthly_report_preferences_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS monthly_report_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      report_month CHAR(7) NOT NULL,
      delivery_email VARCHAR(255) NOT NULL,
      status ENUM('sent', 'failed', 'skipped') NOT NULL,
      error_message TEXT NULL,
      sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_monthly_report_user_month_email (user_id, report_month, delivery_email),
      CONSTRAINT fk_monthly_report_logs_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INT PRIMARY KEY
    )
  `);

  await ensureColumn("users", "auth_provider", "VARCHAR(50) NOT NULL DEFAULT 'local'");
  await ensureColumn("users", "password_enabled", "BOOLEAN NOT NULL DEFAULT TRUE");
  await ensureColumn("users", "failed_login_attempts", "INT NOT NULL DEFAULT 0");
  await ensureColumn("users", "locked_until", "BIGINT NULL");
  await db.query("ALTER TABLE pending_registrations MODIFY COLUMN otp VARCHAR(255) NOT NULL");
  await ensureColumn("pending_registrations", "attempt_count", "INT NOT NULL DEFAULT 0");
  await db.query("ALTER TABLE password_resets MODIFY COLUMN otp VARCHAR(255) NOT NULL");
  await ensureColumn("password_resets", "attempt_count", "INT NOT NULL DEFAULT 0");
  await ensureColumn("transactions", "source_statement_hash", "CHAR(64) NULL");
  await ensureColumn("transactions", "import_fingerprint", "CHAR(64) NULL");
  await ensureColumn("transactions", "payee_vpa", "VARCHAR(320) NULL");
  await ensureColumn("transactions", "merchant_name", "VARCHAR(255) NULL");
  await ensureColumn("recurring_events", "frequency", "VARCHAR(50) NOT NULL DEFAULT 'monthly'");
  await ensureColumn("recurring_events", "interval_count", "INT NOT NULL DEFAULT 1");
  await ensureColumn("recurring_events", "start_date", "DATE NULL");
  await ensureColumn("recurring_events", "payment_mode", "VARCHAR(50) NOT NULL DEFAULT 'manual'");
  await ensureColumn("recurring_events", "autopay_enabled", "BOOLEAN NOT NULL DEFAULT FALSE");
  await ensureColumn("recurring_events", "payment_account", "VARCHAR(100) NULL");
  await ensureColumn("monthly_report_preferences", "report_frequency", "VARCHAR(20) NOT NULL DEFAULT 'monthly'");
  await ensureColumn("monthly_report_preferences", "custom_interval_days", "INT NOT NULL DEFAULT 30");
  await ensureColumn("mutual_fund_sip_investments", "investment_type", "VARCHAR(20) NOT NULL DEFAULT 'sip'");
  await ensureIndex("transactions", "idx_transactions_user_date", "user_id, date");
  await ensureIndex("transactions", "idx_transactions_category", "category");
  await ensureIndex("transactions", "idx_transactions_import_fingerprint", "user_id, import_fingerprint");
  await ensureIndex("transactions", "idx_transactions_user_payee_vpa", "user_id, payee_vpa");
  await ensureIndex("merchant_aliases", "idx_merchant_aliases_user", "user_id");
  await ensureIndex("recurring_events", "idx_recurring_user", "user_id");
  await ensureIndex("mutual_fund_sip_investments", "idx_investments_user", "user_id");
  await ensureIndex("mutual_fund_sip_investments", "idx_investments_user_start_date", "user_id, start_date");
  await ensureIndex("user_profiles", "idx_user_profiles_user", "user_id");
  await ensureIndex("monthly_report_preferences", "idx_monthly_report_preferences_user", "user_id");
  await ensureIndex("monthly_report_logs", "idx_monthly_report_logs_user_month", "user_id, report_month");
  await db.query("UPDATE ai_advisor_sessions SET title = TRIM(LEFT(title, 25)) WHERE CHAR_LENGTH(title) > 25");
  await db.query("ALTER TABLE ai_advisor_sessions MODIFY COLUMN title VARCHAR(25) NOT NULL DEFAULT 'New Chat'");
  await ensureIndex("ai_advisor_sessions", "idx_ai_advisor_sessions_user_updated", "user_id, updated_at");
  await ensureIndex("ai_advisor_messages", "idx_ai_advisor_user_session", "user_id, session_id, created_at");
  await execute("INSERT IGNORE INTO schema_migrations (version) VALUES (?)", [1]);

  logger.info("MySQL schema is ready.");
};
