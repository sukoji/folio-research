import { WorkspaceError } from './store.mjs';

export class Discovery {
  constructor(store, { fetchImpl = fetch } = {}) {
    this.db = store.db; this.fetch = fetchImpl;
    this.db.exec('CREATE TABLE IF NOT EXISTS reading_list (doi TEXT PRIMARY KEY, metadata TEXT NOT NULL, created_at TEXT NOT NULL)');
  }
  async search(query, { excludeDoi = '' } = {}) {
    if (typeof query !== 'string' || query.trim().length < 2 || query.length > 300) throw new WorkspaceError('INVALID_QUERY', '검색어는 2–300자여야 합니다.');
    const url = new URL('https://api.crossref.org/works');
    url.searchParams.set('query.bibliographic', query.trim());
    url.searchParams.set('rows', '15');
    url.searchParams.set('select', 'DOI,title,author,published,container-title,is-referenced-by-count,type');
    let response;
    try { response = await this.fetch(url, { headers: { 'User-Agent': 'FolioResearch/1.1 (https://github.com/sukoji/folio-research)', Accept: 'application/json' }, signal: AbortSignal.timeout(20000) }); }
    catch { throw new WorkspaceError('DISCOVERY_UNAVAILABLE', '학술 검색에 연결하지 못했습니다. 네트워크를 확인하세요.', 502); }
    if (!response.ok) throw new WorkspaceError('DISCOVERY_UNAVAILABLE', `학술 검색 서버 응답: ${response.status}. 잠시 후 다시 시도하세요.`, 502);
    const data = await response.json();
    if (!Array.isArray(data.message?.items)) throw new WorkspaceError('DISCOVERY_UNAVAILABLE', '학술 검색 응답 형식이 잘못됐습니다.', 502);
    const seen = new Set();
    const items = data.message.items.filter(item => {
      const doi = item.DOI?.toLowerCase();
      if (!doi || !/^10\.\d{4,9}\/\S+$/i.test(doi) || doi === excludeDoi.toLowerCase() || seen.has(doi)) return false;
      seen.add(doi); return true;
    }).map(item => ({
      doi: item.DOI, title: String(item.title?.[0] || 'Untitled').slice(0,500),
      authors: (item.author || []).map(a => [a.given,a.family].filter(Boolean).join(' ') || a.name || '').filter(Boolean).join(' and ').slice(0,1000),
      year: String(item.published?.['date-parts']?.[0]?.[0] || ''),
      venue: String(item['container-title']?.[0] || ''), citations: Number(item['is-referenced-by-count']) || 0,
      url: `https://doi.org/${encodeURIComponent(item.DOI)}`
    }));
    return { provider: 'Crossref', query: query.trim(), items, method: 'Bibliographic relevance from Crossref; metadata matches, not an assessment of research quality.' };
  }
  save(item) {
    if (!item || typeof item.doi !== 'string' || !/^10\.\d{4,9}\/\S{1,180}$/i.test(item.doi) || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 500) throw new WorkspaceError('INVALID_REFERENCE', '유효한 DOI와 제목이 필요합니다.');
    const metadata = { doi: item.doi, title: item.title, authors: String(item.authors || '').slice(0,1000), year: String(item.year || '').slice(0,4), venue: String(item.venue || '').slice(0,500), url: `https://doi.org/${encodeURIComponent(item.doi)}` };
    this.db.prepare('INSERT INTO reading_list VALUES(?,?,?) ON CONFLICT(doi) DO UPDATE SET metadata=excluded.metadata').run(item.doi.toLowerCase(),JSON.stringify(metadata),new Date().toISOString());
    return metadata;
  }
  list() { return this.db.prepare('SELECT metadata FROM reading_list ORDER BY created_at DESC').all().map(r => JSON.parse(r.metadata)); }
}
