(() => {
  const STORAGE_KEY = 'orbit_edu_mvp_v2';
  const app = document.getElementById('app');

  const routes = [
    /^\/$/,
    /^\/auth\/login$/,
    /^\/auth\/register$/,
    /^\/profile$/,
    /^\/profile\/(history|projects|career|achievements)$/,
    /^\/sections\/(history|modern|news|success)$/,
    /^\/sections\/(history|modern)\/quiz$/,
    /^\/forum$/,
    /^\/forum\/[a-zA-Z0-9_-]+$/
  ];

  const entitySchema = {
    User: ['id', 'name', 'email', 'password'],
    Section: ['id', 'slug', 'title', 'summary'],
    MaterialBlock: ['id', 'title', 'content'],
    Quiz: ['id', 'title', 'questions'],
    QuizQuestion: ['id', 'text', 'answers', 'correctIndex'],
    QuizAttempt: ['id', 'quizId', 'score', 'passed', 'createdAt'],
    UserProgress: ['userId', 'readBlocks', 'readNews', 'visitedSections', 'points'],
    Achievement: ['id', 'title', 'fileName', 'createdAt'],
    Reward: ['id', 'title', 'points', 'description'],
    UserReward: ['id', 'rewardId', 'createdAt'],
    ForumTopic: ['id', 'title', 'author', 'createdAt', 'comments'],
    ForumComment: ['id', 'author', 'text', 'createdAt'],
    ActivityEvent: ['id', 'type', 'message', 'createdAt']
  };

  function seedState() {
    return {
      users: [],
      sessionUserId: null,
      userProgress: {},
      quizAttempts: {},
      userRewards: {},
      achievements: {},
      forumTopics: [...SPACE_DATA.forumTopics],
      activityEvents: {}
    };
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();

    try {
      const parsed = JSON.parse(raw);
      return {
        ...seedState(),
        ...parsed,
        forumTopics: Array.isArray(parsed.forumTopics) ? parsed.forumTopics : [...SPACE_DATA.forumTopics]
      };
    } catch (_error) {
      return seedState();
    }
  }

  const state = loadState();

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid(prefix = 'id') {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function navigate(path) {
    window.history.pushState({}, '', path);
    render();
  }

  function ensureRoute(path) {
    return routes.some((route) => route.test(path));
  }

  function currentUser() {
    return state.users.find((user) => user.id === state.sessionUserId) || null;
  }

  function userData(userId) {
    if (!state.userProgress[userId]) {
      state.userProgress[userId] = {
        userId,
        readBlocks: [],
        readNews: [],
        visitedSections: [],
        points: 0,
        planetLight: { history: 0, modern: 0, news: 0, success: 0 }
      };
    }

    if (!state.quizAttempts[userId]) state.quizAttempts[userId] = [];
    if (!state.userRewards[userId]) state.userRewards[userId] = [];
    if (!state.achievements[userId]) state.achievements[userId] = [];
    if (!state.activityEvents[userId]) state.activityEvents[userId] = [];

    return state.userProgress[userId];
  }

  function addEvent(userId, type, message) {
    userData(userId);
    state.activityEvents[userId].unshift({ id: uid('ev'), type, message, createdAt: new Date().toISOString() });
    state.activityEvents[userId] = state.activityEvents[userId].slice(0, 50);
  }

  function addPoints(userId, amount, reason) {
    const progress = userData(userId);
    progress.points += amount;
    addEvent(userId, 'points', `${reason}: +${amount} баллов`);
  }

  function awardRewardIfNeeded(userId, rewardId) {
    const reward = Object.values(SPACE_DATA.rewards).find((item) => item.id === rewardId);
    if (!reward) return;

    const rewards = state.userRewards[userId];
    if (rewards.some((entry) => entry.rewardId === rewardId)) return;

    rewards.push({ id: uid('ur'), rewardId, createdAt: new Date().toISOString() });
    addPoints(userId, reward.points, `Награда «${reward.title}»`);
    addEvent(userId, 'reward', `Получена награда: ${reward.title}`);
  }

  function computeCompletion(progress) {
    const sectionCount = SPACE_DATA.sections.length;
    const visited = progress.visitedSections.length;
    const quizPassed = state.quizAttempts[progress.userId].filter((item) => item.passed).length;
    const maxQuiz = 2;
    const result = Math.round(((visited + Math.min(quizPassed, maxQuiz)) / (sectionCount + maxQuiz)) * 100);
    return Math.min(100, result);
  }

  function markSectionVisited(userId, slug) {
    const progress = userData(userId);
    if (!progress.visitedSections.includes(slug)) {
      progress.visitedSections.push(slug);
      addPoints(userId, 8, `Открыт раздел «${slug}»`);
    }

    if (['history', 'modern', 'news', 'success'].every((id) => progress.visitedSections.includes(id))) {
      awardRewardIfNeeded(userId, SPACE_DATA.rewards.deepReader.id);
    }
  }

  function markMaterialRead(userId, sectionSlug, blockId) {
    const progress = userData(userId);
    if (!progress.readBlocks.includes(blockId)) {
      progress.readBlocks.push(blockId);
      progress.planetLight[sectionSlug] = Math.min(100, progress.planetLight[sectionSlug] + 50);
      addPoints(userId, 5, `Изучен материал ${blockId}`);
      addEvent(userId, 'read', `Прочитан материал в разделе «${sectionSlug}»`);
      saveState();
      render();
    }
  }

  function markNewsRead(userId, newsId) {
    const progress = userData(userId);
    if (!progress.readNews.includes(newsId)) {
      progress.readNews.push(newsId);
      progress.planetLight.news = Math.min(100, progress.planetLight.news + 34);
      addPoints(userId, 4, 'Прочитана новость');
      addEvent(userId, 'news', `Прочитана новость ${newsId}`);

      if (progress.readNews.length >= 3) {
        awardRewardIfNeeded(userId, SPACE_DATA.rewards.newsWatcher.id);
      }

      saveState();
      render();
    }
  }

  function submitQuiz(userId, sectionSlug, answers) {
    const section = SPACE_DATA.sections.find((item) => item.slug === sectionSlug);
    if (!section || !section.quiz) return;

    const total = section.quiz.questions.length;
    let correct = 0;

    section.quiz.questions.forEach((question, index) => {
      if (Number(answers[index]) === question.correctIndex) correct += 1;
    });

    const passed = correct === total;
    state.quizAttempts[userId].push({
      id: uid('qa'),
      quizId: section.quiz.id,
      score: correct,
      passed,
      createdAt: new Date().toISOString()
    });

    addEvent(userId, 'quiz', `Тест «${section.quiz.title}»: ${correct}/${total}`);

    if (passed) {
      addPoints(userId, 20, `Успешный тест «${section.quiz.title}»`);
      const passedCount = state.quizAttempts[userId].filter((attempt) => attempt.passed).length;
      if (passedCount >= 2) {
        awardRewardIfNeeded(userId, SPACE_DATA.rewards.quizMaster.id);
      }
    }

    saveState();
    render();
  }

  function requireAuth() {
    if (!currentUser()) {
      navigate('/auth/login');
      return false;
    }
    return true;
  }

  function renderAuth(path) {
    app.innerHTML = document.getElementById('auth-template').innerHTML;
    const isLogin = path === '/auth/login';

    app.querySelector('[data-tab="login"]').classList.toggle('is-active', isLogin);
    app.querySelector('[data-tab="register"]').classList.toggle('is-active', !isLogin);
    app.querySelector('#login-form').classList.toggle('hidden', !isLogin);
    app.querySelector('#register-form').classList.toggle('hidden', isLogin);

    const authMessage = app.querySelector('#auth-message');

    app.querySelector('#login-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const email = app.querySelector('#login-email').value.trim().toLowerCase();
      const password = app.querySelector('#login-password').value;
      const user = state.users.find((item) => item.email === email && item.password === password);

      if (!user) {
        authMessage.textContent = 'Неверный email или пароль.';
        return;
      }

      state.sessionUserId = user.id;
      userData(user.id);
      addEvent(user.id, 'auth', 'Вход в систему');
      saveState();
      navigate('/');
    });

    app.querySelector('#register-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const name = app.querySelector('#register-name').value.trim();
      const email = app.querySelector('#register-email').value.trim().toLowerCase();
      const password = app.querySelector('#register-password').value;

      if (state.users.some((item) => item.email === email)) {
        authMessage.textContent = 'Пользователь с таким email уже существует.';
        return;
      }

      const user = { id: uid('u'), name, email, password };
      state.users.push(user);
      state.sessionUserId = user.id;
      userData(user.id);
      addEvent(user.id, 'auth', 'Регистрация в системе');
      saveState();
      navigate('/');
    });
  }

  function planetButton(section, progress) {
    const light = progress.planetLight[section.slug] || 0;
    return `
      <a href="/sections/${section.slug}" data-link class="planet" style="--light:${light}%">
        <span class="planet-title">${section.title}</span>
        <span class="planet-progress">${light}%</span>
      </a>
    `;
  }

  function renderSectionContent(path, user) {
    const sectionShell = app.querySelector('#section-shell');
    const progress = userData(user.id);

    const defaultSection = SPACE_DATA.sections[0];
    const slug = path.startsWith('/sections/') ? path.split('/')[2] : defaultSection.slug;
    const section = SPACE_DATA.sections.find((item) => item.slug === slug) || defaultSection;

    markSectionVisited(user.id, section.slug);

    if (path.endsWith('/quiz')) {
      const quiz = section.quiz;
      if (!quiz) {
        sectionShell.innerHTML = '<h3>Тест не найден</h3>';
        return;
      }

      sectionShell.innerHTML = `
        <div class="section-head">
          <h3>${quiz.title}</h3>
          <a href="/sections/${section.slug}" data-link class="btn">К материалам</a>
        </div>
        <form id="quiz-form" class="quiz-grid">
          ${quiz.questions
            .map(
              (question, qIndex) => `
                <fieldset class="card quiz-card">
                  <legend>${qIndex + 1}. ${question.text}</legend>
                  ${question.answers
                    .map(
                      (answer, aIndex) => `
                        <label class="radio-row">
                          <input type="radio" name="q-${qIndex}" value="${aIndex}" required />
                          <span>${answer}</span>
                        </label>
                      `
                    )
                    .join('')}
                </fieldset>
              `
            )
            .join('')}
          <button class="btn btn-solid" type="submit">Отправить тест</button>
        </form>
      `;

      app.querySelector('#quiz-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const answers = quiz.questions.map((_, index) => app.querySelector(`input[name="q-${index}"]:checked`)?.value);
        submitQuiz(user.id, section.slug, answers);
      });

      return;
    }

    if (section.slug === 'news') {
      sectionShell.innerHTML = `
        <div class="section-head">
          <div>
            <h3>${section.title}</h3>
            <p class="muted">Новости за последний месяц.</p>
          </div>
        </div>
        <div class="stack" id="news-list"></div>
      `;

      const newsList = app.querySelector('#news-list');
      SPACE_DATA.newsFeed.forEach((news) => {
        const read = progress.readNews.includes(news.id);
        const card = document.createElement('article');
        card.className = 'card';
        card.innerHTML = `
          <strong>${news.title}</strong>
          <p class="muted">${news.date}</p>
          <p>${news.text}</p>
          <button class="btn ${read ? '' : 'btn-solid'}" data-news-id="${news.id}" type="button">${read ? 'Прочитано' : 'Отметить прочитанным'}</button>
        `;
        newsList.appendChild(card);
      });

      newsList.addEventListener('click', (event) => {
        const button = event.target.closest('[data-news-id]');
        if (!button) return;
        markNewsRead(user.id, button.dataset.newsId);
      });
      return;
    }

    sectionShell.innerHTML = `
      <div class="section-head">
        <div>
          <h3>${section.title}</h3>
          <p class="muted">${section.summary}</p>
        </div>
        ${section.quiz ? `<a href="/sections/${section.slug}/quiz" data-link class="btn btn-solid">Перейти к тесту</a>` : ''}
      </div>
      <div class="stack" id="materials-list"></div>
    `;

    const list = app.querySelector('#materials-list');
    section.materialBlocks.forEach((block) => {
      const read = progress.readBlocks.includes(block.id);
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <strong>${block.title}</strong>
        <p>${block.content}</p>
        <button type="button" data-block-id="${block.id}" class="btn ${read ? '' : 'btn-solid'}">${read ? 'Изучено' : 'Отметить изученным'}</button>
      `;
      list.appendChild(card);
    });

    if (!section.materialBlocks.length) {
      list.innerHTML = '<p class="muted">Материалы скоро появятся.</p>';
    }

    list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-block-id]');
      if (!button) return;
      markMaterialRead(user.id, section.slug, button.dataset.blockId);
    });
  }

  function renderHome(path) {
    if (!requireAuth()) return;
    const user = currentUser();
    const progress = userData(user.id);

    app.innerHTML = document.getElementById('home-template').innerHTML;
    app.querySelector('#welcome-heading').textContent = `Привет, ${user.name}! Выберите планету и начните изучение.`;
    app.querySelector('#logout-btn').addEventListener('click', () => {
      addEvent(user.id, 'auth', 'Выход из системы');
      state.sessionUserId = null;
      saveState();
      navigate('/auth/login');
    });

    app.querySelector('#planet-nav').innerHTML = SPACE_DATA.sections.map((section) => planetButton(section, progress)).join('');

    const previewList = app.querySelector('#forum-preview-list');
    previewList.innerHTML = state.forumTopics.slice(0, 2).map((topic) => `<article class="card"><strong>${topic.title}</strong><p class="muted">${topic.author}</p></article>`).join('');

    renderSectionContent(path, user);
  }

  function renderProfile(path) {
    if (!requireAuth()) return;
    const user = currentUser();
    const progress = userData(user.id);

    app.innerHTML = document.getElementById('profile-template').innerHTML;
    app.querySelector('#profile-name').textContent = `${user.name}, ваш прогресс`;

    const completion = computeCompletion(progress);
    const rewards = state.userRewards[user.id];

    app.querySelector('#profile-metrics').innerHTML = `
      <div><span class="k">Баллы</span><strong>${progress.points}</strong></div>
      <div><span class="k">Прогресс</span><strong>${completion}%</strong></div>
      <div><span class="k">Награды</span><strong>${rewards.length}</strong></div>
      <div><span class="k">Изученные планеты</span><strong>${progress.visitedSections.length}/4</strong></div>
    `;

    const subpage = path.split('/')[2] || 'history';
    app.querySelector('#profile-subpage').innerHTML = `
      <h4>/profile/${subpage}</h4>
      <p>${SPACE_DATA.profilePages[subpage] || SPACE_DATA.profilePages.history}</p>
      <div class="chip-row">
        ${rewards
          .map((item) => {
            const reward = Object.values(SPACE_DATA.rewards).find((entry) => entry.id === item.rewardId);
            return reward ? `<span class="chip">${reward.title}</span>` : '';
          })
          .join('') || '<span class="muted">Наград пока нет.</span>'}
      </div>
    `;

    const achievements = state.achievements[user.id];
    const achievementsList = app.querySelector('#achievements-list');
    achievementsList.innerHTML = achievements.length
      ? achievements.map((item) => `<article class="card"><strong>${item.title}</strong><p class="muted">Файл: ${item.fileName}</p></article>`).join('')
      : '<p class="muted">Пока нет загруженных достижений.</p>';

    app.querySelector('#achievement-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const title = app.querySelector('#achievement-title').value.trim();
      const file = app.querySelector('#achievement-file').files[0];
      if (!file) return;

      state.achievements[user.id].push({ id: uid('ach'), title, fileName: file.name, createdAt: new Date().toISOString() });
      addPoints(user.id, 7, 'Загружено достижение');
      addEvent(user.id, 'achievement', `Загружено достижение «${title}»`);
      saveState();
      render();
    });

    const events = state.activityEvents[user.id];
    app.querySelector('#activity-list').innerHTML = events.length
      ? events.map((item) => `<article class="card"><strong>${item.message}</strong><p class="muted">${new Date(item.createdAt).toLocaleString('ru-RU')}</p></article>`).join('')
      : '<p class="muted">История пока пуста.</p>';
  }

  function renderForum(path) {
    if (!requireAuth()) return;
    const user = currentUser();

    app.innerHTML = document.getElementById('forum-template').innerHTML;

    app.querySelector('#forum-topic-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const title = app.querySelector('#topic-title').value.trim();
      const message = app.querySelector('#topic-message').value.trim();

      const topicId = uid('f');
      state.forumTopics.unshift({
        id: topicId,
        title,
        author: user.name,
        createdAt: new Date().toISOString(),
        comments: [{ id: uid('fc'), author: user.name, text: message, createdAt: new Date().toISOString() }]
      });

      addPoints(user.id, 3, 'Создание темы форума');
      addEvent(user.id, 'forum', `Создана тема «${title}»`);
      saveState();
      navigate(`/forum/${topicId}`);
    });

    const forumList = app.querySelector('#forum-list');
    const selectedId = path.split('/')[2];

    forumList.innerHTML = state.forumTopics
      .map((topic) => {
        const isOpened = selectedId === topic.id;
        return `
          <article class="card">
            <div class="section-head">
              <div>
                <strong>${topic.title}</strong>
                <p class="muted">${topic.author} · ${new Date(topic.createdAt).toLocaleDateString('ru-RU')}</p>
              </div>
              <a href="/forum/${topic.id}" data-link class="btn">Открыть</a>
            </div>
            ${
              isOpened
                ? `<div class="stack">${topic.comments
                    .map((comment) => `<article class="card"><strong>${comment.author}</strong><p>${comment.text}</p></article>`)
                    .join('')}</div>`
                : ''
            }
          </article>
        `;
      })
      .join('');
  }

  function attachGlobalListeners() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('[data-link]');
      if (!link) return;
      event.preventDefault();
      navigate(link.getAttribute('href'));
    });

    window.addEventListener('popstate', render);
  }

  function renderNotFound() {
    app.innerHTML = `
      <section class="panel auth-card">
        <h2>Маршрут не найден</h2>
        <p class="muted">Проверьте адрес страницы.</p>
        <a href="/" data-link class="btn btn-solid">На главную</a>
      </section>
    `;
  }

  function render() {
    const path = window.location.pathname;

    if (!ensureRoute(path)) {
      renderNotFound();
      return;
    }

    if (path.startsWith('/auth/')) {
      renderAuth(path);
      return;
    }

    if (path.startsWith('/profile')) {
      renderProfile(path);
      return;
    }

    if (path.startsWith('/forum')) {
      renderForum(path);
      return;
    }

    if (path === '/' || path.startsWith('/sections/')) {
      renderHome(path);
    }
  }

  attachGlobalListeners();

  if (!window.location.pathname || window.location.pathname === '/index.html') {
    window.history.replaceState({}, '', '/');
  }

  render();

  console.info('Entity schema for MVP:', entitySchema);
})();
