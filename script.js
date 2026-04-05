(() => {
  const STORAGE_KEY = 'space_mvp_bw_v1';

  const views = {
    auth: document.getElementById('auth-view'),
    home: document.getElementById('home-view'),
    section: document.getElementById('section-view'),
    forum: document.getElementById('forum-view'),
    cabinet: document.getElementById('cabinet-view')
  };

  const ui = {
    tabLogin: document.getElementById('tab-login'),
    tabRegister: document.getElementById('tab-register'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    authMessage: document.getElementById('auth-message'),
    planetNav: document.getElementById('planet-nav'),
    topNews: document.getElementById('top-news'),
    goNews: document.getElementById('go-news'),
    logoutBtn: document.getElementById('logout-btn'),
    sectionTitle: document.getElementById('section-title'),
    sectionDescription: document.getElementById('section-description'),
    sectionContent: document.getElementById('section-content'),
    forumForm: document.getElementById('forum-form'),
    forumList: document.getElementById('forum-list'),
    cabinetLogout: document.getElementById('cabinet-logout'),
    welcomeLine: document.getElementById('welcome-line'),
    statPoints: document.getElementById('stat-points'),
    statProgress: document.getElementById('stat-progress'),
    statAwards: document.getElementById('stat-awards'),
    cabinetTabs: document.getElementById('cabinet-tabs'),
    cabinetContent: document.getElementById('cabinet-content')
  };

  const state = loadState();
  let activeSectionId = 'history';
  let activeCabinetTab = 'history';

  function createDefaultState() {
    return {
      users: [],
      session: null,
      forumPosts: [
        { id: crypto.randomUUID(), author: 'Модератор', title: 'Добро пожаловать', message: 'Расскажите, какой раздел вы изучаете сейчас.', createdAt: new Date().toISOString() }
      ]
    };
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    try {
      const parsed = JSON.parse(raw);
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        session: parsed.session || null,
        forumPosts: Array.isArray(parsed.forumPosts) ? parsed.forumPosts : []
      };
    } catch {
      return createDefaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function ensureUserProgress(user) {
    if (!user.progress) {
      user.progress = {
        points: 0,
        completedSections: [],
        completedQuiz: false,
        quizScore: 0,
        awards: [],
        uploadedAchievements: [],
        actionLog: []
      };
    }
  }

  function nowLocalString() {
    return new Date().toLocaleString('ru-RU');
  }

  function pushAction(user, action) {
    ensureUserProgress(user);
    user.progress.actionLog.unshift(`${nowLocalString()} — ${action}`);
    user.progress.actionLog = user.progress.actionLog.slice(0, 25);
  }

  function findUserByEmail(email) {
    return state.users.find((user) => user.email === email) || null;
  }

  function currentUser() {
    if (!state.session) return null;
    return findUserByEmail(state.session);
  }

  function switchView(target) {
    Object.values(views).forEach((view) => view.classList.remove('view-active'));
    views[target].classList.add('view-active');
  }

  function switchAuth(mode) {
    const isLogin = mode === 'login';
    ui.loginForm.classList.toggle('hidden', !isLogin);
    ui.registerForm.classList.toggle('hidden', isLogin);
    ui.tabLogin.classList.toggle('is-active', isLogin);
    ui.tabRegister.classList.toggle('is-active', !isLogin);
    ui.authMessage.textContent = '';
  }

  function guardedNavigate(target) {
    const user = currentUser();
    if (!user && target !== 'auth') {
      switchView('auth');
      return;
    }

    if (target === 'home') {
      renderHome();
      switchView('home');
      return;
    }
    if (target === 'forum') {
      renderForum();
      switchView('forum');
      return;
    }
    if (target === 'cabinet') {
      renderCabinet();
      switchView('cabinet');
      return;
    }
    switchView(target);
  }

  function getProgressPercent(user) {
    const total = SPACE_DATA.sections.length + 1;
    const sectionDone = user.progress.completedSections.length;
    const quizDone = user.progress.completedQuiz ? 1 : 0;
    return Math.round(((sectionDone + quizDone) / total) * 100);
  }

  function grantAward(user, awardId) {
    if (user.progress.awards.includes(awardId)) return;
    const award = SPACE_DATA.awards.find((item) => item.id === awardId);
    if (!award) return;
    user.progress.awards.push(awardId);
    user.progress.points += award.points;
    pushAction(user, `Получена награда: ${award.title} (+${award.points} баллов)`);
  }

  function renderTopNews() {
    ui.topNews.innerHTML = '';
    SPACE_DATA.news.slice(0, 3).forEach((item) => {
      const node = document.createElement('article');
      node.className = 'news-item';
      node.innerHTML = `<strong>${item.title}</strong><div class="muted">${item.date}</div>`;
      ui.topNews.appendChild(node);
    });
  }

  function renderPlanetNav() {
    ui.planetNav.innerHTML = '';
    SPACE_DATA.sections.forEach((section) => {
      const button = document.createElement('button');
      button.className = 'planet-btn';
      button.textContent = section.title;
      button.addEventListener('click', () => openSection(section.id));
      ui.planetNav.appendChild(button);
    });
  }

  function renderHome() {
    renderPlanetNav();
    renderTopNews();
  }

  function sectionById(id) {
    return SPACE_DATA.sections.find((item) => item.id === id);
  }

  function openSection(sectionId) {
    activeSectionId = sectionId;
    renderSection(sectionId);
    switchView('section');
  }

  function markSectionDone(sectionId) {
    const user = currentUser();
    if (!user) return;
    if (!user.progress.completedSections.includes(sectionId)) {
      user.progress.completedSections.push(sectionId);
      user.progress.points += 20;
      pushAction(user, `Раздел "${sectionById(sectionId).title}" изучен (+20 баллов)`);
      saveState();
    }
  }

  function renderSection(sectionId) {
    const user = currentUser();
    if (!user) return;

    const section = sectionById(sectionId);
    ui.sectionTitle.textContent = section.title;
    ui.sectionDescription.textContent = section.description;
    ui.sectionContent.innerHTML = '';

    if (section.id === 'news') {
      SPACE_DATA.news.forEach((item) => {
        const block = document.createElement('article');
        block.className = 'content-block';
        block.innerHTML = `<strong>${item.title}</strong><p class="muted">Дата: ${item.date}</p>`;
        ui.sectionContent.appendChild(block);
      });
      markSectionDone('news');
      return;
    }

    if (section.id === 'test') {
      renderQuiz();
      return;
    }

    section.blocks.forEach((text) => {
      const block = document.createElement('article');
      block.className = 'content-block';
      block.textContent = text;
      ui.sectionContent.appendChild(block);
    });

    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn btn-solid';
    doneBtn.textContent = 'Отметить изучение раздела';
    doneBtn.addEventListener('click', () => {
      markSectionDone(section.id);
      doneBtn.disabled = true;
      doneBtn.textContent = 'Раздел засчитан';
    });
    ui.sectionContent.appendChild(doneBtn);
  }

  function renderQuiz() {
    const user = currentUser();
    if (!user) return;

    const holder = document.createElement('div');
    holder.className = 'content-block';

    const title = document.createElement('p');
    title.textContent = 'Выберите правильные ответы. Баллы за тест начисляются один раз.';
    holder.appendChild(title);

    let score = 0;

    SPACE_DATA.quiz.forEach((q, idx) => {
      const qWrap = document.createElement('div');
      qWrap.className = 'content-block';
      qWrap.innerHTML = `<strong>${idx + 1}. ${q.question}</strong>`;

      q.options.forEach((opt) => {
        const b = document.createElement('button');
        b.className = 'btn quiz-option';
        b.textContent = opt;
        b.addEventListener('click', () => {
          if (b.dataset.answered) return;
          b.dataset.answered = '1';
          if (opt === q.answer) {
            score += 1;
            b.textContent = `${opt} ✓`;
          } else {
            b.textContent = `${opt} ✕`;
          }
        });
        qWrap.appendChild(b);
      });

      holder.appendChild(qWrap);
    });

    const submit = document.createElement('button');
    submit.className = 'btn btn-solid';
    submit.textContent = 'Завершить тест';

    const result = document.createElement('p');
    result.className = 'feedback';

    submit.addEventListener('click', () => {
      if (!user.progress.completedQuiz) {
        user.progress.completedQuiz = true;
        user.progress.quizScore = score;
        user.progress.points += score * 15;
        pushAction(user, `Тест завершён: ${score}/${SPACE_DATA.quiz.length} (+${score * 15} баллов)`);
        grantAward(user, 'award-test');
      }

      const fullRouteDone = SPACE_DATA.sections
        .filter((s) => s.id !== 'test')
        .every((s) => user.progress.completedSections.includes(s.id));

      if (fullRouteDone && user.progress.completedQuiz) {
        grantAward(user, 'award-route');
      }

      markSectionDone('test');
      saveState();
      result.textContent = `Результат: ${score}/${SPACE_DATA.quiz.length}. Проверьте награды в личном кабинете.`;
    });

    holder.appendChild(submit);
    holder.appendChild(result);
    ui.sectionContent.appendChild(holder);
  }

  function renderForum() {
    ui.forumList.innerHTML = '';

    state.forumPosts
      .slice()
      .reverse()
      .forEach((post) => {
        const node = document.createElement('article');
        node.className = 'forum-post';
        node.innerHTML = `
          <strong>${post.title}</strong>
          <p>${post.message}</p>
          <div class="muted">${post.author} • ${new Date(post.createdAt).toLocaleString('ru-RU')}</div>
        `;
        ui.forumList.appendChild(node);
      });
  }

  function renderCabinetTabs() {
    ui.cabinetTabs.innerHTML = '';

    SPACE_DATA.cabinetSections.forEach((tab) => {
      const btn = document.createElement('button');
      btn.className = `btn ${activeCabinetTab === tab.id ? 'btn-solid' : ''}`;
      btn.textContent = tab.title;
      btn.addEventListener('click', () => {
        activeCabinetTab = tab.id;
        renderCabinetContent();
      });
      ui.cabinetTabs.appendChild(btn);
    });

    const logsBtn = document.createElement('button');
    logsBtn.className = `btn ${activeCabinetTab === 'log' ? 'btn-solid' : ''}`;
    logsBtn.textContent = 'История действий';
    logsBtn.addEventListener('click', () => {
      activeCabinetTab = 'log';
      renderCabinetContent();
    });
    ui.cabinetTabs.appendChild(logsBtn);
  }

  function renderCabinetContent() {
    const user = currentUser();
    if (!user) return;

    ui.cabinetContent.innerHTML = '';

    if (activeCabinetTab === 'log') {
      const block = document.createElement('article');
      block.className = 'content-block';
      block.innerHTML = '<h3>Базовая история действий пользователя</h3>';
      const list = document.createElement('ul');
      list.className = 'log-list';

      if (user.progress.actionLog.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Пока нет действий.';
        list.appendChild(li);
      } else {
        user.progress.actionLog.forEach((entry) => {
          const li = document.createElement('li');
          li.textContent = entry;
          list.appendChild(li);
        });
      }

      block.appendChild(list);
      ui.cabinetContent.appendChild(block);
      return;
    }

    const tab = SPACE_DATA.cabinetSections.find((item) => item.id === activeCabinetTab);
    if (!tab) return;

    const done = user.progress.completedSections.includes(tab.id);
    const block = document.createElement('article');
    block.className = 'content-block';
    block.innerHTML = `
      <h3>${tab.title}</h3>
      <p>${tab.task}</p>
      <p class="muted">Статус: ${done ? 'выполнено' : 'не выполнено'}</p>
    `;

    const markBtn = document.createElement('button');
    markBtn.className = 'btn';
    markBtn.textContent = done ? 'Уже засчитано' : 'Засчитать выполнение (+20)';
    markBtn.disabled = done;
    markBtn.addEventListener('click', () => {
      markSectionDone(tab.id);
      saveState();
      renderCabinet();
    });
    block.appendChild(markBtn);

    if (tab.id === 'achievements') {
      const uploadWrap = document.createElement('div');
      uploadWrap.className = 'content-block';
      uploadWrap.innerHTML = '<h3>Загрузка достижений</h3><p class="muted">Имитация загрузки: добавьте название файла.</p>';

      const form = document.createElement('form');
      form.className = 'stack';
      form.innerHTML = `
        <input type="text" name="achievement" required placeholder="certificate.pdf" />
        <button class="btn btn-solid" type="submit">Загрузить</button>
      `;

      const uploaded = document.createElement('ul');
      uploaded.className = 'log-list';
      user.progress.uploadedAchievements.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        uploaded.appendChild(li);
      });

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const field = form.elements.achievement;
        const filename = String(field.value).trim();
        if (!filename) return;
        user.progress.uploadedAchievements.push(filename);
        user.progress.points += 10;
        pushAction(user, `Загружено достижение: ${filename} (+10 баллов)`);
        saveState();
        renderCabinet();
      });

      uploadWrap.appendChild(form);
      uploadWrap.appendChild(uploaded);
      ui.cabinetContent.appendChild(uploadWrap);
    }

    const awardsBlock = document.createElement('article');
    awardsBlock.className = 'content-block';
    awardsBlock.innerHTML = '<h3>Награды</h3>';
    const awardsList = document.createElement('ul');
    awardsList.className = 'log-list';

    if (user.progress.awards.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Пока нет наград.';
      awardsList.appendChild(li);
    } else {
      user.progress.awards.forEach((awardId) => {
        const award = SPACE_DATA.awards.find((item) => item.id === awardId);
        if (!award) return;
        const li = document.createElement('li');
        li.textContent = `${award.title} (+${award.points})`;
        awardsList.appendChild(li);
      });
    }

    awardsBlock.appendChild(awardsList);
    ui.cabinetContent.appendChild(block);
    ui.cabinetContent.appendChild(awardsBlock);
  }

  function renderCabinet() {
    const user = currentUser();
    if (!user) return;

    ensureUserProgress(user);
    ui.welcomeLine.textContent = `${user.name}, ваш путь: открыть разделы → изучить материалы → пройти тест → получить баллы и награды.`;
    ui.statPoints.textContent = user.progress.points;
    ui.statProgress.textContent = `${getProgressPercent(user)}%`;
    ui.statAwards.textContent = user.progress.awards.length;

    renderCabinetTabs();
    renderCabinetContent();
    saveState();
  }

  function register(name, email, password) {
    if (findUserByEmail(email)) {
      ui.authMessage.textContent = 'Пользователь с таким email уже существует.';
      return;
    }

    const user = {
      id: crypto.randomUUID(),
      name,
      email,
      password,
      progress: {
        points: 0,
        completedSections: [],
        completedQuiz: false,
        quizScore: 0,
        awards: [],
        uploadedAchievements: [],
        actionLog: []
      }
    };

    pushAction(user, 'Регистрация завершена');

    state.users.push(user);
    state.session = email;
    saveState();

    guardedNavigate('home');
  }

  function login(email, password) {
    const user = findUserByEmail(email);
    if (!user || user.password !== password) {
      ui.authMessage.textContent = 'Неверный email или пароль.';
      return;
    }

    ensureUserProgress(user);
    state.session = email;
    pushAction(user, 'Вход выполнен');
    saveState();
    guardedNavigate('home');
  }

  function logout() {
    const user = currentUser();
    if (user) {
      pushAction(user, 'Выход из аккаунта');
    }
    state.session = null;
    saveState();
    switchView('auth');
  }

  function bindGlobalNav() {
    document.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        guardedNavigate(btn.dataset.nav);
      });
    });
  }

  ui.tabLogin.addEventListener('click', () => switchAuth('login'));
  ui.tabRegister.addEventListener('click', () => switchAuth('register'));

  ui.registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim().toLowerCase();
    const password = document.getElementById('register-password').value;
    register(name, email, password);
  });

  ui.loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    login(email, password);
  });

  ui.goNews.addEventListener('click', () => openSection('news'));
  ui.logoutBtn.addEventListener('click', logout);
  ui.cabinetLogout.addEventListener('click', logout);

  ui.forumForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const user = currentUser();
    if (!user) return;

    const titleEl = document.getElementById('forum-title');
    const msgEl = document.getElementById('forum-message');

    const post = {
      id: crypto.randomUUID(),
      author: user.name,
      title: titleEl.value.trim(),
      message: msgEl.value.trim(),
      createdAt: new Date().toISOString()
    };

    if (!post.title || !post.message) return;

    state.forumPosts.push(post);
    pushAction(user, `Опубликована тема на форуме: "${post.title}"`);
    titleEl.value = '';
    msgEl.value = '';
    saveState();
    renderForum();
  });

  bindGlobalNav();

  if (state.session && currentUser()) {
    guardedNavigate('home');
  } else {
    switchView('auth');
    switchAuth('login');
  }
})();
