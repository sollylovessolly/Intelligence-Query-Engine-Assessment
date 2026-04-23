"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProfilesQuery = buildProfilesQuery;
function buildProfilesQuery(options) {
    const { filters, sortBy = "created_at", order = "desc", page, limit } = options;
    const where = [];
    const values = [];
    if (filters.gender) {
        values.push(filters.gender);
        where.push(`gender = $${values.length}`);
    }
    if (filters.age_group) {
        values.push(filters.age_group);
        where.push(`age_group = $${values.length}`);
    }
    if (filters.country_id) {
        values.push(filters.country_id);
        where.push(`country_id = $${values.length}`);
    }
    if (filters.min_age !== undefined) {
        values.push(filters.min_age);
        where.push(`age >= $${values.length}`);
    }
    if (filters.max_age !== undefined) {
        values.push(filters.max_age);
        where.push(`age <= $${values.length}`);
    }
    if (filters.min_gender_probability !== undefined) {
        values.push(filters.min_gender_probability);
        where.push(`gender_probability >= $${values.length}`);
    }
    if (filters.min_country_probability !== undefined) {
        values.push(filters.min_country_probability);
        where.push(`country_probability >= $${values.length}`);
    }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const offset = (page - 1) * limit;
    const countQuery = `
    SELECT COUNT(*)::int as total
    FROM profiles
    ${whereClause}
  `;
    const dataQuery = `
    SELECT *
    FROM profiles
    ${whereClause}
    ORDER BY ${sortBy} ${order}
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;
    return {
        countQuery,
        countValues: values,
        dataQuery,
        dataValues: [...values, limit, offset],
    };
}
