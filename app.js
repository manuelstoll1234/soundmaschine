(function () {
'use strict';

var $ = function (s) { return document.querySelector(s); };
var el = function (t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; }); };
var mmss = function (s) { s = Math.max(0, Math.floor(s || 0)); var m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); };

function parseLen(v) {
  var s = String(v == null ? '' : v);
  if (s.indexOf(':') >= 0) {
    var p = s.split(':').map(parseFloat);
    if (p.length === 2) return (p[0] || 0) * 60 + (p[1] || 0);
    if (p.length === 3) return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0);
  }
  return parseFloat(s) || 0;
}

var toastT;
function toast(msg) {
  var t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2400);
}

function getJSON(url, ms) {
  var ac = new AbortController();
  var to = setTimeout(function () { ac.abort(); }, ms || 12000);
  return fetch(url, { signal: ac.signal, headers: { 'Accept': 'application/json' } })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .finally(function () { clearTimeout(to); });
}

var jsonpN = 0;
function jsonp(url, ms) {
  return new Promise(function (res, rej) {
    var cb = '__sm_cb_' + (++jsonpN);
    var s = document.createElement('script');
    var to = setTimeout(function () { cleanup(); rej(new Error('jsonp timeout')); }, ms || 12000);
    function cleanup() { clearTimeout(to); try { delete window[cb]; } catch (e) { window[cb] = void 0; } if (s.parentNode) s.parentNode.removeChild(s); }
    window[cb] = function (data) { cleanup(); res(data); };
    s.onerror = function () { cleanup(); rej(new Error('jsonp error')); };
    s.src = url + (url.indexOf('?') < 0 ? '?' : '&') + 'callback=' + cb;
    document.head.appendChild(s);
  });
}

var Weather = {
  LAT: 47.361, LON: 8.719,
  cache: null, ts: 0, pending: null,
  wmo: function (c) {
    var icons = {
      0: ['☀', 'Klar'], 1: ['🌤', 'Leicht bewölkt'], 2: ['🌤', 'Leicht bewölkt'], 3: ['☁', 'Bewölkt'],
      45: ['🌫', 'Nebel'], 48: ['🌫', 'Nebel']
    };
    if (icons[c]) return icons[c];
    if (c >= 51 && c <= 57) return ['🌦', 'Niesel'];
    if (c >= 61 && c <= 67) return ['🌧', 'Regen'];
    if (c >= 71 && c <= 77) return ['🌨', 'Schnee'];
    if (c >= 80 && c <= 82) return ['🌦', 'Schauer'];
    if (c >= 85 && c <= 86) return ['🌨', 'Schneeschauer'];
    if (c >= 95) return ['⛈', 'Gewitter'];
    return ['—', ''];
  },
  _meteo: function () {
    var self = this;
    return getJSON('https://api.open-meteo.com/v1/forecast?latitude=' + this.LAT + '&longitude=' + this.LON + '&current_weather=true&timezone=auto', 8000)
      .then(function (d) {
        var cw = d && d.current_weather;
        if (!cw || cw.temperature == null) throw new Error('no data');
        var m = self.wmo(cw.weathercode);
        return { temp: Math.round(cw.temperature), icon: m[0], desc: m[1], place: 'Nänikon' };
      });
  },
  _wttr: function () {
    return getJSON('https://wttr.in/47.361,8.719?format=j1', 8000).then(function (d) {
      var c = d && d.current_condition && d.current_condition[0];
      if (!c) throw new Error('no data');
      var desc = ((c.weatherDesc || [])[0] || {}).value || '';
      var i = /thunder/i.test(desc) ? '⛈' : /snow|sleet/i.test(desc) ? '🌨'
            : /rain|drizzle|shower/i.test(desc) ? '🌧' : /fog|mist/i.test(desc) ? '🌫'
            : /partly|sunny interval/i.test(desc) ? '🌤'
            : /overcast|cloud/i.test(desc) ? '☁' : '☀';
      return { temp: Math.round(parseFloat(c.temp_C)), icon: i, desc: desc.trim(), place: 'Nänikon' };
    });
  },
  get: function () {
    var self = this;
    if (this.cache && Date.now() - this.ts < 30 * 60 * 1000) return Promise.resolve(this.cache);
    if (this.pending) return this.pending;
    this.pending = this._meteo()
      .catch(function () { return self._wttr(); })
      .then(function (out) {
        self.pending = null;
        if (!out || isNaN(out.temp)) return self.cache || null;
        self.cache = out; self.ts = Date.now();
        return out;
      })
      .catch(function () { self.pending = null; return self.cache || null; });
    return this.pending;
  }
};

var Store = {
  mem: {},
  ok: (function () { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; } catch (e) { return false; } })(),
  get: function (k, d) {
    try {
      var v = this.ok ? localStorage.getItem('sm_' + k) : this.mem[k];
      return v == null ? d : JSON.parse(v);
    } catch (e) { return d; }
  },
  set: function (k, v) {
    try {
      var s = JSON.stringify(v);
      if (this.ok) localStorage.setItem('sm_' + k, s); else this.mem[k] = s;
    } catch (e) { }
  }
};

var USERS = {
  maya: {
    name: 'Maya', initial: 'My', cls: 'u-maya',
    blurb: '80s · Rock\'n\'Roll · Charts', short: '80s · Charts',
    quality: 'high',
    lead: 'radio',
    seeds: ['80s synthwave', 'rock and roll', 'disco', 'pop hits'],
    genres: ['Disco', 'Pop', 'Rock', 'Funk', 'Vaporwave', 'House'],
    tags: ['80s', 'oldies', 'disco', 'charts', 'pop', 'rock', 'top 40', '70s'],
    archive: ['collection:(georgeblood) AND rock and roll',
              'collection:(georgeblood) AND rhythm and blues',
              'collection:(georgeblood) AND swing',
              '1980s pop']
  },
  manuel: {
    name: 'Manuel', initial: 'M', cls: 'u-manuel',
    blurb: 'Alternative · HardCore · Dub', short: 'Alternative · Dub',
    quality: 'lossless',
    lead: 'audius',
    seeds: ['drum and bass', 'hardcore', 'dub reggae', 'alternative rock', 'dubstep', 'jungle'],
    genres: ['Drum & Bass', 'Dubstep', 'Reggae', 'Punk', 'Jungle', 'Alternative'],
    tags: ['reggae', 'dub', 'drum and bass', 'hardcore', 'alternative', 'punk', 'ska', 'dubstep'],
    archive: ['dub reggae', 'roots reggae', 'netlabel electronic', 'punk live', 'alternative rock live']
  }
};

var App = {
  uid: Store.get('user', 'maya'),
  page: 'home',
  q: '',
  vizMode: Store.get('viz', 0)
};
if (!USERS[App.uid]) App.uid = 'maya';
function U() { return USERS[App.uid]; }
function pkey(k) { return App.uid + '_' + k; }

function playlists() {
  var p = Store.get(pkey('pl'), null);
  if (!p) { p = [{ id: 'liked', name: 'Liked Songs', tracks: [] }]; Store.set(pkey('pl'), p); }
  if (!p.some(function (x) { return x.id === 'liked'; })) p.unshift({ id: 'liked', name: 'Liked Songs', tracks: [] });
  return p;
}
function savePl(p) { Store.set(pkey('pl'), p); renderPlSidebar(); }

var Audius = {
  cache: {},
  APP: 'SOUNDMASCHINE',
  hosts: ['https://discoveryprovider2.audius.co', 'https://discoveryprovider3.audius.co', 'https://api.audius.co'],
  hi: 0,
  _url: function (host, path, params) {
    var u = host + path + '?app_name=' + encodeURIComponent(this.APP);
    for (var k in params) if (params[k] != null && params[k] !== '') {
      u += '&' + k + '=' + encodeURIComponent(params[k]);
    }
    return u;
  },
  _get: function (path, params, n) {
    var self = this;
    n = n || 0;
    if (n >= this.hosts.length) return Promise.resolve(null);
    var host = this.hosts[(this.hi + n) % this.hosts.length];
    return getJSON(this._url(host, path, params), 11000)
      .then(function (d) { self.hi = (self.hi + n) % self.hosts.length; return { d: d, host: host }; })
      .catch(function () { return self._get(path, params, n + 1); });
  },
  streamUrl: function (host, id) {
    return this._url(host, '/v1/tracks/' + id + '/stream', {});
  },
  _map: function (list, host) {
    var self = this;
    return (list || []).filter(function (t) {
      if (!t || !t.id) return false;
      if (t.is_streamable === false) return false;
      if (t.is_delete) return false;
      if (t.is_available === false) return false;
      if (t.is_unlisted) return false;
      return (t.duration == null || t.duration >= 45);
    }).map(function (t) {
      var a = t.artwork || {};
      return {
        id: 'au' + t.id,
        title: t.title || 'Untitled',
        artist: (t.user && (t.user.name || t.user.handle)) || 'Unknown',
        album: t.genre || '',
        art: a['480x480'] || a['1000x1000'] || a['150x150'] || '',
        url: self.streamUrl(host, t.id),
        dur: t.duration || 0,
        quality: '320k MP3',
        lossless: false,
        full: true,
        year: (t.release_date || '').slice(0, 4),
        source: 'Audius'
      };
    });
  },
  search: function (term, limit) {
    limit = limit || 25;
    var key = 's' + term + limit;
    if (this.cache[key]) return Promise.resolve(this.cache[key]);
    var self = this;
    return this._get('/v1/tracks/search', { query: term, limit: Math.min(100, limit * 5) })
      .then(function (r) {
        if (!r || !r.d || !r.d.data) return [];
        var out = self._map(r.d.data, r.host).slice(0, limit);
        self.cache[key] = out;
        return out;
      })
      .catch(function () { return []; });
  },
  trending: function (genre, limit) {
    limit = limit || 12;
    var key = 'g' + (genre || '') + limit;
    if (this.cache[key]) return Promise.resolve(this.cache[key]);
    var self = this;
    return this._get('/v1/tracks/trending', { genre: genre || '', limit: Math.min(50, limit * 2), time: 'month' })
      .then(function (r) {
        if (!r || !r.d || !r.d.data) return [];
        var out = self._map(r.d.data, r.host).slice(0, limit);
        self.cache[key] = out;
        return out;
      })
      .catch(function () { return []; });
  }
};

