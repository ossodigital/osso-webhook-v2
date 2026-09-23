const LEADS_PAGE_MAX = 100;
const LEADS_PAGE_DEFAULT = 50;
const SEARCH_MAX_LENGTH = 100;

export function parseLeadsListParams(query = {}) {
  const limitInput = Number.parseInt(query.limit, 10);
  const limit = Number.isFinite(limitInput) && limitInput > 0
    ? Math.min(LEADS_PAGE_MAX, limitInput)
    : LEADS_PAGE_DEFAULT;

  const offsetInput = Number.parseInt(query.offset, 10);
  const offset = Number.isFinite(offsetInput) && offsetInput > 0 ? offsetInput : 0;

  const search = String(query.search || "").trim().slice(0, SEARCH_MAX_LENGTH);
  const stage = String(query.stage || "").trim();

  return { limit, offset, search, stage };
}

export { LEADS_PAGE_MAX, LEADS_PAGE_DEFAULT };
