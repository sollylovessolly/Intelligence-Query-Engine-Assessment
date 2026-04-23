import { ProfileFilters } from "../types/profile";

const countryMap: Record<string, string> = {
  nigeria: "NG",
  kenya: "KE",
  angola: "AO",
  ghana: "GH",
  tanzania: "TZ",
};

export function parseQuery(q: string): ProfileFilters | null {
  const query = q.toLowerCase();

  const filters: ProfileFilters = {};

  let matched = false;

  if (query.includes("male")) {
    filters.gender = "male";
    matched = true;
  }

  if (query.includes("female")) {
    filters.gender = "female";
    matched = true;
  }

  if (query.includes("child")) {
    filters.age_group = "child";
    matched = true;
  }

  if (query.includes("teen")) {
    filters.age_group = "teenager";
    matched = true;
  }

  if (query.includes("adult")) {
    filters.age_group = "adult";
    matched = true;
  }

  if (query.includes("senior")) {
    filters.age_group = "senior";
    matched = true;
  }


  if (query.includes("young")) {
    filters.min_age = 16;
    filters.max_age = 24;
    matched = true;
  }

  const aboveMatch = query.match(/(above|over)\s+(\d+)/);
  if (aboveMatch) {
    filters.min_age = Number(aboveMatch[2]);
    matched = true;
  }


  const belowMatch = query.match(/(below|under)\s+(\d+)/);
  if (belowMatch) {
    filters.max_age = Number(belowMatch[2]);
    matched = true;
  }


  for (const country in countryMap) {
    if (query.includes(country)) {
      filters.country_id = countryMap[country];
      matched = true;
    }
  }

  if (!matched) return null;

  return filters;
}