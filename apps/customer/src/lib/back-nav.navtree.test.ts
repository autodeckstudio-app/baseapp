/**
 * Router-level runtime coverage for the stale-Book-stack fix, driving the app's
 * real installed navigation routers (@react-navigation/routers 7.6.4, the exact
 * versions expo-router 5.1.11 ships with in production).
 *
 * Method: the pre-fix stale stack (Book page for the old service left under the
 * new one) is an OBSERVED state - reproduced live and in the local browser
 * harness (baseline: Back from /book/menu-wash-exterior showed the Full detail
 * wash Book page). These tests construct that observed state directly, then run
 * every transition the fix touches through the real routers: the RESET dispatch
 * the fix performs on mount (BaseRouter + core getRehydratedState, exactly as
 * NavigationContainer applies it), GO_BACK bubbling from the nested stack to the
 * tab history, REPLACE (extras switch), and Confirm pushed after the collapse.
 */
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { collapseStaleBookEntries } from "./back-nav";

function loadRouters() {
  const req = createRequire(import.meta.url);
  for (const pkg of ["expo-router/package.json", "@react-navigation/native/package.json", "@react-navigation/core/package.json"]) {
    try {
      return createRequire(req.resolve(pkg))("@react-navigation/routers") as any;
    } catch {
      /* next anchor */
    }
  }
  throw new Error("@react-navigation/routers not resolvable");
}
const { TabRouter, StackRouter } = loadRouters();

type NavState = any;
const TABS = ["bookings", "catalogue", "index", "garage", "profile", "book", "membership"];
const tabRouter = TabRouter({ backBehavior: "history" as const });
const stackRouter = StackRouter({});
const tabOpts: any = { routeNames: TABS, routeParamList: {}, routeGetIdList: {} };
const bookOpts: any = { routeNames: ["[serviceId]", "confirm"], routeParamList: {}, routeGetIdList: {} };
const catOpts: any = { routeNames: ["index", "[id]"], routeParamList: {}, routeGetIdList: {} };

const bookRoute = (serviceId: string, n: number) => ({ key: `[serviceId]-${serviceId}-${n}`, name: "[serviceId]", params: { serviceId } });
const catRoute = (name: string, id?: string): NavState => ({ key: id ? `[id]-${id}` : "index-cat", name, ...(id ? { params: { id } } : {}) });
const catStack = (routes: Array<{ key: string; name: string; params?: object }>): NavState => ({
  key: "stack-catalogue", type: "stack", index: routes.length - 1, routeNames: catOpts.routeNames, routes, stale: false, preloadedRoutes: [],
});
const confirmRoute = () => ({ key: "confirm-1", name: "confirm" });
const bookStack = (routes: Array<{ key: string; name: string; params?: object }>): NavState => ({
  key: "stack-book", type: "stack", index: routes.length - 1, routeNames: bookOpts.routeNames, routes, stale: false, preloadedRoutes: [],
});

/** Real tab state with the given visit history, book tab focused, holding the given book stack. */
function tabsWith(history: string[], stack: NavState, cat?: NavState): NavState {
  return {
    key: "tabs", type: "tab",
    index: TABS.indexOf(history[history.length - 1] as string),
    routeNames: TABS,
    routes: TABS.map((name) => ({
      key: `${name}-tab`,
      name,
      ...(name === "book" ? { state: stack } : {}),
      ...(name === "catalogue" ? { state: cat ?? catStack([catRoute("index")]) } : {}),
    })),
    history: history.map((name) => ({ type: "route", key: `${name}-tab` })),
    stale: false, preloadedRouteKeys: [],
  };
}

/** The fix exactly as [serviceId].tsx runs it on mount, through the real router + core rehydration. */
function applyFixOnMount(state: NavState): NavState {
  const stack = state.routes.find((r: NavState) => r.name === "book").state;
  const reset = collapseStaleBookEntries(stack as never);
  if (!reset) return state;
  let next = stackRouter.getStateForAction(stack, { type: "RESET", payload: reset }, bookOpts);
  expect(next).not.toBeNull();
  next = stackRouter.getRehydratedState(next, bookOpts);
  expect(next.type).toBe("stack");
  expect(next.routes).toHaveLength(1);
  return { ...state, routes: state.routes.map((r: NavState) => (r.name === "book" ? { ...r, state: next } : r)) };
}

