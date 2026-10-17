# ADR-0001 — Stage 0: feasibility and architecture for destination-to-Garmin walking navigation

- **Status:** Proposed. Needs product-owner approval before Stage 1.
- **Date:** 2026-10-17
- **Scope:** iPhone 14 Pro (iOS 27.0.1) → Garmin fēnix 9 Pro 47 mm (firmware 6.48, onboard maps), walking navigation.
- **Where this research was done:** a Linux cloud container. It had no Xcode, no Connect IQ SDK and no access to your devices. **Nothing here has been built, installed or run on hardware yet.** Every claim about real device behaviour is marked as a hypothesis until Stage 0/1 tests run on your Mac, iPhone and watch.

## Evidence labels

| Label | Meaning |
|---|---|
| **[V]** | Verified in an official primary source (Garmin API docs, Garmin SDK headers or guide, Apple docs, Garmin manual). |
| **[V-src]** | Verified by reading Garmin's shipped SDK binary or headers directly (repo `garmin/connectiq-companion-app-sdk-ios`, last commit 2026-01-15, framework built against the iOS 26.1 SDK, minimum iOS 12.0). |
| **[R]** | Reported by developers or users (forums, GitHub). Credible, but not official. |
| **[I]** | Engineering inference from the verified facts. |
| **[H]** | Hypothesis that must be tested on your devices. |
| **[U]** | Unknown. |

---

## 1. Verified capabilities

### A. Destination sharing (iOS)

| Capability | Status |
|---|---|
| Our own app can appear as a Share-sheet target through a Share Extension, independent of Garmin Connect. | **[V]** Standard Apple App Extension API. |
| Apple Maps → share extension payload on iOS 18.5: `public.plain-text`, `public.url`, `com.apple.mapkit.map-item`. | **[R]** Apple Developer Forums thread 801799. |
| Apple Maps → share extension payload on **iOS 26**: only `public.url` and `public.plain-text`. The `map-item` was dropped. On real devices the URL is a short `https://maps.apple/p/…` link **with no coordinates**. The simulator still emits long `maps.apple.com/place?…&coordinate=…&place-id=…` links. | **[R]** Apple Developer Forums threads 801799 and 805396. One report says Apple DTS mentioned a server-side change rolling out, but it is not confirmed as settled. |
| Apple Maps place URLs carry `coordinate`, `address`, `place-id` and `name` parameters (Unified Map URLs, iOS 18+). Apple recommends using Place IDs. | **[V]** WWDC24 session 10097 and Apple's "Unified Map URLs" documentation. |
| MapKit can resolve a Place ID to an `MKMapItem` (`MKMapItemRequest` / `MKMapItem.Identifier`, iOS 18+). | **[V]** Apple MapKit API. |
| Plain-text addresses can be geocoded on the device with MapKit's geocoding or local search. | **[V]** Uses Apple's servers, so it needs a network connection. |
| Resolving `maps.apple/p/…` or `maps.app.goo.gl/…` short links by following HTTP redirects. | **[R]** Works today according to developers. **Undocumented and fragile.** Use only as a fallback, never as the primary path. |
| What iOS **27.0.1** actually delivers from Apple Maps and Google Maps. | **[U]** Must be measured with a payload-probe extension (Experiment 1b). |

**Conclusion:** destination capture is feasible, but the Apple Maps payload format has changed once already (iOS 26), so the design must not depend on a single format. The parser needs a ranked chain of strategies, each with fixture tests (see §4).

### B. Phone → watch communication

