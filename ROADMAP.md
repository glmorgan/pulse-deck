# Roadmap

Not a wishlist — things with a reason, roughly in the order they earn their place. Each entry
says what it costs, because that is the part that is easy to forget when it is written down.

## Checks beyond HTTP

Today a check is `fetch` and nothing else. A TCP connect check fits the existing shape: the state
machine only consumes *did it succeed*, *how long did it take* and *what went wrong*, so history,
chart, key and thresholds all work unchanged.

- A service needs a **type** (`http`, `tcp`), and the add/edit form has to show different fields
  per type — `expectedStatusCode` and `expectedBodyContains` are HTTP-only.
- Optional banner match for TCP (SMTP's `220`, an SSH version string), which is the TCP analogue
  of the body match.
- The checks table's Code column is already hidden when no row has a value, so a board mixing
  types needs nothing there.
- DNS resolution is a smaller version of the same job and could share the type mechanism.

ICMP ping is the one to leave alone: it needs raw sockets, which means privileges Node does not
have by default.

## TLS certificate expiry

Rides the same TCP connect as above, and is the check that fails *before* an outage rather than
during it. Wants its own state — a certificate expiring in nine days is not "down" — which is a
question for the state machine and the key's colours, not just for the checker.

## Import and export of a board

Twelve services configured by hand is a real investment, and it currently lives in exactly one
place: a Stream Deck profile on one machine. Export makes a board something you can back up, move
to another machine, put in a repository, or hand to a colleague.

Decisions it forces:

- **What travels.** The services and the board defaults, certainly. Runtime history is per-machine
  and by far the largest part of the settings, so the default should be to leave it behind — with
  the question of whether including it is ever worth an option.
- **Merge or replace.** Importing into a board that already has services is the normal case, and a
  silent merge that quietly exceeds the cap, or silently replaces what was there, is the wrong
  answer to both. Quick Clips settled this by previewing the file's contents and letting you choose
  what comes in; the same shape applies here.
- **Secrets.** Nothing today is sensitive, but the moment custom headers land (below) an export can
  carry an API key. Either refuse to write those in clear, or take a passphrase — again, Quick
  Clips has the pattern already.
- **A file format that survives.** Versioned JSON, readable and hand-editable, so a board can be
  written by something other than this plugin.

The cost that is easy to miss: `bin/pulse-host` is a window and nothing else. Choosing a file needs
save and open panels, which means adding those modes to the host — quick-clips' `picker-host` has
them, along with the notes on why they need a different activation policy from the window itself.

## Check faster while something is failing

A board on an hourly interval can miss a short outage entirely, and will not notice a recovery for
up to an hour. The established shape is two intervals rather than one — Nagios and Icinga call them
`check_interval` and `retry_interval` — where a failing service moves to the shorter one until it
is believed again, which pairs naturally with the recovery threshold already in place.

Three things it has to get right:

- **Bounded, and fused.** Polling harder at a service that is already struggling is how a client
  makes an outage worse; the convention everywhere else is to back off. So a floor on the retry
  interval, and a limit on how long acceleration lasts before it returns to the normal cadence.
- **Never accelerate on a 429, or a 503 with `Retry-After`.** That is the service asking for less
  traffic, and speeding up is the one response guaranteed to be wrong. Honouring `Retry-After` as
  the next check time would be better than ignoring it, which is what happens today.
- **It spends the history window.** Sixty records at fifteen seconds covers a quarter of an hour,
  so the faster it polls the less of the run-up to the outage survives — exactly when that context
  is worth the most. Either the window grows while retrying, or retry records are thinned when the
  service recovers.

Worth being an option rather than a default, and worth being settable per service: a payment API
and an internal dashboard do not deserve the same urgency.

## Signing and notarization

`bin/pulse-host` is ad-hoc signed, so on any machine other than the one it was built on Gatekeeper
is likely to refuse it and the plugin silently falls back to a browser window. Fixing it needs a
Developer ID certificate and a notarization step in `native/build.sh`. This is the main thing
standing between the alpha and a release anyone else can install.

## More control over the request

Headers landed in 2.0. What is left:

- **Skipping certificate verification**, for the self-signed certificates on internal boxes.
  Per service, off by default, and *visible* once on — a key that is green without verifying
  anything is worse than a key that is red. Node's `fetch` has no per-request way to relax TLS:
  the global switch would disable verification for every check in the process, so this means
  either a separate `https` path for those services or taking on `undici` for a per-request
  dispatcher. That dependency decision is the real cost of the checkbox, and it is the next thing
  to settle.
- **Method and body**, so a POST-only health route can be checked at all. A body opens up PUT and
  POST, which is worth having but is a bigger form and its own validation.

Headers are stored as ordinary settings, not secrets, so import and export inherits that decision
rather than making it.

## Checks that expect a failure

Verifying that something is *not* reachable, or not permitted: a firewall rule that should be
blocking, an admin route that must refuse anonymous callers, a decommissioned endpoint that should
stay gone.

Most of this already works and is only badly advertised — setting **Expected status** to 401 or 404
does exactly this today. What is missing is the case with no response at all, since a transport
error is unconditionally a failure right now. That is one inversion flag, and it sits naturally
beside the TCP check type: "this port should be closed from here". A negative body match — this
page must *not* contain `Exception` — is the same idea and about as small.

The thing to settle first is language, not code. Once a check can invert, "down" no longer means
down; the model is already "did this match what I expected", but the key's colours and the window's
wording still say up and down.

## Windows

The native host is macOS only. Windows already falls back to a Chromium `--app` window, so the
feature works there — but it borrows the user's browser, and there is no equivalent of the
osascript last resort. Either accept the browser as the Windows story and say so, or write a
second host.

## A mock endpoint service for testing

Latency, status codes, hangs and flapping on demand, so the board can be tested against
misbehaviour without waiting for production to misbehave. Belongs in its own repository rather
than this one.

## Landed since the alpha

Kept short; `git log v2.0.0-alpha.1..main` has the detail.

- Request headers, on the board and per service, with the board's set inherited unless a service
  replaces it
- Checks scheduled from the last check rather than from when the key appeared, so opening a folder
  no longer re-runs a board
- A short press opens the window and a hold checks, on both actions
- The board's inspector reduced to one button, with everything configured in the window
- One healthy green across the key, the pill, the chart and the sparklines
- The endpoint shown in the board's service header
