import ExpoModulesCore

// FamilyControls / ManagedSettings are weak-linked via the podspec.
// Available on iOS 16+ only. Each call site uses `guard #available`.
#if canImport(FamilyControls)
import FamilyControls
#endif
#if canImport(ManagedSettings)
import ManagedSettings
#endif
#if canImport(DeviceActivity)
import DeviceActivity
#endif
// ActivityKit is iOS 16.1+, weak-linked. Live Activity start/update/end
// methods guard with #available so the module still builds on older targets.
#if canImport(ActivityKit)
import ActivityKit
#endif

// Named store extension — keeps session shields isolated and cleanup simple.
#if canImport(ManagedSettings)
@available(iOS 16.0, *)
extension ManagedSettingsStore.Name {
  static let niyahSession = Self("niyah.session")
}
#endif

/// Expo module bridging iOS Screen Time API to JavaScript.
///
/// Key learnings applied from working apps (Opal, One Sec, ScreenZen):
///   - Use PropertyListEncoder (NOT JSON) for FamilyActivitySelection persistence.
///     JSON silently corrupts opaque ApplicationToken data.
///   - Keep selection in memory as primary; persist to UserDefaults for extension use.
///   - Use named ManagedSettingsStore for session isolation.
///   - Use clearAllSettings() for deterministic cleanup.
///   - No DeviceActivitySchedule needed for direct blocking.
@preconcurrency
public class NiyahScreenTimeModule: Module {

  // ── App Group constants ────────────────────────────────────────────────────
  private static let appGroupID = "group.com.niyah.app"
  private static let selectionKey = "niyah_app_selection"
  private static let blockingKey = "niyah_is_blocking"
  // Named block-list templates: JSON index + one plist Data blob per template.
  private static let templatesIndexKey = "niyah_selection_templates_index"
  private static let templateKeyPrefix = "niyah_selection_tpl_"
  // Apps exempt from EVERY block (music, maps, …) — subtracted at apply time.
  private static let neverBlockKey = "niyah_neverblock_selection"

  private var sharedDefaults: UserDefaults {
    UserDefaults(suiteName: Self.appGroupID) ?? .standard
  }

  private var isCurrentlyBlocking: Bool {
    get { sharedDefaults.bool(forKey: Self.blockingKey) }
    set { sharedDefaults.set(newValue, forKey: Self.blockingKey) }
  }

  // ── Violation + surrender polling ──────────────────────────────────────────
  private static let violationsKey    = "niyah_shield_violations"
  private static let violationsByCategoryKey = "niyah_shield_violations_by_category"
  private static let surrenderKey     = "niyah_surrender_requested"
  private static let sessionContextKey = "niyah_session_context"
  private static let baselineKey       = "niyah_baseline_snapshot"
  private var violationPollTimer: Timer?
  private var lastViolationCount: Int = 0

  // ── Live Activity (iOS 16.1+) ──────────────────────────────────────────────
  /// Stored as `Any?` because `Activity` is unavailable on iOS < 16.1.
  /// Typed access is gated through @available computed accessors below.
  private var _activeLiveActivity: Any?

  // ── iOS 16+ state ─────────────────────────────────────────────────────────
  // Stored as `Any?` because the types don't exist on iOS <16.
  // The @available computed properties provide typed access.

  /// In-memory selection — this is the PRIMARY source.
  /// UserDefaults is only used for cross-process persistence (extensions).
  private var _inMemorySelection: Any?

  /// Named ManagedSettingsStore for session-scoped shields.
  private var _managedStore: Any?

  @available(iOS 16.0, *)
  private var managedStore: ManagedSettingsStore {
    if let store = _managedStore as? ManagedSettingsStore { return store }
    let store = ManagedSettingsStore(named: .niyahSession)
    _managedStore = store
    return store
  }

