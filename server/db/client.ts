import mysql, { PoolOptions, ResultSetHeader, RowDataPacket } from "mysql2/promise";

const getDbConfig = (): PoolOptions => {
  const baseConfig: PoolOptions = process.env.MYSQL_URL
    ? { uri: process.env.MYSQL_URL }
    : {
        host: process.env.DB_HOST || process.env.MYSQLHOST || "localhost",
        port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
        user: process.env.DB_USER || process.env.MYSQLUSER || "root",
        password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || "",
        database: process.env.DB_NAME || process.env.MYSQLDATABASE || "expense_tracker",
      };

  if (process.env.DB_SSL === "true") {
    baseConfig.ssl = process.env.DB_CA_CERT
      ? { ca: process.env.DB_CA_CERT.replace(/\\n/g, "\n") }
      : { rejectUnauthorized: true };
  }

  return baseConfig;
};

export const db = mysql.createPool({
  ...getDbConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
  dateStrings: true,
});

export const queryAll = async <T extends RowDataPacket = RowDataPacket>(sql: string, params: any[] = []) => {
  const [rows] = await db.execute<T[]>(sql, params);
  return rows;
};

export const queryOne = async <T extends RowDataPacket = RowDataPacket>(sql: string, params: any[] = []) => {
  const rows = await queryAll<T>(sql, params);
  return rows[0];
};

export const execute = async (sql: string, params: any[] = []) => {
  const [result] = await db.execute<ResultSetHeader>(sql, params);
  return result;
};

export type { RowDataPacket };

