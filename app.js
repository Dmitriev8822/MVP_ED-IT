(() => {
  const STORAGE_KEY = 'cosmotrack_mvp_v2';

  function defaultState() {
    return {
      users: [
        { name: 'Super Admin', email: 'super@cosmo.local', password: '1234', role: 'superadmin' },
        { name: 'Admin', email: 'admin@cosmo.local', password: '1234', role: 'admin' }
      ],
      session: null,
      news: [...COSMO_DATA.seedNews],
      materials: {},
      articles: {},
      forum: {
        topics: [
          {
            id: crypto.randomUUID(),
            title: 'Добро пожаловать в форум',
            body: 'Обсуждайте карьеру в космоиндустрии.',
            author: 'System',
            comments: []
          }
        ]
      },
      userData: {}
    };
  }

  const state = loadState();
  ensureSessionData();

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    try {
      const parsed = JSON.parse(raw);
      return {
        ...defaultState(),
        ...parsed,
        news: Array.isArray(parsed.news) ? parsed.news : [...COSMO_DATA.seedNews]
      };
    } catch {
      return defaultState();
    }
  }

  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function user() { return state.users.find((u) => u.email === state.session) || null; }

  function ensureUserData(email) {
    if (!email) return;
    if (!state.userData[email]) {
      state.userData[email] = {
        points: 0,
        completed: [],
        viewedNews: [],
        quizDone: [],
        activity: [],
        achievements: [],
        resume: null,
        trackStatus: COSMO_DATA.careerStages[0]
      };
    }
  }

  function ensureSessionData() {
    if (state.session) ensureUserData(state.session);
    saveState();
  }

  function addActivity(email, text) {
    ensureUserData(email);
    state.userData[email].activity.unshift(`${new Date().toLocaleString('ru-RU')}: ${text}`);
    state.userData[email].activity = state.userData[email].activity.slice(0, 40);
  }

  function awardOnce(email, key, points, text) {
    ensureUserData(email);
    const data = state.userData[email];
    if (data.completed.includes(key)) return;
    data.completed.push(key);
    data.points += points;
    addActivity(email, `${text} (+${points})`);
    saveState();
  }

  function parseQuery(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function needAuth() {
    if (!user()) window.location.href = 'auth.html';
  }

  function requireAdmin() {
    const me = user();
    if (!me || (me.role !== 'admin' && me.role !== 'superadmin')) {
      window.location.href = 'auth.html';
      return false;
    }
    return true;
  }

  function renderTimeline(container, current) {
    const ix = COSMO_DATA.careerStages.indexOf(current);
    container.innerHTML = `<ul class="timeline">${COSMO_DATA.careerStages
      .map((step, i) => `<li class="${i <= ix ? 'active' : ''}">${step}</li>`)
      .join('')}</ul>`;
  }

  function handleAuthPage() {
    const login = document.getElementById('login-form');
    const reg = document.getElementById('register-form');
    const msg = document.getElementById('auth-msg');

    login?.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const found = state.users.find((u) => u.email === email && u.password === password);
      if (!found) return (msg.textContent = 'Неверный логин/пароль');
      state.session = found.email;
      ensureUserData(found.email);
      addActivity(found.email, 'Вход в систему');
      saveState();
      window.location.href = 'index.html';
    });

    reg?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('reg-name').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      if (state.users.some((u) => u.email === email)) return (msg.textContent = 'Email уже занят');
      state.users.push({ name, email, password, role: 'user' });
      state.session = email;
      ensureUserData(email);
      addActivity(email, 'Регистрация');
      saveState();
      window.location.href = 'index.html';
    });
  }

  function buildQuiz(section, quiz, idx) {
    return `
      <div class="alt-block ${idx % 2 ? 'reverse' : ''}">
        <div class="mock-image"></div>
        <div class="alt-text">
          <h3>Тест</h3>
          <p>${quiz.question}</p>
          <form data-quiz="${quiz.id}" class="form-grid quiz-form">
            ${quiz.options
              .map(
                (o) => `<label><input type="radio" name="${quiz.id}" value="${o.id}" required /> ${o.text}</label>`
              )
              .join('')}
            <button class="btn btn-solid" type="submit">Ответить</button>
          </form>
          <p class="status" id="quiz-status-${quiz.id}"></p>
        </div>
      </div>`;
  }

  function renderSectionPage() {
    needAuth();
    const id = parseQuery('section') || 'orbit';
    const section = COSMO_DATA.sections[id];
    if (!section) return;

    document.getElementById('section-title').textContent = section.title;
    document.getElementById('section-subtitle').textContent = section.subtitle;

    const news = state.news.filter((n) => n.section === id);
    const blocks = [
      { title: 'История', text: section.history.text, key: section.history.id },
      {
        title: 'Новости',
        text:
          news
            .map((n) => `<a class="news-link" href="article.html?id=${n.id}"><strong>${n.title}</strong><br><span class="muted">${n.short}</span></a>`)
            .join('') || 'Новостей пока нет.'
      },
      { title: 'Современные технологии', text: section.modern.text, key: section.modern.id },
      { title: 'Истории успеха', text: section.success.text, key: section.success.id }
    ];

    const html = blocks
      .map(
        (b, idx) => `
          <section class="alt-block ${idx % 2 ? 'reverse' : ''}" data-material="${b.key || ''}">
            <div class="mock-image"></div>
            <div class="alt-text"><h3>${b.title}</h3><div>${b.text}</div></div>
          </section>`
      )
      .join('') + buildQuiz(id, section.quiz, blocks.length);

    document.getElementById('section-blocks').innerHTML = html;

    const me = user();
    [section.history.id, section.modern.id, section.success.id].forEach((key) => awardOnce(me.email, key, 10, `Изучен блок ${key}`));

    document.querySelectorAll('.quiz-form').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const qid = form.dataset.quiz;
        const quiz = section.quiz;
        const chosen = new FormData(form).get(qid);
        const correct = quiz.options.find((o) => o.correct)?.id;
        const status = document.getElementById(`quiz-status-${qid}`);
        if (chosen === correct) {
          awardOnce(me.email, `quiz-${qid}`, 25, `Пройден тест ${qid}`);
          status.textContent = 'Верно. Баллы начислены автоматически.';
        } else {
          status.textContent = 'Неверно. Попробуйте снова.';
        }
      });
    });
  }

  function renderArticlePage() {
    needAuth();
    const id = parseQuery('id');
    const article = state.news.find((n) => n.id === id) || state.articles[id];
    const root = document.getElementById('article-full');
    if (!article) {
      root.innerHTML = '<h1>Статья не найдена</h1>';
      return;
    }
    root.innerHTML = `<h1>${article.title}</h1><p class="muted">${article.section}</p><p>${article.full}</p>`;
    awardOnce(user().email, `news-${id}`, 15, `Прочитана новость ${article.title}`);
  }

  function renderProfile() {
    needAuth();
    const me = user();
    const data = state.userData[me.email];
    const done = data.completed.length;
    const progress = Math.min(100, Math.round((done / 18) * 100));
    const rewards = Math.floor(data.points / 40);

    document.getElementById('profile-metrics').innerHTML = `
      <div class="metric"><div class="muted">Роль</div><strong>${me.role}</strong></div>
      <div class="metric"><div class="muted">Баллы</div><strong>${data.points}</strong></div>
      <div class="metric"><div class="muted">Прогресс</div><strong>${progress}%</strong></div>
      <div class="metric"><div class="muted">Награды</div><strong>${rewards}</strong></div>`;

    document.getElementById('projects-list').innerHTML = COSMO_DATA.projectsSeed.map((x) => `<div class="list-item">${x}</div>`).join('');
    document.getElementById('career-list').innerHTML = COSMO_DATA.careerSeed.map((x) => `<div class="list-item">${x}</div>`).join('');
    document.getElementById('awards-list').innerHTML = data.completed.map((x) => `<div class="list-item">${x}</div>`).join('') || 'Пока нет достижений';
    document.getElementById('activity-log').innerHTML = data.activity.map((x) => `<div class="list-item">${x}</div>`).join('') || 'Активность появится после изучения материалов.';
    renderTimeline(document.getElementById('track-status-view'), data.trackStatus);

    document.getElementById('logout-link').addEventListener('click', (e) => {
      e.preventDefault();
      state.session = null;
      saveState();
      window.location.href = 'auth.html';
    });
  }

  function renderTrack() {
    needAuth();
    const me = user();
    const data = state.userData[me.email];
    renderTimeline(document.getElementById('track-status'), data.trackStatus);

    document.getElementById('resume-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const resume = document.getElementById('resume-name').value.trim();
      data.resume = { name: resume, uploadedAt: new Date().toISOString() };
      data.trackStatus = COSMO_DATA.careerStages[0];
      addActivity(me.email, `Загружено резюме ${resume}`);
      awardOnce(me.email, 'resume-uploaded', 10, 'Загрузка резюме');
      saveState();
      renderTimeline(document.getElementById('track-status'), data.trackStatus);
    });
  }

  function renderForum() {
    needAuth();
    const list = document.getElementById('topics-list');

    function refresh() {
      list.innerHTML = state.forum.topics
        .map(
          (t) => `<div class="list-item"><a href="topic.html?id=${t.id}"><strong>${t.title}</strong></a><div class="muted">${t.author}</div></div>`
        )
        .join('');
    }

    document.getElementById('topic-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('topic-title').value.trim();
      const body = document.getElementById('topic-body').value.trim();
      state.forum.topics.unshift({ id: crypto.randomUUID(), title, body, author: user().name, comments: [] });
      addActivity(user().email, `Создана тема форума: ${title}`);
      saveState();
      e.target.reset();
      refresh();
    });

    refresh();
  }

  function renderTopic() {
    needAuth();
    const id = parseQuery('id');
    const topic = state.forum.topics.find((t) => t.id === id);
    if (!topic) {
      document.getElementById('topic-main').innerHTML = 'Тема не найдена';
      return;
    }

    document.getElementById('topic-main').innerHTML = `<h1>${topic.title}</h1><p>${topic.body}</p><p class="muted">Автор: ${topic.author}</p>`;
    const commentsList = document.getElementById('comments-list');

    function refresh() {
      commentsList.innerHTML = topic.comments.map((c) => `<div class="list-item"><strong>${c.author}</strong><p>${c.text}</p></div>`).join('') || 'Комментариев пока нет.';
    }

    document.getElementById('comment-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = document.getElementById('comment-text').value.trim();
      topic.comments.push({ author: user().name, text });
      addActivity(user().email, `Комментарий в теме ${topic.title}`);
      saveState();
      e.target.reset();
      refresh();
    });

    refresh();
  }

  function renderAdmin() {
    if (!requireAdmin()) return;
    const me = user();
    const root = document.getElementById('admin-root');
    root.innerHTML = `
      <h1>Админ-панель</h1>
      <section class="card">
        <h2>Создание новости/статьи</h2>
        <form id="admin-news" class="form-grid">
          <label>Заголовок<input id="an-title" required /></label>
          <label>Кратко<textarea id="an-short" rows="2" required></textarea></label>
          <label>Полный текст<textarea id="an-full" rows="4" required></textarea></label>
          <label>Раздел
            <select id="an-section"><option value="orbit">orbit</option><option value="luna">luna</option><option value="mars">mars</option></select>
          </label>
          <button class="btn btn-solid" type="submit">Сохранить</button>
        </form>
      </section>
      <section class="card">
        <h2>Материалы разделов</h2>
        <form id="admin-material" class="form-grid">
          <label>Раздел<select id="am-section"><option value="orbit">orbit</option><option value="luna">luna</option><option value="mars">mars</option></select></label>
          <label>Блок<select id="am-type"><option value="history">history</option><option value="modern">modern</option><option value="success">success</option></select></label>
          <label>Текст<textarea id="am-text" rows="3" required></textarea></label>
          <button class="btn btn-solid" type="submit">Обновить блок</button>
        </form>
      </section>
      <section class="card">
        <h2>Резюме и статусы</h2>
        <div id="resume-admin"></div>
      </section>
      <section class="card" id="superadmin-zone"></section>
    `;

    document.getElementById('admin-news').addEventListener('submit', (e) => {
      e.preventDefault();
      const item = {
        id: `n-${Date.now()}`,
        title: document.getElementById('an-title').value.trim(),
        short: document.getElementById('an-short').value.trim(),
        full: document.getElementById('an-full').value.trim(),
        section: document.getElementById('an-section').value
      };
      state.news.unshift(item);
      addActivity(me.email, `Создана новость ${item.title}`);
      saveState();
      e.target.reset();
      alert('Новость сохранена');
    });

    document.getElementById('admin-material').addEventListener('submit', (e) => {
      e.preventDefault();
      const section = document.getElementById('am-section').value;
      const type = document.getElementById('am-type').value;
      const text = document.getElementById('am-text').value.trim();
      COSMO_DATA.sections[section][type].text = text;
      addActivity(me.email, `Обновлен материал ${section}/${type}`);
      saveState();
      alert('Материал обновлен');
    });

    const resumeUsers = state.users.filter((u) => state.userData[u.email]?.resume);
    const resumeBox = document.getElementById('resume-admin');
    resumeBox.innerHTML = resumeUsers
      .map((u) => {
        const ud = state.userData[u.email];
        return `
          <div class="list-item">
            <strong>${u.name} (${u.email})</strong><br>
            <span class="muted">Резюме: ${ud.resume.name}</span>
            <label>Статус
              <select data-email="${u.email}" class="status-select">
                ${COSMO_DATA.careerStages.map((s) => `<option ${s === ud.trackStatus ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </label>
          </div>`;
      })
      .join('') || 'Загруженных резюме пока нет.';

    document.querySelectorAll('.status-select').forEach((sel) => {
      sel.addEventListener('change', () => {
        const email = sel.dataset.email;
        state.userData[email].trackStatus = sel.value;
        addActivity(me.email, `Изменен статус резюме пользователя ${email}`);
        saveState();
      });
    });

    const superZone = document.getElementById('superadmin-zone');
    if (me.role !== 'superadmin') {
      superZone.innerHTML = '<h2>Управление ролями</h2><p class="muted">Доступно только основному администратору.</p>';
      return;
    }

    superZone.innerHTML = `
      <h2>Управление ролями (основной админ)</h2>
      <form id="create-admin" class="form-grid">
        <label>Имя<input id="ca-name" required /></label>
        <label>Email<input id="ca-email" type="email" required /></label>
        <label>Пароль<input id="ca-password" required /></label>
        <button class="btn btn-solid" type="submit">Создать администратора</button>
      </form>
      <div id="roles-table"></div>
    `;

    function renderRoles() {
      document.getElementById('roles-table').innerHTML = state.users
        .map(
          (u) => `<div class="list-item">${u.email} — 
            <select data-role-email="${u.email}" class="role-select">
              <option value="user" ${u.role === 'user' ? 'selected' : ''}>user</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>admin</option>
              <option value="superadmin" ${u.role === 'superadmin' ? 'selected' : ''}>superadmin</option>
            </select>
          </div>`
        )
        .join('');

      document.querySelectorAll('.role-select').forEach((sel) => {
        sel.addEventListener('change', () => {
          const target = state.users.find((x) => x.email === sel.dataset.roleEmail);
          if (target) {
            target.role = sel.value;
            saveState();
          }
        });
      });
    }

    document.getElementById('create-admin').addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('ca-email').value.trim();
      if (state.users.some((u) => u.email === email)) return alert('Email уже существует');
      state.users.push({
        name: document.getElementById('ca-name').value.trim(),
        email,
        password: document.getElementById('ca-password').value,
        role: 'admin'
      });
      ensureUserData(email);
      addActivity(me.email, `Создан администратор ${email}`);
      saveState();
      e.target.reset();
      renderRoles();
    });

    renderRoles();
  }

  const page = document.body.dataset.page;
  if (page === 'auth') handleAuthPage();
  if (page === 'section') renderSectionPage();
  if (page === 'article') renderArticlePage();
  if (page === 'profile') renderProfile();
  if (page === 'track') renderTrack();
  if (page === 'forum') renderForum();
  if (page === 'topic') renderTopic();
  if (page === 'admin') renderAdmin();
})();