var Radio = {
  hosts: ['https://de1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info'],
  hi: 0,
  cache: {},
  _try: function (path, n) {
    var self = this;
    if (n >= this.hosts.length) return Promise.resolve([]);
    return getJSON(this.hosts[(this.hi + n) % this.hosts.length] + path, 10000)
      .catch(function () { return self._try(path, n + 1); });
  },
  byTag: function (tag, limit) {
    var key = 'r' + tag + (limit || 20);
    if (this.cache[key]) return Promise.resolve(this.cache[key]);
    var path = '/json/stations/search?hidebroken=true&order=votes&reverse=true&limit=' + ((limit || 20) * 4) +
               '&tag=' + encodeURIComponent(tag);
    var self = this;
    var securePage = location.protocol === 'https:';
    return this._try(path, 0).then(function (list) {
      var out = (list || []).filter(function (s) {
        if (!s.url_resolved) return false;
        if (securePage && s.url_resolved.indexOf('https://') !== 0) return false;
        return true;
      }).filter(function (s, i, arr) {
        var k = (s.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
        return arr.findIndex(function (o) {
          return (o.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '') === k;
        }) === i;
      }).slice(0, limit || 20).map(function (s) {
        var br = s.bitrate || 0;
        var lossless = /flac/i.test(s.codec || '') || br >= 320;
        return {
          id: 'rb' + s.stationuuid,
          title: s.name.trim(),
          artist: [s.country, (s.tags || '').split(',').slice(0, 2).join(', ')].filter(Boolean).join(' · '),
          album: 'Live radio',
          art: s.favicon || '',
          url: s.url_resolved,
          dur: 0, live: true, bitrate: br,
          quality: br > 0 ? (br + 'k ' + (s.codec || '').toUpperCase()).trim() : 'LIVE',
          lossless: lossless,
          country: s.country || '', tags: (s.tags || '').split(',').slice(0, 4).join(', '),
          home: s.homepage || '',
          source: 'Radio'
        };
      });
      self.cache[key] = out;
      return out;
    }).catch(function () { return []; });
  }
};

Radio.NAMED = [
  { q: 'Pure Radio Holland', label: 'Pure Radio Holland', note: 'Dutch · Pop & Dance' },
  { q: 'Lauf.fm',            label: 'Lauf.FM',            note: 'German · Indie & Electronic' },
  { q: 'SomaFM Underground 80s', label: 'Underground 80s', note: '80s · New Wave' },
  { q: 'Classic Vinyl HD',   label: 'Classic Vinyl HD',   note: 'Oldies · 320k' },
  { q: 'BBC Radio 1',        label: 'BBC Radio 1',        note: 'UK · Charts' },
  { q: 'Radio Paradise',     label: 'Radio Paradise',     note: 'Eclectic · high bitrate' }
];

Radio.byName = function (name) {
  var key = 'n' + name;
  if (this.cache[key]) return Promise.resolve(this.cache[key]);
  var self = this;
  var path = '/json/stations/search?limit=8&hidebroken=true&order=votes&reverse=true&name=' + encodeURIComponent(name);
  var secure = location.protocol === 'https:';
  return this._try(path, 0).then(function (list) {
    var ok = (list || []).filter(function (st) {
      if (!st.url_resolved) return false;
      return !secure || st.url_resolved.indexOf('https://') === 0;
    });
    if (!ok.length) { self.cache[key] = null; return null; }
    ok.sort(function (a, b) { return (b.bitrate || 0) - (a.bitrate || 0); });
    var st = ok[0], br = st.bitrate || 0;
    var out = {
      id: 'rb' + st.stationuuid, title: st.name.trim(),
      artist: [st.country, (st.tags || '').split(',').slice(0, 2).join(', ')].filter(Boolean).join(' · '),
      album: 'Live radio', art: st.favicon || '', url: st.url_resolved,
      dur: 0, live: true, bitrate: br,
      quality: br > 0 ? (br + 'k ' + (st.codec || '').toUpperCase()).trim() : 'LIVE',
      lossless: /flac/i.test(st.codec || ''),
      country: st.country || '', home: st.homepage || '', source: 'Radio'
    };
    self.cache[key] = out;
    return out;
  }).catch(function () { return null; });
};

var Archive = {
  cache: {},
  search: function (term, rows, losslessOnly) {
    var key = 'a' + term + (rows || 12) + (losslessOnly ? 'L' : '');
    if (this.cache[key]) return Promise.resolve(this.cache[key]);
    var q = '(' + term + ') AND mediatype:(audio)' + (losslessOnly ? ' AND format:(Flac)' : '');
    var url = 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent(q) +
              '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=year' +
              '&sort%5B%5D=downloads+desc&rows=' + (rows || 12) + '&page=1&output=json';
    var self = this;
    return getJSON(url, 14000).then(function (d) {
      var docs = (d && d.response && d.response.docs) ? d.response.docs : [];
      var out = docs.map(function (x) {
        return {
          id: 'ia' + x.identifier,
          identifier: x.identifier,
          title: x.title || x.identifier,
          artist: [].concat(x.creator || 'Internet Archive').join(', '),
          year: x.year || '',
          art: 'https://archive.org/services/img/' + x.identifier
        };
      });
      self.cache[key] = out;
      return out;
    }).catch(function () { return []; });
  },
  tracks: function (identifier) {
    var key = 'm' + identifier;
    if (this.cache[key]) return Promise.resolve(this.cache[key]);
    var self = this;
    return getJSON('https://archive.org/metadata/' + encodeURIComponent(identifier), 14000).then(function (m) {
      var files = m.files || [];
      var meta = m.metadata || {};
      var AUDIO_EXT = /\.(flac|wav|aiff?|m4a|mp4|ogg|oga|opus|mp3)$/i;
      var rank = function (f) {
        var fmt = (f.format || '').toLowerCase();
        if (!AUDIO_EXT.test(f.name || '')) return 0;
        if (fmt.indexOf('fingerprint') >= 0 || fmt.indexOf('checksum') >= 0) return 0;
        if (fmt.indexOf('24bit flac') >= 0) return 5;
        if (fmt.indexOf('flac') >= 0) return 4;
        if (fmt.indexOf('wave') >= 0 || fmt.indexOf('wav') >= 0 || fmt.indexOf('aiff') >= 0) return 3;
        if (fmt.indexOf('ogg') >= 0 || fmt.indexOf('opus') >= 0) return 2;
        if (fmt.indexOf('vbr mp3') >= 0) return 1.5;
        if (fmt.indexOf('mp3') >= 0 || fmt.indexOf('m4a') >= 0 || fmt.indexOf('aac') >= 0) return 1;
        return 0;
      };
      var clean = function (s) {
        return String(s || '')
          .replace(/\.[^.]+$/, '')
          .replace(/_/g, ' ')
          .replace(/\s*\([^)]*(?:kbps|cd quality|lossless|vbr|flac|wave?|mp3|ogg)[^)]*\)/ig, '')
          .replace(/\s{2,}/g, ' ')
          .trim();
      };
      var stem = function (name) {
        return String(name || '')
          .replace(/\.[^.]+$/, '')
          .replace(/[_-](?:\d{2,3}kb(?:ps)?|vbr|sample|spectrogram|preview)$/i, '')
          .toLowerCase().replace(/[^a-z0-9]+/g, '');
      };
      var groupKey = function (f) {
        var s = stem(f.name);
        if (s) return 'f' + s;
        var t = parseInt(String(f.track || '').split('/')[0], 10);
        if (!isNaN(t)) return 'n' + t;
        return 't' + clean(f.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      };
      var groups = {};
      files.forEach(function (f) {
        var r = rank(f);
        if (!r) return;
        var k = groupKey(f);
        (groups[k] || (groups[k] = [])).push({ f: f, r: r });
      });
      var out = [];
      Object.keys(groups).forEach(function (k) {
        var members = groups[k].sort(function (a, b) { return b.r - a.r; });
        var pick = members[0];
        var f = pick.f, pr = pick.r;
        var titles = members.map(function (m) { return clean(m.f.title || ''); })
                            .filter(Boolean)
                            .sort(function (a, b) { return a.length - b.length; });
        var title = titles[0] || clean(f.name);
        var lenSrc = members.filter(function (m) { return m.f.length; })[0];
        var numSrc = members.filter(function (m) { return m.f.track; })[0];
        var isLossless = pr >= 3;
        out.push({
          id: 'ia' + identifier + '/' + k,
          n: numSrc ? (parseInt(String(numSrc.f.track).split('/')[0], 10) || null) : null,
          title: title,
          artist: meta.creator ? [].concat(meta.creator).join(', ') : (meta.title || 'Internet Archive'),
          album: meta.title || identifier,
          art: 'https://archive.org/services/img/' + identifier,
          url: 'https://archive.org/download/' + identifier + '/' + encodeURIComponent(f.name),
          dur: lenSrc ? parseLen(lenSrc.f.length) : 0,
          quality: pr >= 5 ? '24-BIT FLAC' : pr === 4 ? 'FLAC' : pr === 3 ? 'WAV' :
                   ((f.format || 'MP3').toUpperCase().indexOf('VBR') >= 0 ? 'VBR MP3' : 'MP3'),
          lossless: isLossless,
          year: (meta.year || meta.date || '').toString().slice(0, 4),
          source: 'Archive'
        });
      });
      out.sort(function (a, b) {
        if (a.n && b.n) return a.n - b.n;
        if (a.n) return -1;
        if (b.n) return 1;
        return a.title.localeCompare(b.title, void 0, { numeric: true });
      });
      out = out.slice(0, 80);
      self.cache[key] = out;
      return out;
    }).catch(function () { return []; });
  }
};

var auPlain = $('#au'), auCors = $('#auX');
var ALL = [auPlain, auCors];
var au = auPlain;
var CORS_OK = { Archive: 1, Audius: 1 };
function pickElement(track, forcePlain) {
  var want = (!forcePlain && track && CORS_OK[track.source]) ? auCors : auPlain;
  if (want !== au) {
    try { au.pause(); } catch (e) {}
    au.removeAttribute('src');
    try { au.load(); } catch (e) {}
    au = want;
  }
  return want;
}

var P = {
  queue: [], idx: -1, shuffle: false, repeat: 0,
  cur: null,
  play: function (track, queue, i, forcePlain) {
    if (queue) { this.queue = queue.slice(); this.idx = (i == null ? 0 : i); }
    else if (!this.queue.length) { this.queue = [track]; this.idx = 0; }
    this.cur = track;
    this.retried = !!forcePlain;
    var a = pickElement(track, forcePlain);
    a.src = track.url;
    var p = a.play();
    if (p && p.catch) p.catch(function (e) {
      if (e && e.name === 'NotAllowedError') toast('Press play to start audio');
    });
    if (a === auCors) Viz.attach(); else Viz.loop();
    Ambilight.apply(track);
    if (Drawer.open) Drawer.render();
    this.paint();
    this.history(track);
    /* Vorschlagstitel entfernt */
  },
  recover: function () {
    var t = this.cur;
    if (!t || this.retried || au !== auCors) return false;
    this.play(t, null, null, true);
    return true;
  },
  toggle: function () {
    if (!this.cur) { toast('Nothing queued yet'); return; }
    if (au.paused) { var p = au.play(); if (p && p.catch) p.catch(function () {}); }
    else au.pause();
  },
  step: function (d) {
    if (!this.queue.length) return;
    var self = this;
    if (this.cur && this.cur.live) {
      var m = this.queue.length;
      var k = this.shuffle ? Math.floor(Math.random() * m) : ((this.idx + d) % m + m) % m;
      this.idx = k; this.play(this.queue[k]);
      return;
    }
    var n = this.shuffle ? Math.floor(Math.random() * this.queue.length) : this.idx + d;
    if (n < 0) n = this.queue.length - 1;
    var amEnde = d > 0 && (n >= this.queue.length || this.queue.length < 2);
    if (amEnde) {
      if (this.repeat === 1) { this.idx = 0; this.play(this.queue[0]); return; }
      toast('Suche ähnliche Titel…');
      this.extend(function (ok) {
        if (ok) {
          self.idx = Math.min(self.idx + 1, self.queue.length - 1);
          self.play(self.queue[self.idx]);
        } else {
          toast('Keine weiteren Titel gefunden');
        }
      });
      return;
    }
    if (n >= this.queue.length) n = 0;
    this.idx = n;
    this.play(this.queue[n]);
  },
  extend: function (cb) {
    var t = this.cur, self = this;
    if (!t || t.live || this._busy) return cb(false);
    this._busy = true;
    var byGenre = t.source === 'Audius' && t.album;
    var req = byGenre ? Audius.trending(t.album, 25)
                      : Audius.search(t.artist && t.artist !== 'Unknown' ? t.artist : (t.album || t.title), 25);
    req.then(function (list) {
      self._busy = false;
      var drin = {};
      self.queue.forEach(function (x) { drin[x.id] = 1; });
      var neu = (list || []).filter(function (x) { return !drin[x.id]; });
      if (!neu.length && byGenre) {
        Audius.search(t.artist, 25).then(function (l2) {
          var n2 = (l2 || []).filter(function (x) { return !drin[x.id]; });
          if (!n2.length) return cb(false);
          self.queue = self.queue.concat(n2);
          cb(true);
        }).catch(function () { cb(false); });
        return;
      }
      if (!neu.length) return cb(false);
      self.queue = self.queue.concat(neu);
      cb(true);
    }).catch(function () { self._busy = false; cb(false); });
  },
  history: function (t) {
    if (t.live) return;
    var h = Store.get(pkey('hist'), []);
    h = h.filter(function (x) { return x.id !== t.id; });
    h.unshift({ id: t.id, title: t.title, artist: t.artist, art: t.art, url: t.url, quality: t.quality, lossless: t.lossless, source: t.source, dur: t.dur });
    Store.set(pkey('hist'), h.slice(0, 60));
  },
  paint: function () {
    var t = this.cur;
    var a = $('#npArt');
    if (t && t.art) {
      if (a.tagName !== 'IMG') { var img = el('img'); img.id = 'npArt'; a.parentNode.replaceChild(img, a); a = img; }
      a.src = t.art;
      a.onerror = function () { var d = el('div', 'ph', '♪'); d.id = 'npArt'; this.parentNode.replaceChild(d, this); };
    } else if (a.tagName === 'IMG') {
      var d = el('div', 'ph', '♪'); d.id = 'npArt'; a.parentNode.replaceChild(d, a);
    }
    $('#npT').textContent = t ? t.title : 'Nichts läuft';
    $('#npS').textContent = t ? t.artist : 'Wähle etwas aus';
    var x = $('#npX');
    if (x) {
      var bits = [];
      if (t) {
        if (t.album && t.album !== t.title) bits.push(t.album);
        if (t.year) bits.push(t.year);
        if (t.source) bits.push(t.source);
        if (t.dur > 0) bits.push(mmss(t.dur));
      }
      x.textContent = bits.join('  ·  ');
    }
    var q = $('#qBadge');
    q.textContent = t ? t.quality : '—';
    q.classList.toggle('loss', !!(t && t.lossless));
    $('#bPlay').textContent = au.paused ? '▶' : '❚❚';
    syncFavButtons();
    $('#bShuf').classList.toggle('on', this.shuffle);
    $('#bRep').classList.toggle('on', this.repeat > 0);
    $('#bRep').textContent = this.repeat === 2 ? '⟳¹' : '⟳';
    document.querySelectorAll('.row').forEach(function (r) {
      r.classList.toggle('playing', !!(t && r.dataset.tid === t.id));
    });
    if (App.page === 'home') paintHomeHero();
  }
};

ALL.forEach(function (a) {
  a.addEventListener('play', function () { if (a === au) P.paint(); });
  a.addEventListener('pause', function () { if (a === au) P.paint(); });
  a.addEventListener('ended', function () {
    if (a !== au) return;
    if (P.repeat === 2) { a.currentTime = 0; a.play(); return; }
    P.step(1);
  });
  a.addEventListener('error', function () {
    if (a !== au || !P.cur || !a.getAttribute('src')) return;
    if (P.recover()) return;
    toast('That stream would not load — skipping');
    setTimeout(function () { P.step(1); }, 700);
  });
  a.addEventListener('timeupdate', function () {
    if (a !== au) return;
    if (!a.duration || !isFinite(a.duration)) {
      $('#tCur').textContent = mmss(a.currentTime);
      $('#tDur').textContent = (P.cur && P.cur.live) ? 'LIVE' : '--:--';
      $('#seek').value = '0';
      return;
    }
    $('#seek').value = String((a.currentTime / a.duration) * 1000);
    $('#tCur').textContent = mmss(a.currentTime);
    $('#tDur').textContent = mmss(a.duration);
  });
});

$('#seek').addEventListener('input', function () {
  if (au.duration && isFinite(au.duration)) au.currentTime = (this.value / 1000) * au.duration;
});
$('#vol').addEventListener('input', function () {
  var v = this.value / 100;
  ALL.forEach(function (a) { a.volume = v; });
  Store.set('vol', this.value);
});
(function () {
  var v = Store.get('vol', 80);
  ALL.forEach(function (a) { a.volume = v / 100; });
  $('#vol').value = v;
})();

