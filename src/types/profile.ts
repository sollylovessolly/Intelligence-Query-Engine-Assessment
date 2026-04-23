export type ProfileFilters = {
  gender?: string;
  age_group?: string;
  country_id?: string;
  min_age?: number;
  max_age?: number;
  min_gender_probability?: number;
  min_country_probability?: number;
};

export type SortBy = "age" | "created_at" | "gender_probability";
export type SortOrder = "asc" | "desc";