import { pool } from "./index";

async function testDB() {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("DB Connected ✅");
    console.log(res.rows[0]);
  } catch (err) {
    console.error("DB Failed ❌", err);
  } finally {
    await pool.end();
  }
}

testDB();