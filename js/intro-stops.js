/* Scroll stops for the homepage intro (dash, 10-25).
   During the intro a swipe moves the page as usual, but when the movement reaches the next stop the page stops
   there, even if the swipe's momentum would carry it further. The rest of that swipe is ignored; the next swipe
   continues from the stop. Below the intro there are no stops, except that scrolling back up stops at the
   hero (the start of #content) from anywhere on the page (dash, 10-25: "when you're on the main page and
   you're past the fold, if you scroll up to the top of the page, it stops at the hero image").

   Why every trackpad/wheel swipe on the homepage is handled here, not just the ones inside the intro: Safari
   (like Chrome) only lets a page cancel a swipe from its first wheel event. A swipe that starts as ordinary
   scrolling in the panels can't be stopped once it reaches the hero, so it used to run on up to BTU LAB.
   Handling every swipe from its first event lets the hero stop hold wherever the swipe started.

   Stops, as a share of the intro's pinned scroll (the progD keyframes in introD-cushion.css):
   .4393 BLOW held · .6197 THINGS held · .7999 UP held · .995 BTU LAB landed (the end of its hold, so the next swipe
   goes straight into the stage leaving; was .9573, mid-hold, which left a still stretch after the stop) · then the start of the
   page content (#content). No stop on the explosion (dash, 10-25: "I don't want a scroll stop on the
   explosion part").

   The BTU LAB slide (UP held to BTU LAB landed) always plays slowly (dash, 10-25: "I want that to come in
   slowly, even if you swipe fast"): a downward swipe there sets where the page is heading, and the page
   glides toward it. Only the part where something moves on screen (UP bursting and the BTU LAB badge
   coming in, --t .925 to 1) goes at the slow pace; the still stretches before and after it go FAST times
   quicker, so a swipe from UP starts the burst straight away (dash, 10-25: "make sure that it goes straight
   into that rather than waiting for a second"; then "it moves very slightly ... pauses, and then goes into
   the action. I want to eliminate that pause"). While gliding, html gets .intro-gliding, which turns off
   the intro's 0.52s --t smoothing (introD.css): the glide is already smooth, and the smoothing's slow
   ease-out was what made the pause.

   Mouse wheel and trackpad are handled with wheel events, touch with touch events. Keyboard scrolling, the
   scrollbar and the "Skip the intro" link are left alone. Off when the intro is skipped, when the visitor asks
   for reduced motion, or when the browser can't run the scroll-driven intro (it shows a static title then). */
