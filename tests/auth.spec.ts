import { test, expect } from '@playwright/test';
import { testUser } from './config/env';

function expectValidJwt(token: string): void {
  const parts = token.split('.');

  expect(parts, 'JWT должен состоять из трёх частей').toHaveLength(3);
  expect(parts.every((part) => part.length > 0), 'Все части JWT должны быть непустыми').toBe(true);
}

test.describe('Auth API', () => {
  test('POST /auth/login — авторизация с корректными данными', async ({ request }) => {
    const response = await request.post('/auth/login', { data: { username: testUser.username, password: testUser.password, expiresInMins: 30 } });
    const body = await response.json();

    expect(response.status(), 'Успешная авторизация должна вернуть статус 200').toBe(200);
    expect(body, 'Ответ авторизации должен содержать данные тестового пользователя').toMatchObject({ id: testUser.id, username: testUser.username, email: testUser.email });
    expectValidJwt(body.accessToken);
    expectValidJwt(body.refreshToken);
    expect(body.accessToken, 'Access token и refresh token должны различаться').not.toBe(body.refreshToken);
  });

  test('POST /auth/login — ошибка при неверном пароле', async ({ request }) => {
    const response = await request.post('/auth/login', { data: { username: testUser.username, password: 'incorrect-password' } });

    expect(response.status(), 'Неверный пароль должен вернуть статус 400').toBe(400);
    expect((await response.json()).message, 'Текст ошибки авторизации').toBe('Invalid credentials');
  });

  test('POST /auth/login — ошибка без поля username', async ({ request }) => {
    const response = await request.post('/auth/login', { data: { password: testUser.password } });

    expect(response.status(), 'Отсутствие поля username должно вернуть статус 400').toBe(400);
    expect((await response.json()).message, 'Текст ошибки без поля username').toBe('Username and password required');
  });

  test('POST /auth/login — ошибка без поля password', async ({ request }) => {
    const response = await request.post('/auth/login', { data: { username: testUser.username } });

    expect(response.status(), 'Отсутствие поля password должно вернуть статус 400').toBe(400);
    expect((await response.json()).message, 'Текст ошибки без поля password').toBe('Username and password required');
  });

  test('GET /auth/me — получение пользователя по Bearer-токену', async ({ request }) => {
    const loginResponse = await request.post('/auth/login', { data: { username: testUser.username, password: testUser.password } });
    expect(loginResponse.status(), 'Предварительная авторизация для получения токена должна быть успешной').toBe(200);

    const { accessToken } = await loginResponse.json();

    const response = await request.get('/auth/me', { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json();

    expect(response.status(), 'Запрос /auth/me с валидным токеном должен вернуть 200').toBe(200);
    expect(body, '/auth/me должен вернуть данные авторизованного пользователя').toMatchObject({ id: testUser.id, username: testUser.username, email: testUser.email });
  });

  test('GET /auth/me — запрос без токена отклоняется', async ({ request }) => {
    const response = await request.get('/auth/me');

    expect(response.status(), 'Запрос без токена должен вернуть статус 401').toBe(401);
    expect((await response.json()).message, 'Текст ошибки авторизации').toBe('Access Token is required');
  });

  test('GET /auth/me — запрос с некорректным токеном отклоняется', async ({ request }) => {
    const response = await request.get('/auth/me', { headers: { Authorization: 'Bearer invalid-token' } });

    expect(response.status(), 'Некорректный токен должен вернуть статус 401').toBe(401);
    expect((await response.json()).message, 'Текст ошибки авторизации').toBe('Invalid/Expired Token!');
  });
});
