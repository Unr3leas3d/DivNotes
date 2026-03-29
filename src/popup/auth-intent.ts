export function createAuthIntentGuard() {
  let currentIntentId = 0;

  return {
    beginIntent() {
      currentIntentId += 1;
      return currentIntentId;
    },
    invalidateCurrentIntent() {
      currentIntentId += 1;
    },
    isCurrentIntent(intentId: number) {
      return intentId === currentIntentId;
    },
  };
}
