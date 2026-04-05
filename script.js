(() => {
  const STORAGE_KEY = 'orbit_mvp_v1';
  const state = loadState();
  let activeSection = 'history';
  let openedArticle = null;

  const views = {
    auth: document.getElementById('auth-view'),
    main: document.getElementById('main-view'),
    forum: document.getElementById('forum-view'),
    profile: document.getElementById('profile-view')
  };

  const ui = {
    showLogin: document.getElementById('show-login'),
    showRegister: document.getElementById('show-register'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    authMessage: document.getElementById('auth-message'),

    welcomeText: document.getElementById('welcome-text'),
    planetNav: document.getElementById('planet-nav'),
    sectionTitle: document.getElementById('section-title'),
    sectionDescription: document.getElementById('section-description'),
    sectionContent: document.getElementById('section-content'),
    headlineNews: document.getElementById('headline-news'),

    jumpNewsBtn: document.getElementById('jump-news-btn'),
    openProfileBtn: document.getElementById('open-profile-btn'),
    openForumBtn: document.getElementById('open-forum-btn'),
    logoutBtn: document.getElementById('logout-btn'),

    profileBackBtn: document.getElementById('profile-back-btn'),
    forumBackBtn: document.getElementById('forum-back-btn'),

    pointsValue: document.getElementById('points-value'),
    progressValue: document.getElementById('progress-value'),
    rewardsValue: document.getElementById('rewards-value'),
    profileSections: document.getElementById('profile-sections'),

    achievementForm: document.getElementById('achievement-form'),
    uploadedAchievements: document.getElementById('uploaded-achievements'),

    actionLog: document.getElementById('action-log'),

    forumForm: document.getElementById('forum-form'),
    forumList: document.getElementById('forum-list')
  };

  function createInitialState() {
    return {
      users: [],
      sessionEmail: null,
      progress: {},
      forum: [...SPACE_DATA.forumSeed]
    };
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    try {
      const parsed = JSON.parse(raw);
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        sessionEmail: parsed.sessionEmail || null,
        progress: parsed.progress || {},
        forum: Array.isArray(parsed.forum) ? parsed.forum : [...SPACE_DATA.forumSeed]
      };
    } catch {
      return createInitialState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function currentUser() {
    return state.users.find((u) => u.email === state.sessionEmail) || null;
  }

  function ensureUserData(email) {
    if (!state.progress[email]) {
      state.progress[email] = {
        visitedSections: [],
        points: 0,
        rewards: [],
        quizPassed: false,
        achievements: [],
        actions: []
      };
    }
  }

  function addAction(email, text) {
    ensureUserData(email);
    state.progress[email].actions.unshift({ text, at: new Date().toISOString() });
    state.progress[email].actions = state.progress[email].actions.slice(0, 40);
  }

  function showView(name) {
    Object.values(views).forEach((v) => v.classList.remove('view-active'));
    views[name].classList.add('view-active');
  }

  function toggleAuth(mode) {
    const isLogin = mode === 'login';
    ui.loginForm.classList.toggle('hidden', !isLogin);
    ui.registerForm.classList.toggle('hidden', isLogin);
    ui.showLogin.classList.toggle('is-active', isLogin);
    ui.showRegister.classList.toggle('is-active', !isLogin);
    ui.authMessage.textContent = '';
  }

  function registerUser(name, email, password) {
    if (state.users.some((u) => u.email === email)) {
      ui.authMessage.textContent = 'Пользователь уже существует.';
      return;
    }
    state.users.push({ name, email, password });
    state.sessionEmail = email;
    ensureUserData(email);
    addAction(email, 'Регистрация в системе');
    saveState();
    renderMain();
  }

  function loginUser(email, password) {
    const user = state.users.find((u) => u.email === email && u.password === password);
    if (!user) {
      ui.authMessage.textContent = 'Неверный email или пароль.';
      return;
    }
    state.sessionEmail = email;
    ensureUserData(email);
    addAction(email, 'Вход в систему');
    saveState();
    renderMain();
  }

  function markSectionVisited(sectionId) {
    const user = currentUser();
    if (!user) return;
    ensureUserData(user.email);
    const data = state.progress[user.email];
    if (!data.visitedSections.includes(sectionId)) {
      data.visitedSections.push(sectionId);
      data.points += 10;
      addAction(user.email, `Открыт раздел: ${sectionId}`);

      const required = ['history', 'modern', 'news', 'success'];
      const allVisited = required.every((id) => data.visitedSections.includes(id));
      if (allVisited && !data.rewards.includes(SPACE_DATA.rewards.explorer.id)) {
        data.rewards.push(SPACE_DATA.rewards.explorer.id);
        data.points += SPACE_DATA.rewards.explorer.points;
        addAction(user.email, 'Получена награда: Исследователь разделов');
      }

      saveState();
    }
  }

  function renderPlanetNav() {
    ui.planetNav.innerHTML = '';
    SPACE_DATA.sections.forEach((section) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `planet ${activeSection === section.id ? 'active' : ''}`;
      btn.textContent = section.title;
      btn.addEventListener('click', () => {
        activeSection = section.id;
        renderSection();
      });
      ui.planetNav.appendChild(btn);
    });
  }

  function renderNewsHighlight() {
    ui.headlineNews.innerHTML = '';
    SPACE_DATA.newsTop.forEach((news) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `<strong>${news.title}</strong><div class="muted">${news.date}</div>`;
      ui.headlineNews.appendChild(card);
    });
  }

  function renderSection() {
    const section = SPACE_DATA.sections.find((s) => s.id === activeSection);
    if (!section) return;

    ui.sectionTitle.textContent = section.title;
    ui.sectionDescription.textContent = section.summary;
    ui.sectionContent.innerHTML = '';
    renderPlanetNav();

    markSectionVisited(section.id);

    if (section.id === 'quiz') {
      renderQuiz(section);
      return;
    }

    if (section.id === 'history' || section.id === 'modern') {
      renderArticleSection(section);
      return;
    }

    section.items.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.textContent = item;
      ui.sectionContent.appendChild(card);
    });
  }

  function renderArticleSection(section) {
    const fullArticleCard = document.createElement('article');
    fullArticleCard.className = 'card article-full hidden';
    ui.sectionContent.appendChild(fullArticleCard);

    section.items.forEach((item, index) => {
      const card = document.createElement('article');
      card.className = 'card article-preview';

      const title = document.createElement('strong');
      title.textContent = item.title;

      const teaser = document.createElement('p');
      teaser.className = 'muted';
      teaser.textContent = item.teaser;

      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'btn';
      openButton.textContent = 'Открыть полную статью';
      openButton.addEventListener('click', () => {
        openedArticle = `${section.id}-${index}`;
        renderArticleSection(section);
      });

      card.appendChild(title);
      card.appendChild(teaser);
      card.appendChild(openButton);
      ui.sectionContent.appendChild(card);
    });

    const selectedIndex = section.items.findIndex((_, index) => openedArticle === `${section.id}-${index}`);
    if (selectedIndex !== -1) {
      const selectedArticle = section.items[selectedIndex];
      fullArticleCard.classList.remove('hidden');
      fullArticleCard.innerHTML = `
        <strong>${selectedArticle.title}</strong>
        <p>${selectedArticle.fullArticle}</p>
      `;
    }
  }

  function renderQuiz(section) {
    const user = currentUser();
    if (!user) return;
    ensureUserData(user.email);
    const userData = state.progress[user.email];

    const wrap = document.createElement('article');
    wrap.className = 'card';
    wrap.innerHTML = `<strong>${section.question}</strong>`;

    const options = document.createElement('div');
    options.className = 'stack';
    section.options.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn';
      button.textContent = option.text;
      button.addEventListener('click', () => {
        if (option.correct) {
          if (!userData.quizPassed) {
            userData.quizPassed = true;
            userData.points += SPACE_DATA.rewards.quiz.points;
            userData.rewards.push(SPACE_DATA.rewards.quiz.id);
            addAction(user.email, 'Тест пройден успешно и выдана награда');
            saveState();
          }
          result.textContent = 'Верно! Баллы и награда начислены.';
        } else {
          addAction(user.email, 'Неудачная попытка в тесте');
          saveState();
          result.textContent = 'Неверно. Попробуйте ещё раз.';
        }
        renderProfile();
      });
      options.appendChild(button);
    });

    const result = document.createElement('p');
    result.className = 'status';
    if (userData.quizPassed) {
      result.textContent = 'Тест уже пройден ранее.';
    }

    wrap.appendChild(options);
    wrap.appendChild(result);
    ui.sectionContent.appendChild(wrap);
  }

  function renderProfile() {
    const user = currentUser();
    if (!user) return;
    ensureUserData(user.email);

    const data = state.progress[user.email];
    const progressBase = 5;
    const done = data.visitedSections.filter((id) => ['history', 'modern', 'news', 'success', 'quiz'].includes(id)).length;
    const progress = Math.round((done / progressBase) * 100);

    ui.pointsValue.textContent = String(data.points);
    ui.rewardsValue.textContent = String(data.rewards.length);
    ui.progressValue.textContent = `${progress}%`;

    ui.profileSections.innerHTML = '';
    SPACE_DATA.profileBlocks.forEach((block) => {
      const visited = data.visitedSections.includes(block.id);
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `<strong>${block.title}</strong><p class="muted">${block.text}</p><div>${visited ? 'Статус: просмотрено' : 'Статус: не открыто'}</div>`;
      ui.profileSections.appendChild(card);
    });

    ui.uploadedAchievements.innerHTML = '';
    data.achievements.forEach((a) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `<strong>${a.title}</strong><div class="muted">Файл: ${a.fileName}</div><div class="muted">${a.date}</div>`;
      ui.uploadedAchievements.appendChild(card);
    });

    ui.actionLog.innerHTML = '';
    data.actions.forEach((entry) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `<div>${entry.text}</div><div class="muted">${entry.at}</div>`;
      ui.actionLog.appendChild(card);
    });
  }

  function renderForum() {
    ui.forumList.innerHTML = '';
    state.forum.forEach((post) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `<strong>${post.topic}</strong><div class="muted">${post.user}</div><p>${post.message}</p>`;
      ui.forumList.appendChild(card);
    });
  }

  function renderMain() {
    const user = currentUser();
    if (!user) {
      showView('auth');
      return;
    }

    ui.welcomeText.textContent = `Маршрут участника: ${user.name}`;
    showView('main');
    renderNewsHighlight();
    renderSection();
    renderProfile();
    renderForum();
  }

  ui.showLogin.addEventListener('click', () => toggleAuth('login'));
  ui.showRegister.addEventListener('click', () => toggleAuth('register'));

  ui.registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim().toLowerCase();
    const password = document.getElementById('register-password').value;
    registerUser(name, email, password);
  });

  ui.loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    loginUser(email, password);
  });

  ui.jumpNewsBtn.addEventListener('click', () => {
    activeSection = 'news';
    renderSection();
  });

  ui.openProfileBtn.addEventListener('click', () => {
    renderProfile();
    showView('profile');
  });

  ui.profileBackBtn.addEventListener('click', () => showView('main'));

  ui.openForumBtn.addEventListener('click', () => {
    renderForum();
    showView('forum');
  });

  ui.forumBackBtn.addEventListener('click', () => showView('main'));

  ui.forumForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const user = currentUser();
    if (!user) return;

    const topic = document.getElementById('forum-topic').value.trim();
    const message = document.getElementById('forum-message').value.trim();
    if (!topic || !message) return;

    state.forum.unshift({ user: user.name, topic, message });
    addAction(user.email, `Создан пост на форуме: ${topic}`);
    saveState();
    ui.forumForm.reset();
    renderForum();
  });

  ui.achievementForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const user = currentUser();
    if (!user) return;

    const title = document.getElementById('achievement-title').value.trim();
    const fileInput = document.getElementById('achievement-file');
    const file = fileInput.files[0];
    if (!title || !file) return;

    ensureUserData(user.email);
    state.progress[user.email].achievements.unshift({
      title,
      fileName: file.name,
      date: new Date().toISOString()
    });
    state.progress[user.email].points += 5;
    addAction(user.email, `Загружено достижение: ${title}`);
    saveState();

    ui.achievementForm.reset();
    renderProfile();
  });

  ui.logoutBtn.addEventListener('click', () => {
    const user = currentUser();
    if (user) addAction(user.email, 'Выход из системы');
    state.sessionEmail = null;
    saveState();
    showView('auth');
  });

  toggleAuth('login');
  if (state.sessionEmail) {
    renderMain();
  }
})();