$('#bPlay').onclick = function () { P.toggle(); };
$('#bNext').onclick = function () { P.step(1); };
$('#bPrev').onclick = function () { if (au.currentTime > 3) { au.currentTime = 0; } else P.step(-1); };
$('#bShuf').onclick = function () { P.shuffle = !P.shuffle; P.paint(); toast('Shuffle ' + (P.shuffle ? 'on' : 'off')); };
$('#bRep').onclick = function () { P.repeat = (P.repeat + 1) % 3; P.paint(); toast(['Repeat off', 'Repeat all', 'Repeat one'][P.repeat]); };

var LUFS_WORKLET = `class R128 extends AudioWorkletProcessor{constructor(){super();const fs=sampleRate;this.s1=this.shelf(fs);this.s2=this.hpf(fs);this.st=[];this.blockLen=Math.round(fs*0.4);this.hop=Math.round(fs*0.1);this.buf=[];this.filled=0;this.blocks=[];this.short=[];this.tp=0;this.sp=0;this.since=0;}shelf(fs){const f0=1681.974450955533,G=3.999843853973347,Q=0.7071752369554196;const K=Math.tan(Math.PI*f0/fs),Vh=Math.pow(10,G/20),Vb=Math.pow(Vh,0.4996667741545416);const a0=1+K/Q+K*K;return{b0:(Vh+Vb*K/Q+K*K)/a0,b1:2*(K*K-Vh)/a0,b2:(Vh-Vb*K/Q+K*K)/a0,a1:2*(K*K-1)/a0,a2:(1-K/Q+K*K)/a0};}hpf(fs){const f0=38.13547087602444,Q=0.5003270373238773;const K=Math.tan(Math.PI*f0/fs),a0=1+K/Q+K*K;return{b0:1,b1:-2,b2:1,a1:2*(K*K-1)/a0,a2:(1-K/Q+K*K)/a0};}biq(x,f,s,i){const y=f.b0*x+f.b1*s[i].x1+f.b2*s[i].x2-f.a1*s[i].y1-f.a2*s[i].y2;s[i].x2=s[i].x1;s[i].x1=x;s[i].y2=s[i].y1;s[i].y1=y;return y;}process(inputs){const inp=inputs[0];if(!inp||!inp.length)return true;const n=inp[0].length,ch=inp.length;while(this.st.length<ch)this.st.push({A:[{x1:0,x2:0,y1:0,y2:0}],B:[{x1:0,x2:0,y1:0,y2:0}]});if(!this.buf.length)for(let c=0;c<ch;c++)this.buf.push(new Float32Array(this.blockLen));for(let i=0;i<n;i++){for(let c=0;c<ch;c++){const raw=inp[c][i];const a=Math.abs(raw);if(a>this.sp)this.sp=a;const s=this.st[c];if(s.p1!==undefined){for(let k=1;k<4;k++){const t=k/4;const v=Math.abs(s.p1+(raw-s.p1)*t+0.5*t*(1-t)*((raw-s.p1)-(s.p0||s.p1)));if(v>this.tp)this.tp=v;}}s.p0=s.p1;s.p1=raw;if(a>this.tp)this.tp=a;const y=this.biq(this.biq(raw,this.s1,s.A,0),this.s2,s.B,0);this.buf[c][this.filled]=y;}this.filled++;if(this.filled>=this.blockLen){let power=0;for(let c=0;c<ch;c++){let sum=0;const b=this.buf[c];for(let j=0;j<this.blockLen;j++)sum+=b[j]*b[j];power+=sum/this.blockLen;}this.blocks.push(power);this.short.push(power);if(this.short.length>30)this.short.shift();for(let c=0;c<ch;c++)this.buf[c].copyWithin(0,this.hop);this.filled=this.blockLen-this.hop;this.emit(power);}}return true;}L(p){return p>0?-0.691+10*Math.log10(p):-Infinity;}emit(momentaryPower){let keep=this.blocks.filter(p=>this.L(p)>=-70);let integ=-Infinity;if(keep.length){const mean=keep.reduce((a,b)=>a+b,0)/keep.length;const thr=this.L(mean)-10;const keep2=keep.filter(p=>this.L(p)>=thr);if(keep2.length)integ=this.L(keep2.reduce((a,b)=>a+b,0)/keep2.length);}const shortP=this.short.length?this.short.reduce((a,b)=>a+b,0)/this.short.length:0;this.port.postMessage({m:this.L(momentaryPower),s:this.L(shortP),i:integ,tp:this.tp>0?20*Math.log10(this.tp):-Infinity,sp:this.sp>0?20*Math.log10(this.sp):-Infinity});}}registerProcessor('r128',R128);`;

var Engine = {
  ac: null, src: null, gain: null, an: null, meter: null,
  eq: [], dead: false, ready: false,
  bands: [60, 250, 1000, 4000, 12000],
  eqGains: Store.get('eq', [0, 0, 0, 0, 0]),
  preamp: Store.get('preamp', 0),
  normalise: Store.get('norm', false),
  lufs: { m: -Infinity, s: -Infinity, i: -Infinity, tp: -Infinity, sp: -Infinity },
  attach: function () {
    if (this.dead || this.src) {
      if (this.ac && this.ac.state === 'suspended') this.ac.resume().catch(function () {});
      return;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.dead = true; return; }
      this.ac = new AC();
      this.src = this.ac.createMediaElementSource(auCors);
      this.gain = this.ac.createGain();
      this.gain.gain.value = 1;
      var self = this, prev = this.gain;
      this.eq = this.bands.map(function (f, i) {
        var b = self.ac.createBiquadFilter();
        b.type = (i === 0) ? 'lowshelf' : (i === self.bands.length - 1 ? 'highshelf' : 'peaking');
        b.frequency.value = f; b.Q.value = 1.0;
        b.gain.value = self.eqGains[i] || 0;
        prev.connect(b); prev = b;
        return b;
      });
      this.an = this.ac.createAnalyser();
      this.an.fftSize = 2048;
      this.an.smoothingTimeConstant = 0.75;
      prev.connect(this.an);
      this.src.connect(this.gain);
      this.an.connect(this.ac.destination);
      this.data = new Uint8Array(this.an.frequencyBinCount);
      this.time = new Float32Array(this.an.fftSize);
      this.ready = true;
      this._loudness();
      this.applyEQ();
    } catch (e) {
      this.dead = true;
    }
    if (this.ac && this.ac.state === 'suspended') this.ac.resume().catch(function () {});
  },
  _loudness: function () {
    var self = this;
    if (!this.ac.audioWorklet) return;
    try {
      var url = URL.createObjectURL(new Blob([LUFS_WORKLET], { type: 'application/javascript' }));
      this.ac.audioWorklet.addModule(url).then(function () {
        URL.revokeObjectURL(url);
        try {
          self.meter = new AudioWorkletNode(self.ac, 'r128');
          self.meter.port.onmessage = function (e) { self.lufs = e.data; };
          self.an.connect(self.meter);
        } catch (e) { }
      }).catch(function () {});
    } catch (e) {}
  },
  applyEQ: function () {
    var self = this;
    if (!this.ready) return;
    this.eq.forEach(function (b, i) { b.gain.value = self.eqGains[i] || 0; });
    var lin = Math.pow(10, (this.preamp || 0) / 20);
    if (this.gain) this.gain.gain.setTargetAtTime(lin, this.ac.currentTime, 0.05);
    Store.set('eq', this.eqGains); Store.set('preamp', this.preamp);
  },
  eqActive: function () {
    return (this.eqGains || []).some(function (g) { return Math.abs(g) > 0.05; }) ||
           Math.abs(this.preamp || 0) > 0.05;
  },
  duck: function (ms) {
    if (!this.ready || !this.gain) return;
    var t = this.ac.currentTime, g = this.gain.gain;
    var base = Math.pow(10, (this.preamp || 0) / 20);
    g.cancelScheduledValues(t);
    g.setTargetAtTime(base * 0.25, t, 0.04);
    g.setTargetAtTime(base, t + (ms || 900) / 1000, 0.12);
  },
  path: function (track) {
    if (!track) return null;
    var live = track.source === 'Radio';
    var lossless = !!track.lossless;
    var srcRate = track.rate || null;
    var ctxRate = this.ac ? this.ac.sampleRate : null;
    var processed = this.eqActive();
    var analysed = !live && this.ready && !this.dead;
    var grade = live ? 'live' : (!lossless ? 'lossy'
              : (processed || (srcRate && ctxRate && srcRate !== ctxRate) ? 'lossless' : 'perfect'));
    return {
      grade: grade, live: live, lossless: lossless, processed: processed,
      srcRate: srcRate, ctxRate: ctxRate, analysed: analysed,
      codec: track.quality || '—',
      nodes: live
        ? ['Stream', 'HTML5 Audio', 'Output']
        : ['Stream', 'Web Audio', processed ? 'EQ · ' + this.eqGains.filter(function(g){return Math.abs(g)>0.05;}).length + ' band' : 'EQ bypassed',
           'Analyser', 'Output']
    };
  }
};

var Palette = {
  cache: {},
  from: function (url, cb) {
    if (!url) return cb(null);
    if (this.cache[url]) return cb(this.cache[url]);
    var self = this, img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        var n = 40, c = document.createElement('canvas');
        c.width = n; c.height = n;
        var x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(img, 0, 0, n, n);
        var d = x.getImageData(0, 0, n, n).data;
        var buckets = {};
        for (var i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 128) continue;
          var r = d[i], g = d[i + 1], b = d[i + 2];
          var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          if (mx < 26 || mn > 235) continue;
          var k = (r >> 4) + ',' + (g >> 4) + ',' + (b >> 4);
          var e = buckets[k] || (buckets[k] = { n: 0, r: 0, g: 0, b: 0, sat: 0 });
          e.n++; e.r += r; e.g += g; e.b += b; e.sat += (mx - mn);
        }
        var list = Object.keys(buckets).map(function (k) {
          var e = buckets[k];
          return { r: e.r / e.n | 0, g: e.g / e.n | 0, b: e.b / e.n | 0,
                   score: e.n * (1 + (e.sat / e.n) / 90) };
        }).sort(function (a, b2) { return b2.score - a.score; });
        if (!list.length) return cb(null);
        var out = { a: list[0], b: list[1] || list[0] };
        self.cache[url] = out;
        cb(out);
      } catch (e) { cb(null); }
    };
    img.onerror = function () { cb(null); };
    img.src = url;
  }
};

var Ambilight = {
  on: Store.get('ambi', true),
  apply: function (track) {
    var root = document.documentElement;
    if (!this.on || !track) { this.clear(); return; }
    Palette.from(track.art, function (p) {
      if (!p) { Ambilight.clear(); return; }
      root.style.setProperty('--ambi-a', 'rgb(' + p.a.r + ',' + p.a.g + ',' + p.a.b + ')');
      root.style.setProperty('--ambi-b', 'rgb(' + p.b.r + ',' + p.b.g + ',' + p.b.b + ')');
      document.body.classList.add('ambi');
    });
  },
  clear: function () { document.body.classList.remove('ambi'); },
  toggle: function () {
    this.on = !this.on; Store.set('ambi', this.on);
    if (this.on) this.apply(P.cur); else this.clear();
    return this.on;
  }
};

