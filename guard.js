/* guard.js v5 — حماية الصفحات وإخفاء الإحصائيات حسب الصلاحيات المحفوظة في settings.html
   بيقرأ الصلاحيات عن طريق Firebase SDK بتاع الصفحة نفسها (مش REST).
   لازم الصفحة تكون محمّلة firebase-app-compat و firebase-firestore-compat. */
(function () {
  var DEBUG = /[?&]debug/.test(location.search); /* الشريط بيظهر بس لو حطيت ?debug=1 في الرابط */
  var logs = [];
  function dbg() {
    var m = [].slice.call(arguments).join(' ');
    console.log('[guard]', m);
    if (!DEBUG) return;
    logs.push(m);
    var b = document.getElementById('guardDebug');
    if (!b) {
      b = document.createElement('div');
      b.id = 'guardDebug';
      b.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#000;color:#0f0;' +
        'font:13px monospace;padding:10px 14px;direction:ltr;text-align:left;visibility:visible;white-space:pre-wrap;border-top:2px solid #0f0';
      document.documentElement.appendChild(b);
    }
    b.textContent = logs.join('\n');
  }

  var STATS_SELECTORS = {
    'students.html': '.stats-cards',
    'finance.html': '.month-bar, .stats-row'
  };
  var FB = {
    apiKey: "AIzaSyAhBzD1tqxDhqpCklLUXh2LxHTI-lZgPbg", authDomain: "al-gnarl.firebaseapp.com",
    projectId: "al-gnarl", storageBucket: "al-gnarl.firebasestorage.app",
    messagingSenderId: "288765966471", appId: "1:288765966471:web:63358febfb82843c2fa022"
  };

  var user = (sessionStorage.getItem('currentUser') || '').trim();
  dbg('guard v6 | user = "' + user + '", loggedIn = ' + sessionStorage.getItem('isLoggedIn'));
  if (sessionStorage.getItem('isLoggedIn') !== 'true') { location.replace('login.html'); return; }
  if (user === 'admin') { dbg('admin -> sees everything, nothing hidden'); return; }

  var root = document.documentElement;
  root.style.visibility = 'hidden';
  var show = function () { root.style.visibility = ''; };
  setTimeout(show, 2500);

  var page = decodeURIComponent(location.pathname.split('/').pop()) || 'index.html';
  if (!/\.html$/i.test(page)) page += '.html';
  page = page.toLowerCase();
  dbg('page = ' + page);

  function apply(cfg) {
    var p = (cfg.users || {})[user];
    if (!p) { dbg('no permissions saved for "' + user + '"'); show(); return; }
    dbg('page access = ' + p[page]);
    if (p[page] === false) { alert('ليس لديك صلاحية لفتح هذه الصفحة'); location.replace('home.html'); return; }
    var key = 'stats_' + page.replace('.html', '');
    var sel = STATS_SELECTORS[page];
    dbg(key + ' = ' + p[key] + ' | selector = ' + sel);
    var old = document.getElementById('guardStatsStyle');
    if (sel && p[key] === false) {
      if (!old) {
        var st = document.createElement('style');
        st.id = 'guardStatsStyle';
        st.textContent = sel + '{display:none!important}';
        document.head.appendChild(st);
      }
      dbg('-> stats hidden');
    } else if (old) { old.remove(); dbg('-> stats shown (config changed)'); }
    show();
  }

  function cached() {
    try { return JSON.parse(localStorage.getItem('guardCfg') || 'null'); } catch (e) { return null; }
  }
  var c0 = cached();
  function fallback(why) {
    dbg(why + (c0 ? ' -> keeping saved config' : ' -> no saved config'));
    if (!c0) show();
  }

  /* أول ما الصفحة تفتح: طبّق آخر إعدادات محفوظة فوراً (من غير انتظار) وبعدها حدّثها من Firestore */
  if (c0) { dbg('instant: using saved config'); apply(c0); }

  /* استنى Firebase SDK بتاع الصفحة يتحمّل */
  function waitFirebase(tries, cb) {
    if (window.firebase && window.firebase.firestore) return cb(true);
    if (tries <= 0) return cb(false);
    setTimeout(function () { waitFirebase(tries - 1, cb); }, 100);
  }

  waitFirebase(50, function (ok) {
    if (!ok) { fallback('firebase SDK not found on this page'); return; }
    var app;
    try { app = firebase.app('guard'); } catch (e) { app = firebase.initializeApp(FB, 'guard'); }
    app.firestore().collection('settings').doc('config').get().then(function (s) {
      dbg('firestore ok | exists = ' + s.exists + (s.metadata && s.metadata.fromCache ? ' | FROM CACHE' : ''));
      if (!s.exists || !s.data().json) { dbg('no config saved yet'); show(); return; }
      var raw = s.data().json;
      try { localStorage.setItem('guardCfg', raw); } catch (e) {}
      apply(JSON.parse(raw));
    }).catch(function (e) { fallback('firestore error: ' + (e.code || '') + ' ' + e.message); });
  });
})();