| Capability | Status |
|---|---|
| The official channel is the **Connect IQ Mobile SDK for iOS**, distributed as a Swift Package (`ConnectIQ.xcframework`). | **[V-src]** |
| **Garmin Connect Mobile (GCM) must be installed.** It is used once, to let the user choose which paired watch to share with our app (`showConnectIQDeviceSelection` → GCM returns a URL to our app). | **[V-src]** |
| After device selection, **our app talks to the watch directly over Bluetooth LE**, using its own `CBCentralManager` inside the SDK. GCM does not relay messages. | **[V-src]** Guide: "communicate directly with Connect IQ-compatible devices over Bluetooth". The headers mention the SDK's internal `CBCentralManager`. |
| Required `Info.plist` setup: a URL scheme (or universal link), `LSApplicationQueriesSchemes` containing `gcm-ciq`, `CFBundleDisplayName`, and a Bluetooth usage description. Optional: the "Uses Bluetooth LE accessories" background mode plus a state-restoration identifier, so iOS can relaunch the app on Bluetooth activity. | **[V-src]** |
| `sendMessage` takes `NSString`, `NSNumber`, `NSArray`, `NSDictionary` and `NSNull`, nested, and delivers to the watch app's **mailbox**. | **[V-src]** |
| Possible send results: Success, Unknown, InternalError, DeviceNotAvailable, AppNotFound, DeviceIsBusy, UnsupportedType, InsufficientMemory, Timeout, MaxRetries. | **[V-src]** |
| `getAppStatus` reports whether our watch app is installed, and its version. | **[V-src]** |
| `openAppRequest` shows a prompt on the watch asking to open our app. | **[V-src]** |
| On the watch: `Communications.registerForPhoneAppMessages` (API 1.4) delivers queued mailbox messages ("called immediately once for each waiting message"). `transmit` sends data back over BLE. | **[V]** |
| On the watch: `Background.registerForPhoneAppMessageEvent` (API 3.2) wakes a background service when a phone message arrives. **fēnix 9 Pro is listed as supported.** | **[V]** |
| On the watch: `registerForPhoneAppMessageErrors` (API 6.0) reports OUT_OF_MEMORY and OUT_OF_STORAGE. The fēnix 9 Pro is at API 6.0. | **[V]** |
| **No numeric message-size limit is documented** on either side. Only "too large" and "insufficient memory" errors exist. | **[V]** That no limit is documented is itself verified. The practical limit must be measured. |
| **`IQSendMessageResult_Success` is a transport result, not proof that our app processed and stored the destination.** | **[I]** We therefore need an application-level ACK sent back from the watch. |
| Behaviour when GCM is force-closed after device selection. | **[H]** Probably still works, because the SDK owns its BLE link. Must test. |
| Behaviour when our iOS app is suspended in the middle of a transfer. | **[H]** With the BLE background mode, short transfers probably complete. Must test. |

**Conclusion:** sending a structured destination with confirmed, app-level delivery is feasible using only official APIs.

### C. Native maps and navigation on the fēnix 9 Pro (Connect IQ, API 6.0)

| # | Question | Answer |
|---|---|---|
| 1 | Show Garmin's map? | **Yes [V].** `WatchUi.MapView` / `MapTrackView` (API 3.0) render the device map. It is "rendered statically", runs in browse or preview mode, and accepts `MapPolyline` and `MapMarker`. That it uses your installed onboard maps on the fēnix 9 Pro is **[I]**, highly likely but untested. Drawing custom graphics *on top of* the MapView is **[U]**. |
| 2 | Draw a route overlay? | **Yes [V].** `MapView.setPolyline`. |
| 3 | Use the watch's native routing engine from our code? | **No [V/R].** There is no `Toybox.Navigation` API, and no routing API in any Connect IQ version. |
| 4 | Start native turn-by-turn navigation to a supplied coordinate? | **Indirectly, yes [V] with one inference [I].** `PersistedContent.saveWaypoint(location, {:name})` (API 2.2; **fēnix 9 Pro 47 mm is listed**) → `getAppWaypoints()` → `Waypoint.toIntent()` → `System.exitTo(intent)`. `exitTo` always shows a **confirmation dialog** on the watch, then our app exits. That this intent opens native "Navigate to" is **[I]**. **[R]** one forum bug report says that on some fēnix/epix/Enduro firmware the waypoint intent navigated to the wrong coordinates. This is the top item to test. |
| 5 | Read the native route's turn instructions or geometry? | **No [V].** Persisted content exposes names and IDs, not coordinates. |
| 6 | Access stored waypoints and courses? | **Read names/IDs, launch them, and remove ones our app owns [V].** |
| 7 | Navigate on onboard data only? | **Yes, natively [V/R].** Garmin's manual ("Rerouting a Course") describes off-course recalculation. With the course routing setting "Use Map", the watch recalculates on its own maps and generates turn prompts **[R]**. The exact fēnix 9 menus are **[U]**. |
| 8 | Put a full multi-point course into the watch's native course storage from our app? | **Yes, with a constraint [V].** `makeWebRequest` with `HTTP_RESPONSE_CONTENT_TYPE_FIT` or `_GPX` makes the system "download and parse a FIT or GPX file and store the contained data in the device". The file must come from an **HTTPS URL**, fetched through the phone. **[R]** HTTP 200 does *not* mean the file was accepted (corrupt files are silently dropped), and `getCourses()` can return stale results. Acceptance has to be confirmed through the course store, and only on real hardware. |
| 9 | Use Garmin Connect's own "share location from Apple Maps" feature? | **Documented by Garmin for the fēnix 9 [V]** (manual: "Sharing a Location From a Map Using the Garmin Connect App"; the location lands in the watch's Saved list). **Broken for you:** the share target is missing. **[R]** This is a known iOS 26-era regression that came and went for other users, with no official fix. Sharing a GPX *file* to Garmin Connect reportedly still works **[R]**. |

