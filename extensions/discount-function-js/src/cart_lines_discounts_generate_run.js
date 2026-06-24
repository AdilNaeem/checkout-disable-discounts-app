/**
  * @typedef {import("../generated/api").CartInput} RunInput
  * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
  */

const ALLOWED_DISCOUNT_CODES = [
  'EXTRA10',
  'SALE10',
  'adv',
  'ref',
  'XJGTSRZD1F8E',
];

/**
  * @param {RunInput} input
  * @returns {CartLinesDiscountsGenerateRunResult}
  */
export function cartLinesDiscountsGenerateRun(input) {
  const enabled = input.shop?.metafield?.value === "true";
  if (!enabled) return { operations: [] };

  const operations = [];

  const enteredCodes = input.enteredDiscountCodes ?? [];

  const codesToReject = enteredCodes.filter(({ code, rejectable }) => {
    if (!rejectable) return false;
    const normalizedCode = code.toUpperCase().trim();
    const isAllowed = ALLOWED_DISCOUNT_CODES.some(
      c => normalizedCode.startsWith(c.toUpperCase().trim())
    );
    return !isAllowed;
  });

  if (codesToReject.length > 0) {
    operations.push({
      enteredDiscountCodesReject: {
        codes: codesToReject.map(({ code }) => ({ code })),
        message: 'Black Card points and discount codes cannot be used during the BOXRAW Summer Sale.',
      },
    });
    return { operations };
  }

  return { operations: [] };
}
