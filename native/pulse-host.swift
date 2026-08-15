import AppKit
import WebKit

//
// pulse-host — a native window that displays PulseDeck's health history page.
//
// It knows nothing about health checks: the page talks to the plugin's local HTTP server, and
// the plugin kills this process once the window closes or the idle timeout elapses. So this is
// only a correctly-sized, correctly-placed window that loads a URL and takes keyboard focus.
//
// It accepts Chrome's own flag spelling (`--app=<url>`, `--window-size=W,H`) so it is a drop-in
// substitute for the browser fallback, with no branching in historyWindow.ts.
//
// Exits non-zero on a bad invocation; exits 0 when the window closes.
//
// Everything here that looks fussy — the non-activating panel, the double focus pass, the
// pre-paint background colour — is the hard-won part. See quick-clips/docs/native-picker.md.
//

/// Diagnostics go to stderr, which the plugin forwards to its log. A separate process is
/// otherwise completely silent about why it did nothing.
private func log(_ message: String) {
    FileHandle.standardError.write("pulse-host: \(message)\n".data(using: .utf8)!)
}

private func flagValue(_ name: String) -> String? {
    for arg in CommandLine.arguments where arg.hasPrefix("--\(name)=") {
        return String(arg.dropFirst(name.count + 3))
    }
    return nil
}

/**
 * The page's own background, mirroring --bg in historyWindow.ts.
 *
 * Every surface visible before the HTML paints is set to this, so the window opens already the
 * right colour. Nothing here may use a dynamic system colour: the page is always dark, while
 * NSColor.windowBackgroundColor resolves to #FFFFFF under the light appearance — which shows as
 * a white flash on a Mac set to Light mode.
 */
private let pageBackground = NSColor(srgbRed: 0x33 / 255.0, green: 0x33 / 255.0, blue: 0x33 / 255.0, alpha: 1)

/// Fraction of leftover vertical space placed above the window; mirrors VERTICAL_BIAS.
private let verticalBias: CGFloat = 0.35
private let defaultSize = CGSize(width: 900, height: 740)

private func requestedContentSize() -> CGSize {
    guard let raw = flagValue("window-size") else { return defaultSize }
    let parts = raw.split(separator: ",").compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
    guard parts.count == 2, parts[0] > 0, parts[1] > 0 else { return defaultSize }
    return CGSize(width: parts[0], height: parts[1])
}

