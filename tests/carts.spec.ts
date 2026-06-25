import { test, expect } from '@playwright/test';
import { testUser } from './config/env';
import { cartData } from './data/test-data';

type Cart = {
  id: number;
  products: Array<{
    id: number;
    price: number;
    quantity: number;
    total: number;
    discountPercentage: number;
    discountedPrice?: number;
    discountedTotal?: number;
  }>;
  total: number;
  discountedTotal: number;
  userId: number;
  totalProducts: number;
  totalQuantity: number;
};


test.describe('Carts API', () => {
  test('GET /carts/user/{userId} — корзины принадлежат запрошенному пользователю', async ({ request }) => {
    const response = await request.get(`/carts/user/${testUser.id}`);
    const body = await response.json();

    expect(response.status(), 'Получение корзин пользователя должно вернуть статус 200').toBe(200);
    expect(body.total, 'Поле total должно соответствовать числу корзин в ответе').toBe(body.carts.length);
    expect(body.carts.length, 'У тестового пользователя должна быть хотя бы одна корзина').toBeGreaterThan(0);

    body.carts.forEach((cart: Cart) => {
      expect(cart.userId, `Корзина ${cart.id} должна принадлежать запрошенному пользователю`).toBe(testUser.id);
    });
  });

  test('GET /carts/user/{userId} — пустой список для пользователя без корзин', async ({ request }) => {
    test.skip(true, 'В текущих данных DummyJSON у каждого пользователя есть корзина');

    const [usersResponse, cartsResponse] = await Promise.all([request.get('/users?limit=0&select=id'), request.get('/carts?limit=0')]);
    const users = await usersResponse.json();
    const carts = await cartsResponse.json();
    const userWithCartIds = new Set<number>(carts.carts.map((cart: { userId: number }) => cart.userId));
    const userWithoutCarts = users.users.find((user: { id: number }) => !userWithCartIds.has(user.id));
    const response = await request.get(`/carts/user/${userWithoutCarts.id}`);
    const body = await response.json();

    expect(response.status(), 'Получение корзин пользователя без корзин должно вернуть статус 200').toBe(200);
    expect(body, 'Ответ для пользователя без корзин должен содержать пустой список').toMatchObject({ carts: [], total: 0 });
  });

  test('GET /carts/{cartId} — получение корзины по id', async ({ request }) => {
    const response = await request.get(`/carts/${cartData.existingCartId}`);
    const cart: Cart = await response.json();

    expect(response.status(), 'Получение существующей корзины должно вернуть статус 200').toBe(200);
    expect(cart.id, 'Ответ должен содержать запрошенный ID корзины').toBe(cartData.existingCartId);
    expect(cart.products.length, 'Существующая корзина должна содержать товары').toBeGreaterThan(0);
    checkCartTotals(cart);
    checkCartPrices(cart);
  });

  test('GET /carts/{cartId} — ошибка для отрицательного id', async ({ request }) => {
    const response = await request.get(`/carts/${cartData.invalidCartId}`);

    expect(response.status(), 'Отрицательный ID корзины должен вернуть статус 404').toBe(404);
    expect((await response.json()).message, 'Текст ошибки получения корзины').toBe(`Cart with id '${cartData.invalidCartId}' not found`);
  });

  test('POST /carts/add — создание корзины с одним товаром', async ({ request }) => {
    const response = await request.post('/carts/add', { data: { userId: testUser.id, products: [cartData.singleProduct] } });
    const cart: Cart = await response.json();

    expect(response.status(), 'Создание корзины должно вернуть статус 201').toBe(201);
    expect(cart.userId, 'Созданная корзина должна принадлежать указанному пользователю').toBe(testUser.id);
    expect(cart.products, 'Созданная корзина должна содержать одну товарную позицию').toHaveLength(1);
    expect(cart.products[0], 'Корзина должна содержать переданный товар').toMatchObject(cartData.singleProduct);
    checkCartTotals(cart);
    checkCartPrices(cart);
  });

  test('POST /carts/add — создание корзины с несколькими единицами одного товара', async ({ request }) => {
    const response = await request.post('/carts/add', { data: { userId: testUser.id, products: [cartData.productWithMultipleUnits] } });
    const cart: Cart = await response.json();

    expect(response.status(), 'Создание корзины должно вернуть статус 201').toBe(201);
    expect(cart.products, 'Несколько единиц одного товара должны оставаться одной товарной позицией').toHaveLength(1);
    expect(cart.products[0], 'Количество товара должно соответствовать переданному значению').toMatchObject(cartData.productWithMultipleUnits);
    checkCartTotals(cart);
    checkCartPrices(cart);
  });

  test('POST /carts/add — создание корзины с несколькими товарами', async ({ request }) => {
    const response = await request.post('/carts/add', { data: { userId: testUser.id, products: cartData.productsToAdd } });
    const cart: Cart = await response.json();

    expect(response.status(), 'Создание корзины должно вернуть статус 201').toBe(201);
    expect(cart.id, 'Созданная корзина должна получить положительный ID').toBeGreaterThan(0);
    expect(cart.userId, 'Созданная корзина должна принадлежать указанному пользователю').toBe(testUser.id);
    expect(cart.products, 'Корзина должна содержать все переданные товары').toEqual(expect.arrayContaining([expect.objectContaining(cartData.productsToAdd[0]), expect.objectContaining(cartData.productsToAdd[1])]));
    checkCartTotals(cart);
    checkCartPrices(cart);
  });

  test('POST /carts/add — ошибка без userId', async ({ request }) => {
    const response = await request.post('/carts/add', { data: { products: [cartData.singleProduct] } });

    expect(response.status(), 'Создание корзины без userId должно вернуть статус 400').toBe(400);
    expect((await response.json()).message, 'Текст ошибки создания корзины').toBe('User id is required');
  });

  test('POST /carts/add — ошибка с пустым списком товаров', async ({ request }) => {
    const response = await request.post('/carts/add', { data: { userId: testUser.id, products: [] } });

    expect(response.status(), 'Пустой список товаров должен вернуть статус 400').toBe(400);
    expect((await response.json()).message, 'Текст ошибки создания корзины').toBe('products can not be empty');
  });

  test('POST /carts/add — неизвестный productId не добавляется в корзину', async ({ request }) => {
    const response = await request.post('/carts/add', { data: { userId: testUser.id, products: [{ id: cartData.missingProductId, quantity: 1 }] } });
    const cart: Cart = await response.json();

    expect(response.status(), 'DummyJSON принимает неизвестный productId со статусом 201').toBe(201);
    expect(cart, 'Неизвестный товар не должен попасть в созданную корзину').toMatchObject({ userId: testUser.id, products: [], totalProducts: 0, totalQuantity: 0, total: 0, discountedTotal: 0 });
  });

  test('PATCH /carts/{cartId} — замена состава корзины', async ({ request }) => {
    const response = await request.patch(`/carts/${cartData.existingCartId}`, { data: { merge: false, products: [cartData.productToUpdate] } });
    const cart: Cart = await response.json();

    expect(response.status(), 'Обновление корзины должно вернуть статус 200').toBe(200);
    expect(cart.id, 'Должна быть обновлена запрошенная корзина').toBe(cartData.existingCartId);
    expect(cart.products, 'При merge: false состав корзины должен быть заменён').toHaveLength(1);
    expect(cart.products[0], 'Корзина должна содержать переданный товар').toMatchObject(cartData.productToUpdate);
    checkCartTotals(cart);
  });

  test('PATCH /carts/{cartId} — добавление товара с merge: true', async ({ request }) => {
    const currentResponse = await request.get(`/carts/${cartData.existingCartId}`);
    expect(currentResponse.status(), 'Исходная корзина для проверки merge должна успешно загрузиться').toBe(200);
    const currentCart: Cart = await currentResponse.json();

    const response = await request.patch(`/carts/${cartData.existingCartId}`, { data: { merge: true, products: [cartData.productToMerge] } });
    const updatedCart: Cart = await response.json();

    expect(response.status(), 'PATCH с merge: true должен вернуть статус 200').toBe(200);
    expect(updatedCart.products, 'При merge: true исходные товары должны сохраниться, а новый товар добавиться').toEqual(expect.arrayContaining([...currentCart.products.map((product) => expect.objectContaining({ id: product.id, quantity: product.quantity })), expect.objectContaining(cartData.productToMerge)]));
    expect(updatedCart.totalProducts, 'После merge число товарных позиций должно увеличиться на одну').toBe(currentCart.totalProducts + 1);
    expect(updatedCart.totalQuantity, 'После merge общее количество должно учитывать добавленный товар').toBe(currentCart.totalQuantity + cartData.productToMerge.quantity);
    checkCartPrices(updatedCart);
  });

  test('PATCH /carts/{cartId} — удаление товара из корзины (замена количества товара на ноль)', async ({ request }) => {
    const response = await request.patch(`/carts/${cartData.existingCartId}`, { data: { merge: false, products: [cartData.productWithZeroQuantity] } });
    const cart = await response.json();

    expect(response.status(), 'PATCH с количеством 0 должен вернуть статус 200').toBe(200);
    expect(cart.id, 'Должна быть обновлена запрошенная корзина').toBe(cartData.existingCartId);
    expect(cart.products, 'Ответ должен содержать обновлённую товарную позицию').toHaveLength(1);
    expect(cart.products[0], 'Количество товара должно быть установлено в 0').toMatchObject(cartData.productWithZeroQuantity);
    expect(cart, 'Количество и суммы корзины должны быть пересчитаны в ноль').toMatchObject({ totalProducts: 1, totalQuantity: 0, total: 0, discountedTotal: 0 });
  });

  test('DELETE /carts/{cartId} — удаление существующей корзины', async ({ request }) => {
    const response = await request.delete(`/carts/${cartData.existingCartId}`);
    const body = await response.json();

    expect(response.status(), 'Удаление существующей корзины должно вернуть статус 200').toBe(200);
    expect(body, 'Ответ должен подтверждать удаление запрошенной корзины').toMatchObject({ id: cartData.existingCartId, isDeleted: true });
  });

  test('DELETE /carts/{cartId} — ошибка удаления несуществующей корзины', async ({ request }) => {
    const response = await request.delete(`/carts/${cartData.missingCartId}`);

    expect(response.status(), 'Удаление несуществующей корзины должно вернуть статус 404').toBe(404);
    expect((await response.json()).message, 'Текст ошибки удаления корзины').toBe(`Cart with id '${cartData.missingCartId}' not found`);
  });

  test('GET /carts/{cartId} — ошибка получения несуществующей корзины', async ({ request }) => {
    const response = await request.get(`/carts/${cartData.missingCartId}`);

    expect(response.status(), 'Получение несуществующей корзины должно вернуть статус 404').toBe(404);
    expect((await response.json()).message, 'Текст ошибки получения корзины').toBe(`Cart with id '${cartData.missingCartId}' not found`);
  });
});


