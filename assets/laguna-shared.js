(() => {
  const {media, fallback, search} = window.lagunaConfig;
  const stockFor = Object.fromEntries(Object.values(media)
    .filter(([stock, local]) => stock !== local)
    .map(([stock, local]) => [local, stock]));
  const localPath = path => path?.startsWith('assets/img/') ? path : fallback[path];
  const stockMode = navigator.onLine && !navigator.connection?.saveData;
  const remoteStatus = new Map();

  function tryStock(url) {
    if (!remoteStatus.has(url)) {
      remoteStatus.set(url, new Promise(resolve => {
        const candidate = new Image();
        candidate.onload = () => resolve(true);
        candidate.onerror = () => resolve(false);
        candidate.src = url;
      }));
    }
    return remoteStatus.get(url);
  }

  function enhance(img) {
    const source = img.getAttribute('src');
    const local = localPath(source);
    if (!local) return;
    if (source !== local) img.src = local;
    const stock = stockFor[local];
    if (!stock || !stockMode) return;
    tryStock(stock).then(ready => {
      if (ready && img.isConnected && img.getAttribute('src') === local) img.src = stock;
    });
  }

  window.lagunaImage = (img, key) => {
    if (!img || !media[key]) return;
    const [, local, description] = media[key];
    img.src = local;
    img.alt = description;
    enhance(img);
  };
  document.querySelectorAll('main img').forEach(enhance);
  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeName === 'IMG') enhance(node);
        else if (node.nodeType === 1) node.querySelectorAll('img').forEach(enhance);
      }
    }
  }).observe(document.querySelector('main'), {subtree:true,childList:true});

  const nav = document.querySelector('.nav-links');
  nav.addEventListener('toggle', event => {
    if (!event.target.open) return;
    nav.querySelectorAll('details[open]').forEach(menu => {
      if (menu !== event.target) menu.open = false;
    });
  }, true);
  document.addEventListener('pointerdown', event => {
    if (!nav.contains(event.target)) nav.querySelectorAll('details[open]').forEach(menu => menu.open = false);
  });

  const dialog = document.getElementById('search');
  const query = document.getElementById('q');
  const results = document.getElementById('results');
  const close = document.getElementById('closeSearch');
  const main = document.querySelector('main');
  const header = document.getElementById('nav');
  const footer = document.querySelector('footer');
  const openers = document.querySelectorAll('#openSearch,[data-open-search]');
  const stopWords = new Set(['a','an','and','can','do','for','how','i','in','is','of','the','to','where','you','city','laguna','beach','find','information']);
  let trigger;

  function setSearch(open) {
    dialog.classList.toggle('open', open);
    main.inert = header.inert = footer.inert = open;
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      query.value = '';
      results.replaceChildren();
      query.focus();
    } else if (trigger) {
      trigger.focus();
    }
  }

  function searchTerms(text) {
    return text.toLowerCase().match(/[a-z0-9]+/g)?.filter(term => !stopWords.has(term)) || [];
  }

  function runSearch() {
    const value = query.value.trim();
    results.replaceChildren();
    if (!value) return;
    const terms = searchTerms(value);
    const matches = search.map(item => {
      const keywords = new Set(searchTerms(item.k + ' ' + item.s + ' ' + item.t));
      const title = new Set(searchTerms(item.t));
      const score = terms.reduce((sum, term) => sum + (title.has(term) ? 3 : keywords.has(term) ? 1 : 0), 0);
      return {item, score};
    }).filter(entry => entry.score > 0).sort((a,b) => b.score - a.score).slice(0,4);
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.className = 'r-empty';
      empty.textContent = 'No matching services. Try permits, potholes, meetings or recreation.';
      results.append(empty);
      return;
    }
    const group = document.createElement('div');
    group.className = 'rgroup';
    const heading = document.createElement('h3');
    heading.textContent = 'City services';
    const list = document.createElement('ul');
    matches.forEach(({item}) => {
      const li = document.createElement('li');
      const anchor = document.createElement('a');
      anchor.href = item.href;
      const text = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = item.t;
      const description = document.createElement('small');
      description.textContent = item.s;
      text.append(title, description);
      if (document.querySelector('main .topshell') && media[item.img]) {
        const thumbnail = document.createElement('img');
        thumbnail.src = media[item.img][1];
        thumbnail.alt = '';
        anchor.append(thumbnail);
      }
      anchor.append(text);
      anchor.addEventListener('click', () => setSearch(false));
      li.append(anchor);
      list.append(li);
    });
    group.append(heading, list);
    results.append(group);
  }

  openers.forEach(opener => opener.addEventListener('click', event => {
    event.preventDefault();
    trigger = opener;
    setSearch(true);
  }));
  close.addEventListener('click', () => setSearch(false));
  dialog.addEventListener('click', event => {
    if (event.target === dialog) setSearch(false);
  });
  query.addEventListener('input', runSearch);
  query.addEventListener('keydown', event => {
    if (event.key === 'Enter') results.querySelector('a')?.click();
  });
  dialog.querySelectorAll('[data-q]').forEach(chip => chip.addEventListener('click', () => {
    query.value = chip.dataset.q;
    runSearch();
    query.focus();
  }));
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll('button,input,a')];
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (dialog.classList.contains('open')) {
        event.stopImmediatePropagation();
        setSearch(false);
      } else {
        const openMenu = nav.querySelector('details[open]');
        if (openMenu) {
          openMenu.open = false;
          openMenu.querySelector('summary').focus();
        }
      }
    }
    if (event.key === '/' && !document.querySelector('.drawer.open') && !/input|textarea/i.test(document.activeElement.tagName)) {
      event.preventDefault();
      trigger = document.activeElement;
      setSearch(true);
    }
  });

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const video = document.querySelector('.topshell video');
  const toggle = document.querySelector('.hero-video-toggle');
  if (video && toggle) {
    const localVideo = video.querySelector('source').getAttribute('src');
    const stockVideo = video.dataset.stockVideo;
    let started = false;
    let usingStock = false;
    let stockTimer;
    let pausedByUser = false;

    function reflectState() {
      toggle.hidden = motion.matches || video.readyState < 2;
      toggle.setAttribute('aria-label', video.paused ? 'Play background video' : 'Pause background video');
      toggle.setAttribute('aria-pressed', String(video.paused));
      toggle.querySelector('use').setAttribute('href', video.paused ? '#i-play' : '#i-pause');
    }

    function fallBack() {
      if (!usingStock) return;
      usingStock = false;
      clearTimeout(stockTimer);
      video.src = localVideo;
      updatePlayback();
    }

    function updatePlayback() {
      if (motion.matches || pausedByUser) {
        video.pause();
        reflectState();
        return;
      }
      if (!started) {
        started = true;
        usingStock = Boolean(stockMode && stockVideo);
        if (usingStock) {
          stockTimer = setTimeout(fallBack, 3500);
          video.src = stockVideo;
        }
      }
      video.play().catch(() => {
        if (video.error) fallBack();
        reflectState();
      });
    }

    video.addEventListener('loadeddata', () => {
      clearTimeout(stockTimer);
      reflectState();
    });
    video.addEventListener('error', fallBack);
    video.addEventListener('pause', reflectState);
    video.addEventListener('play', reflectState);
    toggle.addEventListener('click', () => {
      pausedByUser = !video.paused;
      updatePlayback();
    });
    motion.addEventListener('change', updatePlayback);
    updatePlayback();
  }
})();