final class HistoryWindowController: NSObject, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var parentWatch: Timer?

    func show(url: URL, contentSize: CGSize) {
        let config = WKWebViewConfiguration()
        // Nothing is persisted between invocations — the window is a view onto the key's state.
        config.websiteDataStore = .nonPersistent()
        // Tells the page it is hosted natively so it skips the resizeTo/moveTo correction it
        // needs under Chrome. Here the window is already correct, and resizeTo() would size the
        // *outer* frame and cost the content the height of the title bar. At documentStart so it
        // lands before the page's own head script runs.
        config.userContentController.addUserScript(WKUserScript(
            source: "window.__nativeHost = true;",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))

        webView = WKWebView(frame: NSRect(origin: .zero, size: contentSize), configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        // Also the colour shown before the first paint, so it must be the page's own.
        if #available(macOS 12.0, *) { webView.underPageBackgroundColor = pageBackground }

        /*
         * An NSPanel with .nonactivatingPanel, not an NSWindow.
         *
         * NSApp.activate(ignoringOtherApps:) is refused when another application is frontmost —
         * cooperative activation, macOS 14 and later — so a plain window opens without key status
         * and every keystroke goes to the app the user came from. A non-activating panel takes key
         * status without its application becoming active, which is the right behaviour for a
         * transient window floating over whatever someone is working in.
         */
        let panel = NSPanel(
            contentRect: NSRect(origin: .zero, size: contentSize),
            styleMask: [.titled, .closable, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.isFloatingPanel = true
        panel.becomesKeyOnlyIfNeeded = false
        // The panel must survive its own app not being active, which is now the normal case.
        panel.hidesOnDeactivate = false
        window = panel
        window.delegate = self
        window.contentView = webView
        window.title = flagValue("title") ?? "PulseDeck"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.isMovableByWindowBackground = true
        window.backgroundColor = pageBackground
        // Pins the frame to the dark appearance too. The page is always dark, so leaving this to
        // follow the system drew light traffic lights and a light titlebar over a dark page on a
        // Mac set to Light mode.
        window.appearance = NSAppearance(named: .darkAqua)
        window.level = .floating
        window.isReleasedWhenClosed = false
        // contentRect is the *content* area and AppKit adds the title bar above it, so the page
        // gets the height asked for. .fullSizeContentView is deliberately not used: it makes the
        // frame equal contentRect, costing ~32px of content and sliding the header under the
        // traffic lights.

        position(window, contentSize: contentSize)
        webView.load(URLRequest(url: url))

        // Ordering front and taking key is enough for a non-activating panel; activating is the
        // part macOS refuses, and asking for it anyway only adds a failed request.
        window.orderFrontRegardless()
        window.makeKeyAndOrderFront(nil)
        // A key window is not enough: the web view has to be first responder or keystrokes stop
        // at the window and never reach the page.
        window.makeFirstResponder(webView)
        DispatchQueue.main.async { [weak self] in
            self?.window?.makeKey()
            self?.focusWebView()
        }
        watchParent()
    }

    /**
     * Exits when the plugin that spawned this window goes away.
     *
     * The page talks to a server owned by the plugin process. If that process restarts or
     * crashes, this window is re-parented to launchd and left on screen with every control
     * hitting a dead server — visible, but inert, and nothing else would ever clean it up.
     */
    private func watchParent() {
        let originalParent = getppid()
        parentWatch = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            if getppid() != originalParent {
                log("plugin process went away; closing")
                NSApp.terminate(nil)
            }
        }
    }

    /// Centres horizontally and biases above centre, on the screen the mouse is on — not the
    /// main display, or it opens on the wrong monitor.
    private func position(_ window: NSWindow, contentSize: CGSize) {
        let mouse = NSEvent.mouseLocation
        let screen = NSScreen.screens.first { NSMouseInRect(mouse, $0.frame, false) } ?? NSScreen.main
        guard let area = screen?.visibleFrame else { window.center(); return }

        var frameSize = window.frame.size  // includes the title bar

        // A window larger than the display is not merely ugly: the bias below turns negative and
        // pushes the overflow off the bottom edge, where the rows it holds cannot be reached and
        // cannot be scrolled to either, because the scroll container is inside the part that is
        // off screen. Clamping first costs a scrollbar on a small display and nothing on a large
        // one. `visibleFrame` already excludes the menu bar and the Dock.
        if frameSize.width > area.width || frameSize.height > area.height {
            frameSize.width = min(frameSize.width, area.width)
            frameSize.height = min(frameSize.height, area.height)
            window.setFrame(NSRect(origin: window.frame.origin, size: frameSize), display: false)
            log("clamped to screen: \(Int(frameSize.width))x\(Int(frameSize.height))")
        }

        let x = area.midX - frameSize.width / 2
        // AppKit's origin is bottom-left, so a bias measured from the top inverts here.
        let topGap = (area.height - frameSize.height) * verticalBias
        let y = area.maxY - frameSize.height - topGap
        window.setFrameOrigin(NSPoint(x: x.rounded(), y: y.rounded()))

        let f = window.frame
        log("frame \(Int(f.width))x\(Int(f.height)) at \(Int(f.origin.x)),\(Int(f.origin.y))"
            + " | screen \(Int(area.width))x\(Int(area.height))")
    }

    func windowWillClose(_ notification: Notification) {
        // The page's beforeunload handler tells the plugin before we go.
        NSApp.terminate(nil)
    }

    /// The page calls window.close() on Escape.
    func webViewDidClose(_ webView: WKWebView) {
        NSApp.terminate(nil)
    }

    /**
     * Re-asserts first responder once the page exists.
     *
     * Setting it when the window is created is not always enough, because the load finishes
     * afterwards and the page binds its key handlers then.
     */
    private func focusWebView() {
        guard window != nil, webView != nil else { return }
        if window.firstResponder !== webView { window.makeFirstResponder(webView) }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        focusWebView()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        log("navigation failed: \(error.localizedDescription)")
        NSApp.terminate(nil)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        log("could not load page: \(error.localizedDescription)")
        NSApp.terminate(nil)
    }
}

// MARK: - entry point

guard let raw = flagValue("app"), let url = URL(string: raw), url.scheme != nil else {
    FileHandle.standardError.write(
        "usage: pulse-host --app=<url> [--window-size=W,H] [--title=<text>]\n".data(using: .utf8)!)
    exit(2)
}

let app = NSApplication.shared
// .accessory, not .regular: a transient window should not register as a full application. The
// regular policy adds a Dock icon and the whole app-launch ceremony, which is what makes opening
// feel like a second of loading. Accessory windows can still become key and take keyboard focus.
app.setActivationPolicy(.accessory)

/*
 * AppKit routes the standard editing shortcuts through the Edit menu's key equivalents, so
 * without a menu bar Cmd+V, Cmd+X and Cmd+Z simply do nothing inside a text field — the
 * keystroke reaches nothing that handles it, and the field sits there unchanged.
 *
 * This menu started as Copy and Select All, which was enough while the only window was the
 * read-only history view. The board's manager window has forms in it, and pasting a URL into one
 * is the first thing anybody does, so the full set is here now. Undo and Redo are addressed by
 * name because they are the field editor's own, not NSText's.
 *
 * The menu itself is never shown: the window is the only UI.
 */
let mainMenu = NSMenu()
let editItem = NSMenuItem()
mainMenu.addItem(editItem)
let editMenu = NSMenu(title: "Edit")
editMenu.addItem(NSMenuItem(title: "Undo", action: Selector(("undo:")), keyEquivalent: "z"))
let redo = NSMenuItem(title: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
redo.keyEquivalentModifierMask = [.command, .shift]
editMenu.addItem(redo)
editMenu.addItem(NSMenuItem.separator())
for (title, selector, key) in [
    ("Cut", #selector(NSText.cut(_:)), "x"),
    ("Copy", #selector(NSText.copy(_:)), "c"),
    ("Paste", #selector(NSText.paste(_:)), "v"),
    ("Select All", #selector(NSText.selectAll(_:)), "a"),
] {
    editMenu.addItem(NSMenuItem(title: title, action: selector, keyEquivalent: key))
}
editMenu.addItem(NSMenuItem.separator())
editMenu.addItem(NSMenuItem(title: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w"))
editItem.submenu = editMenu
app.mainMenu = mainMenu

let controller = HistoryWindowController()
controller.show(url: url, contentSize: requestedContentSize())
app.run()
