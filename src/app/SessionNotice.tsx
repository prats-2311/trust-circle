export const SIGN_IN_AGAIN = "Please sign in again.";

export function SessionNotice() {
  return (
    <p role="alert">
      {SIGN_IN_AGAIN} <a href="/demo">Go to sign in</a>
    </p>
  );
}
