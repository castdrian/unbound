# Forcing a function-component unmount + remount from a fiber (React 19.1/19.2, RN 0.83 Fabric)

## Scope and verification basis

Everything below was verified against the **actual reconciler bundle shipped in this repo**, not from memory or docs:

- `packages/client/node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js` (19121 lines, `reconcilerVersion: "19.2.0"`)
- `packages/client/node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-prod.js` (361 KB, `reconcilerVersion: "19.2.0"`)
- `packages/client/node_modules/react-native/Libraries/Renderer/shims/ReactFabric.js` (the `__DEV__` bundle selector)
- Installed versions: `react@19.2.7`, `react-native@0.83.10`

Line numbers cited are from these local files. Both bundles are pretty-printed (not name-mangled), so prod behaviour is directly readable — this is unusually strong ground truth and I relied on it over any secondary source.

Cross-checked independently against upstream React `v19.1.0` source and published dists, which agreed on every point:

- `packages/react-refresh/src/ReactFreshRuntime.js` — https://github.com/facebook/react/blob/v19.1.0/packages/react-refresh/src/ReactFreshRuntime.js
- `packages/react-reconciler/src/ReactFiberHotReloading.js` (this exact name in 19.x; no `.new.js` variant) — https://github.com/facebook/react/blob/v19.1.0/packages/react-reconciler/src/ReactFiberHotReloading.js
- `packages/react-reconciler/src/ReactFiberBeginWork.js` — `remountFiber` at :3499, `_debugNeedsRemount` at :3815
- `packages/react-reconciler/src/ReactFiberReconciler.js` :856-880 — the `__DEV__`-gated internals payload
- `react-refresh@0.16.0` and `react-dom@19.1.0` production dists (symbol counts for `_debugNeedsRemount`, `scheduleRefresh`, `setRefreshHandler`: **0** in production, non-zero in development)
- RN integration: `packages/client/node_modules/react-native/Libraries/Core/setUpReactRefresh.js`

> **Note on versions.** The repo's installed reconciler reports **19.2.0** (catalog pins `^19.2.3`), but the **live device runs React 19.1.0** — confirmed via `ubd eval` (§0). So the upstream v19.1.0 citations are the authoritative ones, and the local 19.2.0 bundle serves as a cross-check. The reconciliation semantics this report depends on are identical across 19.0/19.1/19.2.

**§0 answers the follow-up question** (can we patch the internal comparison functions / re-wire Fast Refresh into a production build?) using live runtime probes. Short answer: no — they are closure-local and partly dead-code-eliminated. The recommendation does not need them.

---

## 0. Live runtime probe: can we patch the reconciler's comparison logic?

Asked directly: *can we monkey-patch the internal functions that do the key/type comparison, and re-wire Fast Refresh into a production build?* I probed the running device with `ubd eval`. **Answer: no — the comparison functions are module-local closures and are not reachable from any object in the runtime.** Evidence below; all probes were removed afterwards (verified: no `__ub*` globals remain).

### What the live runtime reports

| Probe | Result |
|---|---|
| `React.version` | **`19.1.0`** (matches the task premise; my `node_modules` has 19.2.0 — see §7) |
| `__DEV__` | **`false`** — production bundle |
| `typeof __REACT_DEVTOOLS_GLOBAL_HOOK__` | `object` — **present**, contrary to the task's premise |
| `hook.renderers.size` | **`0`** |
| `ReactSharedInternals` keys | `['H','A','T','S','V']` — prod-only set |
| `globalThis.__ReactRefresh` (Metro prefix) | `undefined` |
| `findByProps('scheduleRefresh','setRefreshHandler')` | **not found** |
| `findByProps('injectIntoGlobalHook')` | **not found** |
| `findByProps('performReactRefresh')` | **not found** |
| `findByProps('createSignatureFunctionForTransform')` | **not found** |
| `element._owner` on a live element | `null` (DEV-only field) |

Two corrections to the stated environment, both worth knowing:

1. **The DevTools hook *does* exist** — its key set is `renderers, supportsFiber, inject, onCommitFiberRoot, onCommitFiberUnmount, onPostCommitFiberRoot, getFiberRoots, sub, checkDCE`. That is not React DevTools' hook (no `isDisabled`, no `emit`, no `renderers` population); it is **`bippy`'s stub hook, installed by our own client**. With `renderers.size === 0` it confirms the practical conclusion you already reached: it was installed after the renderer registered, so it captured nothing and `onCommitFiberRoot` will never fire.
2. **React is 19.1.0 on device**, so the upstream v19.1.0 citations in this report are the authoritative ones.

### The renderer is reachable — but its surface is only 12 public functions

The Fabric renderer module *is* findable via metro:

```js
unbound.metro.findByProps('findHostInstance_DEPRECATED', 'createPortal')
```

Its complete export surface, live:

```
createPortal, dispatchCommand, findHostInstance_DEPRECATED, findNodeHandle,
getNodeFromInternalInstanceHandle, getPublicInstanceFromInternalInstanceHandle,
getPublicInstanceFromRootTag, isChildPublicInstance, render,
sendAccessibilityEvent, stopSurface, unmountComponentAtNode
```

All are `writable: true, configurable: true`, so they *are* patchable. But `'scheduleRefresh' in R === false` and `'setRefreshHandler' in R === false`.

**This is the crux.** `beginWork`, `reconcileChildFibersImpl`, `updateSlot`, `updateElement`, and `createWorkInProgress` are `function` declarations inside the bundle's single top-level IIFE closure. They are never assigned to any exported object and are called by direct closure reference. In JavaScript there is **no way to rebind a closure-internal function binding from outside** — patching requires a property on a reachable object, and no such property exists. Confirmed empirically: the only 12 reachable properties are the public API, none of which participate in child reconciliation.

So the three things one might hope to patch are each blocked for an independent reason:

- **`isCompatibleFamilyForHotReloading`** — the natural "re-wire" target, since it's the escape hatch that lets a type change preserve state. It is **dead-code-eliminated from the prod bundle entirely** (`grep -c` → 0). There is no function to patch.
- **`updateSlot` / `reconcileChildFibersImpl`** — exist in prod, but are closure-local. Unreachable.
- **`_debugNeedsRemount` in `beginWork`** — the branch does not exist in prod. Setting the field is an inert write.

### Could we swap in our own reconciler build?