  /// Get/set the current app selection, with in-memory primary + UserDefaults backup.
  @available(iOS 16.0, *)
  private var savedSelection: FamilyActivitySelection? {
    get {
      // Prefer in-memory (avoids encode/decode issues)
      if let memSelection = _inMemorySelection as? FamilyActivitySelection {
        return memSelection
      }
      // Fall back to persisted (e.g. after app restart)
      guard let data = sharedDefaults.data(forKey: Self.selectionKey) else { return nil }
      let selection = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data)
      // Cache in memory for subsequent reads
      if let selection = selection {
        _inMemorySelection = selection
      }
      return selection
    }
    set {
      _inMemorySelection = newValue
      // Also persist to shared UserDefaults for the extension
      if let value = newValue,
         let data = try? PropertyListEncoder().encode(value) {
        sharedDefaults.set(data, forKey: Self.selectionKey)
      } else {
        sharedDefaults.removeObject(forKey: Self.selectionKey)
      }
    }
  }

  // ── Module Definition ──────────────────────────────────────────────────────

  public func definition() -> ModuleDefinition {
    Name("NiyahScreenTime")

    Events("onShieldViolation", "onAuthorizationChange", "onSurrenderRequested")

    // When the user taps "Surrender Session" on the shield, the shield
    // extension writes a flag to App Group UserDefaults, then iOS dismisses
    // the shield and drops the user on the Home Screen (extensions cannot
    // launch the main app). When the user re-opens Niyah, we must immediately
    // check the flag — waiting for the 2-second polling timer to tick (which
    // is paused while backgrounded) would race with the JS listener's ability
    // to receive events.
    OnAppEntersForeground {
      NSLog("[NiyahScreenTime] App foregrounded — polling for pending surrender/violations")
      self.checkForNewViolations()
      if self.isCurrentlyBlocking && self.violationPollTimer == nil {
        self.startViolationPolling()
      }
    }

    // ================================================================
    // MARK: - Authorization
    // ================================================================

    AsyncFunction("requestAuthorization") { () -> String in
      guard #available(iOS 16.0, *) else { return "denied" }
      do {
        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
        NSLog("[NiyahScreenTime] Authorization approved")
        return "approved"
      } catch {
        let status = AuthorizationCenter.shared.authorizationStatus
        NSLog("[NiyahScreenTime] Authorization result: \(self.serializeAuthStatus(status)), error: \(error)")
        return self.serializeAuthStatus(status)
      }
    }

    Function("getAuthorizationStatus") { () -> String in
      guard #available(iOS 16.0, *) else { return "denied" }
      let status = AuthorizationCenter.shared.authorizationStatus
      return self.serializeAuthStatus(status)
    }

    // ================================================================
    // MARK: - App Selection
    // ================================================================

    AsyncFunction("presentAppPicker") { [weak self] () -> [String: Any] in
      guard #available(iOS 16.0, *) else {
        throw NSError(
          domain: "NiyahScreenTime", code: 0,
          userInfo: [NSLocalizedDescriptionKey: "Screen Time requires iOS 16+"]
        )
      }
      guard let self = self else {
        throw NSError(
          domain: "NiyahScreenTime", code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Module deallocated"]
        )
      }

      return try await withCheckedThrowingContinuation { continuation in
        DispatchQueue.main.async {
          // Track whether the continuation has already been resumed.
          // Both onSelection and onCancel dismiss the modal — only the first
          // one to fire should resume the continuation.
          var resumed = false

          let pickerVC = AppPickerHostingController(
            onSelection: { selection in
              guard !resumed else { return }
              resumed = true

              // Save in memory AND persist
              self.savedSelection = selection

              let appCount = selection.applicationTokens.count
              let catCount = selection.categoryTokens.count
              NSLog("[NiyahScreenTime] App picker done: \(appCount) apps, \(catCount) categories")

              let summary = self.serializeSelection(selection)
              continuation.resume(returning: summary)
            },
            onCancel: {
              guard !resumed else { return }
              resumed = true

              NSLog("[NiyahScreenTime] App picker cancelled")
              continuation.resume(throwing: NSError(
                domain: "NiyahScreenTime", code: 4,
                userInfo: [NSLocalizedDescriptionKey: "App picker was cancelled"]
              ))
            },
            // Seed with the current selection so "Change Apps" edits in place
            // instead of starting from scratch.
            initialSelection: self.savedSelection ?? FamilyActivitySelection()
          )
          pickerVC.modalPresentationStyle = .pageSheet

          guard let rootVC = self.findRootViewController() else {
            guard !resumed else { return }
            resumed = true
            continuation.resume(throwing: NSError(
              domain: "NiyahScreenTime", code: 2,
              userInfo: [NSLocalizedDescriptionKey: "Could not find root view controller"]
            ))
            return
          }

          rootVC.present(pickerVC, animated: true)
        }
      }
    }

    Function("getSavedSelection") { [weak self] () -> [String: Any]? in
      guard #available(iOS 16.0, *) else { return nil }
      guard let selection = self?.savedSelection else { return nil }
      return self?.serializeSelection(selection)
    }

    AsyncFunction("clearSelection") { [weak self] () in
      guard #available(iOS 16.0, *) else { return }
      self?.savedSelection = nil
    }

    // ================================================================
    // MARK: - Block-list templates (named selections)
    // ================================================================
    //
    // Templates write THROUGH to the active selection key on apply, so
    // startBlocking, the monitor extension, and every existing gate keep
    // working unchanged — there is no separate "active template" concept.

    /// Snapshot the current selection under `name`. Overwrites an existing
    /// template with the same slug. Throws if nothing is selected.
    AsyncFunction("saveSelectionTemplate") { [weak self] (name: String) -> [String: Any] in
      guard #available(iOS 16.0, *) else {
        throw NSError(domain: "NiyahScreenTime", code: 0,
          userInfo: [NSLocalizedDescriptionKey: "Screen Time requires iOS 16+"])
      }
      guard let self = self, let selection = self.savedSelection,
            !(selection.applicationTokens.isEmpty
              && selection.categoryTokens.isEmpty
              && selection.webDomainTokens.isEmpty) else {
        throw NSError(domain: "NiyahScreenTime", code: 5,
          userInfo: [NSLocalizedDescriptionKey: "No apps selected to save as a template."])
      }
      let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !trimmed.isEmpty else {
        throw NSError(domain: "NiyahScreenTime", code: 6,
          userInfo: [NSLocalizedDescriptionKey: "Template name can't be empty."])
      }
      guard let data = try? PropertyListEncoder().encode(selection) else {
        throw NSError(domain: "NiyahScreenTime", code: 7,
          userInfo: [NSLocalizedDescriptionKey: "Couldn't encode the selection."])
      }
      let slug = Self.slugify(trimmed)
      // Symbol/emoji-only names all slug to "" — distinct templates would
      // silently collide on the same key and overwrite each other.
      guard !slug.isEmpty else {
        throw NSError(domain: "NiyahScreenTime", code: 6,
          userInfo: [NSLocalizedDescriptionKey: "Template name needs at least one letter or number."])
      }
      self.sharedDefaults.set(data, forKey: Self.templateKeyPrefix + slug)

      var index = self.loadTemplateIndex().filter { ($0["slug"] as? String) != slug }
      var entry = self.serializeSelection(selection)
      entry["id"] = slug
      entry["slug"] = slug
      entry["name"] = trimmed
      entry["createdAt"] = Date().timeIntervalSince1970 * 1000
      index.append(entry)
      self.saveTemplateIndex(index)
      NSLog("[NiyahScreenTime] saveSelectionTemplate: \(trimmed) (\(slug))")
      return entry
    }

    /// Index of saved templates (name, slug, counts, label, createdAt).
    Function("listSelectionTemplates") { [weak self] () -> [[String: Any]] in
      return self?.loadTemplateIndex() ?? []
    }

    /// Load a template into the ACTIVE selection (write-through). Returns the
    /// applied selection summary, or null if the template doesn't exist.
    AsyncFunction("applySelectionTemplate") { [weak self] (name: String) -> [String: Any]? in
      guard #available(iOS 16.0, *) else { return nil }
      guard let self = self else { return nil }
      let slug = Self.slugify(name)
      guard let data = self.sharedDefaults.data(forKey: Self.templateKeyPrefix + slug),
            let selection = try? PropertyListDecoder().decode(
              FamilyActivitySelection.self, from: data)
      else {
        NSLog("[NiyahScreenTime] applySelectionTemplate: \(slug) not found")
        return nil
      }
      self.savedSelection = selection
      NSLog("[NiyahScreenTime] applySelectionTemplate: \(slug) applied")
      return self.serializeSelection(selection)
    }

    AsyncFunction("deleteSelectionTemplate") { [weak self] (name: String) in
      guard let self = self else { return }
      let slug = Self.slugify(name)
      self.sharedDefaults.removeObject(forKey: Self.templateKeyPrefix + slug)
      self.saveTemplateIndex(
        self.loadTemplateIndex().filter { ($0["slug"] as? String) != slug })
      NSLog("[NiyahScreenTime] deleteSelectionTemplate: \(slug)")
    }

    // ================================================================
    // MARK: - Never-block list
    // ================================================================

    /// Present the picker seeded with the current never-block selection.
    /// These apps stay AVAILABLE during every block (subtracted at shield
    /// apply time in startBlocking + the monitor extension).
    AsyncFunction("presentNeverBlockPicker") { [weak self] () -> [String: Any] in
      guard #available(iOS 16.0, *) else {
        throw NSError(domain: "NiyahScreenTime", code: 0,
          userInfo: [NSLocalizedDescriptionKey: "Screen Time requires iOS 16+"])
      }
      guard let self = self else {
        throw NSError(domain: "NiyahScreenTime", code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Module deallocated"])
      }
      return try await withCheckedThrowingContinuation { continuation in
        DispatchQueue.main.async {
          var resumed = false
          let pickerVC = AppPickerHostingController(
            onSelection: { selection in
              guard !resumed else { return }
              resumed = true
              let isEmpty = selection.applicationTokens.isEmpty
                && selection.categoryTokens.isEmpty
                && selection.webDomainTokens.isEmpty
              if isEmpty {
                // allowEmptyDone: deselect-all + Done means "clear the list".
                self.sharedDefaults.removeObject(forKey: Self.neverBlockKey)
              } else if let data = try? PropertyListEncoder().encode(selection) {
                self.sharedDefaults.set(data, forKey: Self.neverBlockKey)
              }
              NSLog("[NiyahScreenTime] presentNeverBlockPicker: saved \(selection.applicationTokens.count) apps")
              continuation.resume(returning: self.serializeSelection(selection))
            },
            onCancel: {
              guard !resumed else { return }
              resumed = true
              continuation.resume(throwing: NSError(
                domain: "NiyahScreenTime", code: 4,
                userInfo: [NSLocalizedDescriptionKey: "App picker was cancelled"]
              ))
            },
            initialSelection: self.loadNeverBlockSelection() ?? FamilyActivitySelection(),
            title: "Never Block These Apps",
            allowEmptyDone: true
          )
          pickerVC.modalPresentationStyle = .pageSheet
          guard let rootVC = self.findRootViewController() else {
            guard !resumed else { return }
            resumed = true
            continuation.resume(throwing: NSError(
              domain: "NiyahScreenTime", code: 2,
              userInfo: [NSLocalizedDescriptionKey: "Could not find root view controller"]
            ))
            return
          }
          rootVC.present(pickerVC, animated: true)
        }
      }
    }

    /// Summary of the saved never-block selection, or null when none is set.
    Function("getNeverBlockSummary") { [weak self] () -> [String: Any]? in
      guard #available(iOS 16.0, *) else { return nil }
      guard let self = self, let selection = self.loadNeverBlockSelection(),
            !(selection.applicationTokens.isEmpty
              && selection.categoryTokens.isEmpty
              && selection.webDomainTokens.isEmpty)
      else { return nil }
      return self.serializeSelection(selection)
    }

    AsyncFunction("clearNeverBlockSelection") { [weak self] () in
      self?.sharedDefaults.removeObject(forKey: Self.neverBlockKey)
      NSLog("[NiyahScreenTime] clearNeverBlockSelection")
    }

    /// Sign-out / delete-account hygiene: wipe EVERY per-user Screen Time
    /// artifact from the app group so the next account starts clean — the
    /// active selection, all templates, the never-block list, the shield
    /// session context, and violation counters.
    AsyncFunction("clearAllSelections") { [weak self] () in
      guard let self = self else { return }
      for entry in self.loadTemplateIndex() {
        if let slug = entry["slug"] as? String {
          self.sharedDefaults.removeObject(forKey: Self.templateKeyPrefix + slug)
        }
      }
      self.sharedDefaults.removeObject(forKey: Self.templatesIndexKey)
      self.sharedDefaults.removeObject(forKey: Self.neverBlockKey)
      self.sharedDefaults.removeObject(forKey: Self.selectionKey)
      self.sharedDefaults.removeObject(forKey: Self.sessionContextKey)
      self.sharedDefaults.removeObject(forKey: Self.violationsKey)
      self.sharedDefaults.removeObject(forKey: Self.violationsByCategoryKey)
      self._inMemorySelection = nil
      NSLog("[NiyahScreenTime] clearAllSelections: app-group state wiped")
    }

    // ================================================================
    // MARK: - Blocking (Session Lifecycle)
    // ================================================================

    AsyncFunction("startBlocking") { [weak self] () in
      guard #available(iOS 16.0, *) else { return }
      guard let self = self else { return }
      guard let selection = self.savedSelection else {
        NSLog("[NiyahScreenTime] startBlocking FAILED: no saved selection")
        throw NSError(
          domain: "NiyahScreenTime", code: 3,
          userInfo: [NSLocalizedDescriptionKey: "No apps selected. Present the app picker first."]
        )
      }

      let appCount = selection.applicationTokens.count
      let catCount = selection.categoryTokens.count
      let webCount = selection.webDomainTokens.count
      NSLog("[NiyahScreenTime] startBlocking: \(appCount) apps, \(catCount) categories, \(webCount) web domains")

      // Apply shield to selected apps and categories, minus the never-block
      // list (apps the user keeps available in every block — music, maps…).
      // No never-block selection saved → exact no-ops (subtracting([]) /
      // except: []). KEEP IN SYNC with the monitor extension's
      // applyShieldsFromSavedSelection (separate process, duplicated logic).
      let never = self.loadNeverBlockSelection()
      let exemptApps = never?.applicationTokens ?? []
      let apps = selection.applicationTokens.subtracting(exemptApps)
      let cats = selection.categoryTokens.subtracting(never?.categoryTokens ?? [])
      let webs = selection.webDomainTokens.subtracting(never?.webDomainTokens ?? [])
      // Always assign the full token sets — empty set = "shield nothing"
      self.managedStore.shield.applications = apps.isEmpty ? nil : apps
      self.managedStore.shield.applicationCategories = cats.isEmpty
        ? nil : ShieldSettings.ActivityCategoryPolicy<Application>.specific(cats, except: exemptApps)
      self.managedStore.shield.webDomains = webs.isEmpty ? nil : webs

      self.isCurrentlyBlocking = true

      // Clear any stale violations from previous sessions and start polling
      self.sharedDefaults.removeObject(forKey: Self.violationsKey)
      self.sharedDefaults.removeObject(forKey: Self.violationsByCategoryKey)
      self.lastViolationCount = 0
      self.startViolationPolling()

      NSLog("[NiyahScreenTime] startBlocking: shields applied successfully")
    }

    AsyncFunction("stopBlocking") { [weak self] () in
      guard #available(iOS 16.0, *) else { return }
      guard let self = self else { return }
      // clearAllSettings is the nuclear option — removes all shield/application
      // settings from this named store in one call. More reliable than nil-ing
      // individual properties.
      self.managedStore.clearAllSettings()
      self.isCurrentlyBlocking = false
      self.stopViolationPolling()
      // Every session-end path (complete, surrender, recover-expired, quick
      // block end) funnels through here — clearing the shield context at this
      // chokepoint guarantees a finished staked session can never leak its
      // forfeit copy onto the next free block.
      self.sharedDefaults.removeObject(forKey: Self.sessionContextKey)
      NSLog("[NiyahScreenTime] stopBlocking: all settings cleared")
    }

    Function("isBlocking") { [weak self] () -> Bool in
      return self?.isCurrentlyBlocking ?? false
    }

    /// Per-category blocked-app attempt counts for the current session
    /// (cleared on startBlocking). Categories are the shield's coarse
    /// variants ("social" | "video" | "gaming" | "news" | "other") — iOS
    /// privacy never exposes which specific app was attempted.
    Function("getViolationsByCategory") { [weak self] () -> [String: Int] in
      return (self?.sharedDefaults.dictionary(forKey: Self.violationsByCategoryKey)
        as? [String: Int]) ?? [:]
    }

    // ================================================================
    // MARK: - Scheduled Blocking (DeviceActivitySchedule)
    // ================================================================

    AsyncFunction("startScheduledBlocking") { (startHour: Int, startMinute: Int, endHour: Int, endMinute: Int, activityName: String) in
      guard #available(iOS 16.0, *) else { return }
      let center = DeviceActivityCenter()
      let schedule = DeviceActivitySchedule(
        intervalStart: DateComponents(hour: startHour, minute: startMinute),
        intervalEnd: DateComponents(hour: endHour, minute: endMinute),
        repeats: true
      )
      try center.startMonitoring(
        DeviceActivityName(rawValue: activityName),
        during: schedule
      )
      NSLog("[NiyahScreenTime] startScheduledBlocking: monitoring \(activityName) from \(startHour):\(startMinute) to \(endHour):\(endMinute)")
    }

    AsyncFunction("stopScheduledBlocking") { (activityName: String) in
      guard #available(iOS 16.0, *) else { return }
      DeviceActivityCenter().stopMonitoring([DeviceActivityName(rawValue: activityName)])
      NSLog("[NiyahScreenTime] stopScheduledBlocking: stopped \(activityName)")
    }

    AsyncFunction("stopAllScheduledBlocking") { () in
      guard #available(iOS 16.0, *) else { return }
      DeviceActivityCenter().stopMonitoring()
      NSLog("[NiyahScreenTime] stopAllScheduledBlocking: all monitoring stopped")
    }

    // ================================================================
    // MARK: - Session Context (for Dynamic Shield)
    // ================================================================

    /// Write session context (participant names, stake, type) to shared
    /// UserDefaults so the ShieldConfigurationExtension can display
    /// dynamic messages like "Sarah and Mike are watching."
    AsyncFunction("setSessionContext") { [weak self] (contextJson: String) in
      self?.sharedDefaults.set(contextJson, forKey: Self.sessionContextKey)
      NSLog("[NiyahScreenTime] setSessionContext: \(contextJson)")
    }

    /// Clear session context (call when session ends).
    AsyncFunction("clearSessionContext") { [weak self] () in
      self?.sharedDefaults.removeObject(forKey: Self.sessionContextKey)
      NSLog("[NiyahScreenTime] clearSessionContext")
    }

    // ================================================================
    // MARK: - Surrender Check (race condition fix)
    // ================================================================

    /// Synchronously check if the shield extension wrote a pending surrender
    /// flag. Called from JS on mount to catch surrenders that fired before
    /// the event listener was attached (cold-start race condition).
    /// If found, clears the flag and emits the onSurrenderRequested event.
    Function("checkPendingSurrender") { [weak self] () -> Bool in
      guard let self = self else { return false }
      if self.sharedDefaults.bool(forKey: Self.surrenderKey) {
        NSLog("[NiyahScreenTime] Pending surrender found via manual check")
        self.sharedDefaults.removeObject(forKey: Self.surrenderKey)
        self.sharedDefaults.synchronize()
        self.sendEvent("onSurrenderRequested", [:])
        return true
      }
      return false
    }

    // ================================================================
    // MARK: - DeviceActivityReport baseline (Lane B2)
    // ================================================================

    /// Read the per-app baseline snapshot the DeviceActivityReport extension
    /// persisted to shared UserDefaults. Returns an array of dictionaries
    /// safe to bridge to JS. Empty array means the extension hasn't yet had
    /// a chance to aggregate data (typically requires 24h after first
    /// authorization for meaningful values).
    Function("getScreenTimeBaseline") { [weak self] () -> [[String: Any]] in
      guard let self = self else { return [] }
      guard let data = self.sharedDefaults.data(forKey: Self.baselineKey),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let appsRaw = json["apps"] as? [[String: Any]]
      else { return [] }
      return appsRaw
    }

    // ================================================================
    // MARK: - Live Activity (Lane B7)
    // ================================================================
    //
    // ActivityKit requires iOS 16.1+. Every method guards with #available
    // so calls from JS on older devices return without error (no-op). The
    // main app's Info.plist must also set NSSupportsLiveActivities=YES,
    // which the withLiveActivity Expo plugin handles at prebuild time.

    /// Start a Live Activity for an in-progress focus session. Called from
    /// `sessionStore.startSession` and `groupSessionStore.startSession`.
    /// `attrsJson` is the stringified JSON of:
    ///   { sessionId, sessionType: "solo"|"group", blobAssetName,
    ///     endsAt, leaderboard: [{name,status,violations}], userPayoutCents }
    AsyncFunction("startLiveActivity") { [weak self] (attrsJson: String) -> Bool in
      guard let self = self else { return false }
      #if canImport(ActivityKit)
      guard #available(iOS 16.1, *) else { return false }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else {
        NSLog("[NiyahScreenTime] Live Activities disabled by user")
        return false
      }

      guard let data = attrsJson.data(using: .utf8),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let sessionId = json["sessionId"] as? String,
            let sessionType = json["sessionType"] as? String,
            let endsAt = json["endsAt"] as? Double
      else {
        NSLog("[NiyahScreenTime] startLiveActivity: bad JSON")
        return false
      }

      let blobAssetName = (json["blobAssetName"] as? String) ?? "blob_default"
      let userPayoutCents = (json["userPayoutCents"] as? Int) ?? 0
      let leaderboardRaw = (json["leaderboard"] as? [[String: Any]]) ?? []
      let leaderboard = leaderboardRaw.compactMap { row -> NiyahActivityAttributes.LeaderboardEntry? in
        guard let name = row["name"] as? String,
              let status = row["status"] as? String,
              let violations = row["violations"] as? Int
        else { return nil }
        return NiyahActivityAttributes.LeaderboardEntry(
          name: name, status: status, violations: violations
        )
      }

      let attributes = NiyahActivityAttributes(
        sessionId: sessionId,
        sessionType: sessionType,
        blobAssetName: blobAssetName
      )
      let contentState = NiyahActivityAttributes.ContentState(
        endsAt: endsAt,
        leaderboard: leaderboard,
        userPayoutCents: userPayoutCents
      )

      do {
        let activity: Activity<NiyahActivityAttributes>
        if #available(iOS 16.2, *) {
          // iOS 16.2+ prefers `ActivityContent` wrapper with stale date.
          activity = try Activity.request(
            attributes: attributes,
            content: ActivityContent(state: contentState, staleDate: nil),
            pushType: nil
          )
        } else {
          activity = try Activity.request(
            attributes: attributes,
            contentState: contentState,
            pushType: nil
          )
        }
        self._activeLiveActivity = activity
        NSLog("[NiyahScreenTime] Live Activity started: \(activity.id)")
        return true
      } catch {
        NSLog("[NiyahScreenTime] Live Activity start failed: \(error)")
        return false
      }
      #else
      return false
      #endif
    }

    /// Update the active Live Activity's content state. `stateJson` is the
    /// stringified JSON of: { endsAt, leaderboard, userPayoutCents }.
    /// Pushed on each Firestore session-doc tick from the JS side.
    AsyncFunction("updateLiveActivity") { [weak self] (stateJson: String) -> Bool in
      guard let self = self else { return false }
      #if canImport(ActivityKit)
      guard #available(iOS 16.1, *) else { return false }
      guard let activity = self._activeLiveActivity as? Activity<NiyahActivityAttributes>
      else { return false }

      guard let data = stateJson.data(using: .utf8),
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let endsAt = json["endsAt"] as? Double
      else { return false }

      let userPayoutCents = (json["userPayoutCents"] as? Int) ?? 0
      let leaderboardRaw = (json["leaderboard"] as? [[String: Any]]) ?? []
      let leaderboard = leaderboardRaw.compactMap { row -> NiyahActivityAttributes.LeaderboardEntry? in
        guard let name = row["name"] as? String,
              let status = row["status"] as? String,
              let violations = row["violations"] as? Int
        else { return nil }
        return NiyahActivityAttributes.LeaderboardEntry(
          name: name, status: status, violations: violations
        )
      }

      let newState = NiyahActivityAttributes.ContentState(
        endsAt: endsAt,
        leaderboard: leaderboard,
        userPayoutCents: userPayoutCents
      )

      if #available(iOS 16.2, *) {
        await activity.update(ActivityContent(state: newState, staleDate: nil))
      } else {
        await activity.update(using: newState)
      }
      return true
      #else
      return false
      #endif
    }

    /// End the active Live Activity. Called on session complete or surrender.
    AsyncFunction("endLiveActivity") { [weak self] () -> Bool in
      guard let self = self else { return false }
      #if canImport(ActivityKit)
      guard #available(iOS 16.1, *) else { return false }
      guard let activity = self._activeLiveActivity as? Activity<NiyahActivityAttributes>
      else { return false }

      if #available(iOS 16.2, *) {
        await activity.end(nil, dismissalPolicy: .immediate)
      } else {
        await activity.end(dismissalPolicy: .immediate)
      }
      self._activeLiveActivity = nil
      NSLog("[NiyahScreenTime] Live Activity ended")
      return true
      #else
      return false
      #endif
    }
  }

  // ================================================================
  // MARK: - Helpers
  // ================================================================

  @available(iOS 16.0, *)
  private func serializeAuthStatus(_ status: AuthorizationStatus) -> String {
    switch status {
    case .notDetermined: return "notDetermined"
    case .approved: return "approved"
    case .denied: return "denied"
    @unknown default: return "notDetermined"
    }
  }

  @available(iOS 16.0, *)
  private func serializeSelection(_ selection: FamilyActivitySelection) -> [String: Any] {
    let appCount = selection.applicationTokens.count
    let categoryCount = selection.categoryTokens.count
    let webDomainCount = selection.webDomainTokens.count

    var parts: [String] = []
    if appCount > 0 { parts.append("\(appCount) app\(appCount == 1 ? "" : "s")") }
    if categoryCount > 0 { parts.append("\(categoryCount) categor\(categoryCount == 1 ? "y" : "ies")") }
    if webDomainCount > 0 { parts.append("\(webDomainCount) website\(webDomainCount == 1 ? "" : "s")") }

    return [
      "id": "current",
      "appCount": appCount,
      "categoryCount": categoryCount,
      "label": parts.isEmpty ? "No selection" : parts.joined(separator: ", "),
    ]
  }

  private func findRootViewController() -> UIViewController? {
    guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
          let window = scene.windows.first(where: { $0.isKeyWindow }),
          var topVC = window.rootViewController else {
      return nil
    }
    while let presented = topVC.presentedViewController {
      topVC = presented
    }
    return topVC
  }

  // ================================================================
  // MARK: - Template / never-block helpers
  // ================================================================

  /// Lowercased, alphanumerics-with-dashes, max 40 chars. Saving the same
  /// name twice overwrites (slug equality). Truncates BEFORE the final dash
  /// trim so a stored slug can never end with "-" (slugify must be a fixed
  /// point: slugify(slugify(x)) == slugify(x)).
  private static func slugify(_ name: String) -> String {
    let lowered = name.lowercased()
    let mapped = lowered.map { ch -> Character in
      (ch.isLetter || ch.isNumber) ? ch : "-"
    }
    var slug = String(mapped)
    while slug.contains("--") { slug = slug.replacingOccurrences(of: "--", with: "-") }
    slug = String(slug.prefix(40))
    return slug.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
  }

  private func loadTemplateIndex() -> [[String: Any]] {
    guard let json = sharedDefaults.string(forKey: Self.templatesIndexKey),
          let data = json.data(using: .utf8),
          let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else { return [] }
    return parsed
  }

  private func saveTemplateIndex(_ index: [[String: Any]]) {
    guard let data = try? JSONSerialization.data(withJSONObject: index),
          let json = String(data: data, encoding: .utf8) else { return }
    sharedDefaults.set(json, forKey: Self.templatesIndexKey)
  }

  @available(iOS 16.0, *)
  private func loadNeverBlockSelection() -> FamilyActivitySelection? {
    guard let data = sharedDefaults.data(forKey: Self.neverBlockKey) else { return nil }
    return try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data)
  }

  // ================================================================
  // MARK: - Violation polling & event emission
  // ================================================================
  //
  // The DeviceActivityMonitor extension runs in a separate process and
  // writes violation timestamps to shared UserDefaults. The main app
  // polls for new entries and emits "onShieldViolation" events to JS.

  private func startViolationPolling() {
    stopViolationPolling() // Ensure no duplicate timers
    violationPollTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
      self?.checkForNewViolations()
    }
  }

  private func stopViolationPolling() {
    violationPollTimer?.invalidate()
    violationPollTimer = nil
  }

  private func checkForNewViolations() {
    // ── Violation events ────────────────────────────────────────────────────
    let violations = sharedDefaults.array(forKey: Self.violationsKey) as? [Double] ?? []
    if violations.count > lastViolationCount {
      for i in lastViolationCount..<violations.count {
        let timestamp = violations[i]
        NSLog("[NiyahScreenTime] Shield violation detected at \(timestamp)")
        sendEvent("onShieldViolation", ["timestamp": timestamp])
      }
      lastViolationCount = violations.count
    }

    // ── Surrender request from NiyahShieldAction extension ─────────────────
    // The ShieldActionExtension writes this flag when the user taps
    // "Surrender Session" on the custom shield screen.
    if sharedDefaults.bool(forKey: Self.surrenderKey) {
      NSLog("[NiyahScreenTime] Surrender requested via shield action")
      sharedDefaults.removeObject(forKey: Self.surrenderKey)
      sharedDefaults.synchronize()
      sendEvent("onSurrenderRequested", [:])
    }
  }
}
