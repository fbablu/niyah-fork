import DeviceActivity
import ManagedSettings
import FamilyControls
import Foundation

/// DeviceActivityMonitor App Extension. iOS launches in a separate process
/// when monitored activity events fire (interval start/end, threshold).
/// Class name MUST stay `DeviceActivityMonitorExtension` — that's the
/// NSExtensionPrincipalClass apple-targets writes into Info.plist
/// (`$(PRODUCT_MODULE_NAME).DeviceActivityMonitorExtension`).

@available(iOS 16.0, *)
extension ManagedSettingsStore.Name {
  static let niyahSession = Self("niyah.session")
}

@available(iOS 16.0, *)
class DeviceActivityMonitorExtension: DeviceActivityMonitor {

  private static let appGroupID = "group.com.niyah.app"
  private static let selectionKey = "niyah_app_selection"
  private static let violationsKey = "niyah_shield_violations"
  private static let blockingKey = "niyah_is_blocking"
  private static let sessionContextKey = "niyah_session_context"
  private static let neverBlockKey = "niyah_neverblock_selection"

  private var sharedDefaults: UserDefaults {
    UserDefaults(suiteName: Self.appGroupID) ?? .standard
  }

  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    // Scheduled blocks are FREE. Neutralize any stale staked context (the app
    // may be dead right now, so JS can't do it) — unless a staked session is
    // genuinely live (blocking flag already true + context carries a stake),
    // in which case its forfeit copy must survive. Read BEFORE setting the
    // blocking flag below.
    let stakedSessionLive =
      sharedDefaults.bool(forKey: Self.blockingKey) && contextStake() > 0
    if !stakedSessionLive {
      writeFreeScheduledContext()
    }
    applyShieldsFromSavedSelection()
    sharedDefaults.set(true, forKey: Self.blockingKey)
  }

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    // A live STAKED session shares this exact named store ("niyah.session" —
    // the module and this extension both name the same store; named stores
    // are shared across an app and its extensions). Tearing it down here
    // would silently unshield the staked session AND flip the blocking flag
    // that gates violation recording — the user would ride out the stake
    // unblocked and untracked. Leave teardown to the session's own
    // stopBlocking; this scheduled window contributed the same shields anyway.
    let stakedSessionLive =
      sharedDefaults.bool(forKey: Self.blockingKey) && contextStake() > 0
    if stakedSessionLive { return }

    let store = ManagedSettingsStore(named: .niyahSession)
    store.clearAllSettings()
    sharedDefaults.set(false, forKey: Self.blockingKey)
    sharedDefaults.removeObject(forKey: Self.sessionContextKey)
  }

  override func eventDidReachThreshold(
    _ event: DeviceActivityEvent.Name,
    activity: DeviceActivityName
  ) {
    super.eventDidReachThreshold(event, activity: activity)
    guard sharedDefaults.bool(forKey: Self.blockingKey) else { return }
    recordViolation()
  }

  override func intervalWillStartWarning(for activity: DeviceActivityName) {
    super.intervalWillStartWarning(for: activity)
  }

  override func intervalWillEndWarning(for activity: DeviceActivityName) {
    super.intervalWillEndWarning(for: activity)
  }

  private func applyShieldsFromSavedSelection() {
    let store = ManagedSettingsStore(named: .niyahSession)
    guard let data = sharedDefaults.data(forKey: Self.selectionKey),
          let selection = try? PropertyListDecoder().decode(
            FamilyActivitySelection.self, from: data
          )
    else { return }

    // Subtract the never-block list (apps that stay available in every
    // block). No never-block saved → exact no-ops. KEEP IN SYNC with
    // startBlocking in NiyahScreenTimeModule (separate process, duplicated
    // logic — the targets can't share source with the pod).
    let never = loadNeverBlockSelection()
    let exemptApps = never?.applicationTokens ?? []
    let apps = selection.applicationTokens.subtracting(exemptApps)
    let cats = selection.categoryTokens.subtracting(never?.categoryTokens ?? [])
    let webs = selection.webDomainTokens.subtracting(never?.webDomainTokens ?? [])

    if !apps.isEmpty {
      store.shield.applications = apps
    }
    if !cats.isEmpty {
      store.shield.applicationCategories =
        ShieldSettings.ActivityCategoryPolicy.specific(cats, except: exemptApps)
    }
    if !webs.isEmpty {
      store.shield.webDomains = webs
    }
  }

  private func loadNeverBlockSelection() -> FamilyActivitySelection? {
    guard let data = sharedDefaults.data(forKey: Self.neverBlockKey) else { return nil }
    return try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data)
  }

  private func recordViolation() {
    var violations = sharedDefaults.array(forKey: Self.violationsKey) as? [Double] ?? []
    violations.append(Date().timeIntervalSince1970 * 1000)
    sharedDefaults.set(violations, forKey: Self.violationsKey)
  }

  /// Stake (cents) carried by the current shield session context, or 0 when
  /// the context is missing/malformed. Same JSON format setSessionContext
  /// writes from the module.
  private func contextStake() -> Int {
    guard let json = sharedDefaults.string(forKey: Self.sessionContextKey),
          let data = json.data(using: .utf8),
          let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return 0 }
    return parsed["stake"] as? Int ?? 0
  }

  private func writeFreeScheduledContext() {
    let context: [String: Any] = ["type": "scheduled", "names": [String](), "stake": 0]
    if let data = try? JSONSerialization.data(withJSONObject: context),
       let json = String(data: data, encoding: .utf8) {
      sharedDefaults.set(json, forKey: Self.sessionContextKey)
    }
  }
}
