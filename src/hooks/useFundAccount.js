import { useCallback, useState } from "react";
import { shelbyClient } from "../utils/shelbyClient";

const DEFAULT_FUNDING_AMOUNT = 1_000_000_000;

async function withRetry(fn, options = {}) {
  const { maxRetries = 3, maxDelayMs = 15000, initialDelayMs = 1000 } = options;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) break;

      const baseDelay = initialDelayMs * 2 ** attempt;
      const jitter = Math.random() * 0.3 * baseDelay;
      const delay = Math.min(baseDelay + jitter, maxDelayMs);

      console.log(
        `Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export function useFundAccount() {
  const [isFunding, setIsFunding] = useState(false);
  const [error, setError] = useState(null);

  const fundAccount = useCallback(async (storageAccountAddress) => {
    setIsFunding(true);
    setError(null);

    try {
      const results = {};

      await Promise.all([
        withRetry(() =>
          shelbyClient.fundAccountWithShelbyUSD({
            address: storageAccountAddress,
            amount: DEFAULT_FUNDING_AMOUNT,
          })
        ).then(() => {
          results.shelbyUsd = true;
        }),
        withRetry(() =>
          shelbyClient.fundAccountWithAPT({
            address: storageAccountAddress,
            amount: DEFAULT_FUNDING_AMOUNT,
          })
        ).then(() => {
          results.apt = true;
        }),
      ]);

      return {
        storageAccountAddress,
        funded: results,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error funding account (retries exhausted):", errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setIsFunding(false);
    }
  }, []);

  return {
    fundAccount,
    isFunding,
    error,
  };
}
