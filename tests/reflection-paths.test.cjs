const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function setup() {
  const flow = { listeners: {}, appendChild() {}, addEventListener(key, fn) { this.listeners[key] = fn; } };
  const nav = {}, properties = {}, calls = [];
  const context = vm.createContext({
    document: {
      getElementById: id => id === 'flow' ? flow : nav,
      documentElement: { style: { setProperty: (key, value) => { properties[key] = value; } } },
      createElement: () => {
        const attributes = {}, classes = new Set();
        return { offsetWidth: 220, style: {}, attributes, classes,
          setAttribute(key, value) { attributes[key] = value; },
          classList: { toggle: (key, on) => on ? classes.add(key) : classes.delete(key), add() {}, remove() {} },
          remove() {}
        };
      }
    },
    window: { matchMedia: () => ({ matches: true }) },
    cancelAnimationFrame() {}, requestAnimationFrame() { throw new Error('Reduced motion must settle immediately'); },
    setTimeout(fn) { fn(); }, go: (route, opts) => calls.push({ route, opts })
  });
  vm.runInContext(html.slice(html.indexOf('  var GLANCE_CARDS ='), html.indexOf('  var EPISODES =')), context);
  const imageStart = html.indexOf('  function cardImage(');
  vm.runInContext(html.slice(imageStart, html.indexOf('  function paintSaver(', imageStart)), context);
  const deckStart = html.indexOf('  var flow    =');
  vm.runInContext(html.slice(deckStart, html.indexOf('  window.addEventListener("resize"', deckStart)), context);
  const navStart = html.indexOf('  function syncNavigation(');
  vm.runInContext(html.slice(navStart, html.indexOf('  function show(', navStart)), context);
  return { context, flow, nav, properties, calls,
    key: key => flow.listeners.keydown({ key, preventDefault() {} }) };
}
for (const stage of ['awareness', 'acceptance', 'action']) {
  test(stage + ' has four regular cards, then Look More with stronger center emphasis', () => {
    const s = setup(); s.context.paintDeck(stage);
    assert.equal(s.context.cards.length, 5);
    assert.equal(s.context.cards.filter(c => c.classes.has('is-centered')).length, 1);
    const backScale = Number(s.context.cards[1].style.transform.match(/scale\(([^)]+)\)/)[1]);
    assert.ok(Math.abs(backScale - .93 * .95) < .001, 'background neighbor is five percent smaller');
    assert.match(s.context.cards[0].style.transform, /translateZ\(20.0px\).*scale\(1.020\)/);
    s.key('Enter'); assert.equal(s.calls.at(-1).route, 'saver');
    for (let i = 0; i < 4; i++) s.key('ArrowRight');
    assert.equal(s.context.picked, 4);
    assert.match(s.context.cards[4].className, /is-look-more/);
    assert.equal(s.context.cards[4].attributes['aria-selected'], 'true');
    assert.match(s.context.cards[4].style.transform, /translateZ\(32.0px\).*scale\(1.040\)/);
    s.key('ArrowRight'); assert.equal(s.context.picked, 4);
    s.key('Enter'); assert.equal(s.calls.at(-1).route, 'lookmore');
  });
}
test('bottom navigation is hidden until signup and respects full-screen surfaces', () => {
  const s = setup();
  for (const unlocked of [false, true]) {
    s.context.demoUnlocked = unlocked;
    for (const route of ['awareness', 'acceptance', 'action', 'lookmore', 'gate', 'mirror21', 'home', 'open', 'saver']) {
      s.context.syncNavigation(route);
      const expected = unlocked && !['home', 'open', 'saver'].includes(route);
      assert.equal(s.nav.hidden, !expected, route + ' unlocked=' + unlocked);
      assert.equal(s.properties['--stage-nav-space'], expected ? '96px' : '0px');
    }
  }
});
test('reflection markup contains only the question and cards; navigation has no Home item', () => {
  const stage = html.slice(html.indexOf('<section class="view reflection-path"'), html.indexOf('<!-- ============================== 4'));
  for (const removed of ['stage-tabs', 'stageLookButton', 'lookDrawer', 'lookMoreAction']) assert.ok(!stage.includes(removed));
  const nav = html.match(/<nav id="bottomNav"[\s\S]*?<\/nav>/)[0];
  assert.deepEqual([...nav.matchAll(/data-go="([^"]+)"/g)].map(m => m[1]), ['awareness', 'acceptance', 'action', 'lookmore', 'mirror21']);
});

test('preview reset clears access only when requested and consumes the reset parameter', () => {
  const start = html.indexOf('  var accessPreviewUrl=');
  const end = html.indexOf('  var stack =', start);
  for (const reset of [false, true]) {
    const storage = new Map([['pm-lookmore-unlocked', '1'], ['pm-home-screen-prompt-dismissed', '1'], ['pm-theme', 'light']]);
    let replaced;
    const context = vm.createContext({ URL,
      window: { location: { href: 'http://localhost:5173/?other=kept' + (reset ? '&reset-lookmore=1' : '') }, history: { state: {}, replaceState: (_, __, href) => { replaced = href; } } },
      set: (key, value) => storage.set(key, value)
    });
    vm.runInContext(html.slice(start, end), context);
    assert.equal(storage.get('pm-lookmore-unlocked'), reset ? '0' : '1');
    assert.equal(storage.get('pm-home-screen-prompt-dismissed'), reset ? '0' : '1');
    assert.equal(storage.get('pm-theme'), 'light');
    if (reset) assert.equal(replaced, 'http://localhost:5173/?other=kept');
    else assert.equal(replaced, undefined);
  }
});