(function () {
    var intro = document.querySelector('.intro');
    var content = document.getElementById('content');
    if (!intro || !content) return;
    if (!(window.CSS && CSS.supports('animation-timeline: view()'))) return;
    var calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    var root = document.documentElement;
    var BEATS = [0.4393, 0.6197, 0.7999, 0.995];
    var SLOW_FROM = 2, SLOW_TO = 3;   // indexes into stops: UP held -> BTU LAB landed
    // where the burst moves, as a share of the pinned scroll: --t .925 (UP starts to burst, introD.css --x) to 1 on the progD keyframes
    // (--t .88 at 81.70940%, 1 at 91.45299%)
    var MOVE_FROM = 0.8170940 + (0.925 - 0.88) / 0.12 * (0.9145299 - 0.8170940), MOVE_TO = 0.9145299;
    var SLOW = 0.04919;   // the burst's pace, in pinned-scroll lengths per second (the pace dash approved 10-25)
    var FAST = 20;        // how much quicker the still stretches go (UP to the burst takes about 0.05s)
    // the burst starts RAMP times quicker and eases to the approved pace by --t .945 (the badge starts)
    var RAMP = 4, RAMP_END = 0.8170940 + (0.945 - 0.88) / 0.12 * (0.9145299 - 0.8170940);

    var stops = [], measuredFor = '';
    function measure() {
        var key = window.innerWidth + 'x' + window.innerHeight + (root.classList.contains('no-intro') ? 'n' : '');
        if (key === measuredFor && stops.length) return;
        measuredFor = key;
        var top = intro.getBoundingClientRect().top + window.scrollY;
        var range = intro.offsetHeight - window.innerHeight;
        var margin = parseFloat(getComputedStyle(content).scrollMarginTop) || 0;
        var contentStop = content.getBoundingClientRect().top + window.scrollY - margin;
        stops = BEATS.map(function (p) { return Math.round(top + p * range); });
        stops.push(Math.round(contentStop));
        moveFrom = top + MOVE_FROM * range; moveTo_ = top + MOVE_TO * range; slowSpeed = SLOW * range;
        rampEnd = top + RAMP_END * range;
    }
    var moveFrom = 0, moveTo_ = 0, rampEnd = 0, slowSpeed = 500;
    function active() { return !calm.matches && !root.classList.contains('no-intro'); }

    // the first stop crossed going from y to target (in the direction of travel), or null
    function stopBetween(y, target) {
        var hit = null;
        for (var i = 0; i < stops.length; i++) {
            var s = stops[i];
            if (target > y && s > y + 0.5 && s <= target) { if (hit === null || s < hit) hit = s; }
            if (target < y && s < y - 0.5 && s >= target) { if (hit === null || s > hit) hit = s; }
        }
        return hit;
    }
    function maxScroll() { return document.documentElement.scrollHeight - window.innerHeight; }
    // keep the fractional position between events: browsers round scrollY, which would drop the small
    // deltas at the end of a trackpad's momentum
    var exact = null;
    function currentY() { var y = window.scrollY; return (exact !== null && Math.abs(exact - y) < 1) ? exact : y; }
    function moveTo(y) { exact = y; window.scrollTo(0, y); }

    // ---- the slow BTU LAB slide ----
    // pace of the glide at scroll position y: quick across the still stretches, quick at the start of the
    // burst (UP's fly-at-the-camera starts slowly, so playing it slowly read as a pause), easing down to
    // the approved pace by the time the BTU LAB badge starts coming in, then that pace until it lands
    function paceAt(y) {
        if (y < moveFrom - 0.5 || y >= moveTo_) return slowSpeed * FAST;
        if (y < rampEnd) return slowSpeed * (RAMP + (1 - RAMP) * (y - moveFrom) / (rampEnd - moveFrom));
        return slowSpeed;
    }
    function inSlowZone(y) { return y >= stops[SLOW_FROM] - 0.5 && y < stops[SLOW_TO] - 0.5; }
    var glideTo = null, glideY = 0, glideLast = 0, glideFrame = 0;
    function glideStep(now) {
        glideFrame = 0;
        if (glideTo === null) return;
        if (Math.abs(window.scrollY - glideY) > 3) { glideTo = null; exact = null; smoothing(true); return; } // moved by something else (scrollbar, keyboard, skip link)
        var dt = Math.min(0.1, Math.max(0, (now - glideLast) / 1000));
        glideLast = now;
        // spend this frame's time in small steps, each at the pace for where the page is
        var guard = 0;
        while (dt > 0 && glideY < glideTo && ++guard < 2000) {
            var speed = paceAt(glideY);
            var next = Math.min(glideTo, glideY + 4, glideY + speed * dt);
            dt -= (next - glideY) / speed;
            glideY = next;
        }
        moveTo(glideY);
        if (glideY >= glideTo - 0.01) { glideTo = null; smoothing(true); return; }
        glideFrame = requestAnimationFrame(glideStep);
    }
    // push the glide target on by dy; returns true when the target has reached BTU LAB landed
    function glideBy(y, dy) {
        if (glideTo === null) { glideY = y; glideTo = y; glideLast = performance.now(); smoothing(false); }
        glideTo = Math.min(stops[SLOW_TO], glideTo + dy);
        if (!glideFrame) glideFrame = requestAnimationFrame(glideStep);
        return glideTo >= stops[SLOW_TO];
    }
    function stopGlide() { glideTo = null; smoothing(true); if (glideFrame) { cancelAnimationFrame(glideFrame); glideFrame = 0; } }
    function smoothing(on) { root.classList.toggle('intro-gliding', !on); }
    // a glide left behind by an outside scroll (scrollbar, keyboard, skip link) is dropped before it is used
    function checkGlide() { if (glideTo !== null && Math.abs(window.scrollY - glideY) > 3) { stopGlide(); exact = null; } }

    // ---- wheel (mouse wheel, trackpad and its momentum) ----
    var blocked = false, blockedAt = 0, trough = 0, lastTime = 0, lastDir = 0;
    window.addEventListener('wheel', function (e) {
        if (!active() || e.ctrlKey) return;                       // ctrl+wheel is pinch zoom
        var dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= window.innerHeight;
        if (dy === 0 || Math.abs(e.deltaX) > Math.abs(dy)) return;
        measure(); checkGlide();
        var y = currentY(), end = stops[stops.length - 1], target = y + dy;
        e.preventDefault();

        var now = e.timeStamp, size = Math.abs(dy), dir = dy > 0 ? 1 : -1;
        var gap = now - lastTime;
        lastTime = now;
        if (blocked) {
            // a new swipe: a pause, a change of direction, or (while momentum is still fading) a fresh push
            // that is much stronger than the weakest leftover momentum seen since the stop
            var fresh = gap > 160 || dir !== lastDir || (now - blockedAt > 300 && size > trough * 2.5 + 6 && size > 12);
            lastDir = dir;
            if (!fresh) { trough = Math.min(trough, size); return; }
            blocked = false;
        }
        lastDir = dir;
        if (dir > 0 && (glideTo !== null || inSlowZone(y))) {
            if (glideTo !== null) y = glideY;
            if (glideBy(y, dy)) { blocked = true; blockedAt = now; trough = size; }
            return;
        }
        if (glideTo !== null) { y = glideY; stopGlide(); }       // swiping back up cancels the glide
        target = Math.max(0, Math.min(maxScroll(), y + dy));
        var stop = stopBetween(y, target);
        if (stop !== null) {
            moveTo(stop);
            blocked = true; blockedAt = now; trough = size;
        } else {
            moveTo(target);
        }
    }, { passive: false });

    // ---- touch (phones): a drag that starts in the intro stops at the next stop until the finger lifts ----
    var touchY = null, touchBlocked = false, touchOwned = false;
    window.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) { touchY = null; return; }
        touchY = e.touches[0].clientY; touchBlocked = false;
        measure();
        touchOwned = active() && window.scrollY <= stops[stops.length - 1] + 1;
    }, { passive: true });
    window.addEventListener('touchmove', function (e) {
        if (!touchOwned || touchY === null || e.touches.length !== 1) return;
        e.preventDefault();
        var cy = e.touches[0].clientY, d = touchY - cy;
        touchY = cy;
        if (touchBlocked || d === 0) return;
        checkGlide();
        var y = glideTo !== null ? glideY : currentY();
        if (d > 0 && (glideTo !== null || inSlowZone(y))) { if (glideBy(y, d)) touchBlocked = true; return; }
        if (glideTo !== null) stopGlide();
        var target = Math.max(0, Math.min(maxScroll(), y + d));
        var stop = stopBetween(y, target);
        if (stop !== null) { moveTo(stop); touchBlocked = true; }
        else moveTo(target);
    }, { passive: false });
    window.addEventListener('touchend', function () { touchY = null; touchOwned = false; }, { passive: true });

    window.addEventListener('resize', function () { measuredFor = ''; });
})();
