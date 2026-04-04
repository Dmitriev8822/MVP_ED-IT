(() => {
  const STORAGE_KEY = 'kosmos_rus_state_v1';
  const SECTION_IDS = Object.keys(SPACE_DATA.sections);

  const state = loadState();
  let activeSectionId = null;

  const views = {
    home: document.getElementById('home-view'),
    section: document.getElementById('section-view'),
    quiz: document.getElementById('quiz-view'),
    profile: document.getElementById('profile-view'),
    forum: document.getElementById('forum-view')
  };

  const ui = {
    overallProgress: document.getElementById('overall-progress'),
    overallRating: document.getElementById('overall-rating'),
    sectionTitle: document.getElementById('section-title'),
    sectionDescription: document.getElementById('section-description'),
    sectionProgress: document.getElementById('section-progress'),
    materialsList: document.getElementById('materials-list'),
    startQuizBtn: document.getElementById('start-quiz-btn'),
    quizTitle: document.getElementById('quiz-title'),
    quizSubtitle: document.getElementById('quiz-subtitle'),
    quizForm: document.getElementById('quiz-form'),
    submitQuizBtn: document.getElementById('submit-quiz-btn'),
    quizResult: document.getElementById('quiz-result'),
    profileRating: document.getElementById('profile-rating'),
    profileProgress: document.getElementById('profile-progress'),
    profileSections: document.getElementById('profile-sections')
  };

  function analytics(eventName, payload = {}) {
    // Stub for future analytics integration.
    console.log('[analytics]', eventName, payload);
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialState();
    }

    try {
      const parsed = JSON.parse(raw);
      return {
        rating: Number(parsed.rating) || 0,
        sections: SECTION_IDS.reduce((acc, id) => {
          const saved = parsed.sections?.[id] || {};
          acc[id] = {
            completedMaterials: Array.isArray(saved.completedMaterials) ? saved.completedMaterials : [],
            quizCompleted: Boolean(saved.quizCompleted)
          };
          return acc;
        }, {})
      };
    } catch (error) {
      return createInitialState();
    }
  }

  function createInitialState() {
    return {
      rating: 0,
      sections: SECTION_IDS.reduce((acc, id) => {
        acc[id] = { completedMaterials: [], quizCompleted: false };
        return acc;
      }, {})
    };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function showView(viewKey) {
    Object.values(views).forEach((view) => view.classList.remove('view-active'));
    views[viewKey].classList.add('view-active');
    analytics('page_view', { view: viewKey });
  }

  function calculateSectionProgress(sectionId) {
    const data = SPACE_DATA.sections[sectionId];
    const saved = state.sections[sectionId];
    const totalUnits = data.materials.length + 1;
    const doneMaterials = saved.completedMaterials.length;
    const doneQuiz = saved.quizCompleted ? 1 : 0;
    return Math.round(((doneMaterials + doneQuiz) / totalUnits) * 100);
  }

  function calculateOverallProgress() {
    const total = SECTION_IDS.reduce((acc, id) => acc + calculateSectionProgress(id), 0);
    return Math.round(total / SECTION_IDS.length);
  }

  function updateGlobalStats() {
    const overall = calculateOverallProgress();
    ui.overallProgress.textContent = `${overall}%`;
    ui.overallRating.textContent = state.rating;
    ui.profileProgress.textContent = `${overall}%`;
    ui.profileRating.textContent = state.rating;
  }

  function renderProfile() {
    updateGlobalStats();
    ui.profileSections.innerHTML = '';

    SECTION_IDS.forEach((id) => {
      const section = SPACE_DATA.sections[id];
      const progress = calculateSectionProgress(id);
      const block = document.createElement('div');
      block.className = 'profile-card';
      block.innerHTML = `
        <strong>${section.title}</strong>
        <div class="pixel-label">Прогресс: ${progress}%</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
      `;
      ui.profileSections.appendChild(block);
    });
  }

  function renderSection(sectionId) {
    activeSectionId = sectionId;
    const section = SPACE_DATA.sections[sectionId];
    const saved = state.sections[sectionId];

    ui.sectionTitle.textContent = section.title;
    ui.sectionDescription.textContent = section.description;
    ui.sectionProgress.textContent = `${calculateSectionProgress(sectionId)}%`;
    ui.materialsList.innerHTML = '';

    section.materials.forEach((material, index) => {
      const isDone = saved.completedMaterials.includes(material.id);
      const card = document.createElement('article');
      card.className = `material-card ${index % 2 === 1 ? 'reverse' : ''}`;
      card.innerHTML = `
        <img class="material-img" src="${material.image}" alt="${material.title}" />
        <div class="material-text">
          <h2>${material.title}</h2>
          <p>${material.text}</p>
          <button class="complete-btn" data-material-id="${material.id}">
            ${isDone ? 'Пройдено ✓' : 'Отметить как изученное'}
          </button>
        </div>
      `;
      ui.materialsList.appendChild(card);
    });

    analytics('material_open', { sectionId });
    showView('section');
  }

  function renderQuiz(sectionId) {
    const section = SPACE_DATA.sections[sectionId];
    ui.quizTitle.textContent = section.quiz.title;
    ui.quizSubtitle.textContent = `Раздел: ${section.title}`;
    ui.quizResult.textContent = '';

    ui.quizForm.innerHTML = section.quiz.questions
      .map(
        (q, idx) => `
          <fieldset class="material-card" style="grid-template-columns:1fr; margin: 0 0 0.8rem 0;">
            <legend><strong>${idx + 1}. ${q.prompt}</strong></legend>
            ${q.options
              .map(
                (option, optionIdx) => `
              <label>
                <input type="radio" name="${q.id}" value="${optionIdx}" required /> ${option}
              </label>`
              )
              .join('')}
          </fieldset>
        `
      )
      .join('');

    analytics('quiz_start', { sectionId });
    showView('quiz');
  }

  function completeMaterial(sectionId, materialId) {
    const sectionState = state.sections[sectionId];
    if (!sectionState.completedMaterials.includes(materialId)) {
      sectionState.completedMaterials.push(materialId);
      saveState();
      updateGlobalStats();
      analytics('material_complete', { sectionId, materialId });
      renderSection(sectionId);
    }
  }

  function completeQuiz(sectionId, score, total) {
    const sectionState = state.sections[sectionId];
    if (!sectionState.quizCompleted) {
      sectionState.quizCompleted = true;
      const delta = score * 10;
      state.rating += delta;
      analytics('rating_changed', { delta, rating: state.rating });
    }

    saveState();
    updateGlobalStats();
    renderProfile();
    analytics('quiz_complete', { sectionId, score, total });
  }

  document.getElementById('planet-map').addEventListener('click', (event) => {
    const btn = event.target.closest('.planet');
    if (!btn) return;

    if (btn.dataset.section) {
      const sectionId = btn.dataset.section;
      analytics('planet_click', { sectionId });
      renderSection(sectionId);
      return;
    }

    if (btn.dataset.view) {
      const viewId = btn.dataset.view;
      analytics('planet_click', { viewId });
      if (viewId === 'profile-view') {
        renderProfile();
        showView('profile');
      }
      if (viewId === 'forum-view') {
        showView('forum');
      }
    }
  });

  ui.materialsList.addEventListener('click', (event) => {
    const btn = event.target.closest('.complete-btn');
    if (!btn || !activeSectionId) return;
    completeMaterial(activeSectionId, btn.dataset.materialId);
  });

  ui.startQuizBtn.addEventListener('click', () => {
    if (!activeSectionId) return;
    renderQuiz(activeSectionId);
  });

  ui.submitQuizBtn.addEventListener('click', () => {
    if (!activeSectionId) return;
    const section = SPACE_DATA.sections[activeSectionId];
    const formData = new FormData(ui.quizForm);
    let score = 0;

    section.quiz.questions.forEach((q) => {
      const answer = Number(formData.get(q.id));
      if (answer === q.answer) score += 1;
    });

    ui.quizResult.textContent = `Результат: ${score} из ${section.quiz.questions.length}`;
    completeQuiz(activeSectionId, score, section.quiz.questions.length);
  });

  document.querySelectorAll('[data-go-home]').forEach((btn) => {
    btn.addEventListener('click', () => showView('home'));
  });

  document.querySelector('[data-back-section]').addEventListener('click', () => {
    if (activeSectionId) renderSection(activeSectionId);
  });

  updateGlobalStats();
  renderProfile();
  analytics('page_view', { view: 'home' });
})();
