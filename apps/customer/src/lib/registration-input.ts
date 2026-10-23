/** Typing rule for registration/RC number inputs: no spaces, upper case, at most 10 characters. Input only; stored values are never rewritten. */
export function limitRegistrationInput(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase().slice(0, 10);
}