var Viz = {
  cv: $('#viz'), ctx: null, raf: 0, w: 0, h: 0,
  mode: App.vizMode || 0,
  modes: ['bars', 'rta', 'vu', 'wave'],
  labels: { bars: 'Spectrum', rta: 'RTA 128', vu: 'VU', wave: 'Wave' },
  vu: { l: 0, r: 0, peak: 0, peakAt: 0 },
  size: function () {
    var r = this.cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    if (!r.width) return;
    this.cv.width = r.width * d; this.cv.height = r.height * d;
    this.ctx = this.cv.getContext('2d');
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
    this.w = r.width; this.h = r.height;
  },
  attach: function () { Engine.attach(); this.loop(); },
  loop: function () {
    cancelAnimationFrame(this.raf);
    var self = this;
    (function frame() { self.raf = requestAnimationFrame(frame); self.draw(); })();
  },
  freq: function () {
    if (!Engine.ready || Engine.dead || au !== auCors) return null;
    Engine.an.getByteFrequencyData(Engine.data);
    var sum = 0, d = Engine.data;
    for (var i = 0; i < d.length; i += 8) sum += d[i];
    if (sum === 0) return null;
    return d;
  },
  wave: function () {
    if (!Engine.ready || Engine.dead || au !== auCors) return null;
    Engine.an.getFloatTimeDomainData(Engine.time);
    return Engine.time;
  },
  sim: function (n) {
    var out = new Uint8Array(n), t = Date.now() / 220, live = !au.paused;
    for (var i = 0; i < n; i++) {
      var f = 1 - i / n;
      out[i] = live ? Math.max(0, (Math.sin(t + i * 0.55) * 0.5 + 0.5) * 190 * (0.35 + f * 0.8)) : 0;
    }
    return out;
  },
  accent: function () {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e8a13a';
  },
  draw: function () {
    if (!this.ctx) { this.size(); if (!this.ctx) return; }
    var c = this.ctx, w = this.w, h = this.h;
    c.clearRect(0, 0, w, h);
    var m = this.modes[this.mode] || 'bars';
    if (m === 'vu') return this.drawVU(c, w, h);
    if (m === 'rta') return this.drawRTA(c, w, h);
    if (m === 'wave') return this.drawWave(c, w, h);
    this.drawBars(c, w, h);
  },
  drawBars: function (c, w, h) {
    var d = this.freq(), n = 28, acc = this.accent();
    var src = d || this.sim(n);
    var bw = w / n;
    for (var i = 0; i < n; i++) {
      var idx = d ? Math.floor(Math.pow(i / n, 1.6) * (d.length * 0.7)) : i;
      var v = (src[idx] || 0) / 255;
      var bh = Math.max(1.5, v * h);
      c.fillStyle = acc;
      c.globalAlpha = 0.45 + v * 0.55;
      c.fillRect(i * bw, h - bh, bw - 1.2, bh);
    }
    c.globalAlpha = 1;
  },
  drawRTA: function (c, w, h) {
    var d = this.freq(), N = 128, acc = this.accent();
    var src = d || this.sim(N);
    var bw = w / N;
    for (var i = 0; i < N; i++) {
      var idx = d ? Math.floor(Math.pow(i / N, 2.0) * (d.length - 1)) : i;
      var v = (src[idx] || 0) / 255;
      var bh = Math.max(1, v * h);
      c.fillStyle = v > 0.82 ? '#ff5a5a' : (v > 0.6 ? acc : 'rgba(255,255,255,.34)');
      c.fillRect(i * bw, h - bh, Math.max(0.8, bw - 0.4), bh);
    }
  },
  drawWave: function (c, w, h) {
    var t = this.wave(), acc = this.accent();
    c.strokeStyle = acc; c.lineWidth = 1.4; c.beginPath();
    if (t) {
      for (var i = 0; i < t.length; i += 4) {
        var x = (i / t.length) * w, y = h / 2 + t[i] * h * 0.46;
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
    } else {
      var s = this.sim(64);
      for (var j = 0; j < 64; j++) {
        var x2 = (j / 64) * w, y2 = h / 2 + ((s[j] - 95) / 255) * h * 0.7;
        j ? c.lineTo(x2, y2) : c.moveTo(x2, y2);
      }
    }
    c.stroke();
  },
  drawVU: function (c, w, h) {
    var lv = Engine.lufs, acc = this.accent();
    var db = (lv && isFinite(lv.m)) ? lv.m : null;
    var target;
    if (db != null) target = Math.max(0, Math.min(1, (db + 40) / 40));
    else { var s = this.sim(8), sum = 0; for (var i = 0; i < 8; i++) sum += s[i];
           target = Math.min(1, sum / (8 * 255) * 1.6); }
    this.vu.l += (target - this.vu.l) * 0.16;
    if (this.vu.l > this.vu.peak) { this.vu.peak = this.vu.l; this.vu.peakAt = Date.now(); }
    else if (Date.now() - this.vu.peakAt > 900) this.vu.peak *= 0.94;
    var cx = w / 2, cy = h * 1.06, R = Math.min(w * 0.46, h * 0.92);
    c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 1;
    c.beginPath(); c.arc(cx, cy, R, Math.PI * 1.18, Math.PI * 1.82); c.stroke();
    c.strokeStyle = 'rgba(255,90,90,.55)'; c.lineWidth = 2;
    c.beginPath(); c.arc(cx, cy, R, Math.PI * 1.66, Math.PI * 1.82); c.stroke();
    var pa = Math.PI * (1.18 + 0.64 * this.vu.peak);
    c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(cx + Math.cos(pa) * R * 0.55, cy + Math.sin(pa) * R * 0.55);
    c.lineTo(cx + Math.cos(pa) * R, cy + Math.sin(pa) * R); c.stroke();
    var a = Math.PI * (1.18 + 0.64 * this.vu.l);
    c.strokeStyle = this.vu.l > 0.75 ? '#ff5a5a' : acc; c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(a) * R * 0.94, cy + Math.sin(a) * R * 0.94); c.stroke();
    c.fillStyle = acc; c.beginPath(); c.arc(cx, cy, 2.2, 0, 6.3); c.fill();
  },
  cycle: function () {
    this.mode = (this.mode + 1) % this.modes.length;
    Store.set('viz', this.mode);
    toast(this.labels[this.modes[this.mode]]);
  }
};

var Drawer = {
  open: false, raf: 0, tab: 'signal',
  toggle: function (tab) {
    if (tab && tab !== this.tab && this.open) { this.tab = tab; this.render(); return; }
    this.open = !this.open;
    if (tab) this.tab = tab;
    document.body.classList.toggle('drw-open', this.open);
    if (this.open) { this.render(); this.tick(); }
    else cancelAnimationFrame(this.raf);
  },
  tick: function () {
    var self = this;
    cancelAnimationFrame(this.raf);
    (function f() {
      self.raf = requestAnimationFrame(f);
      if (self.tab === 'signal') self.paintMeters();
    })();
  },
  db: function (v, unit) {
    return (v == null || !isFinite(v)) ? '—' : v.toFixed(1) + (unit || '');
  },
  render: function () {
    var host = $('#drwBody');
    if (!host) return;
    $('#drwTitle').textContent = this.tab === 'signal' ? 'Signal' : 'Liner notes';
    var tabs = $('#drwTabs');
    [].forEach.call(tabs.children, function (b) {
      b.classList.toggle('on', b.dataset.tab === Drawer.tab);
    });
    host.innerHTML = '';
    if (this.tab === 'signal') this.renderSignal(host); else this.renderNotes(host);
  },
  renderSignal: function (host) {
    var t = P.cur, p = Engine.path(t);
    if (!t) { host.appendChild(emptyBox('◌', 'Nothing playing', 'Start a track to see its signal path.')); return; }
    var lamp = {
      perfect: ['gold', 'BIT-PERFECT PATH', 'Lossless source, no DSP, no resampling in our graph.'],
      lossless: ['green', 'LOSSLESS', p && p.processed ? 'Lossless source, but EQ is engaged — the signal is being altered.'
                                                       : 'Lossless source, resampled by the audio context.'],
      lossy: ['grey', 'LOSSY', 'Compressed source. Nothing downstream can restore what the encoder discarded.'],
      live: ['blue', 'LIVE STREAM', 'Radio cannot enter the Web Audio graph without going silent, so it plays untouched and unmeasured.']
    }[p ? p.grade : 'lossy'];
    var box = el('div', 'sig-lamp ' + lamp[0],
      '<div class="lamp"></div><div><b>' + lamp[1] + '</b><small>' + lamp[2] + '</small></div>');
    host.appendChild(box);
    var chain = el('div', 'sig-chain');
    (p ? p.nodes : []).forEach(function (n, i) {
      if (i) chain.appendChild(el('span', 'sig-arrow', '→'));
      chain.appendChild(el('span', 'sig-node' + (/bypass/i.test(n) ? ' off' : ''), esc(n)));
    });
    host.appendChild(section('Signal path').appendChild(chain).parentNode);
    var rows = [
      ['Source', t.source],
      ['Format', p ? p.codec : '—'],
      ['Context rate', p && p.ctxRate ? (p.ctxRate / 1000).toFixed(1) + ' kHz' : '—'],
      ['DSP', p && p.processed ? 'EQ engaged' : 'Bypassed'],
      ['Analysis', p && p.analysed ? 'Active' : 'Unavailable on this source']
    ];
    var tbl = el('div', 'sig-tbl');
    rows.forEach(function (r) {
      tbl.appendChild(el('div', 'sig-row', '<span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b>'));
    });
    host.appendChild(tbl);
    var s = section('Loudness', 'EBU R128 · K-weighted, gated');
    var g = el('div', 'lufs-grid');
    ['m', 's', 'i'].forEach(function (k) {
      var lab = { m: 'Momentary', s: 'Short (3s)', i: 'Integrated' }[k];
      g.appendChild(el('div', 'lufs-cell', '<small>' + lab + '</small><b id="lufs-' + k + '">—</b><i>LUFS</i>'));
    });
    g.appendChild(el('div', 'lufs-cell', '<small>True peak</small><b id="lufs-tp">—</b><i>dBTP</i>'));
    s.appendChild(g);
    s.appendChild(el('div', 'lufs-bar', '<div id="lufsFill"></div><span id="lufsTarget" title="Streaming reference level"></span>'));
    if (!(p && p.analysed)) {
      s.appendChild(el('p', 'muted small', 'Radio streams send no CORS headers. Routing one through Web Audio would silence it, so it plays on a separate untouched element and cannot be measured.'));
    }
    host.appendChild(s);
    var e = section('Equaliser', Engine.eqActive() ? 'Engaged — signal is altered' : 'Bypassed');
    var wrap = el('div', 'eq-wrap');
    Engine.bands.forEach(function (f, i) {
      var row = el('div', 'eq-band');
      var lbl = f >= 1000 ? (f / 1000) + 'k' : f + '';
      row.innerHTML = '<span>' + lbl + '</span>';
      var inp = el('input'); inp.type = 'range'; inp.min = -12; inp.max = 12; inp.step = 0.5;
      inp.value = Engine.eqGains[i] || 0;
      var out = el('b', null, (Engine.eqGains[i] || 0) + '');
      inp.oninput = function () {
        Engine.eqGains[i] = parseFloat(inp.value);
        out.textContent = inp.value;
        Engine.applyEQ();
        Drawer.render();
      };
      row.appendChild(inp); row.appendChild(out);
      wrap.appendChild(row);
    });
    e.appendChild(wrap);
    var reset = el('button', 'btn-ghost', 'Flat');
    reset.onclick = function () {
      Engine.eqGains = [0, 0, 0, 0, 0]; Engine.preamp = 0; Engine.applyEQ(); Drawer.render();
    };
    e.appendChild(reset);
    host.appendChild(e);
  },
  paintMeters: function () {
    var l = Engine.lufs || {};
    var set = function (id, v, u) { var n = $(id); if (n) n.textContent = Drawer.db(v, u); };
    set('#lufs-m', l.m); set('#lufs-s', l.s); set('#lufs-i', l.i); set('#lufs-tp', l.tp);
    var fill = $('#lufsFill');
    if (fill) {
      var v = isFinite(l.s) ? l.s : (isFinite(l.m) ? l.m : -60);
      var pct = Math.max(0, Math.min(100, ((v + 40) / 40) * 100));
      fill.style.width = pct + '%';
      fill.className = v > -9 ? 'hot' : (v > -16 ? 'warm' : '');
    }
    var tgt = $('#lufsTarget');
    if (tgt) tgt.style.left = (((-14 + 40) / 40) * 100) + '%';
  },
  renderNotes: function (host) {
    var t = P.cur;
    if (!t) { host.appendChild(emptyBox('◌', 'Nothing playing', 'Start a track to read its notes.')); return; }
    var head = el('div', 'ln-head',
      (t.art ? '<img src="' + esc(t.art) + '" alt="">' : '<div class="ph">♪</div>') +
      '<div><b>' + esc(t.title) + '</b><span>' + esc(t.artist) + '</span>' +
      (t.album ? '<span class="muted">' + esc(t.album) + '</span>' : '') + '</div>');
    host.appendChild(head);
    var facts = [];
    if (t.source === 'Radio') {
      facts = [['Station', t.title], ['Country', t.country || '—'], ['Language', t.lang || '—'],
               ['Codec', t.quality], ['Tags', t.tags || '—'], ['Homepage', t.home || '—']];
    } else if (t.source === 'Audius') {
      facts = [['Artist', t.artist], ['Genre', t.album || '—'], ['Length', mmss(t.dur)],
               ['Format', t.quality], ['Licence', 'Artist-uploaded, streamed via Audius']];
    } else {
      facts = [['Collection', t.album || '—'], ['Year', t.year || '—'], ['Format', t.quality],
               ['Length', mmss(t.dur)], ['Source', 'Internet Archive']];
    }
    var tbl = el('div', 'sig-tbl');
    facts.forEach(function (r) {
      if (!r[1] || r[1] === '—') return;
      var v = /^https?:/.test(r[1]) ? '<a href="' + esc(r[1]) + '" target="_blank" rel="noopener">' + esc(r[1]) + '</a>' : esc(r[1]);
      tbl.appendChild(el('div', 'sig-row', '<span>' + esc(r[0]) + '</span><b>' + v + '</b>'));
    });
    host.appendChild(tbl);
    if (t.desc) {
      var d = section('Notes');
      d.appendChild(el('p', 'ln-desc', esc(String(t.desc).replace(/<[^>]+>/g, '')).slice(0, 1400)));
      host.appendChild(d);
    }
    var s = section('Artist origin', 'MusicBrainz');
    var ld = loading(); s.appendChild(ld); host.appendChild(s);
    MB.artist(t.artist, function (info) {
      ld.remove();
      if (!info) { s.appendChild(el('p', 'muted small', 'No MusicBrainz entry for this artist — usual for netlabel and self-released music.')); return; }
      var rows = el('div', 'sig-tbl');
      [['Name', info.name], ['Origin', info.area], ['Formed', info.begin], ['Type', info.type]]
        .forEach(function (r) {
          if (!r[1]) return;
          rows.appendChild(el('div', 'sig-row', '<span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b>'));
        });
      s.appendChild(rows);
      if (info.area) s.appendChild(Geo.chip(info.area));
    });
  }
};

var MB = {
  cache: {}, last: 0,
  artist: function (name, cb) {
    if (!name || name === 'Unknown') return cb(null);
    if (this.cache[name] !== undefined) return cb(this.cache[name]);
    var self = this, wait = Math.max(0, 1100 - (Date.now() - this.last));
    setTimeout(function () {
      self.last = Date.now();
      var u = 'https://musicbrainz.org/ws/2/artist?fmt=json&limit=1&query=' + encodeURIComponent(name);
      getJSON(u, 9000).then(function (d) {
        var a = d && d.artists && d.artists[0];
        if (!a || a.score < 90 || a.name.toLowerCase() !== String(name).toLowerCase()) {
          self.cache[name] = null; return cb(null);
        }
        var out = { name: a.name, type: a.type || '',
                    area: (a.area && a.area.name) || (a['begin-area'] && a['begin-area'].name) || '',
                    begin: (a['life-span'] && a['life-span'].begin) || '' };
        self.cache[name] = out; cb(out);
      }).catch(function () { self.cache[name] = null; cb(null); });
    }, wait);
  }
};

