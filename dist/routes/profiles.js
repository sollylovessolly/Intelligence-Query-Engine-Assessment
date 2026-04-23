"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const queryBuilder_1 = require("../utils/queryBuilder");
const parser_1 = require("../utils/parser");
const router = (0, express_1.Router)();
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
        if (min_age !== undefined) {
            const val = Number(min_age);
            if (isNaN(val)) {
                return res.status(422).json({
                    status: "error",
                    message: "Invalid query parameters",
                });
            }
            filters.min_age = val;
        }
        if (max_age !== undefined) {
            const val = Number(max_age);
            if (isNaN(val)) {
                return res.status(422).json({
                    status: "error",
                    message: "Invalid query parameters",
                });
            }
            filters.max_age = val;
        }
        if (min_gender_probability !== undefined) {
            const val = Number(min_gender_probability);
            if (isNaN(val)) {
                return res.status(422).json({
                    status: "error",
                    message: "Invalid query parameters",
                });
            }
            filters.min_gender_probability = val;
        }
        if (min_country_probability !== undefined) {
            const val = Number(min_country_probability);
            if (isNaN(val)) {
                return res.status(422).json({
                    status: "error",
                    message: "Invalid query parameters",
                });
            }
            filters.min_country_probability = val;
        }
        const pageNum = Number(page);
        const limitNum = Math.min(Number(limit), 50);
        if (isNaN(pageNum) || isNaN(limitNum)) {
            return res.status(422).json({
                status: "error",
                message: "Invalid query parameters",
            });
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
        res.json({
            status: "success",
            page: pageNum,
            limit: limitNum,
            total,
            data: dataResult.rows,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({
            status: "error",
            message: "Server failure",
        });
    }
});
router.get("/search", async (req, res) => {
    try {
        const { q, page = "1", limit = "10" } = req.query;
        if (!q || String(q).trim() === "") {
            return res.status(400).json({
                status: "error",
                message: "Missing or empty parameter",
            });
        }
        const filters = (0, parser_1.parseQuery)(String(q));
        if (!filters) {
            return res.status(400).json({
                status: "error",
                message: "Unable to interpret query",
            });
        }
        const pageNum = Number(page);
        const limitNum = Math.min(Number(limit), 50);
        if (isNaN(pageNum) || isNaN(limitNum)) {
            return res.status(422).json({
                status: "error",
                message: "Invalid query parameters",
            });
        }
        const { countQuery, countValues, dataQuery, dataValues } = (0, queryBuilder_1.buildProfilesQuery)({
            filters,
            page: pageNum,
            limit: limitNum,
        });
        const totalResult = await db_1.pool.query(countQuery, countValues);
        const total = totalResult.rows[0].total;
        const dataResult = await db_1.pool.query(dataQuery, dataValues);
        res.json({
            status: "success",
            page: pageNum,
            limit: limitNum,
            total,
            data: dataResult.rows,
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({
            status: "error",
            message: "Server failure",
        });
    }
});
exports.default = router;
