(function () {
  'use strict';

  var CHAR_MS = 40;
  var VITAL_STAGGER_MS = 90;
  var ARM_RATIO = 0.55;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var beats = Array.prototype.slice.call(document.querySelectorAll('.beat'));
  var busy = false;
  var nextIdx = 0;

  function showCursor(el) {
    if (!el) return;
    el.hidden = false;
  }

  function hideCursor(el) {
    if (!el) return;
    el.hidden = true;
  }

  function hideAllCursors(root) {
    (root || document).querySelectorAll('.cursor').forEach(function (c) {
      if (!c.classList.contains('idle-cursor')) hideCursor(c);
    });
  }

  function typeText(span, text, cursor, done) {
    if (reduceMotion) {
      span.textContent = text;
      hideCursor(cursor);
      done();
      return;
    }
    var i = 0;
    span.textContent = '';
    showCursor(cursor);
    function step() {
      if (i < text.length) {
        span.textContent += text.charAt(i);
        i += 1;
        setTimeout(step, CHAR_MS);
      } else {
        hideCursor(cursor);
        done();
      }
    }
    step();
  }

  function typeLines(beat, done) {
    var lines = Array.prototype.slice.call(beat.querySelectorAll('.typed'));
    var idx = 0;

    function next() {
      if (idx >= lines.length) {
        done();
        return;
      }
      var span = lines[idx];
      var cursor = span.parentElement.querySelector('.cursor');
      var text = span.getAttribute('data-type') || '';
      idx += 1;
      typeText(span, text, cursor, next);
    }

    next();
  }

  function revealInstall(beat, done) {
    beat.classList.remove('is-pending');
    beat.classList.add('is-active');
    hideAllCursors(beat);
    beat.classList.remove('is-active');
    beat.classList.add('is-done');
    beat.setAttribute('data-played', 'true');
    done();
  }

  function staggerVitals(beat, done) {
    var block = beat.querySelector('.vital-block');
    var vitals = Array.prototype.slice.call(beat.querySelectorAll('[data-vital]'));
    var payoffGap = beat.querySelector('.payoff-gap');
    var payoff = beat.querySelector('.payoff');
    var idleGap = beat.querySelector('.idle-gap');
    var idle = beat.querySelector('.idle-prompt');

    vitals.forEach(function (v) {
      v.hidden = true;
      v.classList.remove('is-shown');
    });
    if (block) block.hidden = false;

    if (reduceMotion) {
      vitals.forEach(function (v) { v.hidden = false; v.classList.add('is-shown'); });
      if (payoffGap) payoffGap.hidden = false;
      if (payoff) payoff.hidden = false;
      if (idleGap) idleGap.hidden = false;
      if (idle) {
        idle.hidden = false;
        var idleCur = idle.querySelector('.cursor');
        if (idleCur) idleCur.hidden = false;
      }
      done();
      return;
    }

    var i = 0;
    function showNext() {
      if (i < vitals.length) {
        vitals[i].hidden = false;
        vitals[i].classList.add('is-shown');
        i += 1;
        setTimeout(showNext, VITAL_STAGGER_MS);
        return;
      }
      if (payoffGap) payoffGap.hidden = false;
      if (payoff) payoff.hidden = false;
      setTimeout(function () {
        if (idleGap) idleGap.hidden = false;
        if (idle) {
          idle.hidden = false;
          var idleCur = idle.querySelector('.cursor');
          if (idleCur) idleCur.hidden = false;
        }
        done();
      }, 120);
    }
    showNext();
  }

  function playDemo(beat, done) {
    var promptSpan = beat.querySelector('.demo-prompt .typed');
    var promptCursor = beat.querySelector('.demo-prompt .cursor');
    var text = promptSpan ? (promptSpan.getAttribute('data-type') || '') : '';

    typeText(promptSpan, text, promptCursor, function () {
      setTimeout(function () {
        staggerVitals(beat, done);
      }, reduceMotion ? 0 : 160);
    });
  }

  function playBeat(beat, done) {
    var kind = beat.getAttribute('data-beat');
    beat.classList.remove('is-pending');
    beat.classList.add('is-active');
    hideAllCursors();

    function finish() {
      beat.classList.remove('is-active');
      beat.classList.add('is-done');
      beat.setAttribute('data-played', 'true');
      done();
    }

    if (kind === 'install') {
      revealInstall(beat, finish);
      return;
    }
    if (kind === 'demo') {
      playDemo(beat, finish);
      return;
    }
    typeLines(beat, finish);
  }

  function isArmed(beat) {
    var vh = window.innerHeight;
    var armY = vh * ARM_RATIO;

    // Prefer the preceding spacer: fire when its bottom (where the
    // reply will land) crosses ~55% of the viewport.
    var prev = beat.previousElementSibling;
    if (prev && prev.classList.contains('spacer')) {
      if (prev.getBoundingClientRect().bottom < armY) return true;
    }

    var rect = beat.getBoundingClientRect();
    if (rect.top < armY) return true;

    // Last collapsed beat: at max scroll it sits at the viewport
    // bottom and would never cross 55% — force-fire near bottom.
    var maxScroll = document.documentElement.scrollHeight - vh;
    if (maxScroll <= 0) return true;
    if (window.scrollY >= maxScroll - 32) return true;

    return false;
  }

  function tryAdvance() {
    if (busy) return;
    if (nextIdx >= beats.length) return;

    var beat = beats[nextIdx];
    if (beat.getAttribute('data-played') === 'true') {
      nextIdx += 1;
      tryAdvance();
      return;
    }

    // Boot always plays on load; later beats need the 55% arm line
    if (nextIdx > 0 && !isArmed(beat)) return;

    busy = true;
    playBeat(beat, function () {
      nextIdx += 1;
      busy = false;
      // Allow immediate chain if already past arm line (e.g. tall viewport)
      requestAnimationFrame(tryAdvance);
    });
  }

  function revealAllImmediate() {
    beats.forEach(function (beat) {
      beat.classList.remove('is-pending');
      beat.classList.add('is-done');
      beat.setAttribute('data-played', 'true');

      beat.querySelectorAll('.typed').forEach(function (span) {
        span.textContent = span.getAttribute('data-type') || '';
      });
      beat.querySelectorAll('.cursor').forEach(function (c) {
        if (c.classList.contains('idle-cursor')) {
          c.hidden = false;
        } else {
          c.hidden = true;
        }
      });

      var block = beat.querySelector('.vital-block');
      if (block) block.hidden = false;
      beat.querySelectorAll('[data-vital]').forEach(function (v) {
        v.hidden = false;
        v.classList.add('is-shown');
      });
      ['.payoff-gap', '.payoff', '.idle-gap', '.idle-prompt'].forEach(function (sel) {
        var el = beat.querySelector(sel);
        if (el) el.hidden = false;
      });
    });
    nextIdx = beats.length;
    busy = false;
  }

  function bindCopy() {
    var btn = document.getElementById('copy-install');
    var cmdEl = document.getElementById('install-cmd');
    if (!btn || !cmdEl) return;

    btn.addEventListener('click', function () {
      var cmd = cmdEl.textContent.trim();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cmd).then(function () {
          btn.textContent = 'ok';
          setTimeout(function () { btn.textContent = 'copy'; }, 1200);
        }).catch(function () {
          btn.textContent = 'select';
        });
      } else {
        btn.textContent = 'select';
      }
    });
  }

  function start() {
    bindCopy();

    if (reduceMotion) {
      revealAllImmediate();
      return;
    }

    // Hide pending beat content until played
    beats.forEach(function (beat, i) {
      if (i === 0) return;
      beat.classList.add('is-pending');
    });

    window.addEventListener('scroll', tryAdvance, { passive: true });
    window.addEventListener('resize', tryAdvance, { passive: true });

    tryAdvance();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
