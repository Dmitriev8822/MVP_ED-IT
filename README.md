# Orbit MVP (Static HTML/CSS/JS)

Полностью статический MVP-сайт на космическую тематику.

## Ограничения
- Только HTML, CSS, JavaScript.
- Без React/Next/TS/Tailwind/Bootstrap.
- Работает локально: откройте `index.html`.
- Черно-белый минималистичный интерфейс.

## Страницы
- `index.html` — космический фон и кликабельные планеты (навигация).
- `auth.html` — вход/регистрация.
- `academy.html`, `missions.html`, `engineering.html` — отдельные страницы разделов.
- `article.html` — полная статья новости.
- `profile.html` — личный кабинет (баллы, прогресс, этап трека, активность).
- `track.html` — карьерный трек и загрузка резюме.
- `forum.html`, `topic.html` — форум.
- `admin.html` — админ-панель.

## Роли
- `user` — изучение материалов, новости, тесты, форум, трек.
- `admin` — управление контентом и статусами резюме.
- `superadmin` — права admin + создание администраторов.

Тестовые аккаунты:
- `admin@cosmo.local / admin1234`
- `root@cosmo.local / root1234`

## Хранение данных
Все данные сохраняются в `localStorage` (ключ `cosmo_mvp_v2`).
