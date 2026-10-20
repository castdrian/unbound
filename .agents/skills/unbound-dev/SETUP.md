# vphone setup and recovery

## Recovery

Match the doctor's `FAIL` line.

| FAIL                              | Fix                                                                                                                                                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tmux `unbound-dev` / manifest     | `tmux new-session -d -s unbound-dev "cd /home/dev/unbound && UNBOUND_API_URL=<api, optional> PORT=3100 DEV_HOST=100.65.233.54 bun run --filter @unbound-app/client dev 2>&1 \| tee /tmp/unbound-dev.log"`. Ready when the log shows `Build completed successfully`.                                           |
| tmux `unbound-debugger` / `:9091` | `tmux new-session -d -s unbound-debugger "cd /home/dev/unbound && bun packages/debugger/src/index.ts --port 9091 2>&1 \| tee /tmp/unbound-debugger.log"`                                                                                                                                                      |
| device eval                       | Relaunch Discord (SKILL.md loop step 2). Still failing: the vphone tool is missing (MCP connector down on the Mac, check `mcp__tailnet__list_machines` lists `vphone`), Discord is frozen (see [UnboundResources](#unboundresources)), or `settings.json` lost the debugger keys (see [Settings](#settings)). |
| catalog stub                      | `tmux new-session -d -s marketplace-api "cd /home/dev/unbound && bun .agents/skills/unbound-dev/scripts/catalog-stub.ts 2>&1 \| tee /tmp/marketplace-api.log"`                                                                                                                                                |

## Network shape

The VM reaches the VPS at `100.65.233.54` over plain HTTP: `:3100` bundle server, `:9091` debugger bridge, `:3200` catalog stub. Moving files and shell details are in the `vphone` skill.

## From nothing

Each step ends with its check.

1. **Discord IPA.** Use the `dkrypt` skill: `.agents/skills/dkrypt/scripts/fetch-ipa.sh com.hammerandchisel.discord appstore`. Check: it prints `ok <path>`.
2. **Relax ATS.** iOS blocks the loader's plain-HTTP fetch (`kCFErrorDomainCFNetwork -1022`) until `Info.plist` allows arbitrary loads. Run `python3 .agents/skills/unbound-dev/scripts/patch-ats.py <in.ipa> <out.ipa>`. Current patched build: `~/ipas/discord-349.0-114462-ats.ipa`.
3. **Install.** Per the `vphone` skill's Installing section. Check: `list_apps` shows Discord.
4. **Loader.** Build the debug package so attestation is off: `zsh -c 'cd ~/loader-ios && make clean package DEBUG=1'` (a release build shows "SECURITY WARNING" and skips hooking React Native). Install it per the `vphone` skill's Installing section (tweak). Check: launching Discord shows the wrench toolbox button and the red "DEVELOPMENT BUILD" banner.
5. <a id="unboundresources"></a>**UnboundResources.** Copy `/var/jb/Library/Application Support/UnboundResources.bundle` into the installed `Discord.app` (path from `app_info`'s `bundle_path`, under `/rootfs`), owned `_installd:_installd`. Without it `modules.js` is never injected and the `__c()` fault freezes Discord. Redo after every IPA install. Check: Discord goes live (presence dots, badges).
6. <a id="settings"></a>**Settings.** Write `<data_path>/Documents/Unbound/settings.json` (owner `mobile:mobile`):
    ```json
    {
    	"unbound": {
    		"loader": {
    			"update": { "url": "http://100.65.233.54:3100/unbound.bundle", "hmr": true }
    		},
    		"debugger": { "enabled": true, "address": "100.65.233.54:9091" }
    	}
    }
    ```
    The client rewrites this file; keep its other keys when editing. Check: relaunch, then `ubd eval 'typeof unbound' --port 9091` returns `object`.
7. **Log in** only if logged out; the account is the user's, so ask for credentials. Press "Log In" on the welcome screen, then type each field one character per call and confirm with the password eye toggle before submitting. Dismiss tracking, Nitro and notification prompts with presses on "Ask App Not to Track", "Maybe Later", "Continue".