var Geo = {
  chip: function (area) {
    var w = el('div', 'geo-chip');
    w.innerHTML = '<span class="pin">◉</span><b>' + esc(area) + '</b>';
    var a = el('a', 'geo-link', 'Open map ↗');
    a.href = 'https://www.openstreetmap.org/search?query=' + encodeURIComponent(area);
    a.target = '_blank'; a.rel = 'noopener';
    w.appendChild(a);
    return w;
  }
};

Viz.size();
window.addEventListener('resize', function () { Viz.size(); });
Viz.cv.onclick = function () { Viz.cycle(); };
Viz.loop();

var Sugg = {
  el: null, cur: null, timer: 0, pool: [], dismissed: false,
  init: function () {
    this.el = $('#sugg'); if (!this.el) return;
    var self = this;
    $('#sugX').onclick = function () { self.hide(); self.dismissed = true; };
    $('#sugGo').onclick = function () {
      if (!self.cur) return;
      P.play(self.cur, self.pool, self.pool.indexOf(self.cur));
      self.hide();
    };
    $('#sugNext').onclick = function () { self.pick(); };
  },
  reset: function () { this.pool = []; this.cur = null; this.dismissed = false; this.hide(); },
  schedule: function () {
    var self = this;
    clearTimeout(this.timer);
    if (this.dismissed) return;
    this.timer = setTimeout(function () { self.build(); }, 25000);
  },
  seed: function () {
    var hist = Store.get(pkey('hist'), []);
    if (hist.length < 2) return null;
    var recent = hist.slice(0, 8);
    var byArtist = {}, byGenre = {};
    recent.forEach(function (t) {
      if (t.artist) byArtist[t.artist] = (byArtist[t.artist] || 0) + 1;
      if (t.album && t.source === 'Audius') byGenre[t.album] = (byGenre[t.album] || 0) + 1;
    });
    var topG = Object.keys(byGenre).sort(function (a, b) { return byGenre[b] - byGenre[a]; })[0];
    var topA = Object.keys(byArtist).sort(function (a, b) { return byArtist[b] - byArtist[a]; })[0];
    if (topG) return { q: topG, why: 'Weil du ' + topG + ' hörst' };
    if (topA) return { q: topA, why: 'Ähnlich wie ' + topA };
    return null;
  },
  build: function () {
    var self = this, sd = this.seed();
    if (!sd) return;
    this.why = sd.why;
    Audius.search(sd.q, 25).then(function (list) {
      var hist = Store.get(pkey('hist'), []);
      var heard = {};
      hist.forEach(function (t) { heard[t.id] = 1; });
      self.pool = list.filter(function (t) { return !heard[t.id] && (!P.cur || t.id !== P.cur.id); });
      if (!self.pool.length) return;
      self.pick();
    });
  },
  pick: function () {
    if (!this.pool.length) return;
    var i = Math.floor(Math.random() * this.pool.length);
    this.cur = this.pool[i];
    var w = $('#sugg'); if (w) w.title = this.why || 'Vorschlag';
    $('#sugT').textContent = this.cur.title;
    $('#sugA').textContent = this.cur.artist + ' · ' + mmss(this.cur.dur);
    this.show();
  },
  show: function () { if (this.el && !this.dismissed) this.el.classList.add('on'); },
  hide: function () { if (this.el) this.el.classList.remove('on'); }
};

function likedList() {
  return (playlists().filter(function (p) { return p.id === 'liked'; })[0] || { tracks: [] }).tracks;
}
function isLiked(t) {
  return likedList().some(function (x) { return x.id === t.id; });
}
function toggleLike(t) {
  var all = playlists();
  var liked = all.filter(function (p) { return p.id === 'liked'; })[0];
  var at = liked.tracks.findIndex(function (x) { return x.id === t.id; });
  var on;
  if (at >= 0) { liked.tracks.splice(at, 1); on = false; toast('Aus Favoriten entfernt'); }
  else { liked.tracks.push(t); on = true; toast('Zu Favoriten hinzugefügt'); }
  savePl(all);
  syncFavButtons();
  return on;
}
function syncFavButtons() {
  document.querySelectorAll('.row').forEach(function (r) {
    var b = r.querySelector('.r-fav'); if (!b) return;
    var on = likedList().some(function (x) { return x.id === r.dataset.tid; });
    b.textContent = on ? '♥' : '♡';
    b.classList.toggle('on', on);
  });
  var pb = $('#bFav');
  if (pb) {
    var on = !!(P.cur && isLiked(P.cur));
    pb.textContent = on ? '♥' : '♡';
    pb.classList.toggle('on', on);
  }
}

function trackRow(t, i, list) {
  var r = el('div', 'row');
  r.dataset.tid = t.id;
  r.innerHTML =
    '<div class="r-n">' + (i + 1) + '</div>' +
    (t.art ? '<img class="r-a" loading="lazy" src="' + esc(t.art) + '" onerror="this.style.visibility=\'hidden\'">' : '<div class="r-a"></div>') +
    '<div class="r-m"><div class="r-t">' + esc(t.title) + '</div><div class="r-s">' + esc(t.artist) + '</div></div>' +
    '<div class="r-q' + (t.lossless ? ' loss' : '') + '">' + esc(t.quality) + '</div>' +
    '<button class="r-fav' + (isLiked(t) ? ' on' : '') + '" title="Favorit">' + (isLiked(t) ? '♥' : '♡') + '</button>' +
    '<button class="r-add" title="Zu Playlist hinzufügen">＋</button>';
  r.onclick = function (e) {
    if (e.target.classList.contains('r-add')) { e.stopPropagation(); addTo(t); return; }
    if (e.target.classList.contains('r-fav')) {
      e.stopPropagation();
      var nowLiked = toggleLike(t);
      e.target.textContent = nowLiked ? '♥' : '♡';
      e.target.classList.toggle('on', nowLiked);
      return;
    }
    P.play(t, list, i);
  };
  return r;
}

function rowsBlock(list) {
  var wrap = el('div', 'rows');
  list.forEach(function (t, i) { wrap.appendChild(trackRow(t, i, list)); });
  return wrap;
}

function card(o, onClick) {
  var c = el('div', 'card');
  c.innerHTML =
    (o.art ? '<img class="art" loading="lazy" src="' + esc(o.art) + '" onerror="this.outerHTML=\'<div class=&quot;art-ph&quot;>♪</div>\'">'
           : '<div class="art-ph">' + (o.icon || '♪') + '</div>') +
    '<b>' + esc(o.title) + '</b><span>' + esc(o.sub || '') + '</span>' +
    (o.tag ? '<div class="tag' + (o.lossless ? ' loss' : '') + '">' + esc(o.tag) + '</div>' : '');
  c.onclick = onClick;
  return c;
}

function section(title, sub) {
  var s = el('div', 'sec');
  s.appendChild(el('div', 'sec-hd', '<h2>' + esc(title) + '</h2>' + (sub ? '<p>' + esc(sub) + '</p>' : '')));
  return s;
}

function loading(msg) { return el('div', 'empty', '<div class="ic"><span class="spin"></span></div><b>' + esc(msg || 'Loading…') + '</b>'); }
function emptyBox(icon, title, body) { return el('div', 'empty', '<div class="ic">' + icon + '</div><b>' + esc(title) + '</b><p>' + body + '</p>'); }

function addTo(t) {
  var pls = playlists();
  var names = pls.map(function (p, i) { return (i + 1) + '. ' + p.name; }).join('\n');
  var pick = prompt('Add "' + t.title + '" to:\n' + names + '\n\nType a number, or a new playlist name:', '1');
  if (!pick) return;
  var n = parseInt(pick, 10);
  var target;
  if (!isNaN(n) && pls[n - 1]) target = pls[n - 1];
  else { target = { id: 'p' + Date.now(), name: pick.trim(), tracks: [] }; pls.push(target); }
  if (target.tracks.some(function (x) { return x.id === t.id; })) { toast('Already in ' + target.name); return; }
  target.tracks.push(t);
  savePl(pls);
  toast('Added to ' + target.name);
}

function wxChip() {
  var w = Weather.cache;
  if (!w) return '<div class="wx" id="wxBox"></div>';
  return '<div class="wx" id="wxBox" title="' + esc(w.desc + ' · ' + w.place + ', Schweiz') + '">' +
         '<span class="i">' + w.icon + '</span>' + w.temp + '°' +
         '<span class="pl">' + esc(w.place) + '</span></div>';
}

function paintHomeHero() {
  var host = $('#heroBox');
  if (!host) return;   /* Startseite hat keinen Hero mehr */
  var u = U(), t = P.cur, playing = !!t;
  var art, meta;
  if (playing) {
    art = t.art
      ? '<div class="hero-art"><img src="' + esc(t.art) + '" alt="" onerror="this.parentNode.textContent=\'♪\'"></div>'
      : '<div class="hero-art">' + (t.live ? '📻' : '♪') + '</div>';
    var kopf, titel, unten;
    if (t.live) {
      kopf  = 'Radiosender · ' + (t.quality || 'LIVE');
      titel = t.title;
      unten = [t.country, t.tags].filter(Boolean).join(' · ') || 'Live';
    } else {
      kopf  = 'Es läuft · ' + (t.source || 'Audius');
      titel = t.title;
      unten = [t.artist, t.album && t.album !== t.title ? t.album : '', t.year || '']
                .filter(Boolean).join(' · ');
    }
    meta = '<div class="hero-m"><small>' + esc(kopf) + '</small>' +
           '<h2>' + esc(titel) + '</h2>' +
           '<p>' + esc(unten) + '</p></div>';
  } else {
    art = '<div class="hero-art">' + (App.uid === 'maya' ? '✨' : '◈') + '</div>';
    meta = '<div class="hero-m"><small>' + esc(gruss()) + '</small>' +
           '<h2>' + esc(u.name) + '</h2>' +
           '<p>' + esc(u.seeds.slice(0, 3).join(' · ')) + '</p></div>';
  }
  host.classList.toggle('np-mode', playing);
  host.innerHTML = art + meta + wxChip();
  Weather.get().then(function (w) {
    var b = $('#wxBox');
    if (!b || !w) return;
    b.title = w.desc + ' · ' + w.place + ', Schweiz';
    b.innerHTML = '<span class="i">' + w.icon + '</span>' + w.temp + '°' +
                  '<span class="pl">' + esc(w.place) + '</span>';
  });
}

var PAGES = {};

/* --- Relevanz. Audius sortiert nach eigenen Kriterien und schiebt gern
   Entferntes nach oben. Wer "Rancid" tippt, will Rancid zuerst sehen und
   nicht einen Remix, der das Wort im Albumtitel fuehrt.              --- */
function relScore(t, q) {
  var n = function (s) { return String(s == null ? '' : s).toLowerCase().trim(); };
  q = n(q); if (!q) return 0;
  var ti = n(t.title), ar = n(t.artist), al = n(t.album);
  var s = 0;
  if (ti === q) s += 100;
  else if (ti.indexOf(q) === 0) s += 70;
  else if (ti.indexOf(q) >= 0) s += 45;
  if (ar === q) s += 90;
  else if (ar.indexOf(q) === 0) s += 60;
  else if (ar.indexOf(q) >= 0) s += 35;
  if (al.indexOf(q) >= 0) s += 12;
  /* jedes Wort der Anfrage, das irgendwo vorkommt, zaehlt mit */
  var w = q.split(/\s+/).filter(function (x) { return x.length > 2; });
  var hay = ti + ' ' + ar + ' ' + al;
  w.forEach(function (x) { if (hay.indexOf(x) >= 0) s += 8; });
  return s;
}
function byRelevance(list, q) {
  return (list || []).map(function (t, i) { return { t: t, s: relScore(t, q), i: i }; })
    .sort(function (a, b) { return b.s - a.s || a.i - b.i; })   /* stabil bei Gleichstand */
    .map(function (x) { return x.t; });
}
function topHitCard(t, list, onPlay) {
  var c = el('div', 'tophit',
    (t.art ? '<img src="' + esc(t.art) + '" alt="" onerror="this.style.visibility=\'hidden\'">'
           : '<div class="ph">\u266a</div>') +
    '<div class="m"><small>Top-Treffer</small><b>' + esc(t.title) + '</b>' +
    '<span>' + esc([t.artist, t.album && t.album !== t.title ? t.album : ''].filter(Boolean).join(' \u00b7 ')) + '</span></div>');
  c.onclick = onPlay;
  return c;
}


/* ============================================================
   BROWSE — Genres, kuratierte Playlists, Radio nach Kategorie
   Die Queries zeigen bewusst auf Begriffe, die auf Audius /
   Archive / Radio Browser wirklich etwas zurueckliefern. Ein
   Spotify-Playlistname als Suchbegriff faende hier nichts.
   ============================================================ */
var GENRES = [
  { id: 'rock',         label: 'Rock',      icon: '\ud83c\udfb8', query: 'rock' },
  { id: 'punk',         label: 'Punk',      icon: '\ud83d\udca5', query: 'punk' },
  { id: '80s',          label: '80s',       icon: '\ud83d\udcfb', query: '80s' },
  { id: 'classic-rock', label: 'Classic',   icon: '\ud83c\udfa4', query: 'classic rock' },
  { id: 'blues',        label: 'Blues',     icon: '\ud83c\udfb7', query: 'blues' },
  { id: 'latin',        label: 'Latin',     icon: '\ud83c\udf89', query: 'latin' },
  { id: 'chill',        label: 'Chill',     icon: '\u2615',       query: 'chill lounge' },
  { id: 'electronic',   label: 'Electro',   icon: '\ud83c\udf9b', query: 'electronic' },
  { id: 'folk',         label: 'Folk',      icon: '\ud83c\udfb5', query: 'folk' },
  { id: 'country',      label: 'Country',   icon: '\ud83e\udd20', query: 'country' }
];

