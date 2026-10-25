/* Intro preferences for the homepage scroll intro.
   - "Skip intro from now on" saves the choice in this browser (localStorage) and hides the intro.
   - On a first visit, the two skip buttons stay hidden until the intro has played (they appear
     during the final BTU LAB beat). On later visits they show right away.
   - The footer's "Bring back the intro" link (shown only while the choice is saved) clears it and plays the intro again.
   The classes that must exist before the first paint (no-intro, intro-first / intro-returning)
   are set by the small inline script in index.html's <head>. */
(function () {
    var KEY = 'btu-skip-intro';
    var root = document.documentElement;

    function withStorage(fn) {
        try { return fn(window.localStorage); } catch (e) { return null; }
    }

    var replayLinks = document.querySelectorAll('[data-intro-replay]');
    // the footer button only shows while "skip intro from now on" is saved (it undoes that choice)
    function labelReplay(skipping) {
        replayLinks.forEach(function (link) { link.hidden = !skipping; });
    }
    labelReplay(withStorage(function (s) { return s.getItem(KEY) === '1'; }));

    var intro = document.querySelector('.intro');

    // footer link, on every page
    replayLinks.forEach(function (link) {
        link.addEventListener('click', function (event) {
            withStorage(function (s) { s.removeItem(KEY); });
            if (intro) {
                // already on the homepage: put the intro back and start it from the top
                event.preventDefault();
                root.classList.remove('no-intro');
                labelReplay(false);
                window.scrollTo(0, 0);
            }
            // other pages: the link goes to index.html, which now plays the intro
        });
    });

    if (!intro) return;

    var wrap = intro.querySelector('.skip-wrap');
    var forever = intro.querySelector('.skip-forever');
    var canSave = withStorage(function (s) {
        s.setItem('btu-storage-test', '1');
        s.removeItem('btu-storage-test');
        return true;
    });

    if (forever && canSave) {
        forever.hidden = false;
        forever.addEventListener('click', function () {
            withStorage(function (s) { s.setItem(KEY, '1'); });
            root.classList.add('no-intro');
            labelReplay(true);
            window.scrollTo(0, 0);
            var content = document.getElementById('content');
            if (content) {
                content.setAttribute('tabindex', '-1');
                content.focus({ preventScroll: true });
            }
        });
    }

    // first visit: show the buttons once the last beat of the intro (BTU LAB) has landed
    if (wrap && root.classList.contains('intro-first')) {
        var END = 0.915; // share of the pinned scroll where BTU LAB has landed (progD in introD-cushion.css)
        var reveal = function () {
            var box = intro.getBoundingClientRect();
            var pinned = box.height - window.innerHeight;
            if (pinned <= 0 || -box.top / pinned >= END) {
                wrap.classList.add('is-revealed');
                window.removeEventListener('scroll', reveal);
            }
        };
        window.addEventListener('scroll', reveal, { passive: true });
        reveal();
    }
})();
