"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
async function testDB() {
    try {
        const res = await index_1.pool.query("SELECT NOW()");
        console.log("DB Connected ✅");
        console.log(res.rows[0]);
    }
    catch (err) {
        console.error("DB Failed ❌", err);
    }
    finally {
        await index_1.pool.end();
    }
}
testDB();
