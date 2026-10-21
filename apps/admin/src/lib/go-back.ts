/** Back goes to where the person came from. Only when there is no earlier page in this tab (a pasted or opened link) does it go to the list. */
export function goBackOrTo(router: { back: () => void; push: (href: string) => void }, fallback: string, historyLength: number = typeof window === "undefined" ? 0 : window.history.length): void {
  if (historyLength > 1) router.back();
  else router.push(fallback);
}