**An important risk discovered:** **[R]** on 2026-10-08 a Connect IQ developer reported that on fēnix 9 **Pro** models, Connect IQ apps that record their own GPS activity lose GPS after about 14 seconds in over half of sessions. Garmin's built-in sport profiles are not affected. The report is unverified, but it argues strongly against building our own GPS navigator inside Connect IQ as the primary design.

### D. Routing

| Item | Status |
|---|---|
| MapKit walking directions (`MKDirections.Request.transportType = .walking`) return route geometry and steps (instruction text, distance, polyline). | **[V]** Computed on Apple's servers, so it needs a network connection and sends the start and end points to Apple. |
| An Apple walking route will not exactly match the geometry of Garmin's onboard map. | **[I]** On a native course with "Use Map" routing, the watch re-snaps to its own map. A custom navigator would have to tolerate the offset. |
| Offline re-routing in our own Connect IQ code. | **Not feasible at sensible cost [I].** It would need a routing graph plus a routing engine on the watch, and there is no documented access to Garmin's map data. **Only Garmin's native navigation can re-route offline.** |
| Pedestrian correctness in Barcelona (Apple vs Garmin onboard). | **[U]** Must be benchmarked on real walks (test plan §8). |

### E. Performance and memory

| Item | Status |
|---|---|
| fēnix 9 Pro 47 mm: API level 6.0, 454×454 round AMOLED, part number 010-04336-10. | **[V]** Garmin compatible-devices page. |
| Per-app-type memory limits for the fēnix 9 Pro. | **[U]** Not on the public page. Read them from the SDK's `devices/<id>/compiler.json` once the SDK is installed on your Mac. |
| Background data limit: `Background.exit()` ≈ 8 KB; `requestApplicationWake` message ≤ 255 bytes. | **[V]** |
| Phone → watch message size limit. | **[U]** Measure it (Experiment 2). |
| Battery cost of native navigation vs a custom Connect IQ navigator. | **[U]** **[I]** Native should be better, because Garmin tunes its own GPS and display duty cycle. |

---

## 2. Unsupported or unverified capabilities (summary)

- **Unsupported [V]:** calling the native routing engine; reading native routes or turn instructions; creating courses directly in code (only `saveWaypoint` writes, plus the FIT/GPX web download); direct Bluetooth to the watch without the Connect IQ SDK; Garmin Connect as a dependable Apple Maps share target.
- **Unverified [H]:** that the waypoint intent opens native walking navigation on firmware 6.48 with correct coordinates; that native "navigate to point" routes along streets and paths for walking; the Apple Maps share payload on iOS 27.0.1; the practical message size; behaviour with GCM killed or our app suspended; whether a MapView on the fēnix 9 Pro shows onboard TopoActive detail; whether FIT course downloads land in the course store on real hardware.

---

## 3. Recommended architecture

### Options evaluated

| | **O1 — Garmin Connect native share** | **O2 — Waypoint hand-off (recommended first)** | **O3 — Course hand-off (planned upgrade)** | **O4 — Custom Connect IQ navigator** |
|---|---|---|---|---|
| What reaches the watch | Saved location | Saved waypoint created by our watch app | Full Apple walking route as a native FIT course | Route geometry and maneuvers inside our app |
| Who routes | Garmin, on the watch | Garmin, on the watch | Apple, on the phone; watch can re-route on its own maps | Apple, on the phone |
| Map on the watch | Native | Native | Native | `MapView` + polyline, plus our own screens |
| Turn-by-turn | Native | Native | Native course points / Use Map | Ours |
| Offline re-route | Native [H] | Native [H] | Native with "Use Map" [R] | **Not possible** (phone only) |
| Exposed to the CIQ GPS fault [R] | No | No | No | **Yes** |
| Server needed | No | No | **Yes**: a stateless HTTPS endpoint that returns the FIT file, or the localhost path [H] | No |
| Delivery confirmation | No | **Yes**: app-level ACK | Yes: ACK + course-store check | Yes |
| Engineering size (rough) | 0 | Small: share extension + iOS app + about 300 lines of Monkey C | Medium: O2 + FIT encoder + relay | Large: O2 + navigation engine, UI, GPS, off-route logic |
| Status for you today | **Broken** (share target missing) | Viable if the native-routing test passes | Viable if FIT-download test passes | Viable but the riskiest and most work |

