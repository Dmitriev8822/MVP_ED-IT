(function () {
  const KEYS = {
    users: 'space_users',
    session: 'space_session',
    progress: 'space_progress',
    quizAttempts: 'space_quiz_attempts',
    forumComments: 'space_forum_comments',
    activity: 'space_activity'
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function seed() {
    if (!localStorage.getItem(KEYS.users)) write(KEYS.users, []);
    if (!localStorage.getItem(KEYS.progress)) write(KEYS.progress, {});
    if (!localStorage.getItem(KEYS.quizAttempts)) write(KEYS.quizAttempts, []);
    if (!localStorage.getItem(KEYS.forumComments)) {
      write(KEYS.forumComments, {
        '1': [{ id: Date.now(), user: 'Admin', text: 'Делитесь своими наблюдениями!', createdAt: new Date().toISOString() }],
        '2': [{ id: Date.now() + 1, user: 'Admin', text: 'Можно рассказать про Artemis, JWST и другие проекты.', createdAt: new Date().toISOString() }]
      });
    }
    if (!localStorage.getItem(KEYS.activity)) write(KEYS.activity, []);
  }

  function getCurrentUser() {
    return read(KEYS.session, null);
  }

  function requireAuth() {
    if (!getCurrentUser()) {
      window.location.href = '/auth/login/';
    }
  }

  function updateUserInList(user) {
    const users = read(KEYS.users, []);
    const next = users.map((u) => (u.id === user.id ? user : u));
    write(KEYS.users, next);
    write(KEYS.session, user);
  }

  window.Store = { KEYS, read, write, seed, getCurrentUser, requireAuth, updateUserInList };
})();
