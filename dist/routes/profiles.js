"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const queryBuilder_1 = require("../utils/queryBuilder");
const parser_1 = require("../utils/parser");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
/**
 * GET /api/profiles
 */
router.get("/", async (req, res) => {
    try {
        const { gender, age_group, country_id, min_age, max_age, min_gender_probability, min_country_probability, sort_by = "created_at", order = "desc", page = "1", limit = "10", } = req.query;
        const filters = {};
        if (gender)
            filters.gender = gender;
        if (age_group)
            filters.age_group = age_group;
        if (country_id)
            filters.country_id = country_id;
        const toNumber = (val) => {
            const num = Number(val);
            if (isNaN(num))
                return null;
            return num;
        };
        if (min_age !== undefined) {
            const val = toNumber(min_age);
            if (val === null)
                return res.status(422).json({ status: "error", message: "Invalid query parameters" });
            filters.min_age = val;
        }
        if (max_age !== undefined) {
            const val = toNumber(max_age);
            if (val === null)
                return res.status(422).json({ status: "error", message: "Invalid query parameters" });
            filters.max_age = val;
        }
        if (min_gender_probability !== undefined) {
            const val = toNumber(min_gender_probability);
            if (val === null)
                return res.status(422).json({ status: "error", message: "Invalid query parameters" });
            filters.min_gender_probability = val;
        }
        if (min_country_probability !== undefined) {
            const val = toNumber(min_country_probability);
            if (val === null)
                return res.status(422).json({ status: "error", message: "Invalid query parameters" });
            filters.min_country_probability = val;
        }
        const pageNum = Number(page);
        const limitNum = Math.min(Number(limit), 50);
        if (isNaN(pageNum) || isNaN(limitNum)) {
            return res.status(422).json({ status: "error", message: "Invalid query parameters" });
        }
        const { countQuery, countValues, dataQuery, dataValues } = (0, queryBuilder_1.buildProfilesQuery)({
            filters,
            sortBy: sort_by,
            order: order,
            page: pageNum,
            limit: limitNum,
        });
        const totalResult = await db_1.pool.query(countQuery, countValues);
        const total = totalResult.rows[0].total;
        const dataResult = await db_1.pool.query(dataQuery, dataValues);
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
    }
    catch (err) {
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
        const filters = (0, parser_1.parseQuery)(String(q));
        if (!filters) {
            return res.status(400).json({ status: "error", message: "Unable to interpret query" });
        }
        const pageNum = Number(page);
        const limitNum = Math.min(Number(limit), 50);
        const { countQuery, countValues, dataQuery, dataValues } = (0, queryBuilder_1.buildProfilesQuery)({
            filters,
            page: pageNum,
            limit: limitNum,
        });
        const totalResult = await db_1.pool.query(countQuery, countValues);
        const total = totalResult.rows[0].total;
        const dataResult = await db_1.pool.query(dataQuery, dataValues);
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "Server failure" });
    }
});
/**
 * CREATE PROFILE (ADMIN ONLY)
 */
router.post("/", (0, auth_1.requireRole)("admin"), async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ status: "error", message: "Name is required" });
    }
    // For now simple mock (you can plug Stage 1 logic later)
    const result = await db_1.pool.query(`
    INSERT INTO profiles (
      id, name, gender, gender_probability,
      age, age_group, country_id, country_name,
      country_probability
    )
    VALUES (gen_random_uuid(), $1, 'female', 0.9, 30, 'adult', 'US', 'United States', 0.8)
    RETURNING *
    `, [name]);
    res.json({
        status: "success",
        data: result.rows[0],
    });
});
/**
 * EXPORT CSV
 */
router.get("/export", async (req, res) => {
    const result = await db_1.pool.query(`SELECT * FROM profiles LIMIT 100`);
    const rows = result.rows;
    const csv = [
        "id,name,gender,gender_probability,age,age_group,country_id,country_name,country_probability,created_at",
        ...rows.map((r) => `${r.id},${r.name},${r.gender},${r.gender_probability},${r.age},${r.age_group},${r.country_id},${r.country_name},${r.country_probability},${r.created_at}`),
    ].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="profiles_${Date.now()}.csv"`);
    res.send(csv);
});
exports.default = router;
