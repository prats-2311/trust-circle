import { ButtonLink } from "./Button";
import { SIGNED_OUT } from "./fetchJson";
import { Notice } from "./Notice";

export function SignedOut() {
  return (
    <div className="mt-6 flex flex-col gap-3">
      <Notice tone="info">{SIGNED_OUT}</Notice>
      <ButtonLink href="/" variant="secondary">
        Choose a demo account
      </ButtonLink>
    </div>
  );
}