var CURATED = [
  { name: 'Fast Rock',     sub: 'Hochtouriger Rock',   icon: '\ud83d\udd25', query: 'punk rock' },
  { name: '70s Rock',      sub: 'Goldene Aera',        icon: '\ud83d\udc51', query: '1970s rock' },
  { name: '80er Party',    sub: 'Disco und Charts',    icon: '\ud83d\udc83', query: 'disco' },
  { name: 'Latin Party',   sub: 'Die ganze Nacht',     icon: '\ud83c\udf89', query: 'latin' },
  { name: 'Blues Classics',sub: 'Die Legenden'  ,      icon: '\ud83c\udfb7', query: 'blues' },
  { name: 'Chillige Ecke', sub: 'Zum Runterkommen',    icon: '\u2615',       query: 'lounge' },
  { name: 'Dub & Reggae',  sub: 'Bass und Echo',       icon: '\ud83c\udf34', query: 'dub reggae' },
  { name: 'Alternative',   sub: 'Abseits der Charts',  icon: '\u25c8',       query: 'alternative rock' }
];

var RADIO_CATS = [
  { name: 'Charts',      tag: 'top 40' },
  { name: 'Rock',        tag: 'rock' },
  { name: '80er',        tag: '80s' },
  { name: 'Electronic',  tag: 'electronic' },
  { name: 'Alternative', tag: 'alternative' },
  { name: 'Reggae & Dub', tag: 'reggae' }
];

/* Genre und Playlist teilen denselben Weg: Suchfeld setzen, dann suchen.
   Genau wie die bestehenden Chips auf der Suchseite. */
function browseTo(q) { var i = $('#q'); if (i) i.value = q; doSearch(q); }

function renderGenreGrid(page) {
  var s = section('Stöbern', 'Antippen und loslegen');
  var grid = el('div', 'genre-grid');
  GENRES.forEach(function (g) {
    var b = el('button', 'genre-chip',
      '<span class="gi">' + g.icon + '</span><span class="gl">' + esc(g.label) + '</span>');
    b.onclick = function () { browseTo(g.query); };
    grid.appendChild(b);
  });
  s.appendChild(grid);
  page.appendChild(s);
}

function renderCurated(page) {
  var s = section('Sammlungen', 'Fertig zusammengestellt');
  var grid = el('div', 'pl-grid');
  CURATED.forEach(function (p) {
    var c = el('button', 'pl-tile',
      '<span class="pt-ic">' + p.icon + '</span>' +
      '<span class="pt-m"><b>' + esc(p.name) + '</b><span>' + esc(p.sub) + '</span></span>');
    c.onclick = function () { browseTo(p.query); };
    grid.appendChild(c);
  });
  s.appendChild(grid);
  page.appendChild(s);
}

/* Jede Kategorie laedt ihre Sender erst beim Aufklappen — sonst waeren das
   ein Dutzend Radio-Browser-Anfragen beim Oeffnen der Startseite. */
function renderRadioCats(page) {
  var s = section('Radio', 'Live, laeuft durchgehend');
  RADIO_CATS.forEach(function (cat) {
    var wrap = el('div', 'rcat');
    var head = el('button', 'rcat-h', '<span>' + esc(cat.name) + '</span><em>live</em>');
    var body = el('div', 'rcat-b');
    var loaded = false;
    head.onclick = function () {
      var open = wrap.classList.toggle('on');
      if (!open || loaded) return;
      loaded = true;
      body.appendChild(loading('Sender werden geprueft...'));
      Radio.byTag(cat.tag, 8).then(function (list) {
        body.innerHTML = '';
        if (!list.length) {
          loaded = false;
          body.appendChild(emptyBox('\u25cc', 'Nichts gefunden',
            'Radio Browser hat fuer \u201e' + esc(cat.tag) + '\u201c nichts ueber HTTPS geliefert.'));
          return;
        }
        var n = head.querySelector('em');
        if (n) n.textContent = list.length;
        body.appendChild(rowsBlock(list));
      }).catch(function () {
        body.innerHTML = ''; loaded = false;
        body.appendChild(emptyBox('\u25cc', 'Ladefehler', 'Nochmal antippen.'));
      });
    };
    wrap.appendChild(head); wrap.appendChild(body);
    s.appendChild(wrap);
  });
  page.appendChild(s);
}

PAGES.home = function (page) {
  /* Kein Begruessungsfenster mehr. Was laeuft, steht im Mini-Player unten;
     eine zweite grosse Box in der Seitenmitte waere nur Wiederholung. */
  var hist = Store.get(pkey('hist'), []);
  if (hist.length) {
    var s = section('Zuletzt geh\u00f6rt');
    s.appendChild(rowsBlock(hist.slice(0, 6)));
    page.appendChild(s);
  }
  renderGenreGrid(page);
  renderCurated(page);
  renderRadioCats(page);
};

function homeTracks(page, u) {
  u.genres.slice(0, 3).forEach(function (genre) {
    var s = section(genre, 'Full tracks · Audius');
    var g = el('div', 'grid'); s.appendChild(g);
    var ld = loading(); s.appendChild(ld);
    page.appendChild(s);
    Audius.trending(genre, 10).then(function (list) {
      ld.remove();
      if (!list.length) { g.remove(); s.appendChild(emptyBox('◌', 'Nothing came back', 'Audius returned no tracks for ' + esc(genre) + '.')); return; }
      list.forEach(function (t, i) {
        g.appendChild(card({ title: t.title, sub: t.artist, art: t.art, tag: mmss(t.dur) },
          function () { P.play(t, list, i); }));
      });
    });
  });
}

function homeRadio(page, u) {
  var s = section('Stations for you', 'Live · plays continuously');
  var b = el('div'); s.appendChild(b); b.appendChild(loading());
  page.appendChild(s);
  Promise.all(u.tags.slice(0, 3).map(function (t) { return Radio.byTag(t, 5); }))
    .then(function (lists) {
      var seen = {}, all = [];
      lists.forEach(function (l) {
        l.forEach(function (st) {
          var k = st.title.toLowerCase().replace(/[^a-z0-9]+/g, '');
          if (!seen[k]) { seen[k] = 1; all.push(st); }
        });
      });
      b.innerHTML = '';
      if (!all.length) { b.appendChild(emptyBox('◌', 'No stations right now', 'Radio Browser returned nothing for your tags.')); return; }
      all.sort(function (a, b2) { return (b2.bitrate || 0) - (a.bitrate || 0); });
      b.appendChild(rowsBlock(all.slice(0, 10)));
    });
}

function homeArchive(page, u) {
  var q = u.archive[0];
  var s = section(App.uid === 'maya' ? 'Rock\'n\'Roll originals' : 'Full albums',
                  App.uid === 'maya' ? 'Great 78 Project · digitised from the original shellac'
                                     : 'Internet Archive · complete, often lossless');
  var g = el('div', 'grid'); s.appendChild(g);
  var ld = loading(); s.appendChild(ld);
  page.appendChild(s);
  Archive.search(q, 10).then(function (items) {
    ld.remove();
    if (!items.length) { g.remove(); s.appendChild(emptyBox('◌', 'Nothing found', 'The Archive returned nothing for this shelf.')); return; }
    items.forEach(function (it) {
      g.appendChild(card({ title: it.title, sub: it.artist + (it.year ? ' · ' + it.year : ''), art: it.art, icon: '⌗', tag: 'FULL' },
        function () { openArchive(it); }));
    });
  });
}

PAGES.search = function (page) {
  if (!App.q) {
    page.appendChild(emptyBox('⌕', 'Search everything',
      'Type an artist, song or genre above. Every result plays in full — ' +
      '<b>Audius</b> (complete tracks, 320k), <b>Internet Archive</b> (full albums, often lossless) ' +
      'and <b>Radio Browser</b> (live stations). No clips anywhere.'));
    var chips = el('div', 'chips');
    U().seeds.concat(U().tags.slice(0, 4)).forEach(function (g) {
      var b = el('button', 'chip', esc(g));
      b.onclick = function () { $('#q').value = g; doSearch(g); };
      chips.appendChild(b);
    });
    page.appendChild(chips);
    return;
  }
  var q = App.q;
  var s1 = section('Tracks', 'Audius · complete tracks, 320k');
  var b1 = el('div'); s1.appendChild(b1); b1.appendChild(loading());
  page.appendChild(s1);
  Audius.search(q, 24).then(function (list) {
    b1.innerHTML = '';
    list = byRelevance(list, q);
    if (list.length && relScore(list[0], q) >= 45) {
      b1.appendChild(topHitCard(list[0], list, function () { P.play(list[0], list, 0); }));
    }
    if (!list.length) { b1.appendChild(emptyBox('◌', 'No tracks found', 'Try the artist name on its own, or a genre like dub, jungle or synthwave.')); return; }
    b1.appendChild(rowsBlock(list));
  });
  var s2 = section('Albums & lossless', 'Internet Archive — complete records');
  var g2 = el('div', 'grid'); s2.appendChild(g2);
  var l2 = loading(); s2.appendChild(l2);
  page.appendChild(s2);
  Archive.search(q, 12).then(function (items) {
    l2.remove();
    if (!items.length) { s2.appendChild(emptyBox('◌', 'Nothing in the Archive', 'The Internet Archive had no audio matching "' + esc(q) + '".')); return; }
    items.forEach(function (it) {
      g2.appendChild(card({ title: it.title, sub: it.artist + (it.year ? ' · ' + it.year : ''), art: it.art, icon: '⌗', tag: 'FULL' },
        function () { openArchive(it); }));
    });
  });
  var s3 = section('Live stations', 'Radio Browser — plays continuously, never a clip');
  var b3 = el('div'); s3.appendChild(b3); b3.appendChild(loading());
  page.appendChild(s3);
  Radio.byTag(q, 12).then(function (list) {
    b3.innerHTML = '';
    if (!list.length) { b3.appendChild(emptyBox('◌', 'No stations tagged "' + esc(q) + '"', 'Try a genre word like reggae, schlager, hardcore or 80s.')); return; }
    b3.appendChild(rowsBlock(list));
  });
};

PAGES.radio = function (page) {
  page.appendChild(el('div', 'hero',
    '<div class="hero-art">📻</div><div><small>Läuft durchgehend</small>' +
    '<h2>Radio</h2><p>Feste Sender oben, darunter nach Genre stöbern.</p></div>'));
  var s1 = section('Deine Sender', 'Direkt anwählbar');
  var grid = el('div', 'stn-grid'); s1.appendChild(grid);
  var ld = loading('Sender werden geprüft…'); s1.appendChild(ld);
  page.appendChild(s1);
  var found = [];
  Promise.all(Radio.NAMED.map(function (n) {
    return Radio.byName(n.q).then(function (st) { return st ? { st: st, n: n } : null; });
  })).then(function (list) {
    ld.remove();
    list.filter(Boolean).forEach(function (r) {
      found.push(r.st);
      var card = el('button', 'stn',
        (r.st.art ? '<img src="' + esc(r.st.art) + '" alt="" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'ph\',textContent:\'📻\'}))">'
                  : '<div class="ph">📻</div>') +
        '<span class="m"><b>' + esc(r.n.label) + '</b><span>' + esc(r.n.note) + '</span></span>' +
        '<span class="qb' + (r.st.lossless ? ' loss' : '') + '">' + esc(r.st.quality) + '</span>');
      card.dataset.tid = r.st.id;
      card.onclick = function () { P.play(r.st, found, found.indexOf(r.st)); markStations(); };
      grid.appendChild(card);
    });
    if (!grid.children.length) {
      s1.appendChild(emptyBox('◌', 'Keiner erreichbar', 'Radio Browser hat keinen dieser Sender über HTTPS geliefert.'));
    }
    markStations();
  });
  function markStations() {
    Array.prototype.forEach.call(grid.children, function (c) {
      c.classList.toggle('playing', !!(P.cur && c.dataset.tid === P.cur.id));
    });
  }
  var u = U();
  var s2 = section('Nach Genre', 'Nach Bitrate sortiert');
  var chips = el('div', 'chips'); s2.appendChild(chips);
  var host = el('div'); s2.appendChild(host);
  page.appendChild(s2);
  function load(tag) {
    Array.prototype.forEach.call(chips.children, function (c) { c.classList.toggle('on', c.textContent === tag); });
    host.innerHTML = ''; host.appendChild(loading('Suche ' + tag + '…'));
    Radio.byTag(tag, 24).then(function (list) {
      host.innerHTML = '';
      if (!list.length) { host.appendChild(emptyBox('◌', 'Nichts gefunden', 'Radio Browser hat für „' + esc(tag) + '" nichts geliefert.')); return; }
      list.sort(function (a, b) { return (b.lossless ? 1 : 0) - (a.lossless ? 1 : 0); });
      host.appendChild(rowsBlock(list));
    });
  }
  u.tags.forEach(function (t, i) {
    var b = el('button', 'chip', esc(t));
    b.onclick = function () { load(t); };
    chips.appendChild(b);
    if (i === 0) setTimeout(function () { load(t); }, 0);
  });
};

