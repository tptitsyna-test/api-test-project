export const cartData = {
  existingCartId: 1,
  missingCartId: 999_999,
  invalidCartId: -1,
  missingProductId: 999_999,
  singleProduct: { id: 1, quantity: 1 },
  productWithMultipleUnits: { id: 1, quantity: 3 },
  productToMerge: { id: 2, quantity: 1 },
  productsToAdd: [
    { id: 1, quantity: 2 },
    { id: 2, quantity: 1 },
  ],
  productToUpdate: { id: 1, quantity: 2 },
  productWithZeroQuantity: { id: 1, quantity: 0 },
} as const;
