(() => {
  const STORAGE_KEY = 'kosmos_proto_state_v2';
  const SECTION_IDS = Object.keys(SPACE_DATA.sections);

  const state = loadState();
  let activeSectionId = SECTION_IDS[0];

  const views = {
    auth: document.getElementById('auth-view'),
    cabinet: document.getElementById('cabinet-view')
  };

  const ui = {
    showLogin: document.getElementById('show-login'),
    showRegister: document.getElementById('show-register'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    authMessage: document.getElementById('auth-message'),
    welcomeTitle: document.getElementById('welcome-title'),
    overallProgress: document.getElementById('overall-progress'),
    overallRating: document.getElementById('overall-rating'),
    rewardCount: document.getElementById('reward-count'),
    logoutBtn: document.getElementById('logout-btn'),
    sectionTabs: document.getElementById('section-tabs'),
    sectionTitle: document.getElementById('section-title'),
    sectionDescription: document.getElementById('section-description'),
    tasksList: document.getElementById('tasks-list'),
    claimRewardBtn: document.getElementById('claim-reward-btn'),
    rewardMessage: document.getElementById('reward-message'),
    rewardBadges: document.getElementById('reward-badges')
  };

  function createInitialState() {
    return {
      users: [],
      sessionEmail: null,
      ratings: {},
      sections: {},
      rewards: {}
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
        ratings: parsed.ratings || {},
        sections: parsed.sections || {},
        rewards: parsed.rewards || {}
      };
    } catch {
      return createInitialState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function currentUser() {
    return state.users.find((user) => user.email === state.sessionEmail) || null;
  }

  function ensureUserProgress(email) {
    if (!state.sections[email]) {
      state.sections[email] = SECTION_IDS.reduce((acc, sectionId) => {
        acc[sectionId] = [];
        return acc;
      }, {});
    }
    if (typeof state.ratings[email] !== 'number') {
      state.ratings[email] = 0;
    }
    if (!Array.isArray(state.rewards[email])) {
      state.rewards[email] = [];
    }
  }

  function showView(name) {
    Object.values(views).forEach((view) => view.classList.remove('view-active'));
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

  function calculateSectionProgress(email, sectionId) {
    const done = state.sections[email][sectionId].length;
    const total = SPACE_DATA.sections[sectionId].tasks.length;
    return Math.round((done / total) * 100);
  }

  function calculateOverallProgress(email) {
    const sum = SECTION_IDS.reduce((acc, sectionId) => acc + calculateSectionProgress(email, sectionId), 0);
    return Math.round(sum / SECTION_IDS.length);
  }

  function allSectionsCompleted(email) {
    return SECTION_IDS.every((sectionId) => calculateSectionProgress(email, sectionId) === 100);
  }

  function renderTabs(email) {
    ui.sectionTabs.innerHTML = '';

    SECTION_IDS.forEach((sectionId) => {
      const data = SPACE_DATA.sections[sectionId];
      const progress = calculateSectionProgress(email, sectionId);
      const button = document.createElement('button');
      button.className = `primary-btn section-tab ${activeSectionId === sectionId ? 'is-active' : ''}`;
      button.textContent = `${data.title} • ${progress}%`;
      button.addEventListener('click', () => {
        activeSectionId = sectionId;
        renderCabinet();
      });
      ui.sectionTabs.appendChild(button);
    });
  }

  function renderSectionTasks(email) {
    const section = SPACE_DATA.sections[activeSectionId];
    const doneIds = state.sections[email][activeSectionId];

    ui.sectionTitle.textContent = section.title;
    ui.sectionDescription.textContent = section.description;
    ui.tasksList.innerHTML = '';

    section.tasks.forEach((task) => {
      const done = doneIds.includes(task.id);
      const card = document.createElement('div');
      card.className = 'profile-card';
      card.innerHTML = `
        <strong>${task.label}</strong>
        <div class="pixel-label">${done ? 'Статус: выполнено' : 'Статус: в процессе'}</div>
        <button class="complete-btn" data-task-id="${task.id}">${done ? 'Готово ✓' : 'Отметить выполненным'}</button>
      `;
      ui.tasksList.appendChild(card);
    });
  }

  function renderRewards(email) {
    const rewardIds = state.rewards[email];
    ui.rewardCount.textContent = rewardIds.length;
    ui.rewardBadges.innerHTML = '';

    rewardIds.forEach((rewardId) => {
      const reward = Object.values(SPACE_DATA.rewards).find((item) => item.id === rewardId);
      if (!reward) return;
      const badge = document.createElement('div');
      badge.className = 'profile-card';
      badge.innerHTML = `<strong>${reward.title}</strong><div class="pixel-label">${reward.description}</div>`;
      ui.rewardBadges.appendChild(badge);
    });
  }

  function renderCabinet() {
    const user = currentUser();
    if (!user) {
      showView('auth');
      return;
    }

    ensureUserProgress(user.email);

    const rating = state.ratings[user.email];
    const progress = calculateOverallProgress(user.email);

    ui.welcomeTitle.textContent = `${user.name}, ваш маршрут открыт. Заполните разделы ЛК и заберите награду.`;
    ui.overallRating.textContent = rating;
    ui.overallProgress.textContent = `${progress}%`;
    ui.rewardMessage.textContent = '';

    renderTabs(user.email);
    renderSectionTasks(user.email);
    renderRewards(user.email);

    showView('cabinet');
  }

  function registerUser(name, email, password) {
    const exists = state.users.some((user) => user.email === email);
    if (exists) {
      ui.authMessage.textContent = 'Пользователь с таким email уже существует.';
      return;
    }

    state.users.push({ name, email, password });
    state.sessionEmail = email;
    ensureUserProgress(email);
    saveState();
    renderCabinet();
  }

  function loginUser(email, password) {
    const user = state.users.find((item) => item.email === email && item.password === password);
    if (!user) {
      ui.authMessage.textContent = 'Неверный email или пароль.';
      return;
    }

    state.sessionEmail = user.email;
    ensureUserProgress(user.email);
    saveState();
    renderCabinet();
  }

  function completeTask(taskId) {
    const user = currentUser();
    if (!user) return;

    const list = state.sections[user.email][activeSectionId];
    if (list.includes(taskId)) return;

    list.push(taskId);
    state.ratings[user.email] += 10;
    saveState();
    renderCabinet();
  }

  function claimReward() {
    const user = currentUser();
    if (!user) return;

    if (!allSectionsCompleted(user.email)) {
      ui.rewardMessage.textContent = 'Чтобы получить награду, завершите все разделы: история, проекты, карьера, достижения.';
      return;
    }

    const rewardId = SPACE_DATA.rewards.final.id;
    if (!state.rewards[user.email].includes(rewardId)) {
      state.rewards[user.email].push(rewardId);
      state.ratings[user.email] += 50;
      ui.rewardMessage.textContent = 'Поздравляем! Награда получена, полный сценарий завершён.';
      saveState();
      renderCabinet();
      return;
    }

    ui.rewardMessage.textContent = 'Награда уже получена ранее.';
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

  ui.tasksList.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-task-id]');
    if (!btn) return;
    completeTask(btn.dataset.taskId);
  });

  ui.claimRewardBtn.addEventListener('click', claimReward);

  ui.logoutBtn.addEventListener('click', () => {
    state.sessionEmail = null;
    saveState();
    showView('auth');
  });

  if (state.sessionEmail) {
    ensureUserProgress(state.sessionEmail);
    renderCabinet();
  } else {
    showView('auth');
    toggleAuth('login');
  }
})();