//--------HELPERS

function checkCartTotals(cart: Cart): void {
  expect(cart.totalProducts, 'totalProducts должен соответствовать числу товарных позиций').toBe(cart.products.length);
  expect(cart.totalQuantity, 'totalQuantity должен соответствовать сумме количества всех товаров').toBe(cart.products.reduce((sum, product) => sum + product.quantity, 0));
}

function checkCartPrices(cart: Cart): void {
  const expectedTotal = cart.products.reduce((sum, product) => sum + product.total, 0);
  const expectedDiscountedTotal = cart.products.reduce((sum, product) => sum + (product.discountedPrice ?? product.discountedTotal ?? 0), 0);

  expect(cart.total, 'Итоговая сумма корзины должна равняться сумме товаров').toBeCloseTo(expectedTotal, 2);
  expect(cart.discountedTotal, 'Итоговая сумма со скидкой должна равняться сумме скидочных цен товаров').toBeCloseTo(expectedDiscountedTotal, 2);

  for (const product of cart.products) {
    expect(product.total, `Сумма товара ${product.id} должна равняться цене, умноженной на количество`).toBeCloseTo(product.price * product.quantity, 2);

    if (product.discountedPrice !== undefined) {
      const expectedDiscountedPrice = Math.round(product.total * (1 - product.discountPercentage / 100));
      expect(product.discountedPrice, `Скидочная цена товара ${product.id} должна быть рассчитана корректно`).toBe(expectedDiscountedPrice);
    } else if (product.discountedTotal !== undefined) {
      const expectedDiscountedTotal = product.total * (1 - product.discountPercentage / 100);
      expect(product.discountedTotal, `Сумма со скидкой для товара ${product.id} должна быть рассчитана корректно`).toBeCloseTo(expectedDiscountedTotal, 2);
    }
  }
}
