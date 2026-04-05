(function () {
  function currentSection(slug) {
    return window.MOCK_DATA.sections.find((s) => s.slug === slug);
  }

  function updatePlanetProgress() {
    const user = Store.getCurrentUser();
    if (!user) return;
    const progress = Progress.getUserProgress(user.id);
    document.querySelectorAll('[data-planet]').forEach((planet) => {
      const slug = planet.dataset.planet;
      const ratio = Number(progress.planets[slug] || 0);
      planet.style.setProperty('--planet-glow', String(Math.min(0.95, 0.2 + ratio * 0.75)));
      const badge = planet.querySelector('.planet-progress');
      if (badge) badge.textContent = `${Math.round(ratio * 100)}%`;
    });
  }

  function initHome() {
    Store.requireAuth();
    const user = Store.getCurrentUser();
    document.getElementById('hello-user').textContent = user.name;
    document.getElementById('user-points').textContent = String(user.points);
    updatePlanetProgress();
    Auth.logout(document.getElementById('logout-btn'));

    const preview = document.getElementById('forum-preview');
    Forum.renderTopics(preview);
  }

  function initSection(slug) {
    Store.requireAuth();
    const user = Store.getCurrentUser();
    const section = currentSection(slug);
    if (!section) return;
    const progress = Progress.getUserProgress(user.id);

    document.getElementById('section-title').textContent = section.title;
    document.getElementById('section-description').textContent = section.description || '';

    const list = document.getElementById('materials');
    list.innerHTML = (section.materialBlocks || [])
      .map((m) => {
        const done = progress.completedBlocks[m.id];
        return `<article class="card">
          <h3>${m.title}</h3>
          <p>${m.text}</p>
          <button class="btn ${done ? 'btn-muted' : ''}" data-block="${m.id}">${done ? 'Изучено' : 'Отметить как изученное'}</button>
        </article>`;
      })
      .join('');

    list.querySelectorAll('[data-block]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.block;
        if (progress.completedBlocks[id]) return;
        progress.completedBlocks[id] = true;
        const total = (section.materialBlocks || []).length;
        const done = (section.materialBlocks || []).filter((b) => progress.completedBlocks[b.id]).length;
        progress.planets[slug] = done / total;
        Progress.setUserProgress(user.id, progress);
        Progress.addPoints(user, 5, `Изучен блок ${id}`);
        btn.textContent = 'Изучено';
        btn.classList.add('btn-muted');
      });
    });
  }

  function initQuiz(slug) {
    Store.requireAuth();
    const user = Store.getCurrentUser();
    const section = currentSection(slug);
    if (!section?.quiz) return;
    const quiz = section.quiz;
    const form = document.getElementById('quiz-form');
    const result = document.getElementById('quiz-result');
    document.getElementById('quiz-title').textContent = quiz.title;

    form.innerHTML = quiz.questions
      .map(
        (q, qi) => `
      <fieldset class="card">
        <legend>${qi + 1}. ${q.question}</legend>
        ${q.options
          .map(
            (o, oi) => `<label class="option"><input type="radio" name="${q.id}" value="${oi}" required /> ${o}</label>`
          )
          .join('')}
      </fieldset>`
      )
      .join('');

    form.insertAdjacentHTML('beforeend', '<button class="btn" type="submit">Завершить тест</button>');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let correct = 0;
      quiz.questions.forEach((q) => {
        const picked = Number(new FormData(form).get(q.id));
        if (picked === q.answer) correct += 1;
      });
      const ratio = correct / quiz.questions.length;
      const passed = ratio >= 0.7;
      const progress = Progress.getUserProgress(user.id);
      const alreadyPassed = !!progress.sectionQuizzes[slug]?.passed;

      progress.sectionQuizzes[slug] = { passed, correct, total: quiz.questions.length, at: new Date().toISOString() };
      progress.planets[slug] = Math.max(progress.planets[slug] || 0, passed ? 1 : 0.7);
      Progress.setUserProgress(user.id, progress);

      Store.write(Store.KEYS.quizAttempts, [
        ...Store.read(Store.KEYS.quizAttempts, []),
        { id: crypto.randomUUID(), userId: user.id, slug, correct, total: quiz.questions.length, passed, createdAt: new Date().toISOString() }
      ]);

      if (passed && !alreadyPassed) {
        Progress.addPoints(user, quiz.points, `Пройден тест ${slug}`);
      }
      Progress.recordEvent(user.id, 'QUIZ_ATTEMPT', { slug, correct, passed });
      result.textContent = passed
        ? `Тест пройден: ${correct}/${quiz.questions.length}. Начислено ${alreadyPassed ? 0 : quiz.points} баллов.`
        : `Пока не пройдено: ${correct}/${quiz.questions.length}. Нужно минимум 70%.`;
    });
  }

  function initNews() {
    Store.requireAuth();
    const user = Store.getCurrentUser();
    const section = currentSection('news');
    const progress = Progress.getUserProgress(user.id);

    const list = document.getElementById('news-list');
    list.innerHTML = section.news
      .map((n) => {
        const read = progress.viewedNewsIds.includes(n.id);
        return `<article class="card"><h3>${n.title}</h3><small>${n.date}</small><p>${n.summary}</p>
        <button class="btn ${read ? 'btn-muted' : ''}" data-news="${n.id}">${read ? 'Прочитано' : 'Отметить как прочитанное'}</button></article>`;
      })
      .join('');

    list.querySelectorAll('[data-news]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.news;
        if (!progress.viewedNewsIds.includes(id)) {
          progress.viewedNewsIds.push(id);
          const ratio = progress.viewedNewsIds.length / section.news.length;
          progress.planets.news = ratio;
          const firstComplete = ratio === 1 && !user.readNews;
          if (firstComplete) {
            user.readNews = true;
            Progress.addPoints(user, section.readPoints, 'Прочитаны новости');
          } else {
            Store.updateUserInList(user);
          }
          Progress.setUserProgress(user.id, progress);
          btn.textContent = 'Прочитано';
          btn.classList.add('btn-muted');
        }
      });
    });
  }

  function initSuccess() {
    Store.requireAuth();
    const section = currentSection('success');
    document.getElementById('success-list').innerHTML = section.stories
      .map((s) => `<article class="card"><h3>${s.name}</h3><p>${s.achievement}</p></article>`)
      .join('');
  }

  function initProfile() {
    Store.requireAuth();
    const user = Store.getCurrentUser();
    const progress = Progress.getUserProgress(user.id);
    document.getElementById('profile-name').textContent = user.name;
    document.getElementById('profile-email').textContent = user.email;
    document.getElementById('profile-points').textContent = String(user.points);

    const rewards = window.MOCK_DATA.rewards
      .map((r) => `<li>${user.rewards.includes(r.id) ? '🏅' : '○'} ${r.title} (${r.minPoints}+)</li>`)
      .join('');
    document.getElementById('reward-list').innerHTML = rewards;

    document.getElementById('studied-planets').innerHTML = Object.entries(progress.planets)
      .map(([slug, value]) => `<li>${slug}: ${Math.round(value * 100)}%</li>`)
      .join('') || '<li>Пока нет изученных разделов.</li>';

    const fileInput = document.getElementById('achievement-file');
    const fileList = document.getElementById('uploaded-achievements');
    function drawFiles() {
      fileList.innerHTML = (progress.uploadedAchievements || [])
        .map((f) => `<li>${f.name} · ${new Date(f.at).toLocaleString()}</li>`)
        .join('') || '<li>Файлы пока не загружены.</li>';
    }
    drawFiles();
    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      progress.uploadedAchievements = progress.uploadedAchievements || [];
      progress.uploadedAchievements.push({ name: file.name, at: new Date().toISOString() });
      Progress.setUserProgress(user.id, progress);
      Progress.recordEvent(user.id, 'ACHIEVEMENT_UPLOADED', { name: file.name });
      drawFiles();
    });

    const events = Store.read(Store.KEYS.activity, []).filter((e) => e.userId === user.id).slice(0, 10);
    document.getElementById('activity-list').innerHTML = events
      .map((e) => `<li>${new Date(e.createdAt).toLocaleString()} — ${e.type}</li>`)
      .join('') || '<li>Активность пока пуста.</li>';

    Auth.logout(document.getElementById('logout-btn'));
  }

  function initForumList() {
    Store.requireAuth();
    Forum.renderTopics(document.getElementById('forum-topics'));
  }

  function initForumTopic() {
    Store.requireAuth();
    const topicId = document.body.dataset.topicId;
    Forum.renderTopicPage(topicId, document.getElementById('comments'), document.getElementById('comment-form'));
  }

  function boot() {
    Store.seed();
    const page = document.body.dataset.page;
    if (page === 'login') Auth.login(document.getElementById('login-form'));
    if (page === 'register') Auth.register(document.getElementById('register-form'));
    if (page === 'home') initHome();
    if (page === 'section') initSection(document.body.dataset.slug);
    if (page === 'quiz') initQuiz(document.body.dataset.slug);
    if (page === 'news') initNews();
    if (page === 'success') initSuccess();
    if (page === 'profile') initProfile();
    if (page === 'forum') initForumList();
    if (page === 'forum-topic') initForumTopic();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