Theoretically, yes: patch the module registry so `ReactFabric` resolves to a dev-flavoured reconciler that has the refresh helpers, install `bippy`'s hook first, then drive `scheduleRefresh`. In practice this is a non-starter and I'd recommend against pursuing it:

- It replaces the reconciler *underneath a tree Discord has already mounted*. The existing fiber tree was built by the old instance; a second reconciler cannot adopt it. You would need to remount the entire app.
- The prod↔dev fiber shapes differ (dev fibers carry `_debugOwner`, `_debugStack`, `_debugTask`, `_debugInfo`), so existing host instances and internal instance handles would be inconsistent.
- It means shipping a full second copy of the reconciler and keeping it version-locked to whatever React Discord ships — precisely the version-fragility we're trying to avoid.
- Fabric's host config is bound to `nativeFabricUIManager` and the registered surfaces; re-instantiating it risks native view leaks and duplicate surface registration.

**Conclusion on the re-wiring idea: it's a sound instinct and worth having tested, but it's structurally impossible without replacing the reconciler wholesale — and the two mechanisms that survive in production (`key` and `elementType`) already give us a guaranteed remount using nothing but public API.** The good news is that the recommendation in §4 needs none of this: it does not depend on internals, WorkTags, the DevTools hook, or dev-only fields.

---

## 0b. The BetterDiscord `utils/react.ts` reference — what transfers and what doesn't

Reviewed `src/betterdiscord/utils/react.ts` @ `aa241f9` plus the surrounding modules. Verdict up front: **it contains no remount mechanism, so it does not solve this problem** — BetterDiscord never forces a remount on unpatch. But one technique in it (`wrapInHooks`) is directly reusable for a *different* and genuinely valuable purpose, and I verified it works on our runtime.

### It does not solve the remount problem

The file's four exports are `getInternalInstance`, `getOwnerInstance`, `wrapElement`, `wrapInHooks`. None unmount anything. The only update mechanism anywhere in the codebase is `forceUpdate` on a **class** instance found by walking `fiber.return` (`builtins/store/addonstore.ts:129`):

```ts
getOwnerInstance(forward).forceUpdate();
```

`getOwnerInstance` explicitly requires a class: it walks up and returns `curr.stateNode` only when it's truthy and not an `HTMLElement` — i.e. a class instance, since function fibers have `stateNode === null`. That is our candidate #1/#4 territory: **a re-render, which preserves `memoizedState`, so hooks are not reset.** BD's own comment frames it as a cosmetic nudge ("The patches are slightly late sometimes, so this will update chat"), and note the primary path isn't even React — it synthesises `onMouseLeave()`/`onMouseMove()` DOM callbacks.

Critically, `pluginmanager.ts:198 stopAddon()` calls `plugin.instance?.stop()`, emits `stopped`, shows a toast — **and never touches React.** There is no remount, no key bump, no `forceUpdate` sweep on unpatch. BetterDiscord simply doesn't have our problem, because a BD plugin unpatching a component doesn't generally change that component's hook count. So there is no prior art here to copy for the hook-count case.

Also, the fiber-access entry point is DOM-only and cannot work for us:

```ts
if (node.__reactFiber$) return node.__reactFiber$;
const key = Object.keys(node).find(k => k.startsWith("__reactInternalInstance") || k.startsWith("__reactFiber"));
```

Those `__reactFiber$<random>` keys are attached by `react-dom` to DOM nodes. Under RN Fabric there are no DOM nodes; the equivalent is `__internalInstanceHandle` / `canonical.internalInstanceHandle` on a host public instance, which you already have.

### What *does* transfer: `wrapInHooks` — and it's worth taking

`wrapInHooks` swaps React's internal hook dispatcher for a set of inert stubs, then calls a function component directly to get its rendered output **without mounting it**:

```ts
const reactDispatcher = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H;
const originalDispatcher = {...reactDispatcher};
Object.assign(reactDispatcher, patchedReactHooks, customPatches);
try { return FC(props); }
finally { Object.assign(reactDispatcher, originalDispatcher); }
```

I verified every precondition on the live device (React 19.1.0, prod):

| Check | Result |
|---|---|
| `React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE` | present |
| `SI.H` (the dispatcher) | `object`, non-null, **23 hooks enumerable** |
| `SI.H` descriptor | `writable: true, configurable: true`, no getter |
| `Object.isFrozen(SI.H)` / `isExtensible` | `false` / `true` |
| `SI.H.useState` descriptor | `writable: true, configurable: true` |

Dispatcher keys live: `readContext, use, useCallback, useContext, useEffect, useImperativeHandle, useLayoutEffect, useInsertionEffect, useMemo, useReducer, useRef, useState, useDebugValue, useDeferredValue, useTransition, useSyncExternalStore, useId, useHostTransitionStatus, useFormState, useActionState, useOptimistic, useMemoCache, useCacheRefresh`.

So the technique works here. **The high-value use is deciding *whether* a remount is needed** — the gap I flagged in §2 when recommending we mirror Fast Refresh's `canPreserveStateBetween` policy. Fast Refresh gets hook signatures from a Babel transform we don't have; we can instead **count hooks by dry-rendering the component under a counting dispatcher**, before and after unpatch:

```ts
function countHooks(Component, props) {
	const dispatcher = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H;
	const original = { ...dispatcher };
	const sequence: string[] = [];

	for (const name of Object.keys(dispatcher)) {
		dispatcher[name] = (...args) => {
			sequence.push(name);
			return inertHooks[name]?.(...args);
		};
	}

	try { Component(props); } catch { /* dry render may bail; partial sequence still informative */ }
	finally { Object.assign(dispatcher, original); }

	return sequence; // compare join('|') before vs after unpatch
}
```

If the sequence is unchanged, skip the remount and let the plain re-render happen — preserving user state. If it changed, remount. That is exactly Fast Refresh's stale-vs-updated split, reconstructed without the Babel transform or any dev-only API.

**Caveats, and they're real.** Dry-rendering is genuinely risky and must be treated as advisory, never authoritative:

- **Hooks in conditionals/early returns.** A component that returns early on some props yields a different sequence than the mounted render did. Compare before/after with the *same* props to keep it apples-to-apples, and treat any thrown error as "assume changed → remount" (fail safe, never fail silent).
- **Side effects.** Calling `FC(props)` runs the component body. If it does anything beyond computing a tree (mutating a store, firing analytics, subscribing), a dry render causes real side effects. BD accepts this because it dry-renders narrow, known components; a *general* patcher would be dry-rendering arbitrary Discord internals. This is the main reason to scope it tightly.
- **Not concurrent-safe.** Mutating the global dispatcher is only safe outside an active render. Do it synchronously and restore in `finally`, and never during a commit — Fabric renders can interleave.
- **`use()` and Suspense** can throw by design (BD's `USE_ERR_MSG` dance exists for exactly this). Swallow those specifically.
- BD's stubs also mean any component reading real context/state sees defaults, so the *rendered output* is unreliable — only use the hook *sequence*, not the returned tree.

Given the side-effect exposure, I'd gate this behind "only when we're about to remount anyway" — use it to *avoid* an unnecessary remount, not as a general probe.

### Summary of the reference

| Piece | Verdict for us |
|---|---|
| `getInternalInstance` | Not usable — DOM-only (`__reactFiber$`); use `__internalInstanceHandle` under Fabric |
| `getOwnerInstance` | Re-render only, and **requires a class ancestor** (`stateNode`) — candidate #1, already ranked below the recommendation |
| `wrapElement` | Irrelevant (DOM `appendChild` wrapper) |
| **`wrapInHooks`** | **Reusable** — verified live; best used to detect hook-signature change so we remount only when necessary |
| `getType` (memo/forwardRef/lazy unwrap) | Useful small utility — matches the tag 11/14/15 unwrapping noted in §5 |

Net: it's a good reference for *fiber ergonomics* and gave us a real answer to the "when to remount" question, but it confirms rather than changes the core recommendation — BetterDiscord has no production remount mechanism, because `key`/`elementType` remain the only two that exist.

---

## 0c. The "just re-render without hook errors" angle — and the one hack that actually works

Your reframing ("or at least re-render it without violating hook issues") is the more tractable problem, and it has a real answer. Two agents dug through `ReactFiberHooks` and the reconciler; I also ran a live experiment on the device. Summary: **there is exactly one reachable hack that gives a function component a fresh hook chain without unmounting — nulling `memoizedState` on both fibers of the double-buffered pair — and it works, at the cost of leaking effect cleanups.**

### First, the mismatch check is real in production (empirically confirmed)

I mounted a component with 3 `useState` calls into the live app, bumped it to 5, and forced a re-render. React threw and Discord's `ErrorBoundary` caught it — the component stack shows our `Target` under `Field` → `ToastContent` → `Toast` → `ToastContainer`. So this is not a DEV-only guard. Both error paths exist verbatim in `ReactFabric-prod.js`:

`finishRenderingHooks` (prod) — the "fewer hooks" post-render check:

```js
function finishRenderingHooks(current) {
  ReactSharedInternals.H = ContextOnlyDispatcher;
  var didRenderTooFewHooks = null !== currentHook && null !== currentHook.next;
  ...
  if (didRenderTooFewHooks)
    throw Error(
      "Rendered fewer hooks than expected. This may be caused by an accidental early return statement."
    );
```

`updateWorkInProgressHook` (prod) — the "more hooks" check:

```js
if (null === nextCurrentHook) {
  if (null === currentlyRenderingFiber.alternate)
    throw Error("Update hook called on initial render. ...");
  throw Error("Rendered more hooks than during the previous render.");
}
```

Note these are **full strings, not minified error codes**, so they're unambiguous. React only validates hook *count/consumption*, not hook *type per slot* — no per-slot type check exists in prod. That matters for the padding idea below.

### The mechanism: dispatcher selection is a `null` check on `memoizedState`

`renderWithHooks` (prod), the crux:

```js
function renderWithHooks(current, workInProgress, Component, props, secondArg, nextRenderLanes) {
  renderLanes = nextRenderLanes;
  currentlyRenderingFiber = workInProgress;
  workInProgress.memoizedState = null;
  workInProgress.updateQueue = null;
  workInProgress.lanes = 0;
  ReactSharedInternals.H =
    null === current || null === current.memoizedState
      ? HooksDispatcherOnMount
      : HooksDispatcherOnUpdate;
```

So: **if `current.memoizedState === null`, React installs the MOUNT dispatcher and accepts any number of hooks with a fresh chain.** No unmount, no key change, no class ancestor.

The subtlety that makes this a two-fiber operation — `updateWorkInProgressHook` sources the old chain from the **alternate**, not from `current`:

```js
if (null === currentHook) {
  var nextCurrentHook = currentlyRenderingFiber.alternate;
  nextCurrentHook = null !== nextCurrentHook ? nextCurrentHook.memoizedState : null;
} else nextCurrentHook = currentHook.next;
```

In the double-buffered steady state `current === workInProgress.alternate`, so these are usually the same object — but not always (on the first update there is no alternate yet, and `createWorkInProgress` copies `memoizedState` from `current` into the WIP fiber). **Null both to be safe:**

```js
const currentFiber = resolveCurrentFiber(fiber);

currentFiber.memoizedState = null;
currentFiber.updateQueue = null;

if (currentFiber.alternate) {
	currentFiber.alternate.memoizedState = null;
	currentFiber.alternate.updateQueue = null;
}

// then schedule a re-render that actually reaches this fiber
```

### What it corrupts — read this before using it

This is a real hack with real costs, all traced to source:

- **Effect cleanups leak — the worst problem.** `commitHookEffectListUnmount` reads destroy functions from `finishedWork.updateQueue.lastEffect`. Orphaning the chain makes every pending `destroy()` unreachable, so `useEffect` cleanups **never run**: timers keep firing, event subscriptions stay attached, `AbortController`s never abort. On repeated patch/unpatch cycles this accumulates. Mitigation: walk the old chain *before* nulling and invoke the `destroy` functions manually (`hook.queue`/`updateQueue.lastEffect` → `inst.destroy`). Fiddly and version-fragile, but it turns a silent leak into a handled one.
- **All hook state resets** — `useState`, `useRef`, `useMemo` caches. Same visible outcome as a remount, which is expected here.
- **Stale `dispatch` closures stay live.** The old `queue.dispatch` functions captured the old queue objects. If one fires after the swap (a pending `setState` from a timer or a native callback), it enqueues onto an orphaned queue: the update is silently dropped, or in the worst case schedules work on a fiber whose chain no longer matches. Silent lost updates.
- **`useSyncExternalStore` tearing checks** live on `updateQueue.stores`; nulling drops them, so store-tearing detection is skipped for that render.
- **`memoCache`** (React Compiler `useMemoCache`) resets — fine, just slower.
- **No host-view remount**, which is actually the upside over a real remount: native views, gesture handlers, and reanimated bindings are undisturbed, so no visual flash.

**Version fragility:** this depends on the literal expression `null === current || null === current.memoizedState` and on `memoizedState` remaining the hook chain head. Both have been stable since hooks shipped (16.8) and are unchanged in 19.0/19.1/19.2, but this is internals — it is one refactor away from breaking, and it will break *silently* (you'd get the update dispatcher and a hook-count throw, i.e. back to the original bug). Guard it: verify `typeof fiber.memoizedState === 'object'` and wrap in try/catch with a fallback to the keyed remount.

### Rejected: dispatcher padding/truncation

Tempting given `SI.H` is fully writable (verified live: 23 hooks, all `writable/configurable`, object not frozen): on unpatch, if the component now calls 3 hooks instead of 5, have a patched dispatcher call the 2 missing ones to consume the rest of the chain. Since React doesn't type-check slots in prod, the types wouldn't even need to line up.

It fails in practice. Padding must happen *after* the component body finishes but *before* `finishRenderingHooks` runs — and there is no hook you can intercept at that boundary, because the last hook call is indistinguishable from a middle one. Truncation is worse: `didRenderTooFewHooks` is computed from `currentHook.next`, so you'd have to mutate the *old* chain mid-render to sever it, which corrupts the very list the render is walking. And global dispatcher mutation isn't concurrency-safe — Fabric can interleave renders, so you'd pad the wrong component. Dead end; `memoizedState`-nulling achieves the same goal cleanly.

### Rejected: `Activity` / `Offscreen`

Would have been the ideal public-API answer (`<Activity mode="hidden">` destroys state in some modes). **Not available:** I enumerated `React`'s exports live and there is no `Activity` or `unstable_Activity` in this 19.1.0 build. The `OffscreenComponent` tag exists inside the reconciler, but with no public element type there's no way to render one.

### The genuinely useful supporting finding: context punches through `memo` bailout

This closes the "parent bailout" gap from §5 — the main practical obstacle to the keyed-remount approach. Context updates do **not** respect `memo`/props bailout, because propagation marks `childLanes` on every ancestor. `scheduleContextWorkOnParentPath` (prod:1856):

```js
function scheduleContextWorkOnParentPath(parent, renderLanes, propagationRoot) {
  for (; null !== parent; ) {
    var alternate = parent.alternate;
    (parent.childLanes & renderLanes) !== renderLanes
      ? ((parent.childLanes |= renderLanes),
        null !== alternate && (alternate.childLanes |= renderLanes))
      : ...
    if (parent === propagationRoot) break;
    parent = parent.return;
  }
}
```

Called from `propagateContextChanges` (prod:1869) for each consumer whose `dependencies` list contains the changed context. Since `bailoutOnAlreadyFinishedWork` only bails when `0 === (renderLanes & workInProgress.childLanes)`, setting `childLanes` up the path guarantees React descends *through* memoized parents to reach the consumer. So: if our `RemountHost` (§4 Tier 1) consumes a context we own instead of a module-level store, a context change reliably delivers a render to it even under `React.memo` — and its keyed child then remounts. This makes Tier 1 robust rather than best-effort.

### Ranking for this section

1. **Keyed `RemountHost` + own the context** (§4 Tier 1 + context propagation) — public API only, guaranteed unmount, no leaks. Still the recommendation.
2. **`memoizedState`-nulling** — the answer to "hacky but easy": one-liner-ish, no class ancestor, no parent cooperation, no native view churn. Use when you *cannot* control the parent. Must manually run old effect destroys, and accept dropped stale dispatches.
3. Everything else (padding, `Activity`, lane poking, deletion injection) — non-viable; see §0 and the agent findings folded into §3.

---

## 1. The load-bearing distinction, proven from source

### Re-render preserves the hook chain

Any forced update reuses the fiber via `createWorkInProgress`. From `ReactFabric-prod.js:10005`-ish region (`function createWorkInProgress`):

```js
workInProgress.memoizedProps = current.memoizedProps;
workInProgress.memoizedState = current.memoizedState;   // <-- hook chain carried over verbatim
workInProgress.updateQueue  = current.updateQueue;
```

`memoizedState` on a `FunctionComponent` fiber **is** the hook linked list. Copying it means the next render walks the same hooks in the same order, and a changed hook count throws "Rendered fewer hooks than expected." **No dispatch, no `forceUpdate`, no lane scheduling can ever reset hooks.** This kills candidates #3 (partially) and #4 outright.

### Remount creates a fresh fiber

`FiberNode` (prod, line 10005):

```js
function FiberNode(tag, pendingProps, key, mode) {
  ...
  this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null;
  ...
}
```

A newly created fiber has `memoizedState === null` → the next render takes the mount path (`mountState` etc.) → **fresh hook slate**. So the goal reduces to: *make the reconciler construct a new fiber for this position instead of reusing the current one.*

### The only two triggers, from the reconciler's own comparison

Single-child path, `reconcileChildFibersImpl`, **prod line 2998** (dev line 4739, identical bar hot-reload):

```js
for (var key = newChild.key; null !== currentFirstChild; ) {
  if (currentFirstChild.key === key) {                 // (1) KEY must match
    key = newChild.type;
    if (key === REACT_FRAGMENT_TYPE) { ... }
    else if (
      currentFirstChild.elementType === key ||         // (2) TYPE identity must match
      ("object" === typeof key && null !== key &&
       key.$$typeof === REACT_LAZY_TYPE &&
       resolveLazy(key) === currentFirstChild.type)
    ) {
      deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
      lanes = useFiber(currentFirstChild, newChild.props);   // REUSE -> hooks preserved
      ...
      break a;
    }
    deleteRemainingChildren(returnFiber, currentFirstChild);  // type differed -> UNMOUNT
    break;
  } else deleteChild(returnFiber, currentFirstChild);         // key differed  -> UNMOUNT
  currentFirstChild = currentFirstChild.sibling;
}
// falls through to createFiberFromElement(...) -> brand-new fiber, fresh hooks
```

Multi-child path, `updateSlot` (prod, `function updateSlot`):

```js
case REACT_ELEMENT_TYPE:
  return newChild.key === key
    ? updateElement(returnFiber, oldFiber, newChild, lanes)
    : null;                       // key mismatch -> null -> delete + create new
```

**Conclusion: exactly two reliable remount triggers exist in shipping React — a changed `key`, or a changed `elementType` identity, observed at the moment the parent re-renders and produces the child element.** Both are public, documented reconciliation semantics, not internals.

---

## 2. The Fast Refresh precedent (#6) — how it really works, and why it is unavailable

This was the most promising lead, so I traced it end to end. It resolves to a clear negative, which is itself the most valuable finding.

### The remount trigger at the reconciler level

`ReactFabric-dev.js:9198`, the very first thing `beginWork` does:

```js
function beginWork(current, workInProgress, renderLanes) {
  if (workInProgress._debugNeedsRemount && null !== current) {
    renderLanes = createFiberFromTypeAndProps(
      workInProgress.type, workInProgress.key, workInProgress.pendingProps,
      workInProgress._debugOwner || null, workInProgress.mode, workInProgress.lanes
    );
    ...
    var returnFiber = workInProgress.return;
    if (null === returnFiber) throw Error("Cannot swap the root fiber.");
    current.alternate = null;
    workInProgress.alternate = null;
    renderLanes.index   = workInProgress.index;
    renderLanes.sibling = workInProgress.sibling;
    renderLanes.return  = workInProgress.return;
    renderLanes.ref     = workInProgress.ref;
    // splice the NEW fiber into the parent's child list in place of the old one
    if (workInProgress === returnFiber.child) returnFiber.child = renderLanes;
    else { /* walk siblings, relink */ }
    // schedule the OLD fiber for deletion  == a real unmount
    workInProgress = returnFiber.deletions;
    null === workInProgress
      ? ((returnFiber.deletions = [current]), (returnFiber.flags |= 16))
      : workInProgress.push(current);
    renderLanes.flags |= 2;     // Placement
    return renderLanes;
  }
  ...
}
```

This is a genuine unmount + remount: new fiber (fresh `memoizedState`), old fiber pushed into `returnFiber.deletions` with the `ChildDeletion` flag (16), so the commit phase runs `componentWillUnmount`/effect cleanups on the old subtree. It needs **no class ancestor** — it operates on any fiber with a non-null `return`.

### How the flag gets set

`scheduleFibersWithFamiliesRecursively`, `ReactFabric-dev.js:15288`:

```js
_fiber && (fiber._debugNeedsRemount = !0);
if (_fiber || needsRender) {
  (alternate = enqueueConcurrentRenderForLane(fiber, 2)),
    null !== alternate && scheduleUpdateOnFiber(alternate, fiber, 2);
}
```

Note the two-part structure: set `_debugNeedsRemount`, **then** schedule an ordinary update. The scheduled update is only the delivery vehicle; the flag is what converts it into a remount. The `_fiber` (stale) vs `needsRender` (updated) split is exactly the hook-signature decision — stale ⇒ remount, updated ⇒ plain re-render. Same problem, same answer.

The flag also propagates across the current/WIP pair, `ReactFabric-dev.js:15429`:

```js
workInProgress._debugNeedsRemount = current._debugNeedsRemount;
```

`resolveFamily` is installed via `setRefreshHandler` (`dev:160`) and exposed to the renderer only through the DevTools internals payload (`dev:18921-18923`):

```js
internals.scheduleRefresh   = scheduleRefresh;
internals.scheduleRoot      = scheduleRoot;
internals.setRefreshHandler = setRefreshHandler;
```

### The stale-vs-updated decision (what triggers a remount rather than a re-render)

`react-refresh` decides via `canPreserveStateBetween` → `haveEqualSignatures` → `computeFullKey` (`packages/react-refresh/src/ReactFreshRuntime.js`, v19.1.0):

```js
function canPreserveStateBetween(prevType, nextType) {
  if (isReactClass(prevType) || isReactClass(nextType)) return false;
  if (haveEqualSignatures(prevType, nextType)) return true;
  return false;
}

function haveEqualSignatures(prevType, nextType) {
  const prevSignature = allSignaturesByType.get(prevType);
  const nextSignature = allSignaturesByType.get(nextType);
  if (prevSignature === undefined && nextSignature === undefined) return true;
  if (prevSignature === undefined || nextSignature === undefined) return false;
  if (computeFullKey(prevSignature) !== computeFullKey(nextSignature)) return false;
  if (nextSignature.forceReset) return false;
  return true;
}
```

`performReactRefresh` then splits families into `updatedFamilies` (re-render, state preserved) and `staleFamilies` (remount). Rules worth mirroring:

- **Class components always remount** — `isReactClass` short-circuits before signatures are consulted.
- **No signature on either side ⇒ re-render.** A hookless component is never remounted.
- **One-sided signature ⇒ stale.** *Adding or removing the first hook forces a remount* — precisely your patch/unpatch case.
- `forceReset` is checked on the **next** signature only, so new code declaring a reset wins.

This is the policy to copy: remount only when the hook signature actually changed incompatibly, re-render otherwise. The `Family` (`{ current }`) box is just a stable identity handle so the reconciler can tell "same component, new implementation" apart from "different component".

### Why this is unavailable in your build — the decisive finding

Three independent blockers, all verified:

**1. The entire mechanism is DEV-only and compiled out of the shipping bundle.**

```
$ grep -c "_debugNeedsRemount" ReactFabric-prod.js                 -> 0
$ grep -c "resolveFamily\|scheduleRefresh" ReactFabric-prod.js     -> 0
$ grep -c "isCompatibleFamilyForHotReloading" ReactFabric-prod.js  -> 0
```

`ReactFabric-dev.js` has 4 references to `_debugNeedsRemount`; prod has **zero**. Per `shims/ReactFabric.js`, `__DEV__` picks the bundle:

```js
if (__DEV__) { ReactFabric = require('../implementations/ReactFabric-dev'); }
else         { ReactFabric = require('../implementations/ReactFabric-prod'); }
```

Discord ships a release build. Setting `fiber._debugNeedsRemount = true` there writes an **inert property no code ever reads** — a silent no-op. This is a trap worth naming explicitly: it would appear to work under a local dev build and fail silently in production, the worst possible failure mode.

In upstream 19.1.0 source this branch calls a named local helper, **`remountFiber`** (`packages/react-reconciler/src/ReactFiberBeginWork.js:3499`, called from `beginWork` at :3815) — inlined by the RN bundler into the code quoted above. Its `else` branch is the bluntest possible statement of DEV-only status:

```js
  } else {
    throw new Error(
      'Did not expect this call in production. ' +
        'This is a bug in React. Please file an issue.',
    );
  }
```

**2. React Native only wires up Fast Refresh under `__DEV__`.** RN does depend on `react-refresh` (`^0.14.0`), which initially looks like an opening — but `Libraries/Core/setUpReactRefresh.js` is wrapped in its entirety:

```js
if (__DEV__) {
  ...
  // This needs to run before the renderer initializes.
  const ReactRefreshRuntime = require('react-refresh/runtime');
  ReactRefreshRuntime.injectIntoGlobalHook(global);
  ...
  global[(global.__METRO_GLOBAL_PREFIX__ || '') + '__ReactRefresh'] = Refresh;
}
```

Two things follow. `injectIntoGlobalHook` *does* create a stub hook when none exists (`renderers: new Map(), supportsFiber: true, inject: injected => nextID++, ...`), so the hook's absence is normally self-healing — but in a release build this call never runs, which is exactly why you observe no `__REACT_DEVTOOLS_GLOBAL_HOOK__`. And the inline comment ("This needs to run before the renderer initializes") is upstream confirming the ordering constraint you hit. Separately, the published `react-refresh` production dist is a 357-byte file whose entire body is `throw Error("React Refresh runtime should not be included in the production bundle.")`, and `performReactRefresh` itself leads with `if (!__DEV__) throw`.

**3. Even in dev, injection happens at renderer module-eval time.** Prod line 10505:

```js
if ("undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__) {
  var hook = __REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook.isDisabled && hook.supportsFiber)
    try { rendererID = hook.inject(internals), injectedHook = hook; } catch (err) {}
}
```

This is a one-shot check at import. It corroborates your live observation exactly: the hook is absent, and installing it later cannot retro-capture. Note also the prod `internals` object carries only `bundleType`, `version`, `rendererPackageName`, `currentDispatcherRef`, `reconcilerVersion` — none of the `scheduleRefresh`/`setRefreshHandler`/`overrideHookState` helpers that only `dev:18911-18924` attaches.

One nuance on ordering, for completeness: upstream `injectIntoGlobalHook` handles *both* orders when it does run — it monkey-patches `hook.inject` for renderers that register later, **and** back-fills via `hook.renderers.forEach` for renderers that already registered. So "installed too late" is not inherently fatal to Fast Refresh in general. In your case the blocker is more fundamental: in a release bundle the prod renderer never attaches the refresh helpers to `internals` at all, so no amount of hook installation or ordering can recover them. (Related trap if you ever shim the hook yourself: `injectIntoGlobalHook` bails out with a warning if `hook.isDisabled` is truthy, and the renderer requires `supportsFiber === true`.)

**Verdict on #6: correct precedent, right mental model, and it confirms remount-on-hook-change is a first-party-blessed need — but the mechanism is structurally unreachable in a production RN bundle. Do not build on it.** Its real value is the design lesson: mirror Fast Refresh's *decision* (stale ⇒ remount) using a production-available trigger.

---

## 3. Candidate-by-candidate verdicts

| # | Mechanism | Unmount or re-render? | Needs class ancestor? | Surface | Verdict |
|---|---|---|---|---|---|
| 1 | Render-patch nearest **class** ancestor, `cloneElement(res, { key })` | **True unmount** | Yes | Public | Works, but unnecessarily narrow |
| 2 | Find fibers by `type`, remount via parent key bump | **True unmount** | No | Public semantics + fiber read | **Recommended** |
| 3 | Inject `useSyncExternalStore` at patch time | Re-render only (self) | No | Public | Fails the axis; also a Rules-of-Hooks trap |
| 4 | `scheduleUpdateOnFiber` / `enqueueForceUpdate` / lanes | **Re-render only** | No | Deep internals | Cannot reset hooks — confirmed |
| 5 | Change `type`/`elementType` identity | **True unmount** (if done at parent render) | No | Public semantics | Valid; mutating a committed fiber does not work |
| 6 | Fast Refresh `_debugNeedsRemount` | True unmount | No | DEV-only internals | **Unavailable in prod** |

### #1 — class-ancestor render patch, cloneElement with a fresh key
Confirmed correct: returning `cloneElement(res, { key: newKey })` from the ancestor's `render` means the child element carries a new `key`, so `reconcileChildFibersImpl` takes the `deleteChild` branch and builds a new fiber. Preserve `ref` when cloning, since `cloneElement` with a new key otherwise keeps the original ref — and note `coerceRef` runs on the reuse path only. Real, but it needs a class ancestor and permanently patches an unrelated component. Given your live finding that `AnimatedComponent(...)` class wrappers sit ~1 hop above most components, it works most of the time; it just isn't necessary to depend on that.

### #2 — parent-driven key bump (the general form)
This is #1 generalised to function parents. What must be true of the parent: **it must be the component that creates the target element**, and it must actually re-render (not bail out). See §5 for the bailout hazard and §6 for pseudocode.

### #3 — injecting a hook via render patch
Two independent problems.

*It doesn't solve the problem.* A hook injected into the component lets the component re-render itself. Re-rendering is exactly what `createWorkInProgress` preserves hooks through. To remount, the **key must change in the parent's output** — a component cannot change its own key. To even attempt it you'd need the injected hook to drive a *parent*, at which point the hook injection is pointless.

*It creates the very bug you're fixing.* Adding a hook at patch time changes the hook count on the next render of an already-mounted fiber → "Rendered more hooks than during the previous render." Unpatching removes it → the same error again. Injecting hooks makes patch/unpatch *both* hook-count-changing events. Strictly worse. **Reject.**

### #4 — reconciler internals
Confirmed by source: `scheduleUpdateOnFiber` and `enqueueConcurrentRenderForLane` only mark lanes and schedule work; rendering then goes through `createWorkInProgress`, which copies `memoizedState`. Note that Fast Refresh itself calls `scheduleUpdateOnFiber` (`dev:15289`) — and it is *not* what causes the remount there; the pre-set `_debugNeedsRemount` flag is. That is direct evidence that scheduling alone never remounts. `enqueueForceUpdate` is class-only (writes to `updateQueue`) and irrelevant to `tag === 0`. Also: these are module-local functions in the bundle, not exported, and absent from the prod internals payload — unreachable regardless. **Reject.**

### #5 — type identity change
Genuinely valid, and it's the second branch of the comparison at prod:3016 (`currentFirstChild.elementType === key`). Constraints, both important:

- Mutating `fiber.type`/`fiber.elementType` on a **committed** fiber does nothing. The comparison reads `currentFirstChild.elementType` against the **new element's** `type`. Nothing re-examines a committed fiber; and `createWorkInProgress` copies `type` from `current` anyway.
- So the new identity must be produced at the parent's render. If you replace the module export that the parent reads *and* force the parent to re-render, you get a remount for free — the type differs, so the reuse branch fails.

This is effectively how unpatching already behaves **if** the patch swapped the type identity and the parent re-reads it. Useful as a fallback (§6, tier 3) and worth knowing: for `MemoComponent`/`SimpleMemoComponent` (tags 14/15), the identity compared is the *outer* memo object, so re-wrapping in a fresh `memo()` also changes identity.

---

## 4. Ranked recommendation

**Use a keyed remount boundary owned by you (a "remount host"), driven by a key bump at the nearest re-renderable ancestor. Do not rely on `_debugNeedsRemount`, and do not inject hooks into patched components.**

> **If you want the single easiest hack, it's `memoizedState`-nulling (§0c):** set `memoizedState = null` and `updateQueue = null` on both the current fiber and its `alternate`, then trigger any re-render. React installs the mount dispatcher and accepts a fresh hook chain — no unmount, no parent cooperation, no class ancestor, no native view flash. Cost: `useEffect` cleanups leak unless you run the old `destroy` functions manually, and stale `dispatch` closures silently drop updates. Verified against prod source; guard it and fall back to the keyed remount.

Ranked:

1. **Own the boundary (best).** When patching a component type, wrap it once in a tiny `RemountHost` you control that renders `createElement(target, props)` under a key from a module-level counter, subscribed via `useSyncExternalStore` **in the host, not in the target**. Unpatch bumps the counter → host re-renders → child key changes → guaranteed unmount + fresh hooks. Purely public API (`createElement`, `useSyncExternalStore`, `key`), no fiber internals, no class ancestor, no version risk. The hook lives in a component whose hook count never changes, so no Rules-of-Hooks exposure.
2. **Fiber-walk + nearest-ancestor key bump (retrofit).** For components already mounted before your wrapper existed. Needs fiber reads (`return`, `child`, `sibling`, `alternate`, `tag`, `type`, `stateNode`) but only public reconciliation semantics for the actual remount. Fragile only in the "which ancestor can I force to re-render" step (§5).
3. **Type-identity swap.** Change the exported/patched identity and force a re-render of whoever reads it. Good fallback when you control the module export.
4. **Class-ancestor `cloneElement` key bump.** Your existing approach; keep as a fallback, don't make it the foundation.
5. *(Never)* `_debugNeedsRemount` — prod no-op. *(Never)* hook injection into the target.

Why #1 over #2: #2's hard part isn't the remount semantics (settled) but *finding an ancestor you can force to re-render*. #1 removes that problem by construction, because you own a component that is guaranteed to re-render on demand. Since you already control patch time, prefer establishing the boundary then.

---

## 5. Failure modes to design against

**Parent bailout silently defeats a key change.** The most likely real-world failure. `bailoutOnAlreadyFinishedWork` (prod):

```js
if (0 === (renderLanes & workInProgress.childLanes))
  if (null !== current) {
    if ((propagateParentContextChanges(current, workInProgress, renderLanes, !1),
         0 === (renderLanes & workInProgress.childLanes))) return null;
  } else return null;
```

If the parent bails out, its render function never runs, no new child element is created, and the key comparison never happens. So scheduling an update on the *target* fiber is useless — the update must originate **at or above the component that creates the target's element**, and that component must actually render. `React.memo` parents make this worse: `updateSimpleMemoComponent` bails on `shallowEqual(prevProps, nextProps) && current.ref === workInProgress.ref`, so a memoized parent with unchanged props will not re-render from a child-directed update. Approach #1 sidesteps this because the host subscribes to your store directly and is therefore always scheduled.

**Other risks**

- **State loss is the point, but it's still user-visible.** A remount discards state, refs, and re-runs effects in the subtree. Scope the boundary as tightly as possible; remount only types whose hook shape actually changed (mirror Fast Refresh's stale-vs-updated distinction rather than remounting everything). §0b gives a concrete way to make that decision without the Babel transform, via a counting dispatcher — with the side-effect caveats noted there.
- **`current` vs `alternate`.** Always resolve to the current fiber before reading. The standard check is via the root: `HostRoot.current` and follow down, or compare against `fiber.alternate` — a stale WIP fiber's `return`/`child` pointers can be misleading.
- **WorkTag numeric drift.** 0/1/3/5/11/14/15 are correct for 19.x but are internal and have shifted across majors. Prefer structural checks (`typeof fiber.type === 'function'`, `stateNode === null`) over tag equality, or centralise the tag table in one module. `bippy` absorbs some of this, but its `~0.3.8` tag assumptions should be pinned/verified against 19.2.
- **Host-component boundaries.** A remount recreates native views under Fabric, which can flash, drop native gesture/animation state, and reset `reanimated` shared-value bindings held by `AnimatedComponent` wrappers. Expect visual glitching around reanimated/screens subtrees.
- **Key collisions.** Use a monotonically increasing counter (or `uuid`) rather than a boolean toggle; two rapid unpatches must not land on the same key.
- **Fragment/array positions.** If the target sits in an array, the sibling-scan path (`updateSlot`) applies; a key change there deletes and recreates only that slot — fine, but a key that collides with a sibling's key will misreconcile.
- **`_debugNeedsRemount` is a silent no-op in prod.** Restating deliberately: if anyone adds it as a "belt and braces" line, it will pass local dev testing and quietly do nothing in release.

---

## 6. Pseudocode

### Tier 1 — owned remount boundary (recommended)

```ts
// Module-level store. One counter per patched component type.
const generations = new Map<unknown, number>();
const listeners = new Set<() => void>();

function bumpGeneration(type: unknown) {
	generations.set(type, (generations.get(type) ?? 0) + 1);
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => void listeners.delete(listener);
}

// Wrap ONCE at patch time. Hook count here is constant, so no Rules-of-Hooks risk.
function createRemountHost(target: React.ComponentType<any>) {
	function RemountHost(props: any) {
		const generation = useSyncExternalStore(
			subscribe,
			() => generations.get(target) ?? 0,
		);

		// Key change -> reconcileChildFibersImpl takes the deleteChild branch
		// -> brand-new fiber -> memoizedState === null -> fresh hooks.
		return createElement(target, { ...props, key: `ub-${generation}` });
	}

	RemountHost.displayName = `RemountHost(${getDisplayName(target)})`;

	return RemountHost;
}

// On unpatch, when the hook shape changed:
bumpGeneration(target);
```

### Tier 2 — retrofit for already-mounted fibers

```ts
// Find live fibers of a given type, then remount via an ancestor that can re-render.
function findMountedFibers(root: Fiber, type: unknown): Fiber[] {
	const matches: Fiber[] = [];

	traverseFiber(root, (fiber) => {
		// Match both the plain type and memo/forwardRef wrappers.
		if (fiber.type === type || fiber.elementType === type) matches.push(fiber);
		return false;
	});

	return matches;
}

// Walk up to something we can force to re-render AND that creates the target's element.
// Prefer our own RemountHost; fall back to a class ancestor; else give up loudly.
function findRemountDriver(fiber: Fiber): Fiber | undefined {
	for (let node = fiber.return; node; node = node.return) {
		if (node.type?.__ubRemountHost) return node;      // tier 1 boundary
		if (node.tag === 1 && node.stateNode?.forceUpdate) return node; // class ancestor
	}

	return void 0; // Do NOT silently no-op; report so the caller can fall back.
}
```

Resolve the current fiber before use, and treat a missing driver as a real failure (log it) rather than pretending success.

### Tier 3 — type-identity fallback

Replace the identity the parent reads (`exports.Foo = freshWrapper`) and force that parent to re-render. The `currentFirstChild.elementType === key` check then fails and React unmounts the old fiber. Only viable where you control the module export and can schedule the reading parent.

---

## 7. Version notes

- **19.0 / 19.1 / 19.2:** the key and `elementType` comparisons in `reconcileChildFibersImpl` / `updateSlot` / `updateElement`, and the `_debugNeedsRemount` branch in `beginWork`, are unchanged in shape. The recommendation rests only on key/type semantics, which are stable public behaviour across all of React's history.
- **DEV vs PROD is the axis that actually matters here**, far more than the minor version. `_debugNeedsRemount`, `scheduleRefresh`, `setRefreshHandler`, `isCompatibleFamilyForHotReloading`, and all `overrideHookState`/`overrideProps` helpers exist **only** in `ReactFabric-dev.js`. Verified counts in prod: 0 — in both the local RN 0.83.10 Fabric bundle and the published `react-dom@19.1.0` production dist. This is dead-code elimination, not an inert runtime branch.
- **`react-refresh` version skew:** RN 0.83.10 pins `react-refresh@^0.14.0` while the runtime semantics quoted here were read from `0.16.0`. `canPreserveStateBetween`/`haveEqualSignatures` are stable across that range, and it is moot for the recommendation since neither is reachable in prod — but don't assume 0.14 and 0.16 are identical if you ever depend on the DEV path.
- **Fabric vs legacy (Paper):** irrelevant to this question. Child reconciliation lives in the shared reconciler; only the host config differs. `ReactNativeRenderer-{dev,prod}.js` show the same DEV/prod split. Fabric matters only for the *consequences* (native view recreation, §5).
- **React 19 removed** `ReactDOM.unstable_batchedUpdates`-era escape hatches and the old `__secretInternals` shape; `ReactSharedInternals` is now exposed as `currentDispatcherRef` in the internals payload. Don't count on 18-era internals recipes found online.
- **`bippy@~0.3.8`** is fine for traversal (`traverseFiber`, `isValidFiber`, `getDisplayName`) but embeds its own WorkTag assumptions and expects the RDT hook for `onCommitFiberRoot`/`getRDTHook` — which is absent on your build. Use it for tree-walking only, not for commit subscription.

---

## 8. Bottom line

- **Patching the reconciler's comparison logic is not possible** in this build (§0, verified live). `updateSlot`/`beginWork`/`reconcileChildFibersImpl` are closure-local with no reachable property to rebind; the renderer exports exactly 12 public functions and none of them participate in reconciliation. `isCompatibleFamilyForHotReloading` — the one function whose behaviour we'd actually want to re-wire — is dead-code-eliminated from prod entirely.
- Only **key change** and **elementType identity change** force a real unmount in production React. Everything else re-renders and preserves `memoizedState`.
- Fast Refresh is the right precedent conceptually and confirms the problem is real and first-party-recognised, but its mechanism (`_debugNeedsRemount` + `remountFiber` + `scheduleRefresh`) is **DEV-only and stripped from the prod bundle** — it would be a silent no-op on a shipped Discord build. Borrow its *policy* (remount only on incompatible hook-signature change, per `canPreserveStateBetween`), not its mechanism.
- **BetterDiscord (§0b) has no remount mechanism.** `getOwnerInstance().forceUpdate()` is a class-only re-render, and `stopAddon()` never touches React — BD doesn't hit this problem. Its reusable contribution is `wrapInHooks`: the dispatcher swap is verified working on our runtime and is the practical way to implement the policy above (count the hook sequence before/after unpatch), provided the side-effect risk of dry-rendering arbitrary components is respected. Its fiber entry point is DOM-only and doesn't apply under Fabric.
- Own the boundary at patch time (Tier 1). It uses nothing but `createElement`, `useSyncExternalStore`, and `key`; needs no class ancestor, no fiber internals, and no WorkTag numbers — so it is the only option with essentially zero version risk.
- The subtle killer to design around is **parent bailout** (plain and `memo`): the update must originate at or above whoever creates the target element, or the key change is never even evaluated. **Solved** by having the host consume a context we own — `scheduleContextWorkOnParentPath` marks `childLanes` on every ancestor, so context updates descend through memoized parents (§0c).
- **The "hacky but easy" answer, if you want one: null `memoizedState` + `updateQueue` on the fiber AND its `alternate`, then re-render** (§0c). `renderWithHooks` selects the dispatcher with `null === current || null === current.memoizedState`, so this installs the mount dispatcher and accepts any hook count with a fresh chain — no unmount, no key, no class ancestor, no native view churn. The price is leaked `useEffect` cleanups (`commitHookEffectListUnmount` reads `updateQueue.lastEffect`, which you just orphaned) and silently dropped updates from stale `dispatch` closures. Run the old destroys manually and guard with a fallback.
- Empirically confirmed on device: the hook-count mismatch **does** throw in this production build (caught by Discord's ErrorBoundary), and `Activity`/`Offscreen` is **not** exported in 19.1.0, so the clean public-API route doesn't exist yet.