### Decision

**GO, conditionally:** build **O2 (waypoint hand-off)** as the Stage 1 proof and first product. It is also the smallest end-to-end test of the communication layer.

Escalate to **O3** only if real walks show Garmin's onboard pedestrian routing is inadequate in Barcelona, *and* you approve a minimal stateless relay. Treat **O4** as a fallback only, if both native paths fail on hardware.

Why: O2 gets you a real map, real turn-by-turn, and offline re-routing from Garmin's own firmware, which no third-party code can match. It avoids the reported Connect IQ GPS fault and needs no server. Our product's value then sits exactly where competitors fail: dependable capture of the destination, explicit confirmed delivery, and recoverable errors.

**The main compromise of O2:** the street-level route is Garmin's, not Apple's. After `exitTo`, our app has exited, so **we cannot observe native navigation state** ("started", "completed"). The state machine therefore ends at *"hand-off confirmed on watch"*, and we will not pretend otherwise.

### Component diagram (O2)

```
 iPhone                                                      fēnix 9 Pro
┌──────────────────────────────────────────┐               ┌──────────────────────────────────────┐
│ Apple Maps / Google Maps / Safari / Notes │               │ Garmin firmware (native)              │
│        │ Share                            │               │  Saved locations · Maps · Routing    │
│        ▼                                  │               │  Navigate-to · Off-course recalc      │
│ ShareExtension (Swift)                    │               │            ▲ System.exitTo(intent)   │
│  - collect URL/text/map-item attachments  │               │            │ (user confirms)         │
│  - hand off via App Group + open app      │               │ CIQ watch app "Courier" (Monkey C)   │
│        ▼                                  │               │  - mailbox / background msg handler  │
│ Main app (SwiftUI)                        │   BLE via     │  - validate (version, CRC, ranges)   │
│  DestinationResolver (ranked strategies)  │  Connect IQ   │  - idempotency store (last N ids)    │
│  ConfirmView (map preview, name, coords)  │  Mobile SDK   │  - PersistedContent.saveWaypoint     │
│  TransferService (state machine, retries) │ ────────────► │  - ACK {id, STORED|DUP|REJECTED}     │
│  ConnectIQ SDK  ◄─────────────────────────│ ◄──────────── │  - "Navigate to <name>?" screen      │
│  DiagnosticsLog (local, opt-in detail)    │   ACK         │  - cleanup of old owned waypoints    │
└──────────────────────────────────────────┘               └──────────────────────────────────────┘
        GCM (Garmin Connect Mobile): one-time device selection only
```

### Data flow (O2)

1. You tap Share in Apple Maps and choose our app → the extension stores the raw attachments plus a new `transferId` in the App Group container. It does no network work.
2. The main app opens → `DestinationResolver` tries strategies in order (§4) → `Destination{lat, lon, name, source, confidence}`. **State: RESOLVED**, shown on a confirm screen.
3. You tap Send → `getAppStatus` (is our watch app installed?) → `sendMessage(DEST)`. **State: TRANSFER_INITIATED**, then **TRANSPORT_OK** when the SDK returns Success.
4. The watch receives the message (foreground app, or background service woken by the message) → validates → `saveWaypoint` → confirms the waypoint exists via `getAppWaypoints` → `transmit(ACK STORED)`. **Phone state: ACKNOWLEDGED + STORED.**
5. The watch vibrates and shows "Navigate to *Name*? (1.2 km)". You press Start → `exitTo(waypoint.toIntent())` → you confirm in the system dialog → native navigation. If the phone is still connected, the watch first sends `HANDOFF_REQUESTED`. **State: HANDOFF_CONFIRMED.**
6. From then on, the phone can go in your pocket or be switched off. Navigation and re-routing are Garmin's, offline.

---

## 4. Destination resolution strategy (ranked)

