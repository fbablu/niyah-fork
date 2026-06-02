import ManagedSettings
import ManagedSettingsUI
import UIKit

/// Class name MUST stay `ShieldConfigurationExtension` — apple-targets
/// writes `$(PRODUCT_MODULE_NAME).ShieldConfigurationExtension` into the
/// generated Info.plist as NSExtensionPrincipalClass.
class ShieldConfigurationExtension: ShieldConfigurationDataSource {

    private enum ShieldVariant {
        case social, video, gaming, news, defaultVariant
    }

    private let textPrimary   = UIColor(red: 242/255, green: 237/255, blue: 228/255, alpha: 1)
    private let textSecondary = UIColor(red: 170/255, green: 170/255, blue: 180/255, alpha: 1)
    private let primaryGreen  = UIColor(red: 45/255,  green: 106/255, blue: 79/255,  alpha: 1)
    private let accentGreen   = UIColor(red: 82/255,  green: 183/255, blue: 136/255, alpha: 1)
    private let dangerRed     = UIColor(red: 220/255, green: 60/255,  blue: 60/255,  alpha: 1)

    private func backgroundColor(for variant: ShieldVariant) -> UIColor {
        switch variant {
        case .social:         return UIColor(red: 36/255, green: 18/255, blue: 50/255, alpha: 1)
        case .video:          return UIColor(red: 12/255, green: 32/255, blue: 68/255, alpha: 1)
        case .gaming:         return UIColor(red: 14/255, green: 38/255, blue: 22/255, alpha: 1)
        case .news:           return UIColor(red: 42/255, green: 30/255, blue: 16/255, alpha: 1)
        case .defaultVariant: return UIColor(red: 15/255, green: 15/255, blue: 20/255, alpha: 1)
        }
    }

    private func iconName(for variant: ShieldVariant) -> String {
        switch variant {
        case .social:         return "hand.raised.fill"
        case .video:          return "stop.circle.fill"
        case .gaming:         return "gamecontroller.fill"
        case .news:           return "newspaper.fill"
        case .defaultVariant: return "lock.fill"
        }
    }

    private func icon(for variant: ShieldVariant) -> UIImage? {
        let config = UIImage.SymbolConfiguration(pointSize: 80, weight: .bold)
        return UIImage(systemName: iconName(for: variant), withConfiguration: config)?
            .withTintColor(accentGreen, renderingMode: .alwaysOriginal)
    }

    private func detectVariant(bundleID: String?, categoryName: String?) -> ShieldVariant {
        if let bid = bundleID?.lowercased() {
            if bid.contains("instagram") || bid.contains("facebook") || bid.contains("snapchat")
                || bid.contains("tiktok") || bid.contains("threads") || bid.contains("bereal")
                || bid.contains("discord") || bid.contains("whatsapp") || bid.contains("messenger") {
                return .social
            }
            if bid.contains("youtube") || bid.contains("netflix") || bid.contains("hulu")
                || bid.contains("twitch") || bid.contains("disneyplus") || bid.contains("primevideo")
                || bid.contains("spotify") || bid.contains("apple.tv") {
                return .video
            }
            if bid.contains("supercell") || bid.contains("roblox") || bid.contains("fortnite")
                || bid.contains("genshin") || bid.contains("epicgames") || bid.contains("minecraft")
                || bid.contains("riotgames") || bid.contains("clashofclans") {
                return .gaming
            }
            if bid.contains("nytimes") || bid.contains("washingtonpost") || bid.contains("apple.news")
                || bid.contains("reddit") || bid.contains("twitter") || bid.contains("x.com")
                || bid.contains("hackernews") {
                return .news
            }
        }
        if let cat = categoryName?.lowercased() {
            if cat.contains("social") { return .social }
            if cat.contains("entertain") || cat.contains("video") { return .video }
            if cat.contains("game") { return .gaming }
            if cat.contains("news") { return .news }
        }
        return .defaultVariant
    }

    override func configuration(shielding application: Application) -> ShieldConfiguration {
        makeConfiguration(
            bundleID: application.bundleIdentifier,
            categoryName: nil
        )
    }

