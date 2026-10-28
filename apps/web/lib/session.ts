// Random id per browser tab session, sent with playback reports. The API hashes it with a
// daily-rotating salt, so it can count distinct viewers without identifying anyone.
export function sessionId(): string {
  try {
    let id = sessionStorage.getItem('tunely.sid');
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem('tunely.sid', id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
