(function () {
  function register(form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const name = String(formData.get('name') || '').trim();
      const email = String(formData.get('email') || '').trim().toLowerCase();
      const password = String(formData.get('password') || '').trim();

      const users = Store.read(Store.KEYS.users, []);
      if (users.some((u) => u.email === email)) {
        alert('Пользователь с таким email уже существует.');
        return;
      }

      const user = {
        id: crypto.randomUUID(),
        name,
        email,
        password,
        points: 0,
        createdAt: new Date().toISOString(),
        achievements: [],
        rewards: [],
        studiedSections: {},
        readNews: false
      };

      users.push(user);
      Store.write(Store.KEYS.users, users);
      Store.write(Store.KEYS.session, user);
      window.location.href = '/';
    });
  }

  function login(form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const email = String(formData.get('email') || '').trim().toLowerCase();
      const password = String(formData.get('password') || '').trim();
      const users = Store.read(Store.KEYS.users, []);
      const user = users.find((u) => u.email === email && u.password === password);
      if (!user) {
        alert('Неверный email или пароль.');
        return;
      }
      Store.write(Store.KEYS.session, user);
      window.location.href = '/';
    });
  }

  function logout(button) {
    button?.addEventListener('click', () => {
      localStorage.removeItem(Store.KEYS.session);
      window.location.href = '/auth/login/';
    });
  }

  window.Auth = { register, login, logout };
})();