    override func configuration(
        shielding application: Application,
        in category: ActivityCategory
    ) -> ShieldConfiguration {
        makeConfiguration(
            bundleID: application.bundleIdentifier,
            categoryName: category.localizedDisplayName
        )
    }

    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
        makeConfiguration(bundleID: nil, categoryName: nil)
    }

    override func configuration(
        shielding webDomain: WebDomain,
        in category: ActivityCategory
    ) -> ShieldConfiguration {
        makeConfiguration(
            bundleID: nil,
            categoryName: category.localizedDisplayName
        )
    }

    private let appGroupID = "group.com.niyah.app"
    private let sessionContextKey = "niyah_session_context"

    private func makeConfiguration(
        bundleID: String?,
        categoryName: String?
    ) -> ShieldConfiguration {
        let variant = detectVariant(bundleID: bundleID, categoryName: categoryName)
        let subtitleText = buildSubtitle(variant: variant)

        return ShieldConfiguration(
            backgroundBlurStyle: .systemUltraThinMaterialDark,
            backgroundColor: backgroundColor(for: variant),
            icon: icon(for: variant),
            title: ShieldConfiguration.Label(
                text: "Lock in.",
                color: textPrimary
            ),
            subtitle: ShieldConfiguration.Label(
                text: subtitleText,
                color: textSecondary
            ),
            primaryButtonLabel: ShieldConfiguration.Label(
                text: "Back to it",
                color: .white
            ),
            primaryButtonBackgroundColor: primaryGreen,
            secondaryButtonLabel: ShieldConfiguration.Label(
                text: "Open Niyah",
                color: dangerRed
            )
        )
    }

    private func buildSubtitle(variant: ShieldVariant) -> String {
        let context = readSessionContext()
        let names = context?["names"] as? [String]
        let stake = context?["stake"] as? Int ?? 0
        let stakeStr = stake > 0 ? String(format: "$%.2f", Double(stake) / 100.0) : nil

        let quotes = variantQuotes(
            variant,
            namesList: (names?.isEmpty == false) ? formatNames(names!) : nil,
            stakeStr: stakeStr
        )
        let index = Int(Date().timeIntervalSince1970 / 60) % quotes.count
        let lead = quotes[index]

        return "\(lead)\n\nUnlocking forfeits your stake and sends you back to your home screen."
    }

    private func readSessionContext() -> [String: Any]? {
        guard let defaults = UserDefaults(suiteName: appGroupID),
              let json = defaults.string(forKey: sessionContextKey),
              let data = json.data(using: .utf8),
              let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return parsed
    }

    private func variantQuotes(_ variant: ShieldVariant, namesList: String?, stakeStr: String?) -> [String] {
        var quotes: [String] = baseQuotes(for: variant)
        if let names = namesList {
            quotes.append(contentsOf: socialQuotes(variant: variant, namesList: names))
        }
        if let stake = stakeStr {
            quotes.append(contentsOf: stakeQuotes(variant: variant, stakeStr: stake))
        }
        return quotes
    }

    private func baseQuotes(for variant: ShieldVariant) -> [String] {
        switch variant {
        case .social:
            return [
                "the scroll will survive without you.\nlock in.",
                "you opened this on autopilot.\nrespectfully, close it.",
                "this app is not the main character today.\nyou are.",
                "the feed is feeding.\ndon't be the meal.",
                "30 seconds of dopamine,\nan hour of 'why did i do that'.",
                "your future self is begging you to close this.",
                "you're not bored, you're avoiding.\nlock back in.",
                "the algorithm is in its villain era.\ndon't let it cook you.",
                "touch grass after the timer,\nnot the feed.",
                "close the app, keep the stake.\nthat's the whole move.",
            ]
        case .video:
            return [
                "one video becomes five. you know this.\nclose it.",
                "the recommended row was built to trap you.\nleave anyway.",
                "autoplay is not a personality.\nlock in.",
                "netflix will still be netflix tonight.",
                "watching is not progress.\ngo do the thing.",
                "the next episode doesn't need you.\nyour goals do.",
                "your eyes are heavy because the app is cooking you,\nnot because you're resting.",
                "20 min of focus beats 2 hours of half-watched videos.",
                "streaming is fine. after the session.",
                "you came to lock in,\nnot to get cooked by youtube.",
            ]
        case .gaming:
            return [
                "one match becomes five.\ndon't even queue.",
                "your rank recovers tomorrow.\nthis hour doesn't.",
                "the lobby will survive without you.\nlock in.",
                "the grind is the game's goal, not yours.",
                "the boss will still be there.\nyour deadline might not.",
                "loot boxes are not life points.",
                "respectfully, the battle pass can wait.",
                "20 min of work now, game tonight.\ndeal?",
                "you're not gaming, you're avoiding.\nlock back in.",
                "touch the controller after the timer,\nnot before.",
            ]
        case .news:
            return [
                "doomscrolling is not 'staying informed'.",
                "the takes will still be hot tonight.",
                "rage bait rewards the app, not you.\ndon't feed it your focus.",
                "reddit is an infinite hallway.\nclose the door.",
                "your attention is the product.\ntake it back.",
                "nothing you read in 10 minutes changes your day.",
                "skimming feels productive.\nit isn't.",
                "refreshing is the new fidgeting.\ndo something with your hands.",
                "you're informed enough.\ngo lock in.",
                "the discourse will cope without you.\nclose the app.",
            ]
        case .defaultVariant:
            return [
                "real money is on the line.\nyour stake is safe while this stays closed.",
                "the urge passes in about 60 seconds.\nwait it out.",
                "you set this timer.\npast-you was locked in. trust them.",
                "every minute closed is money you keep.",
                "you won't remember this urge tomorrow.\nyou'll remember the work.",
                "two more minutes. then two more.\nthat's how it's done.",
                "respectfully, close the app.",
                "the hardest part is the next minute.\nthen it gets easy.",
                "lock in now, flex later.",
                "close the app. keep the stake. move on.",
            ]
        }
    }

    private func socialQuotes(variant: ShieldVariant, namesList: String) -> [String] {
        switch variant {
        case .social:
            return [
                "\(namesList) are off the scroll right now.\ndon't be the one who caves.",
                "\(namesList) put real money on this with you.\nclose the app.",
                "the whole group's focus stays clean if you close this now.",
            ]
        case .video:
            return [
                "\(namesList) just chose work over a video.\nyour turn.",
                "\(namesList) are watching the leaderboard, not netflix.",
            ]
        case .gaming:
            return [
                "\(namesList) are not in the lobby.\nthey're locked in. follow them.",
                "\(namesList) will know if you queued up.",
            ]
        case .news:
            return [
                "\(namesList) aren't doomscrolling.\nbe like them.",
            ]
        case .defaultVariant:
            return [
                "\(namesList) are counting on you.\nstay locked in.",
                "\(namesList) will know if you open this.\ndon't be the one who folds.",
                "your friends are heads down right now.\n\(namesList) stayed off their phones. can you?",
            ]
        }
    }

    private func stakeQuotes(variant: ShieldVariant, stakeStr: String) -> [String] {
        switch variant {
        case .social:
            return [
                "\(stakeStr) for a scroll session?\nthe scroll is not that good.",
                "you staked \(stakeStr) so you wouldn't open this.\ndon't outsmart past-you.",
            ]
        case .video:
            return [
                "\(stakeStr) is more than a month of premium.\nkeep it.",
                "\(stakeStr) to watch the same recs again?",
            ]
        case .gaming:
            return [
                "\(stakeStr) is more than this season's battle pass.\ndon't trade focus for it.",
            ]
        case .news:
            return [
                "\(stakeStr) for one more outraged take?\nnot the move.",
            ]
        case .defaultVariant:
            return [
                "\(stakeStr) says you can't stay off this app.\nprove it wrong.",
                "you staked \(stakeStr).\nstill yours unless you tap forfeit.",
            ]
        }
    }

    private func formatNames(_ names: [String]) -> String {
        switch names.count {
        case 1: return names[0]
        case 2: return "\(names[0]) and \(names[1])"
        default:
            let allButLast = names.dropLast().joined(separator: ", ")
            return "\(allButLast), and \(names.last!)"
        }
    }
}
