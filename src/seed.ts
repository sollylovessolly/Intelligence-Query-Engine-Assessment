import fs from "fs";
import path from "path";
import { pool } from "./db";
import { uuidv7 } from "uuidv7";

type Profile = {
  name: string;
  gender: "male" | "female";
  gender_probability: number;
  age: number;
  age_group: "child" | "teenager" | "adult" | "senior";
  country_id: string;
  country_name: string;
  country_probability: number;
};

export async function seed() {
  const filePath = path.join(process.cwd(), "data", "profiles.json");

  const file = fs.readFileSync(filePath, "utf-8");

  const parsed = JSON.parse(file);

  // 🔥 supports different JSON formats
  const profiles: Profile[] =
    Array.isArray(parsed)
      ? parsed
      : parsed.profiles || parsed.data || [];

  if (!profiles.length) {
    throw new Error("No profiles found in JSON file ❌");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const p of profiles) {
      await client.query(
        `
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
        `,
        [
          uuidv7(),
          p.name,
          p.gender,
          p.gender_probability,
          p.age,
          p.age_group,
          p.country_id,
          p.country_name,
          p.country_probability,
        ]
      );
    }

    await client.query("COMMIT");
    console.log("Seeding complete ✅");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seeding failed ❌", err);
  } finally {
    client.release();

  }
}

seed();