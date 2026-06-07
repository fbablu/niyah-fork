import SwiftUI
import FamilyControls

/// A UIHostingController that wraps Apple's FamilyActivityPicker in SwiftUI
/// so it can be presented modally from the Expo native module.
///
/// FamilyActivityPicker is the system-provided UI for choosing which apps,
/// categories, and web domains to shield/block. It uses opaque tokens --
/// the app never sees actual bundle IDs or app names (Apple's privacy design).
@available(iOS 16.0, *)
class AppPickerHostingController: UIHostingController<AppPickerView> {

  init(
    onSelection: @escaping (FamilyActivitySelection) -> Void,
    onCancel: @escaping () -> Void,
    initialSelection: FamilyActivitySelection = FamilyActivitySelection(),
    title: String = "Select Apps to Block",
    allowEmptyDone: Bool = false
  ) {
    super.init(
      rootView: AppPickerView(
        initialSelection: initialSelection,
        title: title,
        allowEmptyDone: allowEmptyDone,
        onSelection: onSelection,
        onCancel: onCancel,
        dismiss: {}
      )
    )
    // `self` exists after super.init — wire dismiss to close ONLY this
    // presented picker. The previous helper called dismiss() on
    // window.rootViewController, which tears down the ENTIRE forward
    // presentation chain (the session fullScreenModal too), dumping the user
    // back on the dashboard. Calling dismiss on this controller dismisses just
    // this sheet and leaves the session screen intact.
    rootView = AppPickerView(
      initialSelection: initialSelection,
      title: title,
      allowEmptyDone: allowEmptyDone,
      onSelection: onSelection,
      onCancel: onCancel,
      dismiss: { [weak self] in self?.dismiss(animated: true) }
    )
  }

  @MainActor required dynamic init?(coder aDecoder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }
}

/// SwiftUI view that wraps FamilyActivityPicker with a navigation bar
/// and "Done" / "Cancel" buttons. Seeded with `initialSelection` so editing
/// an existing selection (or the never-block list) doesn't start from scratch.
@available(iOS 16.0, *)
struct AppPickerView: View {
  @State private var selection: FamilyActivitySelection
  let title: String
  /// When true, Done with an empty selection resolves as a SELECTION (the
  /// caller treats it as "clear the list" — the never-block picker). When
  /// false (default, the block picker), empty-Done resolves as cancel so a
  /// previously-saved selection isn't clobbered with an empty one.
  let allowEmptyDone: Bool
  let onSelection: (FamilyActivitySelection) -> Void
  let onCancel: () -> Void
  /// Closes only this picker controller (injected by the hosting controller).
  let dismiss: () -> Void

  init(
    initialSelection: FamilyActivitySelection,
    title: String,
    allowEmptyDone: Bool,
    onSelection: @escaping (FamilyActivitySelection) -> Void,
    onCancel: @escaping () -> Void,
    dismiss: @escaping () -> Void
  ) {
    _selection = State(initialValue: initialSelection)
    self.title = title
    self.allowEmptyDone = allowEmptyDone
    self.onSelection = onSelection
    self.onCancel = onCancel
    self.dismiss = dismiss
  }

  var body: some View {
    NavigationView {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .confirmationAction) {
            Button("Done") {
              let isEmpty =
                selection.applicationTokens.isEmpty
                && selection.categoryTokens.isEmpty
                && selection.webDomainTokens.isEmpty
              if isEmpty && !allowEmptyDone {
                onCancel()
              } else {
                onSelection(selection)
              }
              dismiss()
            }
          }
          ToolbarItem(placement: .cancellationAction) {
            Button("Cancel") {
              onCancel()
              dismiss()
            }
          }
        }
    }
  }
}
