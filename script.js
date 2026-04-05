(() => {
  const STORAGE_KEY = 'orbit_edu_mvp_v2';
  const DEFAULT_ROUTE = '/';
  const state = loadState();

  let activeSectionSlug = 'history';
  let activeProfilePath = '/profile/history';

  const views = {
    auth: document.getElementById('auth-view'),
    main: document.getElementById('main-view'),
    quiz: document.getElementById('quiz-view'),
    forum: document.getElementById('forum-view'),
    profile: document.getElementById('profile-view')
  };

  const ui = {
    routeLabel: document.getElementById('route-label'),

    showLogin: document.getElementById('show-login'),
    showRegister: document.getElementById('show-register'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    authMessage: document.getElementById('auth-message'),

    welcomeText: document.getElementById('welcome-text'),
    planetNav: document.getElementById('planet-nav'),
    sectionTitle: document.getElementById('section-title'),
    sectionDescription: document.getElementById('section-description'),
    sectionProgress: document.getElementById('section-progress'),
    sectionContent: document.getElementById('section-content'),

    forumPreviewList: document.getElementById('forum-preview-list'),

    quizTitle: document.getElementById('quiz-title'),
    quizDescription: document.getElementById('quiz-description'),
    quizForm: document.getElementById('quiz-form'),
    quizResult: document.getElementById('quiz-result'),

    forumForm: document.getElementById('forum-form'),
    forumList: document.getElementById('forum-list'),

    pointsValue: document.getElementById('points-value'),
    planetsValue: document.getElementById('planets-value'),
    rewardsValue: document.getElementById('rewards-value'),
    profileSubnav: document.getElementById('profile-subnav'),
    profileSubtitle: document.getElementById('profile-subtitle'),
    profileSubcontent: document.getElementById('profile-subcontent'),
    achievementForm: document.getElementById('achievement-form'),
    uploadedAchievements: document.getElementById('uploaded-achievements'),

    gotoProfile: document.getElementById('goto-profile'),
    gotoForum: document.getElementById('goto-forum'),
    profileBack: document.getElementById('profile-back'),
    forumBack: document.getElementById('forum-back'),
    quizBack: document.getElementById('quiz-back'),
    logoutBtn: document.getElementById('logout-btn')
  };

  function createInitialState() {
    return {
      users: [], // User[]
      sessionEmail: null,
      forumTopics: [...SPACE_DATA.forumSeed], // ForumTopic[]
      activityEvents: [], // ActivityEvent[]
      userProgress: {} // map email -> UserProgress
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
        forumTopics: Array.isArray(parsed.forumTopics) ? parsed.forumTopics : [...SPACE_DATA.forumSeed],
        activityEvents: Array.isArray(parsed.activityEvents) ? parsed.activityEvents : [],
        userProgress: parsed.userProgress || {}
      };
    } catch {
      return createInitialState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function getCurrentUser() {
    return state.users.find((user) => user.email === state.sessionEmail) || null;
  }

  function ensureUserProgress(email) {
    if (!state.userProgress[email]) {
      state.userProgress[email] = {
        userEmail: email,
        studiedSections: [],
        studiedMaterials: [],
        readNewsIds: [],
        quizAttempts: [], // QuizAttempt[]
        points: 0,
        rewardIds: [],
        achievements: []
      };
    }
  }

  function addActivityEvent(type, text) {
    const user = getCurrentUser();
    if (!user) return;

    state.activityEvents.unshift({
      id: `ev-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      userEmail: user.email,
      type,
      text,
      createdAt: nowIso()
    });

    state.activityEvents = state.activityEvents.slice(0, 120);
  }

  function setRoute(path) {
    window.location.hash = path;
  }

  function getRoute() {
    const route = window.location.hash.replace(/^#/, '').trim();
    return route || DEFAULT_ROUTE;
  }

  function isProtectedRoute(path) {
    return !path.startsWith('/auth/');
  }

  function showOnly(viewName) {
    Object.values(views).forEach((view) => {
      view.classList.remove('view-active');
    });
    views[viewName].classList.add('view-active');
  }

  function toggleAuth(mode) {
    const isLogin = mode === 'login';
    ui.loginForm.classList.toggle('hidden', !isLogin);
    ui.registerForm.classList.toggle('hidden', isLogin);
    ui.showLogin.classList.toggle('is-active', isLogin);
    ui.showRegister.classList.toggle('is-active', !isLogin);
    ui.authMessage.textContent = '';
  }

  function formatDate(isoDate) {
    return new Date(isoDate).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function grantPoints(amount, reason) {
    const user = getCurrentUser();
    if (!user) return;
    ensureUserProgress(user.email);
    state.userProgress[user.email].points += amount;
    addActivityEvent('points', `${reason} (+${amount})`);
  }

  function grantReward(rewardId) {
    const user = getCurrentUser();
    if (!user) return;
    ensureUserProgress(user.email);

    const progress = state.userProgress[user.email];
    if (progress.rewardIds.includes(rewardId)) return;

    const reward = SPACE_DATA.rewards.find((item) => item.id === rewardId);
    if (!reward) return;

    progress.rewardIds.push(rewardId);
    grantPoints(reward.points, `Награда: ${reward.title}`);
  }

  function markSectionOpened(sectionSlug) {
    const user = getCurrentUser();
    if (!user) return;
    ensureUserProgress(user.email);

    const progress = state.userProgress[user.email];
    if (!progress.studiedSections.includes(sectionSlug)) {
      progress.studiedSections.push(sectionSlug);
      grantPoints(10, `Открыт раздел ${sectionSlug}`);
      addActivityEvent('section', `Планета ${sectionSlug} открыта`);
    }

    const required = ['history', 'modern', 'news', 'success'];
    const fullOpened = required.every((slug) => progress.studiedSections.includes(slug));
    if (fullOpened) {
      grantReward('reward-explorer');
    }
  }

  function markMaterialRead(materialId, sectionSlug) {
    const user = getCurrentUser();
    if (!user) return;
    ensureUserProgress(user.email);
    const progress = state.userProgress[user.email];

    if (progress.studiedMaterials.includes(materialId)) return;
    progress.studiedMaterials.push(materialId);
    grantPoints(5, `Изучен материал ${sectionSlug}`);
    addActivityEvent('material', `Изучен блок ${materialId}`);
  }

  function markNewsRead(newsId) {
    const user = getCurrentUser();
    if (!user) return;
    ensureUserProgress(user.email);
    const progress = state.userProgress[user.email];

    if (progress.readNewsIds.includes(newsId)) return;
    progress.readNewsIds.push(newsId);
    grantPoints(3, 'Прочитана новость');
  }

  function registerUser(name, email, password) {
    if (state.users.some((user) => user.email === email)) {
      ui.authMessage.textContent = 'Пользователь уже существует.';
      return;
    }

    // User
    state.users.push({
      id: `u-${Date.now()}`,
      name,
      email,
      password,
      createdAt: nowIso()
    });

    state.sessionEmail = email;
    ensureUserProgress(email);
    addActivityEvent('auth', 'Регистрация');
    saveState();
    setRoute('/');
  }

  function loginUser(email, password) {
    const user = state.users.find((item) => item.email === email && item.password === password);
    if (!user) {
      ui.authMessage.textContent = 'Неверный email или пароль.';
      return;
    }

    state.sessionEmail = email;
    ensureUserProgress(email);
    addActivityEvent('auth', 'Вход в систему');
    saveState();
    setRoute('/');
  }

  function logoutUser() {
    addActivityEvent('auth', 'Выход из системы');
    state.sessionEmail = null;
    saveState();
    setRoute('/auth/login');
  }

  function sectionBySlug(slug) {
    return SPACE_DATA.sections.find((section) => section.slug === slug);
  }

  function quizBySectionSlug(slug) {
    return SPACE_DATA.quizzes.find((quiz) => quiz.sectionSlug === slug);
  }

  function planetLightLevel(sectionSlug) {
    const user = getCurrentUser();
    if (!user) return 20;
    ensureUserProgress(user.email);
    const progress = state.userProgress[user.email];

    if (!progress.studiedSections.includes(sectionSlug)) return 20;

    if (sectionSlug === 'history' || sectionSlug === 'modern') {
      const section = sectionBySlug(sectionSlug);
      const total = section.materialBlocks.length;
      const studiedCount = section.materialBlocks.filter((block) => progress.studiedMaterials.includes(block.id)).length;
      return Math.max(35, Math.min(95, Math.round((studiedCount / total) * 95)));
    }

    if (sectionSlug === 'news') {
      const section = sectionBySlug('news');
      const total = section.monthlyNews.length;
      const readCount = section.monthlyNews.filter((news) => progress.readNewsIds.includes(news.id)).length;
      return Math.max(35, Math.min(95, Math.round((readCount / total) * 95)));
    }

    return 80;
  }

  function renderPlanetNav() {
    ui.planetNav.innerHTML = '';

    SPACE_DATA.sections.forEach((section) => {
      const lightness = planetLightLevel(section.slug);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = `planet ${activeSectionSlug === section.slug ? 'active' : ''}`;
      button.style.setProperty('--planet-light', `${lightness}%`);
      button.innerHTML = `<span>${section.title}</span>`;
      button.addEventListener('click', () => {
        activeSectionSlug = section.slug;
        setRoute(`/sections/${section.slug}`);
      });

      ui.planetNav.appendChild(button);
    });
  }

  function renderMainSection() {
    const section = sectionBySlug(activeSectionSlug);
    if (!section) return;

    markSectionOpened(section.slug);

    ui.sectionTitle.textContent = section.title;
    ui.sectionDescription.textContent = section.summary;

    const user = getCurrentUser();
    ensureUserProgress(user.email);
    const progress = state.userProgress[user.email];
    const studiedPlanets = progress.studiedSections.length;
    ui.sectionProgress.textContent = `Изучено планет: ${studiedPlanets}/4`;

    ui.sectionContent.innerHTML = '';

    if (section.slug === 'history' || section.slug === 'modern') {
      section.materialBlocks.forEach((block) => {
        const card = document.createElement('article');
        card.className = 'card';

        const studied = progress.studiedMaterials.includes(block.id);

        card.innerHTML = `
          <strong>${block.title}</strong>
          <p>${block.text}</p>
          <div class="card-actions">
            <button type="button" class="btn">${studied ? 'Изучено' : 'Отметить как изученное'}</button>
          </div>
        `;

        card.querySelector('button').addEventListener('click', () => {
          markMaterialRead(block.id, section.slug);
          saveState();
          renderRoute();
        });

        ui.sectionContent.appendChild(card);
      });

      const quizBtn = document.createElement('button');
      quizBtn.type = 'button';
      quizBtn.className = 'btn btn-solid';
      quizBtn.textContent = 'Пройти тест по разделу';
      quizBtn.addEventListener('click', () => {
        setRoute(`/sections/${section.slug}/quiz`);
      });
      ui.sectionContent.appendChild(quizBtn);
    }

    if (section.slug === 'news') {
      section.monthlyNews.forEach((news) => {
        const card = document.createElement('article');
        card.className = 'card';

        const wasRead = progress.readNewsIds.includes(news.id);

        card.innerHTML = `
          <strong>${news.title}</strong>
          <div class="muted">${news.date}</div>
          <p>${news.text}</p>
          <button class="btn" type="button">${wasRead ? 'Прочитано' : 'Отметить прочтение'}</button>
        `;

        card.querySelector('button').addEventListener('click', () => {
          markNewsRead(news.id);
          saveState();
          renderRoute();
        });

        ui.sectionContent.appendChild(card);
      });
    }

    if (section.slug === 'success') {
      section.stories.forEach((story) => {
        const card = document.createElement('article');
        card.className = 'card';
        card.innerHTML = `<strong>${story.name}</strong><p>${story.story}</p>`;
        ui.sectionContent.appendChild(card);
      });
    }

    renderPlanetNav();
    renderForumPreview();
    renderProfileMetrics();
  }

  function renderQuizSection(slug) {
    const quiz = quizBySectionSlug(slug);
    if (!quiz) {
      setRoute(`/sections/${slug}`);
      return;
    }

    const section = sectionBySlug(slug);
    ui.quizTitle.textContent = quiz.title;
    ui.quizDescription.textContent = `${section.title}: ответьте на вопросы и получите награду.`;
    ui.quizResult.textContent = '';
    ui.quizForm.innerHTML = '';

    quiz.questions.forEach((question) => {
      const wrap = document.createElement('fieldset');
      wrap.className = 'card';
      wrap.innerHTML = `<legend><strong>${question.text}</strong></legend>`;

      question.options.forEach((option) => {
        const id = `${question.id}-${option.id}`;
        const label = document.createElement('label');
        label.className = 'option';
        label.innerHTML = `<input type="radio" name="${question.id}" value="${option.id}" id="${id}" /> ${option.text}`;
        wrap.appendChild(label);
      });

      ui.quizForm.appendChild(wrap);
    });

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn-solid';
    submit.textContent = 'Проверить ответы';
    ui.quizForm.appendChild(submit);

    ui.quizForm.onsubmit = (event) => {
      event.preventDefault();
      const user = getCurrentUser();
      if (!user) return;
      ensureUserProgress(user.email);

      let score = 0;
      quiz.questions.forEach((question) => {
        const answer = ui.quizForm.querySelector(`input[name="${question.id}"]:checked`);
        const selected = answer?.value;
        const correct = question.options.find((option) => option.isCorrect);
        if (selected && correct && selected === correct.id) {
          score += 1;
        }
      });

      const attempt = {
        id: `qa-${Date.now()}`,
        quizId: quiz.id,
        score,
        maxScore: quiz.questions.length,
        passed: score >= quiz.passScore,
        createdAt: nowIso()
      };

      state.userProgress[user.email].quizAttempts.unshift(attempt);
      grantPoints(10, `Попытка теста ${section.title}`);

      if (attempt.passed) {
        grantReward(quiz.rewardId);
        ui.quizResult.textContent = `Тест пройден (${score}/${quiz.questions.length}). Награда начислена.`;
        addActivityEvent('quiz', `${quiz.title} успешно завершен`);
      } else {
        ui.quizResult.textContent = `Недостаточно баллов (${score}/${quiz.questions.length}). Попробуйте ещё раз.`;
        addActivityEvent('quiz', `${quiz.title} не пройден`);
      }

      saveState();
      renderProfileMetrics();
    };
  }

  function renderForumPreview() {
    ui.forumPreviewList.innerHTML = '';

    state.forumTopics.slice(0, 2).forEach((topic) => {
      const item = document.createElement('article');
      item.className = 'card';
      item.innerHTML = `
        <strong>${topic.topic}</strong>
        <div class="muted">${topic.userName} · ${formatDate(topic.createdAt)}</div>
        <p>${topic.message}</p>
        <button class="btn" type="button">Открыть тему</button>
      `;
      item.querySelector('button').addEventListener('click', () => {
        setRoute(`/forum/${topic.id}`);
      });
      ui.forumPreviewList.appendChild(item);
    });
  }

  function renderForum(route) {
    ui.forumList.innerHTML = '';

    const topicMatch = route.match(/^\/forum\/([\w-]+)$/);
    const focusedId = topicMatch ? topicMatch[1] : null;

    const list = focusedId ? state.forumTopics.filter((topic) => topic.id === focusedId) : state.forumTopics;

    list.forEach((topic) => {
      const article = document.createElement('article');
      article.className = 'card';

      const comments = topic.comments
        .map(
          (comment) =>
            `<div class="comment"><strong>${comment.userName}</strong>: ${comment.text}<div class="muted">${formatDate(comment.createdAt)}</div></div>`
        )
        .join('');

      article.innerHTML = `
        <strong>${topic.topic}</strong>
        <div class="muted">${topic.userName} · ${formatDate(topic.createdAt)}</div>
        <p>${topic.message}</p>
        <div class="stack">${comments || '<p class="muted">Комментариев пока нет.</p>'}</div>
      `;

      ui.forumList.appendChild(article);
    });
  }

  function renderProfileMetrics() {
    const user = getCurrentUser();
    if (!user) return;

    ensureUserProgress(user.email);
    const progress = state.userProgress[user.email];

    ui.pointsValue.textContent = String(progress.points);
    ui.planetsValue.textContent = String(progress.studiedSections.length);
    ui.rewardsValue.textContent = String(progress.rewardIds.length);
  }

  function renderProfileSubnav() {
    ui.profileSubnav.innerHTML = '';

    SPACE_DATA.profileRoutes.forEach((route) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `btn ${activeProfilePath === route.path ? 'btn-solid' : ''}`;
      button.textContent = route.title;
      button.addEventListener('click', () => {
        activeProfilePath = route.path;
        setRoute(route.path);
      });
      ui.profileSubnav.appendChild(button);
    });
  }

  function renderProfileSection(path) {
    const user = getCurrentUser();
    if (!user) return;
    ensureUserProgress(user.email);
    const progress = state.userProgress[user.email];

    const found = SPACE_DATA.profileRoutes.find((route) => route.path === path) || SPACE_DATA.profileRoutes[0];
    activeProfilePath = found.path;

    ui.profileSubtitle.textContent = found.title;
    ui.profileSubcontent.innerHTML = '';

    if (found.path === '/profile/history') {
      const events = state.activityEvents.filter((event) => event.userEmail === user.email);
      if (!events.length) {
        ui.profileSubcontent.innerHTML = '<p class="muted">История действий пуста.</p>';
      } else {
        events.slice(0, 20).forEach((event) => {
          const card = document.createElement('article');
          card.className = 'card';
          card.innerHTML = `<strong>${event.text}</strong><div class="muted">${formatDate(event.createdAt)}</div>`;
          ui.profileSubcontent.appendChild(card);
        });
      }
    }

    if (found.path === '/profile/projects') {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = '<p>Проект: подготовка мини-спутника (демо). Статус: в процессе.</p>';
      ui.profileSubcontent.appendChild(card);
    }

    if (found.path === '/profile/career') {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = '<p>Цель карьеры: инженер систем связи. Рекомендация: завершить историю + современность + тесты.</p>';
      ui.profileSubcontent.appendChild(card);
    }

    if (found.path === '/profile/achievements') {
      if (!progress.rewardIds.length && !progress.achievements.length) {
        ui.profileSubcontent.innerHTML = '<p class="muted">Пока нет наград и загруженных достижений.</p>';
      }

      progress.rewardIds.forEach((rewardId) => {
        const reward = SPACE_DATA.rewards.find((item) => item.id === rewardId);
        const card = document.createElement('article');
        card.className = 'card';
        card.innerHTML = `<strong>${reward?.title || rewardId}</strong><p class="muted">Системная награда</p>`;
        ui.profileSubcontent.appendChild(card);
      });

      progress.achievements.forEach((achievement) => {
        const card = document.createElement('article');
        card.className = 'card';
        card.innerHTML = `<strong>${achievement.title}</strong><div class="muted">${achievement.fileName}</div>`;
        ui.profileSubcontent.appendChild(card);
      });
    }

    ui.uploadedAchievements.innerHTML = '';
    progress.achievements.forEach((achievement) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `<strong>${achievement.title}</strong><div class="muted">${achievement.fileName} · ${formatDate(achievement.createdAt)}</div>`;
      ui.uploadedAchievements.appendChild(card);
    });

    renderProfileSubnav();
    renderProfileMetrics();
  }

  function renderMain() {
    const user = getCurrentUser();
    if (!user) return;
    ui.welcomeText.textContent = `Маршрут участника: ${user.name}`;
    renderMainSection();
    renderForumPreview();
  }

  function handleRouteGuards(route) {
    const user = getCurrentUser();

    if (!user && isProtectedRoute(route)) {
      setRoute('/auth/login');
      return false;
    }

    if (user && (route === '/auth/login' || route === '/auth/register')) {
      setRoute('/');
      return false;
    }

    return true;
  }

  function renderRoute() {
    const route = getRoute();
    if (!handleRouteGuards(route)) return;
    ui.routeLabel.textContent = route;

    if (route === '/auth/login') {
      showOnly('auth');
      toggleAuth('login');
      return;
    }

    if (route === '/auth/register') {
      showOnly('auth');
      toggleAuth('register');
      return;
    }

    if (route === '/') {
      showOnly('main');
      renderMain();
      return;
    }

    const sectionMatch = route.match(/^\/sections\/([\w-]+)$/);
    if (sectionMatch) {
      const slug = sectionMatch[1];
      if (sectionBySlug(slug)) {
        activeSectionSlug = slug;
        showOnly('main');
        renderMain();
        return;
      }
    }

    const quizMatch = route.match(/^\/sections\/([\w-]+)\/quiz$/);
    if (quizMatch) {
      const slug = quizMatch[1];
      activeSectionSlug = slug;
      showOnly('quiz');
      renderQuizSection(slug);
      return;
    }

    if (route === '/forum' || /^\/forum\/[\w-]+$/.test(route)) {
      showOnly('forum');
      renderForum(route);
      return;
    }

    if (route === '/profile' || route.startsWith('/profile/')) {
      showOnly('profile');
      const normalized = SPACE_DATA.profileRoutes.some((item) => item.path === route) ? route : '/profile/history';
      renderProfileSection(normalized);
      return;
    }

    setRoute('/');
  }

  function bindEvents() {
    ui.showLogin.addEventListener('click', () => setRoute('/auth/login'));
    ui.showRegister.addEventListener('click', () => setRoute('/auth/register'));

    ui.loginForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const email = document.getElementById('login-email').value.trim().toLowerCase();
      const password = document.getElementById('login-password').value;
      loginUser(email, password);
    });

    ui.registerForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = document.getElementById('register-name').value.trim();
      const email = document.getElementById('register-email').value.trim().toLowerCase();
      const password = document.getElementById('register-password').value;
      registerUser(name, email, password);
    });

    ui.gotoProfile.addEventListener('click', () => setRoute('/profile'));
    ui.gotoForum.addEventListener('click', () => setRoute('/forum'));
    ui.profileBack.addEventListener('click', () => setRoute('/'));
    ui.forumBack.addEventListener('click', () => setRoute('/'));
    ui.quizBack.addEventListener('click', () => setRoute(`/sections/${activeSectionSlug}`));
    ui.logoutBtn.addEventListener('click', logoutUser);

    ui.forumForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const user = getCurrentUser();
      if (!user) return;

      const topic = document.getElementById('forum-topic').value.trim();
      const message = document.getElementById('forum-message').value.trim();
      if (!topic || !message) return;

      // ForumTopic
      state.forumTopics.unshift({
        id: `t-${Date.now()}`,
        userName: user.name,
        topic,
        message,
        createdAt: nowIso(),
        comments: []
      });

      grantPoints(4, 'Создана тема на форуме');
      addActivityEvent('forum', `Создана тема: ${topic}`);
      saveState();
      ui.forumForm.reset();
      renderForum(getRoute());
    });

    ui.achievementForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const user = getCurrentUser();
      if (!user) return;
      ensureUserProgress(user.email);

      const title = document.getElementById('achievement-title').value.trim();
      const fileInput = document.getElementById('achievement-file');
      const file = fileInput.files[0];
      if (!title || !file) return;

      // Achievement
      state.userProgress[user.email].achievements.unshift({
        id: `ach-${Date.now()}`,
        title,
        fileName: file.name,
        createdAt: nowIso()
      });

      grantPoints(8, 'Загружено достижение');
      addActivityEvent('achievement', `Загружено достижение: ${title}`);
      saveState();
      ui.achievementForm.reset();
      renderProfileSection(activeProfilePath);
    });

    window.addEventListener('hashchange', renderRoute);
  }

  bindEvents();

  if (!window.location.hash) {
    setRoute(state.sessionEmail ? '/' : '/auth/login');
  } else {
    renderRoute();
  }
})();
