import { Router } from "express";
import { pool } from "../db";
import { buildProfilesQuery } from "../utils/queryBuilder";
import { parseQuery } from "../utils/parser";
import { requireRole } from "../middleware/auth";

const router = Router();

/**
 * GET /api/profiles
 */
router.get("/", async (req, res) => {
  try {
    const {
      gender,
      age_group,
      country_id,
      min_age,
      max_age,
      min_gender_probability,
      min_country_probability,
      sort_by = "created_at",
      order = "desc",
      page = "1",
      limit = "10",
    } = req.query;

    const filters: any = {};

    if (gender) filters.gender = gender;
    if (age_group) filters.age_group = age_group;
    if (country_id) filters.country_id = country_id;

    const toNumber = (val: any) => {
      const num = Number(val);
      if (isNaN(num)) return null;
      return num;
    };

    if (min_age !== undefined) {
      const val = toNumber(min_age);
      if (val === null) return res.status(422).json({ status: "error", message: "Invalid query parameters" });
      filters.min_age = val;
    }

    if (max_age !== undefined) {
      const val = toNumber(max_age);
      if (val === null) return res.status(422).json({ status: "error", message: "Invalid query parameters" });
      filters.max_age = val;
    }

    if (min_gender_probability !== undefined) {
      const val = toNumber(min_gender_probability);
      if (val === null) return res.status(422).json({ status: "error", message: "Invalid query parameters" });
      filters.min_gender_probability = val;
    }

    if (min_country_probability !== undefined) {
      const val = toNumber(min_country_probability);
      if (val === null) return res.status(422).json({ status: "error", message: "Invalid query parameters" });
      filters.min_country_probability = val;
    }

    const pageNum = Number(page);
    const limitNum = Math.min(Number(limit), 50);

    if (isNaN(pageNum) || isNaN(limitNum)) {
      return res.status(422).json({ status: "error", message: "Invalid query parameters" });
    }

    const { countQuery, countValues, dataQuery, dataValues } =
      buildProfilesQuery({
        filters,
        sortBy: sort_by as any,
        order: order as any,
        page: pageNum,
        limit: limitNum,
      });

    const totalResult = await pool.query(countQuery, countValues);
    const total = totalResult.rows[0].total;

    const dataResult = await pool.query(dataQuery, dataValues);

    const totalPages = Math.ceil(total / limitNum);

    const baseUrl = req.baseUrl + req.path;

    res.json({
      status: "success",
      page: pageNum,
      limit: limitNum,
      total,
      total_pages: totalPages,
      links: {
        self: `${baseUrl}?page=${pageNum}&limit=${limitNum}`,
        next: pageNum < totalPages ? `${baseUrl}?page=${pageNum + 1}&limit=${limitNum}` : null,
        prev: pageNum > 1 ? `${baseUrl}?page=${pageNum - 1}&limit=${limitNum}` : null,
      },
      data: dataResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Server failure" });
  }
});

/**
 * SEARCH
 */
router.get("/search", async (req, res) => {
  try {
    const { q, page = "1", limit = "10" } = req.query;

    if (!q || String(q).trim() === "") {
      return res.status(400).json({ status: "error", message: "Missing or empty parameter" });
    }

    const filters = parseQuery(String(q));
    if (!filters) {
      return res.status(400).json({ status: "error", message: "Unable to interpret query" });
    }

    const pageNum = Number(page);
    const limitNum = Math.min(Number(limit), 50);

    const { countQuery, countValues, dataQuery, dataValues } =
      buildProfilesQuery({
        filters,
        page: pageNum,
        limit: limitNum,
      });

    const totalResult = await pool.query(countQuery, countValues);
    const total = totalResult.rows[0].total;

    const dataResult = await pool.query(dataQuery, dataValues);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      status: "success",
      page: pageNum,
      limit: limitNum,
      total,
      total_pages: totalPages,
      links: {
        self: `/api/profiles/search?page=${pageNum}&limit=${limitNum}`,
        next: pageNum < totalPages ? `/api/profiles/search?page=${pageNum + 1}&limit=${limitNum}` : null,
        prev: pageNum > 1 ? `/api/profiles/search?page=${pageNum - 1}&limit=${limitNum}` : null,
      },
      data: dataResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: "Server failure" });
  }
});

/**
 * CREATE PROFILE (ADMIN ONLY)
 */
router.post("/", requireRole("admin"), async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ status: "error", message: "Name is required" });
  }

  // For now simple mock (you can plug Stage 1 logic later)
  const result = await pool.query(
    `
    INSERT INTO profiles (
      id, name, gender, gender_probability,
      age, age_group, country_id, country_name,
      country_probability
    )
    VALUES (gen_random_uuid(), $1, 'female', 0.9, 30, 'adult', 'US', 'United States', 0.8)
    RETURNING *
    `,
    [name]
  );

  res.json({
    status: "success",
    data: result.rows[0],
  });
});

/**
 * EXPORT CSV
 */
router.get("/export", async (req, res) => {
  const result = await pool.query(`SELECT * FROM profiles LIMIT 100`);

  const rows = result.rows;

  const csv = [
    "id,name,gender,gender_probability,age,age_group,country_id,country_name,country_probability,created_at",
    ...rows.map(
      (r) =>
        `${r.id},${r.name},${r.gender},${r.gender_probability},${r.age},${r.age_group},${r.country_id},${r.country_name},${r.country_probability},${r.created_at}`
    ),
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="profiles_${Date.now()}.csv"`
  );

  res.send(csv);
});

export default router;