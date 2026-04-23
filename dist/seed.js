"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seed = seed;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_1 = require("./db");
const uuidv7_1 = require("uuidv7");
async function seed() {
    const filePath = path_1.default.join(process.cwd(), "data", "profiles.json");
    const file = fs_1.default.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(file);
    // 🔥 supports different JSON formats
    const profiles = Array.isArray(parsed)
        ? parsed
        : parsed.profiles || parsed.data || [];
    if (!profiles.length) {
        throw new Error("No profiles found in JSON file ❌");
    }
    const client = await db_1.pool.connect();
    try {
        await client.query("BEGIN");
        for (const p of profiles) {
            await client.query(`
        INSERT INTO profiles (
          id,
          name,
          gender,
          gender_probability,
          age,
          age_group,
          country_id,
          country_name,
          country_probability
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (name) DO NOTHING
        `, [
                (0, uuidv7_1.uuidv7)(),
                p.name,
                p.gender,
                p.gender_probability,
                p.age,
                p.age_group,
                p.country_id,
                p.country_name,
                p.country_probability,
            ]);
        }
        await client.query("COMMIT");
        console.log("Seeding complete ✅");
    }
    catch (err) {
        await client.query("ROLLBACK");
        console.error("Seeding failed ❌", err);
    }
    finally {
        client.release();
    }
}
seed();
