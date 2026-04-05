(function () {
  function renderTopics(container) {
    const topics = window.MOCK_DATA.forumTopics;
    container.innerHTML = topics
      .map(
        (t) => `
        <a class="card" href="/forum/${t.id}/">
          <h3>${t.title}</h3>
          <p>Автор: ${t.author} · ${t.createdAt}</p>
        </a>
      `
      )
      .join('');
  }

  function renderTopicPage(topicId, list, form) {
    const commentsStore = Store.read(Store.KEYS.forumComments, {});
    const topic = window.MOCK_DATA.forumTopics.find((t) => t.id === topicId);
    if (!topic) return;

    document.getElementById('topic-title').textContent = topic.title;

    function draw() {
      const comments = commentsStore[topicId] || [];
      list.innerHTML = comments
        .map((c) => `<li class="card"><strong>${c.user}</strong><p>${c.text}</p><small>${new Date(c.createdAt).toLocaleString()}</small></li>`)
        .join('');
    }

    draw();

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = Store.getCurrentUser();
      if (!user) return;
      const text = String(new FormData(form).get('text') || '').trim();
      if (!text) return;
      commentsStore[topicId] = commentsStore[topicId] || [];
      commentsStore[topicId].push({ id: crypto.randomUUID(), user: user.name, text, createdAt: new Date().toISOString() });
      Store.write(Store.KEYS.forumComments, commentsStore);
      Progress.recordEvent(user.id, 'FORUM_COMMENT', { topicId });
      form.reset();
      draw();
    });
  }

  window.Forum = { renderTopics, renderTopicPage };
})();