PAGES.lossless = function (page) {
  page.appendChild(el('div', 'hero',
    '<div class="hero-art">◈</div><div><small>Audiophile</small><h2>Lossless &amp; full length</h2>' +
    '<p>Internet Archive collections — live recordings and open music, frequently in FLAC or 24-bit.</p></div>'));
  var chips = el('div', 'chips'); page.appendChild(chips);
  var host = el('div'); page.appendChild(host);
  function load(term) {
    Array.prototype.forEach.call(chips.children, function (c) { c.classList.toggle('on', c.dataset.t === term); });
    host.innerHTML = ''; host.appendChild(loading('Searching the Archive for lossless…'));
    Archive.search(term, 24, true).then(function (items) {
      host.innerHTML = '';
      if (!items.length) { host.appendChild(emptyBox('◌', 'Nothing found', 'Try a broader term.')); return; }
      var g = el('div', 'grid'); host.appendChild(g);
      items.forEach(function (it) {
        g.appendChild(card({ title: it.title, sub: it.artist + (it.year ? ' · ' + it.year : ''), art: it.art, icon: '⌗' },
          function () { openArchive(it); }));
      });
    });
  }
  U().archive.concat(['live concert flac', 'netlabel']).forEach(function (t, i) {
    var b = el('button', 'chip', esc(t)); b.dataset.t = t;
    b.onclick = function () { load(t); };
    chips.appendChild(b);
    if (i === 0) setTimeout(function () { load(t); }, 0);
  });
};

function openArchive(item) {
  go('item');
  var page = $('#page');
  page.innerHTML = '';
  page.appendChild(el('div', 'hero',
    '<div class="hero-art" style="background:url(' + esc(item.art) + ') center/cover,var(--bg4)"></div>' +
    '<div><small>Internet Archive</small><h2>' + esc(item.title) + '</h2><p>' + esc(item.artist) + '</p></div>'));
  var host = el('div'); host.appendChild(loading('Reading track list…'));
  page.appendChild(host);
  Archive.tracks(item.identifier).then(function (tr) {
    host.innerHTML = '';
    if (!tr.length) { host.appendChild(emptyBox('◌', 'No playable audio', 'This item has no browser-playable files.')); return; }
    var lossN = tr.filter(function (t) { return t.lossless; }).length;
    var hd = el('div', 'sec-hd', '<h2>' + tr.length + ' tracks</h2><p>' + (lossN ? lossN + ' lossless' : 'compressed audio') + '</p>');
    host.appendChild(hd);
    var pa = el('button', 'btn', '▶ Play all');
    pa.style.marginBottom = '14px';
    pa.onclick = function () { P.play(tr[0], tr, 0); };
    host.appendChild(pa);
    host.appendChild(rowsBlock(tr));
  });
}

PAGES.library = function (page) {
  var hist = Store.get(pkey('hist'), []);
  page.appendChild(el('div', 'hero',
    '<div class="hero-art">📚</div><div><small>' + esc(U().name) + '</small><h2>Your Library</h2>' +
    '<p>Everything you have played on this device, newest first.</p></div>'));
  if (!hist.length) {
    page.appendChild(emptyBox('◌', 'Nothing here yet', 'Play something and it will show up here. Nothing leaves this browser.'));
    return;
  }
  var s = section('Recently played', hist.length + ' tracks');
  s.appendChild(rowsBlock(hist));
  page.appendChild(s);
};

PAGES.playlists = function (page) {
  var pls = playlists();
  page.appendChild(el('div', 'hero',
    '<div class="hero-art">▶</div><div><small>' + esc(U().name) + '</small><h2>Playlists</h2>' +
    '<p>Saved in this browser for this profile. Export them from Settings.</p></div>'));
  var nb = el('button', 'btn', '＋ New playlist');
  nb.style.marginBottom = '18px';
  nb.onclick = function () {
    var n = prompt('Playlist name:'); if (!n) return;
    var p = playlists(); p.push({ id: 'p' + Date.now(), name: n.trim(), tracks: [] }); savePl(p); render();
  };
  page.appendChild(nb);
  var g = el('div', 'grid');
  pls.forEach(function (p) {
    g.appendChild(card({
      title: p.name, sub: p.tracks.length + ' track' + (p.tracks.length === 1 ? '' : 's'),
      art: p.tracks[0] && p.tracks[0].art, icon: p.id === 'liked' ? '♥' : '≡'
    }, function () { openPlaylist(p.id); }));
  });
  page.appendChild(g);
};

function openPlaylist(id) {
  go('pl');
  var p = playlists().filter(function (x) { return x.id === id; })[0];
  var page = $('#page'); page.innerHTML = '';
  if (!p) { page.appendChild(emptyBox('◌', 'Playlist gone', 'It may have been deleted.')); return; }
  page.appendChild(el('div', 'hero',
    '<div class="hero-art">' + (p.id === 'liked' ? '♥' : '≡') + '</div>' +
    '<div><small>Playlist</small><h2>' + esc(p.name) + '</h2><p>' + p.tracks.length + ' tracks</p></div>'));
  var bar = el('div'); bar.style.cssText = 'display:flex;gap:9px;margin-bottom:16px;flex-wrap:wrap';
  if (p.tracks.length) {
    var pb = el('button', 'btn', '▶ Play');
    pb.onclick = function () { P.play(p.tracks[0], p.tracks, 0); };
    bar.appendChild(pb);
  }
  if (p.id !== 'liked') {
    var db = el('button', 'btn ghost', 'Delete playlist');
    db.onclick = function () {
      if (!confirm('Delete "' + p.name + '"?')) return;
      savePl(playlists().filter(function (x) { return x.id !== id; }));
      go('playlists');
    };
    bar.appendChild(db);
  }
  page.appendChild(bar);
  if (!p.tracks.length) { page.appendChild(emptyBox('◌', 'Empty playlist', 'Use the ＋ button on any track to add it here.')); return; }
  var wrap = el('div', 'rows');
  p.tracks.forEach(function (t, i) {
    var r = trackRow(t, i, p.tracks);
    var rm = r.querySelector('.r-add');
    rm.textContent = '−'; rm.title = 'Remove';
    rm.onclick = function (e) {
      e.stopPropagation();
      var all = playlists();
      var tgt = all.filter(function (x) { return x.id === id; })[0];
      tgt.tracks = tgt.tracks.filter(function (x) { return x.id !== t.id; });
      savePl(all); openPlaylist(id); toast('Removed');
    };
    wrap.appendChild(r);
  });
  page.appendChild(wrap);
}