1. `com.apple.mapkit.map-item` attachment, if iOS 27 has restored it → `MKMapItem` directly.
2. Long Apple Maps URL → parse `coordinate=` (or legacy `ll=`) plus `name=` and `address=`. If only `place-id=` is present → `MKMapItemRequest`.
3. Coordinates in plain text (decimal degrees, with or without a sign or N/S/E/W) → validate ranges.
4. Google Maps long URL → `@lat,lng`, `q=lat,lng`, `ll=` or `query=`.
5. Plain-text address → MapKit geocoding. If there are several results, you pick one; nothing is auto-picked silently.
6. **Fallback only:** short links (`maps.apple/p/…`, `maps.app.goo.gl/…`) → follow redirects with a 3 s cap, then re-enter step 2 or 4. This path is labelled "best effort" in the logs.
7. If everything fails, show "Couldn't read a location from this share" and offer: paste or search an address, or drop a pin. **The input is never discarded silently.**

Each strategy gets fixture-based unit tests built from real payloads captured on your iPhone (Experiment 1b).

---

## 5. Communication protocol v1

Messages are `NSDictionary` objects. Coordinates are sent as **integer degrees × 10⁷** (32-bit range is enough: |lon| ≤ 1.8×10⁹ < 2³¹). This avoids silent float narrowing during the SDK's NSNumber → Monkey C conversion; 1e-7° is about 1 cm.

```
Phone → watch   DEST   {v:1, t:"DEST", id:"<uuid>", lat:413870123, lon:21700456,
                        name:"Sagrada Família" (≤ 40 chars), src:"apple_url", ts:<unix s>,
                        crc:<CRC32 of "v|t|id|lat|lon|name">}
Watch → phone   ACK    {v:1, t:"ACK", id, st:"STORED"|"DUP"|"REJECTED", err:<code|null>, wp:<waypointId|null>, fw:"<ciq app ver>"}
Watch → phone   EVT    {v:1, t:"EVT", id, ev:"HANDOFF_REQUESTED"|"HANDOFF_DECLINED"}
Phone → watch   PING   {v:1, t:"PING", id}         → watch replies ACK st:"PONG" (for diagnostics and latency)
```

Rules:
- **Versioning:** the watch rejects `v` higher than it supports with `err:"UNSUPPORTED_VERSION"`, and the phone shows "Update the watch app".
- **Integrity:** the watch recomputes the CRC32 and range-checks lat/lon. On a mismatch it replies `REJECTED/BAD_CRC` and saves nothing.
- **Idempotency:** the watch keeps the last 20 `id → waypointId` pairs in `Application.Storage`. A repeated `id` returns `DUP` with the original `wp` and saves nothing new. On the phone, one share equals one `transferId`, so retries reuse it.
- **Timeouts and retries:** the ACK timeout is 8 s after TRANSPORT_OK, with at most 3 attempts and 2 s / 4 s backoff. After that the state is `FAILED(reason)` and the app shows a clear message. There is never an endless spinner.
- **The watch app is not running:** the message waits in the mailbox; the background service is woken [V] and stores the waypoint, then sends the ACK if allowed in the background [H]. Otherwise the phone offers "Open on watch" (`openAppRequest`).
- **No chunking in v1:** a destination message is about 200 bytes. Chunking is designed only if O4 or large payloads become necessary.
- **Waypoint hygiene:** the watch removes waypoints *it owns* that are older than the last 10 (`Waypoint.remove()`, API 3.0, owner-only) so your Saved list does not fill with clutter.

---

## 6. Offline navigation strategy

- **O2/O3:** offline behaviour is Garmin's native behaviour. It keeps tracking, keeps showing turns, and re-routes when off course using onboard maps (**[R]**, to be confirmed on the fēnix 9). Our app has nothing left to do after hand-off, and so nothing that can crash mid-walk.
- **O4 only:** offline route following of the stored geometry, with off-route detection (for example: 3 consecutive fixes more than 30 m from the route with accuracy under 20 m). Re-routing would need the phone, and the UI would say "Automatic rerouting unavailable — phone not connected". No invented instructions.

---

## 7. Major technical risks (ranked by likelihood × impact)

