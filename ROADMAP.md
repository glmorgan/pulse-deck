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

## Signing and notarization

`bin/pulse-host` is ad-hoc signed, so on any machine other than the one it was built on Gatekeeper
is likely to refuse it and the plugin silently falls back to a browser window. Fixing it needs a
Developer ID certificate and a notarization step in `native/build.sh`. This is the main thing
standing between the alpha and a release anyone else can install.

## Requests with more than a URL

Real health endpoints often want a header (an API key, a tenant id), a method other than GET, or
a body. Small to add to the checker; the cost is in the form, which is already the longest surface
in the window, and in deciding whether a header holding a secret belongs in settings that travel
with a profile export.

## Windows

The native host is macOS only. Windows already falls back to a Chromium `--app` window, so the
feature works there — but it borrows the user's browser, and there is no equivalent of the
osascript last resort. Either accept the browser as the Windows story and say so, or write a
second host.

## A mock endpoint service for testing

Latency, status codes, hangs and flapping on demand, so the board can be tested against
misbehaviour without waiting for production to misbehave. Belongs in its own repository rather
than this one.