PAGES.settings = function (page) {
  var u = U();
  page.appendChild(el('div', 'hero',
    '<div class="hero-art">⚙</div><div><small>' + esc(u.name) + '</small><h2>Settings</h2>' +
    '<p>Everything is stored in this browser only.</p></div>'));
  var s1 = el('div', 'set');
  s1.innerHTML =
    '<h3>Where the music comes from</h3>' +
    '<p>All three are free, keyless, and every one of them plays a track from start to finish. Nothing here serves a 30-second clip.</p>' +
    '<div class="set-row"><div><b>Audius</b><small>Complete tracks, streamed end to end</small></div><span class="qb">320k MP3</span></div>' +
    '<div class="set-row"><div><b>Internet Archive</b><small>Complete albums — live sets, netlabels, Great 78 originals, often FLAC</small></div><span class="qb loss">LOSSLESS</span></div>' +
    '<div class="set-row"><div><b>Radio Browser</b><small>Live stations, continuous playback, up to 320k and FLAC</small></div><span class="qb">LIVE</span></div>';
  page.appendChild(s1);
  var s2 = el('div', 'set');
  s2.innerHTML = '<h3>Playback</h3><p>Preferences for ' + esc(u.name) + '.</p>';
  var r1 = el('div', 'set-row', '<div><b>Preferred quality</b><small>Used to sort results — lossless first when available</small></div>');
  var sel = el('select');
  [['lossless', 'Lossless / highest'], ['high', 'High (320k)'], ['std', 'Standard']].forEach(function (o) {
    var op = el('option', null, o[1]); op.value = o[0];
    if (Store.get(pkey('qual'), u.quality) === o[0]) op.selected = true;
    sel.appendChild(op);
  });
  sel.onchange = function () { Store.set(pkey('qual'), this.value); toast('Saved'); };
  r1.appendChild(sel); s2.appendChild(r1);
  page.appendChild(s2);
  /* ---- Innentemperatur: Zugangsdaten bleiben auf diesem Geraet ---- */
  var sh = el('div', 'set');
  sh.innerHTML = '<h3>Innentemperatur</h3>' +
    '<p>Liest einen Sensor aus Home Assistant. Zugangsdaten werden nur in diesem ' +
    'Browser gespeichert und stehen nicht in der Website. Erreichbar muss HA per ' +
    '<b>https</b> von diesem Geraet aus sein \u2014 sonst zeigt die Kopfzeile \u2715.</p>';
  [['ha_url', 'Basis-URL', 'https://ha.example.com', 'url'],
   ['ha_ent', 'Entity-ID', 'sensor.tf1', 'text'],
   ['ha_tok', 'Long-Lived Token', 'wird nur lokal gespeichert', 'password']
  ].forEach(function (f) {
    var row = el('div', 'set-row', '<div><b>' + f[1] + '</b></div>');
    var inp = el('input');
    inp.type = f[3]; inp.placeholder = f[2]; inp.value = Store.get(f[0], '');
    inp.autocomplete = 'off'; inp.spellcheck = false;
    inp.style.cssText = 'min-width:190px;max-width:100%';
    inp.onchange = function () {
      Store.set(f[0], inp.value.trim());
      HAtemp.cache = null; HAtemp.ts = 0;
      paintHdrWx();
    };
    row.appendChild(inp); sh.appendChild(row);
  });
  var test = el('button', 'btn ghost', 'Verbindung testen');
  test.onclick = function () {
    if (!HAtemp.ready()) { toast('Bitte alle drei Felder ausfuellen'); return; }
    HAtemp.cache = null; HAtemp.ts = 0;
    test.disabled = true; test.textContent = 'Teste\u2026';
    HAtemp.get().then(function (v) {
      test.disabled = false; test.textContent = 'Verbindung testen';
      toast(v == null ? 'Nicht erreichbar \u2014 URL, Token oder Entity pruefen'
                      : 'Verbunden: ' + v + '\u00b0C');
      paintHdrWx();
    });
  };
  var clr = el('button', 'btn ghost', 'Zugangsdaten loeschen');
  clr.onclick = function () {
    ['ha_url', 'ha_ent', 'ha_tok'].forEach(function (k) { Store.set(k, ''); });
    HAtemp.cache = null; HAtemp.ts = 0;
    toast('Geloescht'); render(); paintHdrWx();
  };
  var hb = el('div'); hb.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px';
  hb.appendChild(test); hb.appendChild(clr); sh.appendChild(hb);
  page.appendChild(sh);

  var s3 = el('div', 'set');
  s3.innerHTML = '<h3>Your data</h3><p>Nothing is uploaded anywhere. Export gives you a JSON file you can re-import later.</p>';
  var row = el('div', 'set-row', '<div><b>Playlists &amp; history</b><small>' + playlists().length + ' playlists · ' + Store.get(pkey('hist'), []).length + ' played</small></div>');
  var box = el('div'); box.style.cssText = 'display:flex;gap:8px';
  var ex = el('button', 'btn ghost', 'Export');
  ex.onclick = function () {
    var name = 'soundmaschine-' + App.uid + '.json';
    var json = JSON.stringify({ user: App.uid, playlists: playlists(), history: Store.get(pkey('hist'), []) }, null, 2);
    var host = (window.claude && window.claude.use) ? window.claude.use('downloads') : null;
    Promise.resolve(host).then(function (dl) {
      if (!dl) throw new Error('no host');
      return dl.save({ filename: name, data: json }).then(function () { toast('Exported'); });
    }).catch(function (err) {
      if (err && err.code === 'declined') return;
      if (err && err.code) { toast('Export failed: ' + err.code); return; }
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = el('a'); a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  };
  var cl = el('button', 'btn ghost', 'Clear history');
  cl.onclick = function () { if (confirm('Clear listening history for ' + u.name + '?')) { Store.set(pkey('hist'), []); toast('History cleared'); render(); } };
  box.appendChild(ex); box.appendChild(cl); row.appendChild(box); s3.appendChild(row);
  page.appendChild(s3);
};

function dayPart() { var h = new Date().getHours(); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'; }
function gruss() { var h = new Date().getHours(); return h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 14 ? 'Guten Tag' : h < 18 ? 'Guten Nachmittag' : 'Guten Abend'; }

var NAV = [
  ['home', '⌂', 'Home'],
  ['search', '⌕', 'Search'],
  ['radio', '📻', 'Radio'],
  ['lossless', '◈', 'Lossless'],
  ['library', '📚', 'Library'],
  ['playlists', '▶', 'Playlists'],
  ['settings', '⚙', 'Settings']
];


/* --- Tab-Bar. Vier Ziele reichen; alles Weitere bleibt in der Seitenleiste
   hinter dem Menue-Knopf. Mehr als fuenf Tabs wird auf dem Handy zur
   Trefferuebung.                                                     --- */
var TABS = [
  ['home',   '\u2302', 'Start'],
  ['search', '\u2315', 'Suchen'],
  ['radio',  '\ud83d\udcfb', 'Radio'],
  ['library','\u2637', 'Library']
];
function renderTabs() {
  var n = $('#tabbar'); if (!n) return;
  n.innerHTML = '';
  TABS.forEach(function (t) {
    var b = el('button', 'tab' + (App.page === t[0] ? ' on' : ''),
      '<i>' + t[1] + '</i>' + t[2]);
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', App.page === t[0] ? 'true' : 'false');
    b.onclick = function () { go(t[0]); closeSide(); };
    n.appendChild(b);
  });
}

/* Suchfeld im Daumenbereich. Nur auf der Suchseite, nur auf dem Handy —
   gespiegelt auf das bestehende #q, damit die Suchlogik unberuehrt bleibt. */
function mountSearchBar() {
  var old = $('.searchbar'); if (old) old.remove();
  document.body.classList.toggle('searching', App.page === 'search');
  if (App.page !== 'search') return;
  var wrap = el('div', 'searchbar');
  var inp = el('input');
  inp.type = 'search'; inp.placeholder = 'Titel, Interpret oder Genre';
  inp.value = App.q || ''; inp.autocomplete = 'off'; inp.spellcheck = false;
  var t;
  inp.addEventListener('input', function () {
    clearTimeout(t);
    var v = inp.value;
    t = setTimeout(function () { var f = $('#q'); if (f) f.value = v; doSearch(v); }, 160);
  });
  wrap.appendChild(inp);
  document.body.appendChild(wrap);
}

function renderNav() {
  var n = $('#nav'); n.innerHTML = '';
  NAV.forEach(function (item) {
    var b = el('button', 'nav' + (App.page === item[0] ? ' on' : ''), '<i>' + item[1] + '</i>' + item[2]);
    b.onclick = function () { go(item[0]); closeSide(); };
    n.appendChild(b);
  });
}

function renderPlSidebar() {
  var h = $('#plList'); h.innerHTML = '';
  playlists().forEach(function (p) {
    if (p.id === 'liked') return;
    var b = el('button', 'pl-link', '<b>' + esc(p.name) + '</b><em>' + p.tracks.length + '</em>');
    b.onclick = function () { openPlaylist(p.id); closeSide(); };
    h.appendChild(b);
  });
  if (!h.children.length) h.appendChild(el('div', 'fav-empty', 'Noch keine eigenen Playlists.'));
  renderFav();
}

function renderFav() {
  var host = $('#favList'); if (!host) return;
  var liked = (playlists().filter(function (p) { return p.id === 'liked'; })[0] || { tracks: [] }).tracks;
  var cnt = $('#favCount'); if (cnt) cnt.textContent = liked.length;
  host.innerHTML = '';
  if (!liked.length) {
    host.appendChild(el('div', 'fav-empty', 'Noch keine Favoriten. Tippe auf ♥ neben einem Titel.'));
    return;
  }
  liked.slice(-5).reverse().forEach(function (t, i) {
    var b = el('button', 'fav-item',
      (t.art ? '<img src="' + esc(t.art) + '" alt="">' : '<div class="ph">♪</div>') +
      '<span class="m"><b>' + esc(t.title) + '</b><span>' + esc(t.artist) + '</span></span>');
    b.onclick = function () { P.play(t, liked.slice().reverse(), i); closeSide(); };
    host.appendChild(b);
  });
  if (liked.length > 5) {
    var all = el('button', 'fav-item', '<span class="m"><b style="color:var(--accent)">Alle ' + liked.length + ' anzeigen →</b></span>');
    all.onclick = function () { openPlaylist('liked'); closeSide(); };
    host.appendChild(all);
  }
}

function go(p) {
  App.page = p;
  renderNav();
  renderTabs();
  mountSearchBar();
  var titles = { home: 'Home', search: 'Search', radio: 'Radio', lossless: 'Lossless', library: 'Library', playlists: 'Playlists', settings: 'Settings', item: 'Album', pl: 'Playlist' };
  var tt = $('#ttl'); if (tt) tt.textContent = titles[p] || 'Home';
  document.title = 'MUSIKMASCHINE · ' + (titles[p] || 'Home');
  if (PAGES[p]) render();
  $('#main').scrollTop = 0;
}

function render() {
  var page = $('#page');
  page.innerHTML = '';
  var fn = PAGES[App.page];
  if (fn) { try { fn(page); } catch (e) { page.appendChild(emptyBox('!', 'Something broke rendering this page', esc(e.message))); } }
  P.paint();
}

var sT;
function doSearch(v) {
  App.q = v.trim();
  App.page = 'search';
  renderNav();
  $('#ttl').textContent = 'Search';
  render();
}
$('#q').addEventListener('input', function () {
  var v = this.value;
  clearTimeout(sT);
  sT = setTimeout(function () { doSearch(v); }, 160);
});
$('#q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { clearTimeout(sT); doSearch(this.value); } });

function renderUser() {
  var u = U();
  document.body.className = u.cls;
  var seg = $('#usrSeg'); seg.innerHTML = '';
  Object.keys(USERS).forEach(function (k) {
    var x = USERS[k], on = (k === App.uid);
    var b = el('button', on ? 'on' : '', '<span class="av">' + esc(x.initial) + '</span>' +
      '<span class="un"><b>' + esc(x.name) + '</b><i>' + esc(x.short || x.blurb) + '</i></span>');
    b.dataset.u = k;
    b.onclick = function () {
      if (k === App.uid) return;
      App.uid = k; Store.set('user', k);
      renderUser(); renderPlSidebar(); renderFav(); go('home');
      Sugg.reset();
      toast('Jetzt ' + x.name);
    };
    seg.appendChild(b);
  });
}

function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  Store.set('theme', t);
  $('#themeBtn').textContent = t === 'dark' ? '◐' : '◑';
}
function bootTheme() {
  var stamped = document.documentElement.getAttribute('data-theme');
  if (stamped === 'light' || stamped === 'dark') return stamped;
  return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
}
setTheme(Store.get('theme', bootTheme()));
$('#themeBtn').onclick = function () {
  setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
};

function closeSide() { $('#side').classList.remove('open'); $('#scrim').hidden = true; }
$('#menuBtn').onclick = function () { $('#side').classList.add('open'); $('#scrim').hidden = false; };
$('#scrim').onclick = closeSide;

document.addEventListener('keydown', function (e) {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); P.toggle(); }
  if (e.key === 'ArrowRight' && e.shiftKey) P.step(1);
  if (e.key === 'ArrowLeft' && e.shiftKey) P.step(-1);
  if (e.key === '/') { e.preventDefault(); $('#q').focus(); }
});

var Net = {
  blocked: false,
  check: function () {
    var probe = 'https://archive.org/metadata/messian_dread_-_reasonings_in_dub_-_2006_net_album';
    var self = this;
    return getJSON(probe, 9000)
      .catch(function () { return jsonp(probe, 9000); })
      .then(function () { self.blocked = false; })
      .catch(function () { self.blocked = true; self.banner(); });
  },
  banner: function () {
    if (document.getElementById('netbanner')) return;
    var b = el('div', null,
      '<b>This page cannot reach the music services.</b>' +
      '<p>SOUNDMASCHINE loads everything live from Audius, the Internet Archive and Radio Browser. ' +
      'The preview sandbox on claude.ai blocks outside requests, so nothing can load here. ' +
      'Open <code>index.html</code> from your own machine, or put it on Netlify, and it works normally.</p>');
    b.id = 'netbanner';
    b.style.cssText =
      'margin:0 0 20px;padding:14px 16px;border-radius:10px;background:var(--bg2);' +
      'border:1px solid var(--accent);border-left-width:3px;font-size:13px;line-height:1.6';
    b.querySelector('p').style.cssText = 'margin-top:5px;color:var(--fg2)';
    b.querySelector('b').style.cssText = 'font-family:var(--f-disp);font-size:14px';
    var page = $('#page');
    page.insertBefore(b, page.firstChild);
  }
};

(function watchHostBadge() {
  var SEL = '#nl-badge-frame,[id*="badge-frame"],[class*="badge-frame"]';
  function check() {
    if (document.querySelector(SEL)) { document.body.classList.add('hostbadge'); return true; }
    return false;
  }
  if (check()) return;
  var tries = 0;
  var iv = setInterval(function () { if (check() || ++tries > 12) clearInterval(iv); }, 500);
  window.addEventListener('load', check);
})();

renderUser();
renderPlSidebar();
renderTabs();
go('home');
Net.check();
(function () {
  var origRender = render;
  render = function () { origRender(); if (Net.blocked) Net.banner(); };
})();
window.SM = { App: App, P: P, Store: Store, Audius: Audius, Radio: Radio, Archive: Archive,
              Viz: Viz, Net: Net, Sugg: Sugg, isLiked: isLiked, toggleLike: toggleLike,
              Engine: Engine, Drawer: Drawer, Ambilight: Ambilight, Palette: Palette, MB: MB };

(function () {
  var t = $('#drwTabs');
  if (t) [].forEach.call(t.children, function (b) {
    b.onclick = function () { Drawer.tab = b.dataset.tab; Drawer.render(); };
  });
  var c = $('#drwClose'); if (c) c.onclick = function () { Drawer.toggle(); };
  var sc = $('#drwScrim'); if (sc) sc.onclick = function () { Drawer.toggle(); };
  var sig = $('#bSig'); if (sig) sig.onclick = function () { Drawer.toggle('signal'); };
  var nts = $('#bNotes'); if (nts) nts.onclick = function () { Drawer.toggle('notes'); };
  var amb = $('#bAmbi');
  if (amb) {
    amb.classList.toggle('on', Ambilight.on);
    amb.onclick = function () {
      amb.classList.toggle('on', Ambilight.toggle());
      toast('Ambilight ' + (Ambilight.on ? 'an' : 'aus'));
    };
  }
  document.addEventListener('keydown', function (e) {
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    if (e.key === 'i' || e.key === 'I') Drawer.toggle('signal');
    if (e.key === 'n' || e.key === 'N') Drawer.toggle('notes');
  });
})();

(function () {
  var hl = $('#hdrLogo'), src0 = document.querySelector('.logo-amp img');
  if (hl && src0) { hl.src = src0.src; hl.style.cursor = 'pointer';
    hl.onclick = function () { var g = $('#logoBig'); if (g) { g.querySelector('img').src = src0.src; g.classList.add('on'); } }; }
})();

(function () {
  var b = $('#logoBtn'), big = $('#logoBig');
  if (!b || !big) return;
  var img = big.querySelector('img'), src = b.querySelector('img');
  b.onclick = function () { img.src = src.src; big.classList.add('on'); };
  big.onclick = function () { big.classList.remove('on'); };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') big.classList.remove('on');
  });
})();

/* Sugg.init() entfernt */

(function () {
  var q = $('#q'), x = $('#qClear');
  if (!q || !x) return;
  function sync() { x.hidden = !q.value; }
  q.addEventListener('input', sync);
  x.onclick = function () {
    q.value = ''; sync(); q.focus();
    App.q = '';
    if (App.page === 'search') render();
  };
  sync();
})();


/* ---- Innentemperatur aus Home Assistant ------------------------------
   Zugangsdaten stehen NICHT in dieser Datei, sondern im localStorage des
   jeweiligen Geraets (Einstellungen -> Innentemperatur). index.html liegt
   oeffentlich auf Netlify; ein Token darin waere fuer jeden lesbar.

   Erreichbar ist HA nur, wenn es per https von diesem Geraet aus antwortet.
   Ein http-HA scheitert auf der https-Seite an Mixed Content, ein reines
   Heimnetz-HA ist von unterwegs ohnehin nicht da. In beiden Faellen zeigt
   die Anzeige das Platzhalterzeichen statt eines falschen Werts.        */
var HAtemp = {
  cache: null, ts: 0, pending: null,
  cfg: function () {
    return { url: (Store.get('ha_url', '') || '').replace(/\/+$/, ''),
             tok: Store.get('ha_tok', '') || '',
             ent: Store.get('ha_ent', '') || '' };
  },
  ready: function () { var c = this.cfg(); return !!(c.url && c.tok && c.ent); },
  get: function () {
    var self = this, c = this.cfg();
    if (!this.ready()) return Promise.resolve(null);
    if (this.cache && Date.now() - this.ts < 120000) return Promise.resolve(this.cache);
    if (this.pending) return this.pending;
    var ac = new AbortController();
    var to = setTimeout(function () { ac.abort(); }, 6000);
    this.pending = fetch(c.url + '/api/states/' + encodeURIComponent(c.ent), {
      signal: ac.signal,
      headers: { Authorization: 'Bearer ' + c.tok, Accept: 'application/json' }
    })
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        var v = parseFloat(d && d.state);
        if (isNaN(v)) throw new Error('kein Zahlenwert');
        self.cache = Math.round(v * 10) / 10; self.ts = Date.now(); self.pending = null;
        return self.cache;
      })
      .catch(function () { self.pending = null; self.cache = null; return null; })
      .finally(function () { clearTimeout(to); });
    return this.pending;
  }
};

/* Diskrete Aussentemperatur in der Kopfzeile — auf jeder Seite sichtbar.
   Weather.get() begrenzt sich selbst auf einen Abruf pro halbe Stunde,
   der Intervall unten kostet also nichts. Bleibt leer, wenn beide
   Wetterdienste ausfallen, statt einen Platzhalter zu zeigen. */
function paintHdrWx() {
  var b = $('#hdrWx');
  if (!b) return;
  Promise.all([Weather.get(), HAtemp.get()]).then(function (r) {
    var w = r[0], inn = r[1], html = '', tip = [];
    if (HAtemp.ready()) {
      /* Konfiguriert, aber nicht erreichbar -> Platzhalter statt stiller Luecke */
      html += '<span class="in"><i>\u2302</i>' + (inn == null ? '\u2715' : inn + '\u00b0') + '</span>';
      tip.push(inn == null ? 'Innen: nicht erreichbar' : 'Innen ' + inn + '\u00b0C');
    }
    if (w && !isNaN(w.temp)) {
      html += '<span class="out"><i>' + w.icon + '</i>' + w.temp + '\u00b0</span>';
      tip.push(w.desc + ' \u00b7 ' + w.place);
    }
    b.innerHTML = html;
    b.title = tip.join('  \u00b7  ');
  });
}
paintHdrWx();
setInterval(paintHdrWx, 15 * 60 * 1000);


})();
