import mysql from "mysql2/promise";
import { config } from "../config/index.js";

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  charset: "utf8mb4_unicode_ci",
  // Les DECIMAL reviennent en chaînes par défaut : on veut des nombres côté JS
  // pour que les totaux et les prix se calculent sans conversion partout.
  decimalNumbers: true,
  dateStrings: ["DATE"],
});

export const query = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

export const queryOne = async (sql, params = []) => {
  const rows = await query(sql, params);
  return rows[0] || null;
};

/**
 * Exécute une suite d'écritures dans une transaction : soit tout passe, soit
 * rien. Indispensable pour une commande et ses lignes, ou un import de tarif.
 */
export const withTransaction = async (run) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await run(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const closePool = () => pool.end();