| # | Risk | Mitigation / cheapest test |
|---|---|---|
| 1 | **The waypoint intent does not open native walking navigation, or opens it with wrong coordinates** on firmware 6.48 ([R] bug report). This kills O2. | Experiment 1, step 5, with a known coordinate, checking the distance shown on the watch. Fallback: the user opens Navigate → Saved Locations (2–3 presses), or move to O3. |
| 2 | **Garmin's onboard routing is poor for pedestrians** (straight lines, or road-only routes that miss pedestrian paths). | Experiment 0 (no code): navigate manually to 3 saved Barcelona points. If routing is poor, O3 (Apple route as course) becomes necessary. |
| 3 | **The Apple Maps share payload on iOS 27 contains no coordinates or Place ID** (iOS 26 regression pattern). | Experiment 1b payload probe. Fallbacks: the text payload usually holds name and address → geocode; follow the short link as best effort. |
| 4 | **Connect IQ Mobile SDK pairing friction**: the GCM device-selection callback sometimes fails to return ([R] several forum threads). | Set `CFBundleDisplayName` and `gcm-ciq`, and consider universal links. Device selection is one-time and stored. |
| 5 | **The reported fēnix 9 Pro Connect IQ GPS fault** [R] | Avoided by design in O2/O3. It is decisive against O4. |

---

## 8. Test plan (Stage 0–1 portion; later stages expand §10 of the brief)

| ID | Test | How measured | Pass |
|---|---|---|---|
| E0.1 | Native walk routing, no code | On the watch: Walk activity → Navigate → Saved Locations → a point saved about 800 m away in Eixample | Route follows streets, turn prompts appear, ≥ 1 deliberate wrong turn triggers recalculation without the phone (phone in flight mode) |
| E0.2 | GCM share target | Apple Maps → Share → Edit Actions → look for Garmin Connect; record GCM version | Recorded either way (benchmark baseline) |
| E0.3 | GPX → Garmin Connect | Share a test GPX to GCM; check it syncs as a course | Recorded (O3 fallback path without a server) |
| E1b | Share payload probe | The extension logs UTIs plus the raw values from Apple Maps (place, address, dropped pin), Google Maps, Safari text, Notes coordinates | A fixture file per source; resolution strategy chosen per source |
| E1 | End-to-end DEST → ACK → hand-off | §9 acceptance criteria | All pass |
| E2 | Message size ceiling | Send 1, 2, 4, 8, 16, 32 KB string payloads | Largest size that succeeds 20/20 recorded |
| E3 | Fault cases | Watch Bluetooth off; GCM force-closed; our app backgrounded mid-send; watch app closed (mailbox); same `id` sent 3 times; corrupted CRC; `v:2` | Correct state and message each time; zero duplicate waypoints; zero accepted corrupt messages |

Latency method: the phone records monotonic timestamps at Send-tap, TRANSPORT_OK and ACK received. p50/p95 are computed with the nearest-rank method over ≥ 30 trials, with the watch connected and the phone within 1 m. External latency (geocoding, redirects) is logged separately from local parsing time.

---

## 9. Minimal proof of concept and acceptance criteria (Stage 1)

**Build:** (a) a SwiftUI app with the Connect IQ SDK: a "Select watch" button, hard-coded test destinations, a Send button and a live state log; (b) a Connect IQ watch app: message handler, validation, `saveWaypoint`, ACK, a "Navigate?" screen, `exitTo`. There is no share extension yet; that is the separate probe E1b.

**Acceptance criteria — Stage 1 passes only if all of these hold on your real devices:**

1. Device selection through GCM returns to our app and the fēnix 9 Pro shows as `Connected` with characteristics discovered.
2. `getAppStatus` reports our watch app as installed with the correct version.
3. 30 of 30 sends of a DEST message produce `ACK STORED` (first send) or `ACK DUP` (resends of the same `id`), with **zero duplicate waypoints** in the watch's Saved list.
4. ACK latency p95 ≤ 3 s (Send-tap → ACK), connected, ≤ 1 m.
5. A deliberately corrupted CRC and a `v:2` message are **rejected, nothing is saved**, and the phone shows the correct error.
6. With our watch app closed, a sent message is stored when it is next opened, or by the background service, and is then ACKed. The behaviour is recorded either way.
7. The phone **never shows "Delivered" on TRANSPORT_OK alone**, only on ACK.
8. "Navigate" on the watch opens Garmin's native navigation to the **correct** point: the distance shown on the watch is within ±5 % of the distance shown in Apple Maps, for 3 test points.
9. With the phone in flight mode after hand-off, a 500 m walk completes with turn prompts, and one deliberate deviation triggers native recalculation.

