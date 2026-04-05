(() => {
  const STORAGE_KEY = 'orbit_edu_mvp_v2';
  const app = document.getElementById('app');
  const planetTemplate = document.getElementById('planet-template');
  const quizOptionTemplate = document.getElementById('quiz-option-template');

  const requiredRoutes = {
    home: '/',
    login: '/auth/login',
    register: '/auth/register',
    profile: '/profile',
    profileHistory: '/profile/history',
    profileProjects: '/profile/projects',
    profileCareer: '/profile/career',
    profileAchievements: '/profile/achievements',
    forum: '/forum'
  };

  const state = loadState();

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  function createInitialState() {
    return {
      users: [],
      sessionUserId: null,
      sections: SPACE_DATA.sections,
      materialBlocks: SPACE_DATA.sections.flatMap((section) =>
        section.materials.map((material) => ({
          id: material.id,
          sectionSlug: section.slug,
          title: material.title,
          text: material.text
        }))
      ),
      quizzes: SPACE_DATA.quizzes,
      quizAttempts: [],
      userProgress: [],
      achievements: [],
      rewards: SPACE_DATA.rewards,
      userRewards: [],
      forumTopics: SPACE_DATA.forumTopics,
      activityEvents: []
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createInitialState();
      const parsed = JSON.parse(raw);
      return {
        ...createInitialState(),
        ...parsed
      };
    } catch {
      return createInitialState();
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function routePath() {
    const hash = window.location.hash || '#/';
    return hash.slice(1);
  }

  function navigate(path) {
    window.location.hash = `#${path}`;
  }

  function addEvent(type, message, meta = {}) {
    const current = currentUser();
    state.activityEvents.unshift({
      id: uid('event'),
      userId: current?.id || null,
      type,
      message,
      meta,
      createdAt: nowIso()
    });
    state.activityEvents = state.activityEvents.slice(0, 120);
  }

  function currentUser() {
    return state.users.find((user) => user.id === state.sessionUserId) || null;
  }

  function ensureUserProgress(userId) {
    let progress = state.userProgress.find((item) => item.userId === userId);
    if (!progress) {
      progress = {
        id: uid('progress'),
        userId,
        sectionReadMap: {},
        points: 0,
        exploredPlanets: [],
        quizPassedSlugs: [],
        newsReadIds: [],
        updatedAt: nowIso()
      };
      state.userProgress.push(progress);
    }
    return progress;
  }

  function getUserProgress() {
    const user = currentUser();
    if (!user) return null;
    return ensureUserProgress(user.id);
  }

  function awardReward(userId, rewardId) {
    const already = state.userRewards.some((it) => it.userId === userId && it.rewardId === rewardId);
    if (already) return;
    const reward = state.rewards.find((item) => item.id === rewardId);
    if (!reward) return;

    state.userRewards.push({
      id: uid('user-reward'),
      userId,
      rewardId,
      earnedAt: nowIso()
    });

    const progress = ensureUserProgress(userId);
    progress.points += reward.points;
    addEvent('reward_earned', `Получена награда: ${reward.title}`, { rewardId });
  }

  function validateExplorerReward(userId) {
    const progress = ensureUserProgress(userId);
    const needed = ['history', 'modern', 'news', 'success'];
    const allOpened = needed.every((slug) => progress.exploredPlanets.includes(slug));
    if (allOpened) {
      awardReward(userId, 'reward-explorer');
    }
  }

  function topNav(title, actions = []) {
    const actionsHtml = actions
      .map((action) => `<button class="btn ${action.solid ? 'btn-solid' : ''}" data-action="${action.action}">${action.label}</button>`)
      .join('');
    return `
      <div class="card row" style="justify-content: space-between;">
        <div class="stack" style="gap: 0.25rem;">
          <h2>${title}</h2>
          <p class="muted">Маршрут: вход → планета → материалы → тест → награда.</p>
        </div>
        <div class="row">${actionsHtml}</div>
      </div>
    `;
  }

  function safe(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function sectionProgressPercent(progress, sectionSlug) {
    const section = state.sections.find((item) => item.slug === sectionSlug);
    if (!section) return 0;
    const readIds = progress.sectionReadMap[sectionSlug] || [];
    return Math.round((readIds.length / section.materials.length) * 100);
  }

  function renderAuthPage(mode) {
    app.className = 'app-shell auth-layout';
    const isLogin = mode === 'login';

    app.innerHTML = `
      <section class="card auth-card stack">
        <h1>Orbit EDU MVP</h1>
        <p class="muted">Интерактивный образовательный космический портал в чёрно-белом стиле.</p>

        <div class="row">
          <button class="btn ${isLogin ? 'btn-solid' : ''}" data-action="goto-login">Вход</button>
          <button class="btn ${!isLogin ? 'btn-solid' : ''}" data-action="goto-register">Регистрация</button>
        </div>

        <form id="auth-form" class="stack">
          ${
            isLogin
              ? `
            <label>Email<input name="email" type="email" required placeholder="cadet@orbit.local" /></label>
            <label>Пароль<input name="password" type="password" minlength="4" required /></label>
          `
              : `
            <label>Имя<input name="name" type="text" required placeholder="Курсант" /></label>
            <label>Email<input name="email" type="email" required placeholder="cadet@orbit.local" /></label>
            <label>Пароль<input name="password" type="password" minlength="4" required /></label>
          `
          }
          <button class="btn btn-solid" type="submit">${isLogin ? 'Войти' : 'Создать аккаунт'}</button>
          <p id="auth-status" class="status muted"></p>
        </form>
      </section>
    `;

    app.querySelector('[data-action="goto-login"]').onclick = () => navigate(requiredRoutes.login);
    app.querySelector('[data-action="goto-register"]').onclick = () => navigate(requiredRoutes.register);

    app.querySelector('#auth-form').onsubmit = (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const email = String(form.get('email')).trim().toLowerCase();
      const password = String(form.get('password'));
      const status = app.querySelector('#auth-status');

      if (isLogin) {
        const user = state.users.find((item) => item.email === email && item.password === password);
        if (!user) {
          status.textContent = 'Неверный email или пароль.';
          status.className = 'status warn';
          return;
        }
        state.sessionUserId = user.id;
        addEvent('login', 'Выполнен вход');
        persist();
        navigate(requiredRoutes.home);
        return;
      }

      const name = String(form.get('name')).trim();
      if (!name) {
        status.textContent = 'Введите имя.';
        status.className = 'status warn';
        return;
      }
      if (state.users.some((item) => item.email === email)) {
        status.textContent = 'Пользователь с таким email уже существует.';
        status.className = 'status warn';
        return;
      }

      const user = {
        id: uid('user'),
        name,
        email,
        password,
        createdAt: nowIso()
      };

      state.users.push(user);
      state.sessionUserId = user.id;
      ensureUserProgress(user.id);
      addEvent('register', 'Создан новый аккаунт', { email });
      persist();
      navigate(requiredRoutes.home);
    };
  }

  function attachGlobalActions(root) {
    root.querySelectorAll('[data-action]').forEach((button) => {
      const action = button.dataset.action;
      button.addEventListener('click', () => {
        if (action === 'logout') {
          addEvent('logout', 'Выход из системы');
          state.sessionUserId = null;
          persist();
          navigate(requiredRoutes.login);
        }
        if (action === 'go-profile') navigate(requiredRoutes.profile);
        if (action === 'go-home') navigate(requiredRoutes.home);
        if (action === 'go-forum') navigate(requiredRoutes.forum);
      });
    });
  }

  function renderHomePage() {
    const user = currentUser();
    const progress = getUserProgress();
    app.className = 'app-shell';

    app.innerHTML = `
      <main class="hero">
        ${topNav(`Привет, ${safe(user.name)}!`, [
          { label: 'Профиль', action: 'go-profile' },
          { label: 'Форум', action: 'go-forum' },
          { label: 'Выйти', action: 'logout' }
        ])}

        <section class="card stack">
          <h3>Карта планет (навигация без классического header)</h3>
          <p class="muted">Каждая планета ведёт в раздел. По мере изучения материалов планета «светлеет».</p>
          <div id="planets" class="planets"></div>
        </section>

        <section class="card stack">
          <h3>Сводка новостей за последний месяц</h3>
          <div class="grid three">
            ${state.sections
              .find((s) => s.slug === 'news')
              .materials.map((news) => `<article class="card stack"><strong>${safe(news.title)}</strong><p class="muted">${safe(news.text)}</p></article>`)
              .join('')}
          </div>
        </section>
      </main>

      <section class="forum-screen" id="forum-preview">
        <div class="card row" style="justify-content: space-between;">
          <div class="stack" style="gap:0.2rem;">
            <h3>Упрощённый форум (второй экран при прокрутке)</h3>
            <p class="muted">Прокрутите вниз с планет — и попадёте в обсуждения.</p>
          </div>
          <button class="btn btn-solid" data-action="go-forum">Открыть полный форум</button>
        </div>
        <div class="grid two" id="forum-preview-list"></div>
      </section>
    `;

    attachGlobalActions(app);

    const planetsEl = app.querySelector('#planets');
    const entries = [
      { label: 'История', route: '/sections/history', slug: 'history' },
      { label: 'Современность', route: '/sections/modern', slug: 'modern' },
      { label: 'Новости', route: '/sections/news', slug: 'news' },
      { label: 'Истории успеха', route: '/sections/success', slug: 'success' },
      { label: 'Профиль', route: '/profile', slug: 'profile' }
    ];

    entries.forEach((entry) => {
      const node = planetTemplate.content.firstElementChild.cloneNode(true);
      node.querySelector('.planet-label').textContent = entry.label;

      if (entry.slug !== 'profile') {
        const percent = sectionProgressPercent(progress, entry.slug);
        node.querySelector('.planet-visual').style.filter = `brightness(${0.65 + percent / 100})`;
      }

      node.onclick = () => navigate(entry.route);
      planetsEl.appendChild(node);
    });

    const forumPreview = app.querySelector('#forum-preview-list');
    state.forumTopics.slice(0, 4).forEach((topic) => {
      const html = document.createElement('a');
      html.className = 'topic-link';
      html.href = `#/forum/${topic.id}`;
      html.innerHTML = `<strong>${safe(topic.title)}</strong><span class="muted">${safe(topic.author)}</span><span class="muted">Комментариев: ${topic.comments.length}</span>`;
      forumPreview.appendChild(html);
    });
  }

  function markMaterialRead(sectionSlug, materialId) {
    const user = currentUser();
    const progress = ensureUserProgress(user.id);

    if (!progress.exploredPlanets.includes(sectionSlug)) {
      progress.exploredPlanets.push(sectionSlug);
      progress.points += 10;
      addEvent('section_opened', `Открыт раздел ${sectionSlug}`);
    }

    if (!progress.sectionReadMap[sectionSlug]) {
      progress.sectionReadMap[sectionSlug] = [];
    }
    if (!progress.sectionReadMap[sectionSlug].includes(materialId)) {
      progress.sectionReadMap[sectionSlug].push(materialId);
      progress.points += 5;
      addEvent('material_read', 'Изучен материал', { sectionSlug, materialId });
      validateExplorerReward(user.id);
      progress.updatedAt = nowIso();
      persist();
    }
  }

  function renderSectionPage(sectionSlug) {
    const user = currentUser();
    const progress = getUserProgress();
    const section = state.sections.find((item) => item.slug === sectionSlug);

    if (!section) {
      renderNotFound('Раздел не найден');
      return;
    }

    app.className = 'app-shell';
    app.innerHTML = `
      <main class="section-page">
        ${topNav(section.title, [
          { label: 'Главная', action: 'go-home' },
          { label: 'Профиль', action: 'go-profile' },
          { label: 'Форум', action: 'go-forum' },
          { label: 'Выйти', action: 'logout' }
        ])}

        <section class="card stack">
          <p class="muted">${safe(section.summary)}</p>
          <div>
            <div class="row" style="justify-content: space-between; margin-bottom:0.4rem;">
              <span class="muted">Прогресс изучения планеты</span>
              <span>${sectionProgressPercent(progress, section.slug)}%</span>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:${sectionProgressPercent(progress, section.slug)}%"></div></div>
          </div>
        </section>

        <section class="grid two" id="materials"></section>

        ${section.quizId ? `<section class="card row" style="justify-content: space-between;"><span>После изучения пройдите тест и получите награду.</span><button class="btn btn-solid" data-action="go-quiz">Открыть тест</button></section>` : ''}
      </main>
    `;

    attachGlobalActions(app);

    const materials = app.querySelector('#materials');
    const readIds = progress.sectionReadMap[sectionSlug] || [];

    section.materials.forEach((material) => {
      const read = readIds.includes(material.id);
      const node = document.createElement('article');
      node.className = 'card stack';
      node.innerHTML = `
        <h4>${safe(material.title)}</h4>
        <p>${safe(material.text)}</p>
        <div class="row" style="justify-content: space-between;">
          <span class="badge">${read ? 'Изучено' : 'Не изучено'}</span>
          <button class="btn ${read ? '' : 'btn-solid'}" data-id="${material.id}">${read ? 'Прочитано' : 'Отметить как изученное'}</button>
        </div>
      `;
      node.querySelector('button').onclick = () => {
        markMaterialRead(sectionSlug, material.id);
        renderSectionPage(sectionSlug);
      };
      materials.appendChild(node);
    });

    if (section.quizId) {
      const btn = app.querySelector('[data-action="go-quiz"]');
      btn.onclick = () => navigate(`/sections/${sectionSlug}/quiz`);
    }

    if (!progress.exploredPlanets.includes(sectionSlug)) {
      progress.exploredPlanets.push(sectionSlug);
      progress.points += 10;
      addEvent('section_opened', `Открыт раздел ${sectionSlug}`);
      validateExplorerReward(user.id);
      persist();
    }
  }

  function renderQuizPage(sectionSlug) {
    const quiz = state.quizzes.find((item) => item.sectionSlug === sectionSlug);
    const user = currentUser();
    const progress = getUserProgress();

    if (!quiz) {
      renderNotFound('Тест для раздела не найден');
      return;
    }

    app.className = 'app-shell';
    app.innerHTML = `
      <main class="generic-page">
        ${topNav(quiz.title, [
          { label: 'К разделу', action: 'back-section' },
          { label: 'Профиль', action: 'go-profile' },
          { label: 'Выйти', action: 'logout' }
        ])}
        <form class="card stack" id="quiz-form">
          <p class="muted">Правильный ответ на каждый вопрос: +10 баллов. Проходной порог: 70%.</p>
          <div id="quiz-questions" class="stack"></div>
          <button class="btn btn-solid" type="submit">Проверить</button>
          <p id="quiz-status" class="status muted"></p>
        </form>
      </main>
    `;

    attachGlobalActions(app);
    app.querySelector('[data-action="back-section"]').onclick = () => navigate(`/sections/${sectionSlug}`);

    const qsWrap = app.querySelector('#quiz-questions');
    quiz.questions.forEach((question, index) => {
      const block = document.createElement('section');
      block.className = 'stack card';
      block.innerHTML = `<strong>${index + 1}. ${safe(question.text)}</strong>`;

      question.options.forEach((option) => {
        const optionNode = quizOptionTemplate.content.firstElementChild.cloneNode(true);
        const input = optionNode.querySelector('input');
        const span = optionNode.querySelector('span');
        input.name = `question-${question.id}`;
        input.value = option.id;
        span.textContent = option.text;
        block.appendChild(optionNode);
      });

      qsWrap.appendChild(block);
    });

    app.querySelector('#quiz-form').onsubmit = (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      let score = 0;

      quiz.questions.forEach((question) => {
        const selectedId = form.get(`question-${question.id}`);
        const correct = question.options.find((option) => option.isCorrect);
        if (selectedId === correct.id) {
          score += 1;
        }
      });

      const percent = Math.round((score / quiz.questions.length) * 100);
      const passed = percent >= 70;

      state.quizAttempts.unshift({
        id: uid('attempt'),
        userId: user.id,
        quizId: quiz.id,
        score,
        maxScore: quiz.questions.length,
        passed,
        createdAt: nowIso()
      });

      progress.points += score * 10;
      if (passed && !progress.quizPassedSlugs.includes(sectionSlug)) {
        progress.quizPassedSlugs.push(sectionSlug);
        awardReward(user.id, quiz.rewardId);
      }

      addEvent('quiz_attempt', `Попытка теста: ${quiz.title}`, { score, maxScore: quiz.questions.length, passed });
      persist();

      const status = app.querySelector('#quiz-status');
      status.className = `status ${passed ? 'ok' : 'warn'}`;
      status.textContent = passed
        ? `Тест пройден (${percent}%). Баллы и награда обновлены.`
        : `Нужно минимум 70%. Сейчас: ${percent}%. Попробуйте ещё раз.`;
    };
  }

  function renderForumPage(topicId = null) {
    app.className = 'app-shell';
    const user = currentUser();

    if (!topicId) {
      app.innerHTML = `
        <main class="forum-page">
          ${topNav('Форум', [
            { label: 'Главная', action: 'go-home' },
            { label: 'Профиль', action: 'go-profile' },
            { label: 'Выйти', action: 'logout' }
          ])}

          <form class="card stack" id="new-topic-form">
            <h3>Создать тему</h3>
            <label>Тема<input name="title" type="text" required placeholder="Например: подготовка к тесту" /></label>
            <label>Комментарий<textarea name="text" rows="3" required placeholder="Ваш вопрос или наблюдение"></textarea></label>
            <button class="btn btn-solid" type="submit">Опубликовать</button>
          </form>

          <section class="grid two" id="topics"></section>
        </main>
      `;

      attachGlobalActions(app);

      app.querySelector('#new-topic-form').onsubmit = (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const title = String(form.get('title')).trim();
        const text = String(form.get('text')).trim();
        if (!title || !text) return;

        const id = uid('topic');
        state.forumTopics.unshift({
          id,
          title,
          author: user.name,
          comments: [{ id: uid('comment'), author: user.name, text }]
        });
        addEvent('forum_topic_created', 'Создана новая тема форума', { title });
        persist();
        navigate(`/forum/${id}`);
      };

      const topics = app.querySelector('#topics');
      state.forumTopics.forEach((topic) => {
        const node = document.createElement('a');
        node.className = 'topic-link';
        node.href = `#/forum/${topic.id}`;
        node.innerHTML = `<strong>${safe(topic.title)}</strong><span class="muted">Автор: ${safe(topic.author)}</span><span class="muted">Комментариев: ${topic.comments.length}</span>`;
        topics.appendChild(node);
      });
      return;
    }

    const topic = state.forumTopics.find((item) => item.id === topicId);
    if (!topic) {
      renderNotFound('Тема форума не найдена');
      return;
    }

    app.innerHTML = `
      <main class="forum-page">
        ${topNav(topic.title, [
          { label: 'К темам', action: 'go-forum' },
          { label: 'Главная', action: 'go-home' },
          { label: 'Выйти', action: 'logout' }
        ])}

        <section class="card stack" id="comments"></section>

        <form class="card stack" id="comment-form">
          <label>Комментарий<textarea name="text" rows="3" required placeholder="Добавьте комментарий"></textarea></label>
          <button class="btn btn-solid" type="submit">Отправить</button>
        </form>
      </main>
    `;

    attachGlobalActions(app);

    const comments = app.querySelector('#comments');
    topic.comments.forEach((comment) => {
      const node = document.createElement('article');
      node.className = 'card stack';
      node.innerHTML = `<strong>${safe(comment.author)}</strong><p>${safe(comment.text)}</p>`;
      comments.appendChild(node);
    });

    app.querySelector('#comment-form').onsubmit = (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const text = String(form.get('text')).trim();
      if (!text) return;

      topic.comments.push({ id: uid('comment'), author: user.name, text });
      addEvent('forum_comment_created', 'Добавлен комментарий на форуме', { topicId });
      persist();
      renderForumPage(topicId);
    };
  }

  function renderProfilePage(subPage = null) {
    const user = currentUser();
    const progress = getUserProgress();
    const userRewards = state.userRewards.filter((item) => item.userId === user.id);
    const attempts = state.quizAttempts.filter((item) => item.userId === user.id);
    const events = state.activityEvents.filter((item) => item.userId === user.id).slice(0, 15);
    const achievements = state.achievements.filter((item) => item.userId === user.id);

    if (subPage) {
      const page = SPACE_DATA.profilePages.find((item) => item.slug === subPage);
      if (!page) {
        renderNotFound('Подраздел профиля не найден');
        return;
      }

      app.className = 'app-shell';
      app.innerHTML = `
        <main class="profile-page">
          ${topNav(page.title, [
            { label: 'Профиль', action: 'go-profile' },
            { label: 'Главная', action: 'go-home' },
            { label: 'Выйти', action: 'logout' }
          ])}
          <section class="card stack">
            <p>${safe(page.text)}</p>
            <p class="muted">В MVP этот экран сделан как фокусная подстраница для маршрута /profile/${subPage}.</p>
          </section>
        </main>
      `;
      attachGlobalActions(app);
      return;
    }

    const progressSections = ['history', 'modern', 'news', 'success'];
    const exploredCount = progressSections.filter((slug) => progress.exploredPlanets.includes(slug)).length;
    const overallProgress = Math.round((exploredCount / progressSections.length) * 100);

    app.className = 'app-shell';
    app.innerHTML = `
      <main class="profile-page">
        ${topNav(`Профиль: ${safe(user.name)}`, [
          { label: 'Главная', action: 'go-home' },
          { label: 'Форум', action: 'go-forum' },
          { label: 'Выйти', action: 'logout' }
        ])}

        <section class="grid three">
          <article class="card stack"><span class="muted">Баллы</span><span class="metric">${progress.points}</span></article>
          <article class="card stack"><span class="muted">Изученные планеты</span><span class="metric">${exploredCount}/${progressSections.length}</span></article>
          <article class="card stack"><span class="muted">Награды</span><span class="metric">${userRewards.length}</span></article>
        </section>

        <section class="card stack">
          <div class="row" style="justify-content:space-between;"><span>Общий прогресс</span><strong>${overallProgress}%</strong></div>
          <div class="progress-track"><div class="progress-fill" style="width:${overallProgress}%"></div></div>
          <div class="row">
            <a class="btn" href="#/profile/history">История</a>
            <a class="btn" href="#/profile/projects">Проекты</a>
            <a class="btn" href="#/profile/career">Карьера</a>
            <a class="btn" href="#/profile/achievements">Достижения</a>
          </div>
        </section>

        <section class="card stack">
          <h3>Загрузить достижение</h3>
          <form id="achievement-form" class="stack">
            <label>Название<input name="title" type="text" required placeholder="Например: сертификат" /></label>
            <label>Файл<input name="file" type="file" required /></label>
            <button class="btn btn-solid" type="submit">Сохранить</button>
          </form>
          <div id="achievements-list" class="grid two"></div>
        </section>

        <section class="grid two">
          <article class="card stack"><h3>Награды</h3><div id="rewards-list" class="stack"></div></article>
          <article class="card stack"><h3>Попытки тестов</h3><div id="attempts-list" class="stack"></div></article>
        </section>

        <section class="card stack">
          <h3>Activity events</h3>
          <div id="events-list" class="stack"></div>
        </section>
      </main>
    `;

    attachGlobalActions(app);

    const achievementsList = app.querySelector('#achievements-list');
    achievements.forEach((item) => {
      const node = document.createElement('article');
      node.className = 'card stack';
      node.innerHTML = `<strong>${safe(item.title)}</strong><span class="muted">${safe(item.fileName)}</span><span class="muted">${safe(item.createdAt)}</span>`;
      achievementsList.appendChild(node);
    });

    const rewardsList = app.querySelector('#rewards-list');
    userRewards.forEach((userReward) => {
      const reward = state.rewards.find((item) => item.id === userReward.rewardId);
      const node = document.createElement('div');
      node.className = 'card';
      node.innerHTML = `<strong>${safe(reward.title)}</strong> <span class="muted">+${reward.points} баллов</span>`;
      rewardsList.appendChild(node);
    });

    const attemptsList = app.querySelector('#attempts-list');
    attempts.slice(0, 8).forEach((attempt) => {
      const quiz = state.quizzes.find((q) => q.id === attempt.quizId);
      const node = document.createElement('div');
      node.className = 'card';
      node.innerHTML = `<strong>${safe(quiz.title)}</strong><div class="muted">${attempt.score}/${attempt.maxScore} · ${attempt.passed ? 'пройдено' : 'не пройдено'}</div>`;
      attemptsList.appendChild(node);
    });

    const eventsList = app.querySelector('#events-list');
    events.forEach((event) => {
      const node = document.createElement('div');
      node.className = 'card';
      node.innerHTML = `<strong>${safe(event.type)}</strong><div>${safe(event.message)}</div><div class="muted">${safe(event.createdAt)}</div>`;
      eventsList.appendChild(node);
    });

    app.querySelector('#achievement-form').onsubmit = (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const file = form.get('file');
      const title = String(form.get('title')).trim();
      if (!title || !file || !file.name) return;

      state.achievements.unshift({
        id: uid('achievement'),
        userId: user.id,
        title,
        fileName: file.name,
        createdAt: nowIso()
      });
      progress.points += 5;
      addEvent('achievement_uploaded', 'Загружено достижение', { title, fileName: file.name });
      persist();
      renderProfilePage();
    };
  }

  function renderNotFound(message) {
    app.className = 'app-shell';
    app.innerHTML = `
      <main class="generic-page">
        <section class="card stack">
          <h2>404</h2>
          <p>${safe(message)}</p>
          <button class="btn btn-solid" data-action="go-home">На главную</button>
        </section>
      </main>
    `;
    attachGlobalActions(app);
  }

  function parseRoute(path) {
    if (path === requiredRoutes.home) return { name: 'home' };
    if (path === requiredRoutes.login) return { name: 'login' };
    if (path === requiredRoutes.register) return { name: 'register' };
    if (path === requiredRoutes.profile) return { name: 'profile' };
    if (path === requiredRoutes.profileHistory) return { name: 'profile-sub', slug: 'history' };
    if (path === requiredRoutes.profileProjects) return { name: 'profile-sub', slug: 'projects' };
    if (path === requiredRoutes.profileCareer) return { name: 'profile-sub', slug: 'career' };
    if (path === requiredRoutes.profileAchievements) return { name: 'profile-sub', slug: 'achievements' };
    if (path === requiredRoutes.forum) return { name: 'forum' };

    let match = path.match(/^\/sections\/([a-z0-9-]+)$/);
    if (match) return { name: 'section', slug: match[1] };

    match = path.match(/^\/sections\/([a-z0-9-]+)\/quiz$/);
    if (match) return { name: 'quiz', slug: match[1] };

    match = path.match(/^\/forum\/([a-z0-9-]+)$/);
    if (match) return { name: 'forum-topic', id: match[1] };

    return { name: 'not-found' };
  }

  function renderRoute() {
    const path = routePath();
    const route = parseRoute(path);
    const user = currentUser();

    if (!user && !['login', 'register'].includes(route.name)) {
      navigate(requiredRoutes.login);
      return;
    }

    if (user && ['login', 'register'].includes(route.name)) {
      navigate(requiredRoutes.home);
      return;
    }

    if (route.name === 'login') renderAuthPage('login');
    else if (route.name === 'register') renderAuthPage('register');
    else if (route.name === 'home') renderHomePage();
    else if (route.name === 'section') renderSectionPage(route.slug);
    else if (route.name === 'quiz') renderQuizPage(route.slug);
    else if (route.name === 'forum') renderForumPage();
    else if (route.name === 'forum-topic') renderForumPage(route.id);
    else if (route.name === 'profile') renderProfilePage();
    else if (route.name === 'profile-sub') renderProfilePage(route.slug);
    else renderNotFound('Маршрут не найден');
  }

  window.addEventListener('hashchange', renderRoute);
  if (!window.location.hash) {
    navigate(requiredRoutes.login);
  } else {
    renderRoute();
  }
})();
