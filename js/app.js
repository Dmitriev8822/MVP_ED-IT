(function () {
  const DATA = window.MVP_DATA;
  const key = DATA.storageKey;

  function seedState() {
    return {
      users: [
        { id: uid(), name: 'Главный админ', email: 'root@cosmo.local', password: 'root1234', role: 'superadmin' },
        { id: uid(), name: 'Администратор', email: 'admin@cosmo.local', password: 'admin1234', role: 'admin' }
      ],
      session: null,
      news: [...DATA.seedNews],
      materials: {},
      articles: [],
      forumTopics: [],
      resumes: [],
      progress: {}
    };
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function load() {
    const raw = localStorage.getItem(key);
    if (!raw) {
      const st = seedState();
      save(st);
      return st;
    }
    try {
      const parsed = JSON.parse(raw);
      return { ...seedState(), ...parsed };
    } catch {
      const st = seedState();
      save(st);
      return st;
    }
  }

  function save(state) {
    localStorage.setItem(key, JSON.stringify(state));
  }

  const state = load();

  function getUser() {
    return state.users.find((u) => u.id === state.session) || null;
  }

  function ensureProgress(userId) {
    if (!state.progress[userId]) {
      state.progress[userId] = {
        points: 0,
        viewed: {},
        newsOpened: {},
        tests: {},
        awards: [],
        projects: ['MVP-сайт космо-платформы'],
        career: 'Начальный этап',
        achievements: [],
        activity: []
      };
    }
    return state.progress[userId];
  }

  function logActivity(userId, action) {
    const p = ensureProgress(userId);
    p.activity.unshift({ action, at: new Date().toISOString() });
    p.activity = p.activity.slice(0, 30);
  }

  function addPoints(userId, marker, amount, action) {
    const p = ensureProgress(userId);
    if (p.viewed[marker]) return;
    p.viewed[marker] = true;
    p.points += amount;
    logActivity(userId, action);
    save(state);
  }

  function requireAuth() {
    if (!getUser()) {
      window.location.href = 'auth.html';
      return false;
    }
    return true;
  }

  function requireAdmin() {
    const u = getUser();
    if (!u || (u.role !== 'admin' && u.role !== 'superadmin')) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }

  function logout() {
    state.session = null;
    save(state);
    window.location.href = 'index.html';
  }

  function navHtml() {
    const u = getUser();
    return `<header class="nav"><a href="index.html">ORBIT</a><nav>
      <a href="profile.html">Кабинет</a>
      <a href="forum.html">Форум</a>
      <a href="track.html">Трек</a>
      ${u && (u.role === 'admin' || u.role === 'superadmin') ? '<a href="admin.html">Админ</a>' : ''}
      ${u ? '<button id="logoutBtn" class="link-btn">Выход</button>' : '<a href="auth.html">Вход</a>'}
    </nav></header>`;
  }

  function wireLogout() {
    const btn = document.getElementById('logoutBtn');
    if (btn) btn.addEventListener('click', logout);
  }

  function initHome() {
    document.body.insertAdjacentHTML('afterbegin', navHtml());
    const wrap = document.getElementById('planets');
    DATA.planets.forEach((p) => {
      const a = document.createElement('a');
      a.className = 'planet';
      a.href = p.page;
      a.textContent = p.name;
      wrap.appendChild(a);
    });
    wireLogout();
  }

  function initAuth() {
    document.body.insertAdjacentHTML('afterbegin', navHtml());
    const login = document.getElementById('loginForm');
    const register = document.getElementById('registerForm');
    const status = document.getElementById('authStatus');

    login.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = login.email.value.trim();
      const password = login.password.value.trim();
      const user = state.users.find((u) => u.email === email && u.password === password);
      if (!user) {
        status.textContent = 'Неверные данные';
        return;
      }
      state.session = user.id;
      ensureProgress(user.id);
      logActivity(user.id, 'Вход в систему');
      save(state);
      window.location.href = 'index.html';
    });

    register.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = register.name.value.trim();
      const email = register.email.value.trim();
      const password = register.password.value.trim();
      if (state.users.some((u) => u.email === email)) {
        status.textContent = 'Пользователь уже существует';
        return;
      }
      const user = { id: uid(), name, email, password, role: 'user' };
      state.users.push(user);
      state.session = user.id;
      ensureProgress(user.id);
      logActivity(user.id, 'Регистрация');
      save(state);
      window.location.href = 'index.html';
    });
    wireLogout();
  }

  function blockHtml(item, reverse, blockId, sectionId) {
    return `<section class="alt ${reverse ? 'reverse' : ''}" data-marker="${sectionId}:${blockId}">
      <img src="${item.image}" alt="${item.title}">
      <div><h2>${item.title}</h2><p>${item.text}</p>${blockId === 'news' ? '<div class="news-list" id="newsList"></div>' : ''}${blockId === 'test' ? '<form id="quizForm" class="quiz"></form>' : ''}</div>
    </section>`;
  }

  function initSection() {
    if (!requireAuth()) return;
    document.body.insertAdjacentHTML('afterbegin', navHtml());
    const page = document.body.dataset.section;
    const sec = DATA.sections[page];
    const blocks = JSON.parse(JSON.stringify(sec.blocks));
    Object.keys(blocks).forEach((b) => {
      const override = state.materials[`${page}:${b}`];
      if (override) blocks[b].text = override;
    });
    const root = document.getElementById('sectionRoot');
    root.insertAdjacentHTML('beforeend', `<h1 class="section-title">${sec.title}</h1>`);
    const order = ['history', 'news', 'modern', 'success', 'test'];
    order.forEach((id, i) => root.insertAdjacentHTML('beforeend', blockHtml(blocks[id], i % 2 === 1, id, page)));

    const u = getUser();
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const marker = entry.target.dataset.marker;
          addPoints(u.id, marker, 10, `Изучен блок: ${marker}`);
        }
      });
    }, { threshold: 0.7 });
    document.querySelectorAll('.alt').forEach((el) => obs.observe(el));

    const list = document.getElementById('newsList');
    if (list) {
      const allNews = state.news.filter((n) => n.section === page);
      list.innerHTML = allNews.map((n) => `<article><h3>${n.title}</h3><p>${n.teaser}</p><a href="article.html?id=${n.id}">Читать статью</a></article>`).join('');
    }

    const quiz = document.getElementById('quizForm');
    if (quiz) {
      quiz.innerHTML = `<p>${sec.quiz.question}</p>${sec.quiz.options.map((o, i) => `<label><input type="radio" name="q" value="${i}" required> ${o}</label>`).join('')}<button>Проверить</button><p id="quizStatus"></p>`;
      quiz.addEventListener('submit', (e) => {
        e.preventDefault();
        const choice = Number(quiz.q.value);
        const p = ensureProgress(u.id);
        if (choice === sec.quiz.answer) {
          if (!p.tests[page]) {
            p.tests[page] = true;
            p.points += 30;
            logActivity(u.id, `Пройден тест раздела ${page}`);
            save(state);
          }
          document.getElementById('quizStatus').textContent = 'Верно. Баллы начислены автоматически.';
        } else {
          document.getElementById('quizStatus').textContent = 'Неверный ответ, попробуйте снова.';
        }
      });
    }
    wireLogout();
  }

  function initArticle() {
    if (!requireAuth()) return;
    document.body.insertAdjacentHTML('afterbegin', navHtml());
    const id = new URLSearchParams(window.location.search).get('id');
    const article = state.news.find((n) => n.id === id) || state.articles.find((a) => a.id === id);
    const root = document.getElementById('articleRoot');
    if (!article) {
      root.innerHTML = '<p>Статья не найдена</p>';
      return;
    }
    root.innerHTML = `<h1>${article.title}</h1><p>${article.content}</p>`;
    const u = getUser();
    const p = ensureProgress(u.id);
    if (!p.newsOpened[id]) {
      p.newsOpened[id] = true;
      p.points += 15;
      logActivity(u.id, `Открыта полная новость: ${article.title}`);
      save(state);
    }
    wireLogout();
  }

  function initProfile() {
    if (!requireAuth()) return;
    document.body.insertAdjacentHTML('afterbegin', navHtml());
    const u = getUser();
    const p = ensureProgress(u.id);
    const totalMarkers = DATA.planets.length * 5;
    const progress = Math.min(100, Math.round((Object.keys(p.viewed).length / totalMarkers) * 100));
    const rewards = [];
    if (p.points >= 100) rewards.push('Орбитальный старт');
    if (Object.keys(p.tests).length >= 2) rewards.push('Навигатор знаний');
    document.getElementById('profileRoot').innerHTML = `
      <h1>${u.name}</h1>
      <div class="metrics"><div><span>Баллы</span><strong>${p.points}</strong></div><div><span>Прогресс</span><strong>${progress}%</strong></div><div><span>Награды</span><strong>${rewards.join(', ') || '—'}</strong></div></div>
      <section class="panel"><h2>Проекты</h2><p>${p.projects.join(', ')}</p></section>
      <section class="panel"><h2>Карьера</h2><p>${p.career}</p></section>
      <section class="panel"><h2>Достижения</h2><p>${p.achievements.join(', ') || 'Пока нет'}</p></section>
      <section class="panel"><h2>Этап трека</h2><p>${currentTrackStatus(u.id)}</p></section>
      <section class="panel"><h2>История активности</h2><ul>${p.activity.map((a) => `<li>${new Date(a.at).toLocaleString('ru-RU')} — ${a.action}</li>`).join('')}</ul></section>`;
    wireLogout();
  }

  function currentTrackStatus(userId) {
    const resume = state.resumes.find((r) => r.userId === userId);
    return resume ? resume.status : 'Резюме не загружено';
  }

  function initTrack() {
    if (!requireAuth()) return;
    document.body.insertAdjacentHTML('afterbegin', navHtml());
    const u = getUser();
    const form = document.getElementById('resumeForm');
    const root = document.getElementById('trackRoot');
    function render() {
      const resume = state.resumes.find((r) => r.userId === u.id);
      const status = resume ? resume.status : 'Резюме не загружено';
      root.innerHTML = `<h1>Карьерный трек</h1><p>Текущий статус: <strong>${status}</strong></p><ol class="stages">${DATA.trackStages.map((s) => `<li class="${resume && DATA.trackStages.indexOf(resume.status) >= DATA.trackStages.indexOf(s) ? 'done' : ''}">${s}</li>`).join('')}</ol>`;
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const file = form.resume.files[0];
      if (!file) return;
      const existing = state.resumes.find((r) => r.userId === u.id);
      if (existing) {
        existing.fileName = file.name;
        existing.status = DATA.trackStages[0];
      } else {
        state.resumes.push({ id: uid(), userId: u.id, fileName: file.name, status: DATA.trackStages[0] });
      }
      logActivity(u.id, `Загружено резюме: ${file.name}`);
      save(state);
      render();
      form.reset();
    });
    render();
    wireLogout();
  }

  function initForum() {
    if (!requireAuth()) return;
    document.body.insertAdjacentHTML('afterbegin', navHtml());
    const u = getUser();
    const list = document.getElementById('topics');
    const form = document.getElementById('topicForm');
    function render() {
      list.innerHTML = state.forumTopics.map((t) => `<li><a href="topic.html?id=${t.id}">${t.title}</a> <small>(${t.comments.length} комментариев)</small></li>`).join('') || '<li>Тем пока нет</li>';
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      state.forumTopics.push({ id: uid(), title: form.title.value.trim(), authorId: u.id, comments: [] });
      logActivity(u.id, `Создана тема форума: ${form.title.value.trim()}`);
      save(state);
      form.reset();
      render();
    });
    render();
    wireLogout();
  }

  function initTopic() {
    if (!requireAuth()) return;
    document.body.insertAdjacentHTML('afterbegin', navHtml());
    const u = getUser();
    const id = new URLSearchParams(window.location.search).get('id');
    const topic = state.forumTopics.find((t) => t.id === id);
    const root = document.getElementById('topicRoot');
    const form = document.getElementById('commentForm');
    if (!topic) {
      root.innerHTML = '<p>Тема не найдена</p>';
      return;
    }
    function render() {
      root.innerHTML = `<h1>${topic.title}</h1><ul>${topic.comments.map((c) => `<li>${c.author}: ${c.text}</li>`).join('') || '<li>Комментариев нет</li>'}</ul>`;
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      topic.comments.push({ author: u.name, text: form.text.value.trim() });
      logActivity(u.id, `Комментарий в теме: ${topic.title}`);
      save(state);
      form.reset();
      render();
    });
    render();
    wireLogout();
  }

  function initAdmin() {
    if (!requireAdmin()) return;
    document.body.insertAdjacentHTML('afterbegin', navHtml());
    const u = getUser();
    const newsForm = document.getElementById('newsForm');
    const matForm = document.getElementById('materialForm');
    const resumes = document.getElementById('resumeAdmin');
    const users = document.getElementById('usersAdmin');
    const createAdminForm = document.getElementById('createAdminForm');

    newsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      state.news.push({ id: uid(), section: newsForm.section.value, title: newsForm.title.value.trim(), teaser: newsForm.teaser.value.trim(), content: newsForm.content.value.trim() });
      logActivity(u.id, `Создана новость: ${newsForm.title.value.trim()}`);
      save(state);
      newsForm.reset();
      renderResumes();
    });

    matForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const k = `${matForm.section.value}:${matForm.block.value}`;
      state.materials[k] = matForm.text.value.trim();
      logActivity(u.id, `Обновлен материал ${k}`);
      save(state);
      matForm.reset();
    });

    function renderResumes() {
      resumes.innerHTML = state.resumes.map((r) => {
        const user = state.users.find((x) => x.id === r.userId);
        return `<li>${user ? user.email : r.userId} — ${r.fileName}
          <select data-resume="${r.id}">${DATA.trackStages.map((s) => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </li>`;
      }).join('') || '<li>Резюме пока нет</li>';
      resumes.querySelectorAll('select').forEach((sel) => {
        sel.addEventListener('change', () => {
          const res = state.resumes.find((r) => r.id === sel.dataset.resume);
          res.status = sel.value;
          save(state);
        });
      });
    }

    function renderUsers() {
      users.innerHTML = state.users.map((x) => `<li>${x.email} — ${x.role}</li>`).join('');
    }

    if (u.role !== 'superadmin') {
      createAdminForm.closest('section').classList.add('hidden');
    } else {
      createAdminForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (state.users.some((x) => x.email === createAdminForm.email.value.trim())) return;
        state.users.push({
          id: uid(),
          name: createAdminForm.name.value.trim(),
          email: createAdminForm.email.value.trim(),
          password: createAdminForm.password.value.trim(),
          role: createAdminForm.role.value
        });
        save(state);
        createAdminForm.reset();
        renderUsers();
      });
    }

    renderResumes();
    renderUsers();
    wireLogout();
  }

  const page = document.body.dataset.page;
  const handlers = {
    home: initHome,
    auth: initAuth,
    section: initSection,
    article: initArticle,
    profile: initProfile,
    track: initTrack,
    forum: initForum,
    topic: initTopic,
    admin: initAdmin
  };
  if (handlers[page]) handlers[page]();
})();
