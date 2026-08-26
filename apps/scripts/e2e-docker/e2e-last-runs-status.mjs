/**
 * Last-run status for the README tag: all-green only when every discovered
 * feature has a passed finding.
 */
import { featureStem } from './e2e-features.mjs';

function rowStem(row) {
  if (row.featureFile) return featureStem(row.featureFile);
  return String(row.id || '').replace(/^memries-/, '');
}

function rowStatus(lastRunsApps, id) {
  const status = lastRunsApps?.[id]?.finding?.status;
  if (status === 'passed' || status === 'failed') return status;
  return 'missing';
}

export function summarizeE2eLastRuns({ discovered = [], lastRunsApps = {} } = {}) {
  const rows = discovered.map((row) => ({
    id: row.id,
    stem: rowStem(row),
    status: rowStatus(lastRunsApps, row.id),
  }));
  const passed = rows.filter((row) => row.status === 'passed').length;
  const failed = rows.filter((row) => row.status === 'failed').length;
  const missing = rows.filter((row) => row.status === 'missing').length;
  return {
    allPassed: rows.length > 0 && passed === rows.length,
    passed,
    failed,
    missing,
    total: rows.length,
    rows,
  };
}

export function renderE2eLastRunsTag(summary) {
  if (summary.allPassed) {
    return `[**E2E last-runs:** ✅ all ${summary.total} passed](#end-to-end-tests)`;
  }
  const stems = (summary.rows ?? [])
    .filter((row) => row.status !== 'passed')
    .map((row) => row.stem);
  const clause = stems.length ? ` — ${stems.join(', ')}` : '';
  return `[**E2E last-runs:** ❌ ${summary.passed} of ${summary.total} passed](#end-to-end-tests)${clause}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function replaceMarkedRegion(markdown, id, body) {
  const start = `<!-- ${id}:start -->`;
  const end = `<!-- ${id}:end -->`;
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`);
  if (!pattern.test(markdown)) {
    throw new Error(`missing marked region ${id}`);
  }
  return markdown.replace(pattern, `${start}\n${body}\n${end}`);
}

const FEATURE_STOP = /^\s*(Scenario(?: Outline)?|Background|Rule|@|#)/i;

function parseFeatureBlurb(source) {
  const lines = String(source || '').split(/\r?\n/);
  let title = '';
  const blurb = [];
  let seenFeature = false;
  for (const line of lines) {
    const heading = /^Feature:\s*(.+)\s*$/.exec(line);
    if (heading) {
      title = heading[1].trim();
      seenFeature = true;
      continue;
    }
    if (!seenFeature) continue;
    if (FEATURE_STOP.test(line)) break;
    const text = line.trim();
    if (text) blurb.push(text);
  }
  return { title, blurb: blurb.join(' ') };
}

export function catalogRowsFromFeatures(files = []) {
  return files.map((file) => {
    const parsed = parseFeatureBlurb(file.source);
    return { id: file.id, title: parsed.title, blurb: parsed.blurb };
  });
}

export function renderE2eCatalog(catalog = [], summary = { rows: [] }) {
  const statusById = new Map((summary.rows ?? []).map((row) => [row.id, row.status]));
  return catalog
    .map((row) => {
      const mark = statusById.get(row.id) === 'passed' ? '✅' : '❌';
      return `- ${mark} **${row.title}** — ${row.blurb}`;
    })
    .join('\n');
}

export const README_TAG_REGION = 'e2e-last-runs-tag';
export const README_CATALOG_REGION = 'e2e-last-runs-catalog';

export function applyE2eLastRunsReadme({
  markdown,
  discovered = [],
  lastRunsApps = {},
  readFeature,
} = {}) {
  const files = discovered.map((row) => ({
    id: row.id,
    source: typeof readFeature === 'function' ? readFeature(row) : '',
  }));
  const catalog = catalogRowsFromFeatures(files);
  const missingTitle = catalog.filter((row) => !row.title).map((row) => row.id);
  if (missingTitle.length) {
    throw new Error(`feature file missing Feature: title: ${missingTitle.join(', ')}`);
  }
  const summary = summarizeE2eLastRuns({ discovered, lastRunsApps });
  let next = replaceMarkedRegion(markdown, README_TAG_REGION, renderE2eLastRunsTag(summary));
  next = replaceMarkedRegion(next, README_CATALOG_REGION, renderE2eCatalog(catalog, summary));
  return { markdown: next, summary };
}
