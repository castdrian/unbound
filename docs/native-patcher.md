# Native Addon Surface

A design for letting addons drive native behaviour without shipping native code.

This is a design document, not documentation of shipped behaviour. Nothing described here exists yet. The native side lives in the loader repository; this document specifies the contract both sides implement.

It covers four layers, in descending order of how much they should be reached for:

1. [Parameterized mechanisms](#parameterized-mechanisms) — native owns the mechanism, JS supplies the policy.
2. [Declarative view patches](#declarative-view-patches) — match views, set properties.
3. [The patcher](#the-patcher) — lifecycle and appearance hooks.
4. [The Objective-C bridge](#the-objective-c-bridge) — general reach, and the dangerous one.

## The constraint that shapes everything

An addon cannot ship a dylib. AMFI only executes pages signed for the install identity, and a public addon ecosystem cannot sign for every user's identity. This is not a policy choice that can be relaxed; it is the platform.

The way around it is that an addon ships **data**, and every instruction that runs comes from already-signed code. The addon names a class, a selector, and a set of operations. The loader performs them. Users get new behaviour; the process never gets new CPU instructions.

Two consequences set the shape of everything below.

**`libffi` and generated IMP trampolines are out.** They need `mmap(PROT_EXEC)`, which needs `dynamic-codesigning`. That entitlement exists under TrollStore but not under plain sideloading, and building on it would restrict the ecosystem to a subset of installs. Hooks route through Objective-C message forwarding instead, which is signed code already present in the runtime.

**`dlopen` is conditionally fine.** Loading an already-signed system framework from `/System/Library/Frameworks` or `/System/Library/PrivateFrameworks` adds no unsigned pages and AMFI has no objection — this is ordinary tweak practice. Loading an addon-supplied dylib is the thing that cannot work. The distinction is the path, and it must be enforced: see [dlopen](#dlopen).

A JavaScript closure passed across JSI satisfies the constraint too. The closure is data — a `jsi::Function` the loader retains and calls. So the addon-facing surface can be ordinary TypeScript, and no bytecode format or interpreter is required.

### Why not a recipe language

The question that motivated this design was whether addons need a custom bytecode format or DSL. They do not, and the reason is worth recording so it is not relitigated.

A DSL would need a parser, a verifier, an interpreter, a marshalling layer, a debugger story, and a toolchain — and it would buy nothing over a JS closure, because both are equally "data selecting among precompiled operations" as far as AMFI is concerned. The signing constraint never required a language.

The second reason is that control flow was never the hard part. See [what mention avatars proves](#what-mention-avatars-proves).

## Parameterized mechanisms

**This is the layer to reach for first, and the one that should absorb most feature work.**

Native owns the mechanism; JS supplies the policy. The existing mention-avatars implementation in `ChatUI.x` is already exactly this shape:

```objc
+ (void)setMentionAvatars:(NSDictionary<NSString *, NSDictionary<NSString *, id> *> *)mentions
              showAtSymbol:(BOOL)showAtSymbol
```

JS passes a dictionary of label → metadata. Native owns the view walk, the attributed-string surgery, the `NSCache`, the async image fetch, the coalesced re-render scheduling, and the `objc_setAssociatedObject` stash of the original text for restoration. JS decided *which* mentions and *what* avatars; native did everything else.

### What mention avatars proves

It is tempting to think addons need a view-tree AST so they can run conditionals over the hierarchy. The existing implementation shows why that is the wrong tool.

`updateMentionAvatarsInView:` is a recursive walk with a capability test (`respondsToSelector:`), not a query over a reified tree. And the conditionals that actually matter are not structural at all:

- `if (!attributes[@"YYTextHighlight"]) continue` — is this a real mention or literal text?
- a cache lookup
- a nil-image check

Those are predicates over **attributed-string attributes and fetch state**. A tree query language would get an addon to the label and do nothing for the sixty lines that follow, which are `CTRunDelegateCreate`, `YYTextAttachment` construction, CoreText ascent/descent callbacks, and cache-invalidation ordering.

An AST is the right tool for *finding* views by structural relationship. It is the wrong tool for expressing what to do once there. Nothing in this design reifies the view tree.

### The boundary test

Working through what a JS reimplementation of mention avatars would require produced a sharper rule than any of the layer descriptions below:

> **If a feature needs C functions, function pointers, or per-frame work, it is a loader feature.** If it is Objective-C methods called occasionally, the bridge handles it.

Mention avatars fails that test three ways, and the first two are absolute rather than matters of degree:

- `UIGraphicsBeginImageContextWithOptions` is a **C function**, not an Objective-C method. `objc_msgSend` cannot reach it. Without `libffi` — ruled out above — reaching it means hand-writing a native wrapper, which is shipping native code by another name.
- `CTRunDelegateCreate` takes a **struct of C function pointers**. JS cannot supply those. No bridge design fixes this; the callbacks must be native.
- It runs on **every text update in the message list**, so a bridge-based version would cost dozens of crossings per mention per re-render, on the main thread.

This is worth stating plainly because it bounds [the Objective-C bridge](#the-objective-c-bridge) more tightly than that section otherwise implies: **`native.objc` reaches Objective-C methods only.** Features built on CoreText, CoreGraphics, or any C-level API belong here instead, as parameterized mechanisms.

The JS side of such a feature is then the part that genuinely belongs in JS — deriving the policy table from Discord's stores:

```ts
if (UN?.supportsFeature('chat.mentionAvatars')) {
	UN.chat.setMentionAvatars({
		'mario': { type: 'user', avatarURL: '…' },
		'Moderators': { type: 'role' },
	}, { showAtSymbol: true });
}
```

Resolving which mentions are in view, mapping ids to avatar URLs, and rebuilding on store changes is real work and belongs in the addon. The CoreText surgery does not.

### Generalizing

A new text transform should be a table entry, not a new API. The generic form is a registration of `{ pattern, replacement }` against the transformation machinery that already exists — mention avatars becomes one configuration of it, inline emoji another, neither requiring new native code.

Let this list grow from real demand rather than designing it up front. There is exactly one text transform today; the second will say more about the right abstraction than speculation will.

The honest trade-off: complex native features land in the **loader**, versioned behind `supportsFeature`, and addons configure them. That is less satisfying than "addons can do anything natively," but the alternative is asking addon authors to write CoreText through an RPC boundary with no debugger.

## Declarative view patches

Matching a view and setting properties on it is data. Expressing it as data rather than as a callback buys three things:

- **It applies before JS boots.** The loader reads it at startup, so it can affect first paint — the case the async dispatch path cannot serve.
- **It is reversible by construction**, with no ledger reasoning required.
- **It is cross-platform.** Match-and-set maps onto Android views; `forwardInvocation:` has no Android equivalent at all.

This is what the existing hardcoded features (`chat.setAvatarCornerRadius`, `chat.setMessageBubblesEnabled`) already are, generalised. Static appearance belongs here.

## The patcher

**Scope: lifecycle and appearance hooks.** The `DCDAvatarView.layoutSubviews` corner-radius case — simple, generic, and genuinely a patch. It is deliberately *not* the vehicle for features like mention avatars; those belong in [parameterized mechanisms](#parameterized-mechanisms).

### Mirroring `possess`

The JS patcher (`possess`, re-exported as `unbound.patcher`) already solves the general problem: many callers patch one method, they run in order, a throwing patch is isolated, and patching returns an unpatch function so teardown is structural. The native patcher mirrors that API rather than introducing a second convention.

```ts
const patcher = UnboundNative.iOS.createPatcher('my-plugin');

const unpatch = patcher.after('DCDAvatarView', 'layoutSubviews', ctx => {
	ctx.view.setCornerRadius(12);
});

patcher.unpatchAll();
```

`createPatcher(caller)` scopes patches to an addon exactly as `possess` does. The `caller` is the addon id, and it is what the ledger and `unpatchAllByCaller` key on.

Three differences are forced by the platform, and each is load-bearing.

#### `instead` is not in the initial surface

`possess` derives much of its power from `instead`: replace a method and decide whether to call the original. Natively the decision must be made before the method returns, so the calling thread blocks until JS answers — and for most hookable Objective-C methods that thread is the main thread. Blocking it on the JS thread costs frames and risks deadlock whenever the JS thread is itself waiting on something main-thread-owned. `instead` is deferred behind its own feature gate.

#### Unpatching restores state, not just the callback

Unpatching in JS is complete: the original function is restored and nothing lingers. A native patch also *mutated live views*. Dropping the callback does not undo that.

So the unpatch token owns two things: the subscriber registration, and a ledger of every property write the patch performed. Unpatching unwinds the ledger.

#### The swizzle is loader-owned and refcounted

`possess` can patch one function repeatedly because each patch wraps the previous. Swizzling cannot work that way — two swizzles of one method capture each other's IMPs, and unload order then determines whether the chain is restored correctly.

The loader installs **exactly one swizzle per method**, on first subscription, and holds a subscriber list. Addons register against that list and never touch the method themselves. The swizzle comes out when the list empties. Per-addon swizzling cannot be made correct under arbitrary unload order, which is why the registry belongs to the loader.

### Threading

Discord runs the **bridgeless** New Architecture, and the loader already handles this correctly. `Unbound.xm` hooks `RCTHost`'s `instance:didInitializeRuntime:` to capture the runtime pointer, and injects the bundle through `callFunctionOnBufferedRuntimeExecutor`. `RCTHost` exists only in bridgeless; the `__fbBatchedBridge` handling in `packages/client/src/lib/loader.ts` is legacy fallback, not the live path.

The JS runtime always runs on a **dedicated thread**. `RCTJSThreadManager.mm` creates an `NSThread` named `com.facebook.react.runtime.JavaScript` running a CFRunLoop. There is no configuration that moves the bridgeless runtime onto the main thread.

#### `RuntimeExecutor` is always asynchronous

`RuntimeExecutor` never runs inline. `ReactInstance.cpp` builds it to unconditionally hop threads via `jsThread->runOnQueue(...)`, with no fast path for callers already on the JS thread. The header states it "may be invoked asynchronously."

One trap: `getUnbufferedRuntimeExecutor()` routes through `scheduleWork()`, which is `scheduleTask(SchedulerPriority::ImmediatePriority, …)`. **`ImmediatePriority` is a queue priority, not synchrony.**

The **Buffered** variant the loader uses for bundle injection adds *ordering*, never synchrony — it queues into a priority queue until `flush()`, then becomes a pass-through. RN's own comment: it "ensures that the main JS bundle finished execution before any JS queued into it from C++ are executed." The loader's use at `Unbound.xm:129` is exactly the intended one.

#### The synchronous path, and its price

`RuntimeScheduler::executeNowOnTheSameThread` does grant synchronous access, and Fabric's own synchronous work uses this same primitive rather than a privileged channel. Obtain the scheduler via `RuntimeSchedulerBinding::getBinding(runtime)->getRuntimeScheduler()`.

The mechanism should be understood before relying on it. When called from the main thread, the implementation schedules a block on the JS thread whose only job is to publish the `jsi::Runtime*` and then block on a future. The main thread wakes, takes that pointer, and runs the JS **on the main thread** while the JS thread sits parked. Mutual exclusion is achieved by parking the owning thread, not by locking. RN's internal name for this is `executeSynchronouslyOnSameThread_CAN_DEADLOCK`.

Re-entrancy is handled — both scheduler implementations keep a `thread_local jsi::Runtime*` and short-circuit nested calls, explicitly to avoid deadlock.

The header scopes intended use narrowly:

> Grants access to the runtime synchronously on the caller's thread. Shouldn't be called directly. it is expected to be used by dispatching a synchronous event via event emitter in your native component.

Reserve it for rare, genuinely user-driven events. For anything latency-tolerant, the async executor is correct.

#### Never call JS on a raw runtime pointer

RN constructs the runtime with `makeHermesRuntime(…)`, **not** `makeThreadSafeHermesRuntime`. Hermes ships a thread-safe variant; RN does not use it, so there is no internal lock.

Calling `jsi::Function::call` on a captured `jsi::Runtime*` from the main thread is therefore undefined behaviour, and the failure mode is heap or GC corruption rather than a clean assertion — it may not reproduce during testing. The `RuntimeExecutor` header warns about exactly this pattern: storing a runtime pointer "makes it more difficult to ensure that the Runtime is being accessed safely."

This applies to the loader's existing `static jsi::Runtime *gRuntime` (`Unbound.xm:16`). Its current uses are safe — the dereference at `Unbound.xm:193` is inside `_loadScriptFromSource:`, already on the JS thread — but the pointer is a hazard for anything added later. Route new work through an executor or the scheduler.

#### Layout-frequency methods

`layoutSubviews`, `drawRect:`, and cell reuse run often and on the main thread. **Per-invocation JS dispatch is not viable here**, and the register-once pattern is required rather than merely preferred.

Two costs compound. Each synchronous call is a full thread round-trip that *parks the JS thread* for its duration, so at layout frequency the UI and JS threads serialise against each other thousands of times per second. Less obviously, each call increments `syncTaskRequests_`, and `RuntimeScheduler_Modern::getShouldYield()` returns true while that is nonzero — so every sync call actively signals React to abandon in-progress rendering. Per-frame use would keep React permanently yielding.

This conclusion is reasoned from the blocking mechanism and the `getShouldYield` interaction, not measured; no published benchmark exists. An on-device profile would give a hard threshold, but the mechanism is clear enough to design against.

So the closure runs **once at registration** and returns a description the loader applies natively on every subsequent invocation, never re-entering JS:

```ts
patcher.layout('DCDChatListView', ctx => ({
	cornerRadius: radius,
	insets: { top: 4, bottom: 4 },
}));
```

The closure still captures JS state — `radius` above. Dynamism is preserved because the closure *produces* the recipe rather than *being* it, and the hot path stays native. Exhaust this pattern before considering an interpreter.

### Multiple addons

Composition is where the subtlest bugs live, so the semantics are specified rather than left to fall out of the implementation.

**Ordering is explicit.** Subscribers run in priority order, defaulting to registration order — which is load order, which is arbitrary. For composing patches that is fine; for conflicting ones "whichever loaded first wins" produces irreproducible reports, so `priority` is available to pin it.

**Conflicting writes resolve last-writer-wins, and unwind correctly.** If A sets corner radius 8 and B sets 12, one loses while both are loaded; that is inherent. What matters is that unloading B restores *A's* value, not the original. The ledger records a stack of prior values per property per view, and unwinding pops rather than resets.

**A throwing subscriber is isolated.** The error is caught, recorded against that addon's id, and remaining subscribers still run — matching the README's contract that a failing addon is caught and recorded, never fatal.

## The Objective-C bridge

The general-reach layer, and the one with real hazards. It exists so addons can reach frameworks the loader has not wrapped.

### Handles, not pointers

`call` returns an opaque integer **handle** indexing a native-side table. It must not return an address.

Returning a raw address fails three ways: JS numbers are doubles, so pointers above 2^53 lose precision and round-trip to a *different* address; a stale address after dealloc is a use-after-free rather than an error; and any JS value can be forged into a pointer, so `msgSend(0x41414141, …)` becomes arbitrary memory access, quietly defeating the allowlist.

The table entry holds the object, its retain state, the owning addon, and a **generation counter**. A forged handle is a table miss. A stale handle fails generation validation — reusing a slot bumps the generation, so an old handle throws instead of touching freed memory. That is the difference between a catchable JS error and an undiagnosable crash. The cost is one lookup per call, negligible beside `objc_msgSend` plus the JSI crossing.

### Memory management

JS has no destructors, so nothing tells native when a handle becomes garbage. Three mechanisms together:

**Ledger-scoped ownership** is the primary one. Every handle is tagged with its creating addon; plugin `stop()` releases everything that addon owns. The worst case is a leak bounded by the plugin's lifetime, not the app's.

**`scope()` for the common case.** Most native work is a short burst producing intermediates:

```ts
UnboundNative.iOS.scope(s => {
	const cls = s.getClass('UIColor');
	const color = s.call(cls, 'colorWithRed:green:blue:alpha:', 1, 0, 0, 1);
	view.setBackgroundColor(color);
});
```

Every handle created inside is released on exit — the `@autoreleasepool` pattern. Handles that must outlive the scope are explicitly promoted. This handles the overwhelming majority of allocations without the author reasoning about lifetimes.

**`FinalizationRegistry` as opportunistic cleanup.** Hermes supports it; wrap handles and release natively when the wrapper is collected. Finalizers are best-effort — not guaranteed to run, not prompt, never run for objects alive at teardown — so this reduces steady-state pressure and is never relied on for correctness.

### Ownership is the subtler bug

Leaks are the safe failure. Over-release is the dangerous one: `alloc`, `new`, `copy`, `mutableCopy` return +1; everything else returns +0 autoreleased. Releasing something never retained is a use-after-free that surfaces somewhere unrelated.

The bridge applies **selector-family rules** — inspect the selector name, determine the convention, and retain +0 returns so every handle uniformly owns a strong reference. Release is then always symmetric. This also covers the autorelease-pool-drain hazard, since the bridge retains at handle creation rather than storing a raw pointer.

### Type safety

`objc_msgSend` must be called through a function pointer cast to the correct signature. Wrong argument types read the wrong registers. Struct returns and floating-point returns diverge by ABI. Structs like `CGRect` and `UIEdgeInsets` pass by value across multiple registers and have no natural JS representation.

The bridge therefore **reads the runtime's own type encoding** via `method_getTypeEncoding` and validates supplied arguments against it, refusing on mismatch, with an explicit marshalling table per struct type. This is the single highest-value property of the bridge: it converts most crashes into catchable JS errors.

`respondsToSelector:` is checked before every call, or an unrecognized selector is a hard crash.

### Threading

The handle table is shared across the JS and main threads and needs a lock, which is cheap. More important: `call` on a UIKit object must execute on the main thread. Either the bridge dispatches automatically for UIKit classes, or `call` is only permitted inside a main-thread context such as a patcher callback. **Prefer the latter** — implicit dispatch makes ordering unpredictable and hard to debug.

### dlopen

Exposed **only for paths under `/System/Library/`**. Arbitrary paths would let an addon load an addon-supplied dylib, which is precisely what the signing constraint exists to prevent. This restriction is not advisory; without it the bridge re-enables what AMFI blocks.

### Feature detection

Two gates answering two different questions.

**Build capability** — does this Unbound install have the bridge:

```ts
if (UnboundNative?.supportsFeature('native.objc')) { … }
```

**Runtime availability** — does this device have the class. Framework availability is a runtime question: a private framework may exist on iOS 17 and vanish on iOS 18, or exist on iPhone but not iPad. So `objc.classExists(name)` and `objc.respondsTo(cls, sel)` ask the runtime directly.

On Android the feature reports unsupported and addons take their fallback path.

## Capabilities

If a patch or call can invoke arbitrary selectors it reaches `NSFileManager`, `NSURLSession`, keychain APIs, and `dlopen`. The bridge-versus-DSL question is irrelevant to this; an unbounded selector table means arbitrary native execution from a downloaded addon either way.

So selectors resolve against a **curated table**, addons declare required capabilities in the manifest, and argument types are checked against the method signature before the invocation is built — `setArgument:atIndex:` writes raw memory, so a type confusion is memory corruption rather than a logic error.

**This is the load-bearing section for safety.** Everything else is ergonomics.

It should be recorded plainly that a fully general Objective-C bridge is, functionally, arbitrary native code execution from a downloaded addon — reachable by data rather than by unsigned pages, but with a comparable reachable surface. The handle table makes it *memory-safe*; it does not make it *contained*. Containment is the allowlist and the `dlopen` restriction. Given Unbound's threat model this may well be acceptable — the README already frames it as a power-user tool whose safety story is recoverability — but it should be a deliberate decision rather than one that falls out of the API being convenient.

## The ledger

The loader owns, per addon: retained `jsi::Function` handles, subscriber registrations, objc handle-table entries, a stack of prior values per (view, property), and created views, layers, and observer registrations.

Teardown walks it in reverse. This is the piece the current addon manager has no equivalent of — teardown in `packages/client/src/managers/addons.ts` is cooperative, depending entirely on the plugin's own `stop()`. That is survivable for JS patches, which vanish on reload. It is not survivable for native state, where a leaked swizzle or orphaned subview persists until the app is killed and cannot be recovered by reloading the bundle.

Because the ledger is loader-owned, correct teardown does not depend on addon authors remembering to do it.

### Runtime invalidation

`BundleManager.reload()` destroys the `jsi::Runtime`. Every retained `jsi::Function` becomes dangling and the next hook invocation crashes. The loader must observe runtime teardown, invalidate every handle, tear down the objc handle table, and remove swizzles whose subscribers were all JS-backed. Reload is routine — reachable from the toolbox and from `native.reload()` — not an edge case.

## Android

`forwardInvocation:` has no counterpart; the equivalent would be dynamic proxies or ART method hooking, a different design. The roadmap lists the Android native module as unimplemented in its entirety.

The declarative layer is intended to be genuinely cross-platform. The patcher and the objc bridge are iOS-only behind feature gates. Designing one hook format for both platforms would contort it badly for no present gain.

## Feature gates

| Feature | Covers |
| --- | --- |
| `native.viewPatches` | Declarative match-and-set |
| `native.patcher` | `before` / `after` lifecycle hooks |
| `native.patcher.layout` | Register-once layout descriptions |
| `native.patcher.instead` | Blocking hooks with return values (deferred) |
| `native.objc` | The Objective-C bridge |

An install predating a capability reports it unsupported and the addon degrades rather than crashing.

## Open questions

**Selector drift.** Discord reshapes its Objective-C classes between releases. A patch pinned to `-[DCDChatListView _updateBubbleForCell:]` breaks silently, and unlike Metro finders — which search by shape — there is no fuzzy fallback. Structural matching should be preferred where the API can express it, but this is unsolved.

**Debuggability.** A misbehaving patch gives the author no stack trace, no breakpoints, and a crash inside `objc_msgSend`. A trace mode logging every operation with resolved arguments is needed on day one.

**Discord's RN version and feature-flag state.** This gates whether the synchronous path is safe to use at all. On RN `main` the main-queue coordinator path is unconditional, but on `v0.81.0` it is gated behind `enableMainQueueCoordinatorOnIOS()`; the legacy fallback does **not** pump UI tasks while waiting, so deadlock risk differs by version and flag. Relatedly, whether `RuntimeScheduler_Modern` or `_Legacy` is active is itself flag-selected. Pin both down before depending on `executeNowOnTheSameThread`.

**Whether a `RuntimeScheduler` is reachable from a swizzle context.** `RuntimeSchedulerBinding::getBinding(runtime)` is the documented retrieval path, but it requires runtime access to call, and it is unconfirmed that `RCTInstance`'s scheduler is reachable from tweak code. This gates the synchronous approach entirely and is worth resolving early.

**Hot-path latency is unmeasured.** The conclusion that per-frame dispatch is unviable is reasoned from the blocking mechanism, not benchmarked. An on-device profile would give a hard number, though it is unlikely to change the design.

## Sequencing

1. Correct the `UnboundNativeModule` typings. Stale (see below), and everything hangs off them.
2. Capability table and selector allowlist. The security boundary, and the hardest part.
3. Ledger and refcounted swizzle registry. Every layer needs these.
4. Declarative layer. Cross-platform, covers first paint, no threading complexity.
5. `before` / `after` with async dispatch.
6. Layout descriptions.
7. The objc bridge, with handles, scopes, and encoding validation.
8. `instead`, only if a concrete case demands it.

Parameterized mechanisms are not a numbered step; they are ongoing, and should absorb feature work that would otherwise push the lower layers.

## Existing drift to fix first

**The typings were stale and have been corrected.** `UnboundNativeModule` in `packages/types/global.d.ts` declared a flat surface (`getDeviceModel()`) while `docs/modules/native.mdx` documents a namespaced one (`device.getModel()`), and was missing all eight feature-negotiation functions plus `evaluateBytecode`. Since `packages/api/src/native.d.ts` is generated from it, addon developers had wrong autocomplete for the entire native surface — including `supportsFeature`, which this design expects them to call. Run `bun run generate-sdk` to regenerate the API package.

**Plugin evaluation and teardown.** `packages/client/src/managers/plugins.ts` interpolates bundle text into a template literal passed to `eval` in the client's own scope, and teardown is cooperative. Tolerable while patches are JS-only; adding native mutation makes loader-owned tracking a requirement rather than an improvement.

## Performance note on the existing implementation

Independent of this design, two things in `ChatUI.x` are worth a look. `updateMentionAvatarsInView:` walks the entire key window on every scheduled update, and `mentionAvatarTextFromOriginal:` is O(labels × occurrences) with a `rangeOfString:` scan per label. Both are fine at small mention counts and could bite on large tables.