If criterion 8 or 9 fails, stop and return to this ADR (switch to O3 or O4) before Stage 2.

---

## 10. Expected limitations (O2)

- The route is calculated by Garmin's onboard engine, not Apple's. Its quality in Barcelona is to be measured (E0.1).
- One confirmation press on the watch (`exitTo` system dialog) is unavoidable.
- After hand-off, our app cannot see whether you started or finished navigation.
- GCM must be installed (one-time device selection). Connect IQ watch apps must be sideloaded (personal) or published (public, subject to Garmin review).
- Destination capture from Apple Maps depends on what iOS exposes. It may need the network (geocoding or redirects) when a share carries no coordinates.
- MapKit geocoding and routing send queries to Apple. Nothing is sent to us. There is no server and no analytics.

---

## 11. Go / no-go

**GO for Stage 0 experiments (E0, E1b) and for Stage 1 (O2 PoC)**, conditional on the acceptance criteria in §9.

**NO-GO** for: a custom offline routing engine; a custom Connect IQ navigator (O4) as the primary design; any server, until O3 is justified by E0.1 results and you approve it.

## Sources

- Garmin Connect IQ API: [MapView](https://developer.garmin.com/connect-iq/api-docs/Toybox/WatchUi/MapView.html), [PersistedContent](https://developer.garmin.com/connect-iq/api-docs/Toybox/PersistedContent.html), [Waypoint](https://developer.garmin.com/connect-iq/api-docs/Toybox/PersistedContent/Waypoint.html), [Communications](https://developer.garmin.com/connect-iq/api-docs/Toybox/Communications.html), [Background](https://developer.garmin.com/connect-iq/api-docs/Toybox/Background.html), [System](https://developer.garmin.com/connect-iq/api-docs/Toybox/System.html), [Compatible devices](https://developer.garmin.com/connect-iq/compatible-devices/)
- Garmin iOS SDK: [garmin/connectiq-companion-app-sdk-ios](https://github.com/garmin/connectiq-companion-app-sdk-ios) (headers and `documentation/ConnectIQ_iOS_SDK.html` read directly)
- fēnix 9 / 9 Pro: [Garmin press release](https://www.garmin.com/en-US/newsroom/press-release/outdoor/garmin-expands-its-flagship-performance-smartwatch-lineup-with-fenix9-and-fenix9-pro/), [SDK Manager announcement](https://forums.garmin.com/developer/connect-iq/b/news-announcements/posts/fenix-9-and-fenix-9-pro-now-available-from-connect-iq-sdk-manager), [fēnix 9 manual: sharing a location](https://www8.garmin.com/manuals-apac/webhelp/fenix9/EN-SG/GUID-A7BB8054-A830-4B5E-ACD9-B6A2F9D35D06-1263.html), [Rerouting a Course](https://www8.garmin.com/manuals/webhelp/GUID-16B12CFE-F96E-4DE9-9F5F-8C4A5936D3B9/EN-US/GUID-62C3249E-F56E-467B-A9DA-83D907CDF4E6.html)
- Developer reports: [fēnix 9 Pro CIQ GPS fault (the5krunner)](https://the5krunner.com/2026/10/08/fenix-9-pro-gps-problem/), [Waypoint intent wrong coordinates](https://forums.garmin.com/developer/connect-iq/i/bug-reports/waypoint-intents-fail-to-launch-correct-navigation-to-coordinates), [exitTo course during activity](https://forums.garmin.com/developer/connect-iq/i/bug-reports/bug-navigating-a-course-via-system-exitto-fails-if-native-activity-is-already-running), [FIT download findings](https://github.com/ssalonen/garmin-router-widget/pull/29), [GCM missing from share sheet on iOS 26](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-mobile-ios/421564/garmin-connect-missing-from-share-card-in-google-and-apple-maps-in-ios26/1974406), [GCM device selection not returning](https://forums.garmin.com/developer/connect-iq/i/bug-reports/connectiq-sdk-for-mobile---ios-16---launches-garmin-connect---doesn-t-present-device-selection-or-call-back-app)
- Apple: [Apple Maps share payload change on iOS 26 (forum 801799)](https://developer.apple.com/forums/thread/801799), [forum 805396](https://developer.apple.com/forums/thread/805396), [Unified Map URLs](https://developer.apple.com/documentation/mapkit/unified-map-urls), [WWDC24 10097 (Place IDs)](https://developer.apple.com/videos/play/wwdc2024/10097/)
