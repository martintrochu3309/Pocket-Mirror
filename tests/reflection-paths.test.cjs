const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function setup() {
  function element() {
    const attributes = {}, classes = new Set(), children = [], listeners = {};
    return { offsetWidth: 220, style: {}, attributes, classes, children, listeners,
      setAttribute(key, value) { attributes[key] = value; }, removeAttribute(key) { delete attributes[key]; },
      classList: { toggle: (key, on) => on ? classes.add(key) : classes.delete(key), add() {}, remove() {} },
      appendChild(child) { children.push(child); }, replaceChildren() { children.length = 0; },
      addEventListener(key, fn) { listeners[key] = fn; }, remove() {}
    };
  }
  const flow = element(), nav = element(), dots = element(), conditions = element(), picker = element();
  const properties = {}, calls = [];
  const elements = { flow, bottomNav: nav, nudgeDots: dots, nudgeConditions: conditions, nudgePicker: picker };
  const context = vm.createContext({
    document: {
      getElementById: id => elements[id],
      documentElement: { style: { setProperty: (key, value) => { properties[key] = value; } } },
      createElement: element
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
  return { context, flow, nav, dots, conditions, picker, properties, calls,
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
    s.key('Enter');
    if(stage==='awareness'){assert.equal(s.context.cards[0]._flipped,true);assert.equal(s.calls.length,0);}
    else assert.equal(s.calls.at(-1).route, 'saver');
    for (let i = 0; i < 4; i++) s.key('ArrowRight');
    assert.equal(s.context.picked, 4);
    assert.match(s.context.cards[4].className, /is-look-more/);
    assert.equal(s.context.cards[4].attributes['aria-selected'], 'true');
    assert.match(s.context.cards[4].style.transform, /translateZ\(32.0px\).*scale\(1.040\)/);
    s.key('ArrowRight'); assert.equal(s.context.picked, 4);
    s.key('Enter');
    assert.equal(s.context.activeDeck[4].flip,undefined);
    assert.equal(s.context.cards[4]._frontFace,undefined);
    assert.equal(s.calls.at(-1).route, 'lookmore');
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

for (const stage of ['awareness', 'acceptance', 'action']) {
  test(stage + ' dots select cards and update three guidance statements without opening a path', () => {
    const s = setup(); s.context.paintDeck(stage);
    assert.equal(s.dots.children.length, 5);
    assert.equal(s.picker.open, true);
    for (const index of [2, 4, 0, 3, 1]) {
      s.dots.children[index].listeners.click();
      assert.equal(s.context.picked, index);
      assert.equal(s.dots.children.filter(dot => dot.attributes['aria-current'] === 'true').length, 1);
      assert.equal(s.dots.children[index].attributes['aria-current'], 'true');
      assert.deepEqual(s.conditions.children.map(row => row.textContent), Array.from(s.context.activeDeck[index].guidance));
      assert.equal(s.conditions.children.length, 3);
    }
    assert.equal(s.calls.length, 0);
    s.picker.open = false; s.key('ArrowRight');
    assert.equal(s.picker.open, false, 'selection preserves the collapsed state');
    s.context.paintDeck(stage); assert.equal(s.picker.open, true, 'new deck opens its panel');
  });
}

test('Awareness hides its guidance panel without hiding it on the other paths', () => {
  const s = setup();
  for (const stage of ['awareness', 'acceptance', 'awareness', 'action']) {
    s.context.paintDeck(stage);
    assert.equal(s.picker.hidden, stage === 'awareness');
    assert.equal(s.dots.children.length, 5);
    assert.equal(s.context.cards.length, 5);
  }
});

test('Awareness flips back and forth and preserves its face when changing cards', () => {
  const s = setup(); s.context.paintDeck('awareness');
  const first = s.context.cards[0], transform = first.style.transform;
  s.key('Enter'); assert.equal(first._flipped, true);
  assert.equal(first.style.transform, transform);
  assert.equal(first._frontFace.inert, true); assert.equal(first._backFace.inert, false);
  first._backButton.listeners.click({detail:0}); assert.equal(first._flipped, false);
  s.key(' '); assert.equal(first._flipped, true);
  s.dots.children[1].listeners.click(); assert.equal(first._flipped, true);
  assert.equal(s.context.cards[1]._flipped, false);
  s.dots.children[0].listeners.click(); assert.equal(first._flipped, true);
  s.key('Enter'); assert.equal(first._flipped, false);
  assert.equal(s.calls.length, 0);
});
test('Awareness pointer taps flip once and dragging does not flip or navigate', () => {
  const s = setup(); s.context.paintDeck('awareness');
  const first = s.context.cards[0];
  const target = {closest: selector => selector === '.ncard' ? first : null};
  s.flow.listeners.pointerdown({clientX:500,target,pointerId:1});
  s.flow.listeners.pointerup(); assert.equal(first._flipped, true);
  first._frontButton.listeners.click({detail:1}); assert.equal(first._flipped, true);
  s.flow.listeners.pointerdown({clientX:500,target,pointerId:2});
  s.flow.listeners.pointermove({clientX:340});
  s.flow.listeners.pointerup();
  assert.equal(first._flipped, true);
  assert.ok(s.context.cards.slice(1).every(card => !card._flipped));
  assert.equal(s.calls.length, 0);
});
test('Awareness backs 1–4 exist and are preloaded as separate mounted faces', () => {
  const s = setup(); s.context.paintDeck('awareness');
  s.context.activeDeck.slice(0,4).forEach((item,index) => {
    assert.equal(item.backImage, 'images/Nudge Card Back - Awareness ' + (index+1) + '.png');
    assert.ok(fs.existsSync(path.join(__dirname,'..',item.backImage)));
    const card = s.context.cards[index];
    assert.equal(card._backButton.children[0].src, item.backImage);
    assert.equal(card._backButton.children[0].loading, 'eager');
  });
});

test('vertical dragging over Awareness permits native scrolling without flipping or selecting a card', () => {
  const s = setup(); s.context.paintDeck('awareness');
  const first=s.context.cards[0], target={closest: selector => selector==='.ncard'?first:null};
  let captures=0, prevented=0;
  s.flow.setPointerCapture=()=>{captures++;};
  s.flow.listeners.pointerdown({clientX:500,clientY:100,pointerId:1,target});
  assert.equal(captures,0,'pointerdown must not capture a possible vertical scroll');
  s.flow.listeners.pointermove({clientX:503,clientY:170,pointerId:1,cancelable:true,preventDefault(){prevented++;}});
  s.flow.listeners.pointerup();
  assert.equal(captures,0); assert.equal(prevented,0);
  assert.equal(s.context.turning,false); assert.equal(s.context.picked,0);
  assert.equal(first._flipped,false); assert.equal(s.calls.length,0);
});
test('horizontal swiping tolerates child capture transfer and preserves previously flipped cards', () => {
  const s=setup(); s.context.paintDeck('awareness'); s.key('Enter');
  const first=s.context.cards[0], target={closest: selector => selector==='.ncard'?first:null};
  s.flow.setPointerCapture=()=>s.flow.listeners.lostpointercapture({target:first});
  s.flow.listeners.pointerdown({clientX:500,clientY:100,pointerId:1,target});
  s.flow.listeners.pointermove({clientX:460,clientY:102,pointerId:1});
  assert.equal(s.context.turning,true);
  s.flow.listeners.pointermove({clientX:340,clientY:105,pointerId:1});
  s.flow.listeners.pointerup();
  assert.equal(s.context.picked,1); assert.equal(first._flipped,true);
  s.key('ArrowLeft'); assert.equal(s.context.picked,0); assert.equal(first._flipped,true);
});

test('swipe positions update immediately without repeated layout reads or selection writes', () => {
  const s=setup(); s.context.paintDeck('awareness');
  const first=s.context.cards[0], target={closest: selector => selector==='.ncard'?first:null};
  s.flow.listeners.pointerdown({clientX:500,clientY:100,pointerId:1,target});
  let writes=0;
  for(const card of s.context.cards){
    Object.defineProperty(card,'offsetWidth',{get(){throw new Error('Layout read during swipe');}});
    const set=card.setAttribute;card.setAttribute=(...args)=>{writes++;set(...args);};
  }
  s.flow.listeners.pointermove({clientX:480,clientY:101,pointerId:1});
  const firstTransform=first.style.transform;
  assert.ok(Math.abs(s.context.pos-20/(220*.56))<1e-9);
  s.flow.listeners.pointermove({clientX:460,clientY:102,pointerId:1});
  assert.ok(Math.abs(s.context.pos-40/(220*.56))<1e-9);
  assert.notEqual(first.style.transform,firstTransform);
  assert.equal(writes,0,'unchanged selection does not update every face on each move');
  assert.equal(first._flipped,false);
  s.flow.listeners.pointerup();
  assert.equal(s.calls.length,0);
});
