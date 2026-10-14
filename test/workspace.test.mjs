import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.mjs';

test('stale edits are rejected across database connections; revisions survive reopen and restore', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'folio-store-test-'));
  const a = new Store(dir), b = new Store(dir);
  const project = a.create('Research', { 'main.tex': 'Original' });
  const before = b.readFile(project.id, 'main.tex');
  const edited = a.replaceText(project.id, 1, 'main.tex', 'Original', 'Revised');
  assert.equal(edited.revision, 2);
  assert.throws(() => b.writeFile(project.id, before.revision, 'main.tex', 'Stale'), { code: 'REVISION_CONFLICT' });
  assert.equal(b.readFile(project.id, 'main.tex').content, 'Revised');
  assert.equal(b.restore(project.id, 2, 1).files['main.tex'], 'Original');
  a.close(); b.close();
  const reopened = new Store(dir);
  assert.equal(reopened.get(project.id).revision, 3);
  assert.equal(reopened.history(project.id).length, 3);
  reopened.close();
});

test('safe exports preserve nested text, invalid paths and ambiguous edits make no changes', () => {
  const store = new Store(mkdtempSync(path.join(os.tmpdir(), 'folio-export-test-')));
  const p = store.create('Export', { 'sections/test.tex': 'test test' });
  for (const filename of ['../outside.tex', 'C:/outside.tex', '/outside.tex', 'a/../../x.tex', 'NUL.tex', 'a\\b.tex']) {
    assert.throws(() => store.writeFile(p.id, 1, filename, 'bad'), { code: 'INVALID_FILENAME' });
  }
  assert.throws(() => store.replaceText(p.id, 1, 'sections/test.tex', 'test', 'changed'), { code: 'AMBIGUOUS_EDIT' });
  assert.throws(() => store.replace(p.id, 1, 'Export', { 'A.tex': '', 'a.tex': '' }), { code: 'INVALID_FILENAME' });
  assert.throws(() => store.replace(p.id, 1, 'Export', {}), { code: 'INVALID_FILES' });
  assert.equal(store.get(p.id).revision, 1);
  const exported = store.export(p.id);
  assert.equal(readFileSync(path.join(exported.directory, 'sections/test.tex'), 'utf8'), 'test test');
  store.close();
});
