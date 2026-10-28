/** Typing rule for registration/RC number inputs: no spaces, upper case, at most 10 characters. Input only; stored values are never rewritten. */
/** Native maxLength for these fields. It must be larger than 10: the browser clips RAW text before onChange, so a pasted 'mh 12 cd 5678 99' would lose its tail before spaces are stripped. The 10-character cap is applied AFTER stripping, in limitRegistrationInput. */
export const REG_RAW_MAX = 40;

export function limitRegistrationInput(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase().slice(0, 10);
}