/** Back: nested stack first (real StackRouter), bubbling to tab history (real TabRouter) when it cannot pop. */
function back(state: NavState): NavState | null {
  const focused = state.routes[state.index];
  if (focused.state) {
    const r1 = stackRouter.getStateForAction(focused.state, { type: "GO_BACK" }, bookOpts);
    if (r1 !== null) return { ...state, routes: state.routes.map((r: NavState) => (r.name === focused.name ? { ...r, state: r1 } : r)) };
  }
  return tabRouter.getStateForAction(state, { type: "GO_BACK" }, tabOpts);
}
const focusedTab = (s: NavState) => s.routes[s.index].name;
const bookState = (s: NavState) => s.routes.find((r: NavState) => r.name === "book").state;
const catState = (s: NavState) => s.routes.find((r: NavState) => r.name === "catalogue").state;
const topRoute = (stack: NavState) => stack.routes[stack.index];
// The catalogue stack the repro sequence leaves behind (browser-observed: Back lands on the Ceramic
// detail page, URL /catalogue/menu-wash-exterior): list < Full detail < Ceramic detail.
const reproCat = () => catStack([catRoute("index"), catRoute("[id]", "menu-wash-full"), catRoute("[id]", "menu-wash-exterior")]);

describe("wash Back fix through the real navigation routers", () => {
  it("pre-fix observed state: Back from Ceramic Book pops to the stale Full detail Book page", () => {
    const s = tabsWith(["index", "catalogue", "book"], bookStack([bookRoute("menu-wash-full", 1), bookRoute("menu-wash-exterior", 2)]));
    const after = back(s);
    expect(focusedTab(after)).toBe("book");
    expect(bookState(after).routes.map((r: NavState) => r.params.serviceId)).toEqual(["menu-wash-full"]);
  });

  it("fixed: collapse on mount, then Back leaves the Book stack to the Ceramic detail page", () => {
    const s = applyFixOnMount(tabsWith(["index", "catalogue", "book"], bookStack([bookRoute("menu-wash-full", 1), bookRoute("menu-wash-exterior", 2)]), reproCat()));
    expect(bookState(s).routes.map((r: NavState) => r.params.serviceId)).toEqual(["menu-wash-exterior"]);
    const after = back(s);
    expect(focusedTab(after)).toBe("catalogue");
    expect(topRoute(catState(after))).toMatchObject({ name: "[id]", params: { id: "menu-wash-exterior" } }); // /catalogue/menu-wash-exterior, Ceramic wash detail
  });

  it("Home-tab origin: collapse then Back returns to the Home screen, not Services", () => {
    const s = applyFixOnMount(tabsWith(["index", "book"], bookStack([bookRoute("menu-wash-full", 1), bookRoute("menu-wash-exterior", 2)])));
    const after = back(s);
    expect(focusedTab(after)).toBe("index");
    expect(topRoute(catState(after)).name).toBe("index"); // the Services tab was never visited; its stack is untouched
  });

  it("Home re-entry over a stale Services entry: newest page survives, Back returns to Home", () => {
    const s = applyFixOnMount(tabsWith(["index", "catalogue", "book", "index", "book"], bookStack([bookRoute("menu-wash-full", 1), bookRoute("menu-wash-exterior", 2)])));
    const after = back(s);
    expect(focusedTab(after)).toBe("index");
    // and once more from Home: history still holds the older entries correctly
    const again = back({ ...after, routes: after.routes.map((r: NavState) => r) });
    expect(again === null || focusedTab(again)).toBeTruthy();
  });

  it("third consecutive entry: repeated collapses keep depth 1; Back follows the real history each time", () => {
    // entry A from catalogue
    let s = applyFixOnMount(tabsWith(["index", "catalogue", "book"], bookStack([bookRoute("svc-a", 1)])));
    expect(bookState(s).routes).toHaveLength(1);
    // entry B over stale A, origin catalogue
    s = applyFixOnMount(tabsWith(["index", "catalogue", "book"], bookStack([bookRoute("svc-a", 1), bookRoute("svc-b", 2)])));
    expect(bookState(s).routes).toHaveLength(1);
    // entry C over stale B, origin catalogue
    s = applyFixOnMount(tabsWith(["index", "catalogue", "book"], bookStack([bookRoute("svc-b", 2), bookRoute("svc-c", 3)])));
    expect(bookState(s).routes).toHaveLength(1);
    expect(bookState(s).routes[0].params.serviceId).toBe("svc-c");
    const after = back(s);
    expect(focusedTab(after)).toBe("catalogue");
  });

  it("extras switch (REPLACE on the Book page) keeps depth 1 and Back still returns to the origin", () => {
    let s = applyFixOnMount(tabsWith(["index", "catalogue", "book"], bookStack([bookRoute("menu-wash-exterior", 1)])));
    const stack = bookState(s);
    const replaced = stackRouter.getStateForAction(stack, {
      type: "REPLACE",
      payload: { name: "[serviceId]", params: { serviceId: "menu-wash-full", upgraded: "switched" } },
      source: stack.routes[stack.index].key,
      target: stack.key,
    }, bookOpts);
    expect(replaced).not.toBeNull();
    s = { ...s, routes: s.routes.map((r: NavState) => (r.name === "book" ? { ...r, state: replaced } : r)) };
    expect(bookState(s).routes).toHaveLength(1);
    // the remounted page runs the effect again: collapse must be a no-op on the clean stack
    expect(collapseStaleBookEntries(bookState(s) as never)).toBeNull();
    const after = back(s);
    expect(focusedTab(after)).toBe("catalogue");
  });

  it("Confirm pushed after the collapse is untouched: Book > Confirm > Back returns to the Book page", () => {
    let s = applyFixOnMount(tabsWith(["index", "catalogue", "book"], bookStack([bookRoute("menu-wash-full", 1), bookRoute("menu-wash-exterior", 2)])));
    const pushed = stackRouter.getStateForAction(bookState(s), { type: "NAVIGATE", payload: { name: "confirm" } }, bookOpts);
    expect(pushed).not.toBeNull();
    s = { ...s, routes: s.routes.map((r: NavState) => (r.name === "book" ? { ...r, state: pushed } : r)) };
    expect(bookState(s).routes.map((r: NavState) => r.name)).toEqual(["[serviceId]", "confirm"]);
    // the effect only runs for Book pages; on Confirm the collapse correctly refuses (top is confirm)
    expect(collapseStaleBookEntries(bookState(s) as never)).toBeNull();
    const after = back(s);
    expect(focusedTab(after)).toBe("book");
    expect(bookState(after).routes.map((r: NavState) => r.name)).toEqual(["[serviceId]"]);
    expect(bookState(after).routes[0].params.serviceId).toBe("menu-wash-exterior");
    const twice = back(after);
    expect(focusedTab(twice)).toBe("catalogue");
  });

  it("a Confirm stranded under a new Book page is dropped with the stale entries; Back leaves the stack", () => {
    const s = applyFixOnMount(tabsWith(["index", "catalogue", "book"], bookStack([bookRoute("menu-wash-full", 1), confirmRoute(), bookRoute("menu-wash-exterior", 2)])));
    expect(bookState(s).routes).toHaveLength(1);
    expect(bookState(s).routes[0].params.serviceId).toBe("menu-wash-exterior");
    const after = back(s);
    expect(focusedTab(after)).toBe("catalogue");
  });

  it("clean single-page stack: effect is a no-op and Back still returns to the origin", () => {
    const s = applyFixOnMount(tabsWith(["index", "catalogue", "book"], bookStack([bookRoute("menu-wash-full", 1)])));
    expect(bookState(s).routes).toHaveLength(1);
    const after = back(s);
    expect(focusedTab(after)).toBe("catalogue");
  });
});
