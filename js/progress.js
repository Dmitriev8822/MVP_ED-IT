(function () {
  function getUserProgress(userId) {
    const all = Store.read(Store.KEYS.progress, {});
    return all[userId] || {
      completedBlocks: {},
      sectionQuizzes: {},
      viewedNewsIds: [],
      planets: {},
      uploadedAchievements: []
    };
  }

  function setUserProgress(userId, progress) {
    const all = Store.read(Store.KEYS.progress, {});
    all[userId] = progress;
    Store.write(Store.KEYS.progress, all);
  }

  function recordEvent(userId, type, payload) {
    const events = Store.read(Store.KEYS.activity, []);
    events.unshift({ id: crypto.randomUUID(), userId, type, payload, createdAt: new Date().toISOString() });
    Store.write(Store.KEYS.activity, events.slice(0, 200));
  }

  function ensureRewards(user) {
    const rewards = window.MOCK_DATA.rewards.filter((r) => user.points >= r.minPoints);
    user.rewards = [...new Set(rewards.map((r) => r.id))];
    Store.updateUserInList(user);
  }

  function addPoints(user, points, reason) {
    user.points += points;
    Store.updateUserInList(user);
    recordEvent(user.id, 'POINTS_EARNED', { points, reason });
    ensureRewards(user);
  }

  window.Progress = { getUserProgress, setUserProgress, addPoints, recordEvent };
})();
