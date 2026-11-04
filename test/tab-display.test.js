import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { displayTab, unwrapSuspendedUrl } from '../host/lib/tab-display.js';

const SUSPENDER = 'chrome-extension://noogafoofpebimajpfpamcfhoaifemoa/suspended.html';

describe('unwrapSuspendedUrl', () => {
  it('サスペンド URL から元のタイトルと URL を取り出す', () => {
    const url = `${SUSPENDER}#ttl=%E4%BE%8B%20%7C%20Notion&pos=0&uri=https://example.com/a?b=1#c`;
    assert.deepEqual(unwrapSuspendedUrl(url), { title: '例 | Notion', url: 'https://example.com/a?b=1#c' });
  });

  it('復号できないタイトルはそのまま返す', () => {
    const url = `${SUSPENDER}#ttl=100%&pos=0&uri=https://example.com/`;
    assert.equal(unwrapSuspendedUrl(url).title, '100%');
  });

  it('通常の URL は null', () => {
    assert.equal(unwrapSuspendedUrl('https://example.com/'), null);
  });
});

describe('displayTab', () => {
  it('タイトルが空なら URL をタイトルにする', () => {
    assert.deepEqual(displayTab({ title: '', url: 'https://example.com/' }), { title: 'https://example.com/', url: 'https://example.com/' });
  });

  it('サスペンド中のタブは元のタイトルと URL を使う', () => {
    const tab = { title: `${SUSPENDER}#ttl=x`, url: `${SUSPENDER}#ttl=Doc&pos=0&uri=https://example.com/doc` };
    assert.deepEqual(displayTab(tab), { title: 'Doc', url: 'https://example.com/doc' });
  });
});
