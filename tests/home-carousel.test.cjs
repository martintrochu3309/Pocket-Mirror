const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const source = html.slice(html.indexOf('  /* ---- Home path carousel'), html.indexOf('  /* ---- Painters'));

function setup(reducedMotion = false) {
  function element() {
    const attributes = {}, styles = {}, listeners = {}, classes = new Set();
    return {
      attributes, styles, listeners, clientWidth: 1000, textContent: '',
      style: { setProperty: (key, value) => { styles[key] = value; } },
      classList: { add: key => classes.add(key), remove: key => classes.delete(key), toggle: (key, on) => on ? classes.add(key) : classes.delete(key) },
      setAttribute: (key, value) => { attributes[key] = value; },
      removeAttribute: key => { delete attributes[key]; },
      addEventListener: (key, fn) => { listeners[key] = fn; },
      appendChild() {}, querySelector: () => ({ cloneNode: () => ({}) }),
      setPointerCapture() {}, hasPointerCapture: () => false, releasePointerCapture() {}
    };
  }
  const cards = [element(), element(), element()], carousel = element(), question = element();
  let now = 0, pending = null;
  const destinations = [];
  const context = vm.createContext({
    document: { querySelectorAll: () => cards, getElementById: id => id === 'boosterCarousel' ? carousel : question, createElement: element },
    window: { matchMedia: () => ({ matches: reducedMotion }) },
    performance: { now: () => now },
    requestAnimationFrame: fn => { pending = fn; return 1; }, cancelAnimationFrame: () => { pending = null; },
    go: destination => destinations.push(destination)
  });
  vm.runInContext(source, context);
  const dispatch = (type, props = {}) => carousel.listeners[type]({ isPrimary: true, pointerId: 1, button: 0, clientX: 500, clientY: 200, preventDefault() {}, ...props });
  const finish = () => { now += 501; const fn = pending; pending = null; if (fn) fn(now); };
  const selected = () => cards.findIndex(card => card.attributes['aria-current'] === 'true');
  return { cards, carousel, context, dispatch, finish, selected, destinations };
}

test('starts with SEE IT centered and bright side mirrors at the intended scale', () => {
  const s = setup();
  assert.equal(s.selected(), 0);
  assert.equal(Number(s.cards[0].styles['--booster-scale']), 1);
  assert.equal(Number(s.cards[1].styles['--booster-scale']), .74);
  assert.equal(Number(s.cards[2].styles['--booster-scale']), .74);
  assert.ok(Number(s.cards[0].style.zIndex) > Number(s.cards[1].style.zIndex));
});

test('keyboard cycles infinitely in both directions without a visual reset', () => {
  const s = setup();
  for (const expected of [1, 2, 0, 1, 2, 0]) {
    s.dispatch('keydown', { key: 'ArrowRight' }); s.finish(); assert.equal(s.selected(), expected);
  }
  for (const expected of [2, 1, 0, 2, 1, 0]) {
    s.dispatch('keydown', { key: 'ArrowLeft' }); s.finish(); assert.equal(s.selected(), expected);
  }
  const before = s.cards.map(card => ({ ...card.styles }));
  s.dispatch('keydown', { key: 'ArrowLeft' }); s.finish();
  s.dispatch('keydown', { key: 'ArrowLeft' }); s.finish();
  s.dispatch('keydown', { key: 'ArrowLeft' }); s.finish();
  s.cards.forEach((card, index) => Object.keys(card.styles).forEach(key => {
    assert.ok(Math.abs(parseFloat(card.styles[key]) - parseFloat(before[index][key])) < .001);
  }));
});

test('drag follows the pointer, settles to the nearest tile, and suppresses its click', () => {
  const s = setup();
  s.dispatch('pointerdown'); s.dispatch('pointermove', { clientX: 300 });
  assert.ok(s.context.boosterPhase > 0 && s.context.boosterPhase < 1);
  s.dispatch('pointerup', { clientX: 300 }); s.finish(); assert.equal(s.selected(), 1);
  let prevented = false;
  s.cards[2].listeners.click({ detail: 1, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true); assert.deepEqual(s.destinations, []);
  s.dispatch('pointerdown'); s.dispatch('pointerup');
  s.cards[0].listeners.click({ detail: 1 });
  assert.deepEqual(s.destinations, ['awareness']);
});

test('short drag returns to the nearest tile and vertical scrolling does not rotate', () => {
  const s = setup();
  s.dispatch('pointerdown'); s.dispatch('pointermove', { clientX: 470 }); s.dispatch('pointerup'); s.finish();
  assert.equal(s.selected(), 0);
  s.dispatch('pointerdown'); s.dispatch('pointermove', { clientY: 260 }); s.finish();
  assert.equal(s.selected(), 0); assert.equal(s.context.boosterPointer, null);
});

test('cancelled gestures settle and all mirrors open their destinations from the keyboard', () => {
  const s = setup();
  s.dispatch('pointerdown'); s.dispatch('pointermove', { clientX: 280 }); s.dispatch('pointercancel'); s.finish();
  assert.equal(s.context.boosterPointer, null);
  s.cards.forEach(card => card.listeners.click({ detail: 0 }));
  assert.deepEqual(s.destinations, ['awareness', 'acceptance', 'action']);
});

test('reduced motion settles instantly', () => {
  const s = setup(true);
  s.dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(s.selected(), 1); assert.equal(s.context.boosterPhase, 1);
});

test('touch capture transferring from a mirror to the carousel does not cancel the swipe', () => {
  const s = setup();
  s.carousel.setPointerCapture = () => s.dispatch('lostpointercapture', { target: s.cards[1], pointerType: 'touch' });
  s.dispatch('pointerdown', { target: s.cards[1], pointerType: 'touch' });
  s.dispatch('pointermove', { clientX: 480, pointerType: 'touch' });
  assert.ok(s.context.boosterPointer, 'capture lost by the child must not end the gesture');
  s.dispatch('pointermove', { clientX: 270, pointerType: 'touch' });
  s.dispatch('pointerup', { clientX: 270, pointerType: 'touch' }); s.finish();
  assert.equal(s.selected(), 1);
  assert.deepEqual(s.destinations, []);
});

test('losing carousel capture still ends the gesture safely', () => {
  const s = setup(); s.dispatch('pointerdown'); s.dispatch('pointermove', { clientX: 280 });
  s.dispatch('lostpointercapture', { target: s.carousel }); s.finish();
  assert.equal(s.context.boosterPointer, null);
});
