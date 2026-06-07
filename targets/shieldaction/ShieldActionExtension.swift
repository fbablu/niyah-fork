import Foundation
import ManagedSettings
import UserNotifications

/// Class name MUST stay `ShieldActionExtension` — apple-targets writes
/// `$(PRODUCT_MODULE_NAME).ShieldActionExtension` into the generated
/// Info.plist as NSExtensionPrincipalClass.

extension ManagedSettingsStore.Name {
    static let niyahSession = Self("niyah.session")
}

class ShieldActionExtension: ShieldActionDelegate {

    private static let appGroupID            = "group.com.niyah.app"
    private static let surrenderKey          = "niyah_surrender_requested"
    private static let pendingSurrenderKey   = "niyah_surrender_pending"
    private static let blockingKey           = "niyah_is_blocking"
    private static let violationsKey         = "niyah_shield_violations"
    private static let violationsByCategoryKey = "niyah_shield_violations_by_category"
    private static let lastVariantKey        = "niyah_last_shield_variant"
    private static let surrenderPushID       = "niyah-surrender-confirm"
    private static let surrenderCategoryID   = "SURRENDER_CONFIRM"

    private var sharedDefaults: UserDefaults {
        UserDefaults(suiteName: Self.appGroupID) ?? .standard
    }

    override func handle(
        action: ShieldAction,
        for application: ApplicationToken,
        completionHandler: @escaping (ShieldActionResponse) -> Void
    ) {
        handleAction(action, completionHandler: completionHandler)
    }

    override func handle(
        action: ShieldAction,
        for webDomain: WebDomainToken,
        completionHandler: @escaping (ShieldActionResponse) -> Void
    ) {
        handleAction(action, completionHandler: completionHandler)
    }

    override func handle(
        action: ShieldAction,
        for category: ActivityCategoryToken,
        completionHandler: @escaping (ShieldActionResponse) -> Void
    ) {
        handleAction(action, completionHandler: completionHandler)
    }

    private func handleAction(
        _ action: ShieldAction,
        completionHandler: @escaping (ShieldActionResponse) -> Void
    ) {
        // The shield is only shown when the user just tried to open a blocked
        // app, so EITHER button press is a genuine "hit a blocked app" signal.
        // This is the live detection path: startBlocking() shields directly via
        // ManagedSettings (no DeviceActivityCenter event), so the monitor's
        // eventDidReachThreshold never fires — recording here is what feeds the
        // main app's 2s poll → reportShieldViolation CF → group push.
        recordViolation()

        switch action {
        case .primaryButtonPressed:
            completionHandler(.close)

        case .secondaryButtonPressed:
            // Direct-open Niyah → /session/blocked deep link. The full custom
            // surrender UI (brand-colored screen, animated avatar, stake +
            // friends context, confirm/cancel buttons) lives in the main app,
            // not in this shield. The NSExtensionContext().open trick is what
            // Opal and One Sec use — Apple doesn't officially support opening
            // the host app from a ShieldActionDelegate, but instantiating a
            // fresh NSExtensionContext routes around that restriction.
            //
            // We still flip pendingSurrenderKey so the app can detect a
            // confirm-in-flight if the user opens Niyah without the deep link.
            NSLog("[NiyahShieldAction] Surrender tapped — opening Niyah blocked screen")
            sharedDefaults.set(true, forKey: Self.pendingSurrenderKey)
            sharedDefaults.synchronize()
            openMainApp(urlString: "niyah://blocked")
            completionHandler(.close)
            return

        @unknown default:
            completionHandler(.close)
        }
    }

    private func scheduleSurrenderConfirmPush(completion: @escaping (Bool) -> Void) {
        let content = UNMutableNotificationContent()
        content.title = "Confirm surrender"
        content.body = "Tap to forfeit your stake. This cannot be undone."
        content.sound = .default
        content.categoryIdentifier = Self.surrenderCategoryID
        content.userInfo = ["type": "surrender_confirm_pending"]

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.5, repeats: false)
        let request = UNNotificationRequest(
            identifier: Self.surrenderPushID,
            content: content,
            trigger: trigger
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                NSLog("[NiyahShieldAction] Failed to schedule confirm push: \(error.localizedDescription)")
                completion(false)
            } else {
                completion(true)
            }
        }
    }

    /// Append a violation timestamp (ms since epoch) to the App Group array the
    /// main app polls — same key/format the DeviceActivityMonitor uses. Guarded
    /// by the blocking flag so a stray shield tap outside an active session is
    /// ignored. Best-effort + synchronize() so the value is visible to the main
    /// app process before its next poll tick.
    private func recordViolation() {
        guard sharedDefaults.bool(forKey: Self.blockingKey) else { return }
        var violations = sharedDefaults.array(forKey: Self.violationsKey) as? [Double] ?? []
        violations.append(Date().timeIntervalSince1970 * 1000)
        sharedDefaults.set(violations, forKey: Self.violationsKey)

        // Per-category tally. This process can't classify the app itself
        // (Application(token:).bundleIdentifier is nil outside the shield's
        // data source), but shieldconfig always renders before a button press
        // lands here and writes the variant it classified — so "last shown
        // variant" IS the category of the app the user just tapped through.
        // Privacy ceiling: categories only; app names are never visible here.
        let category = sharedDefaults.string(forKey: Self.lastVariantKey) ?? "other"
        var byCategory =
            sharedDefaults.dictionary(forKey: Self.violationsByCategoryKey) as? [String: Int] ?? [:]
        byCategory[category, default: 0] += 1
        sharedDefaults.set(byCategory, forKey: Self.violationsByCategoryKey)
        sharedDefaults.synchronize()
    }

    private func openMainApp(urlString: String) {
        guard let url = URL(string: urlString) else { return }
        NSExtensionContext().open(url) { _ in }
    }
}
