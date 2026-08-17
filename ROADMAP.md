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

## Import and export of a board

Twelve services configured by hand is a real investment, and it currently lives only in a Stream
Deck profile. Quick Clips already solved the shape of this (preview before merging, and a
passphrase for anything sensitive), so the pattern is known.

## A mock endpoint service for testing

Latency, status codes, hangs and flapping on demand, so the board can be tested against
misbehaviour without waiting for production to misbehave. Belongs in its own repository rather
than this one.
