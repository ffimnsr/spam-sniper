import ContactsUI
import SwiftUI

extension View {
    func cardStyle() -> some View {
        self
            .padding(20)
            .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(Color(uiColor: .separator).opacity(0.35), lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.12), radius: 18, x: 0, y: 10)
    }
}

struct ThemePalette {
    let colorScheme: ColorScheme

    var tint: Color {
        switch colorScheme {
        case .dark:
            return Color(red: 0.38, green: 0.84, blue: 0.86)
        default:
            return Color(red: 0.04, green: 0.46, blue: 0.54)
        }
    }

    var tintSoft: Color {
        tint.opacity(colorScheme == .dark ? 0.22 : 0.10)
    }

    var warning: Color {
        switch colorScheme {
        case .dark:
            return Color(red: 1.0, green: 0.56, blue: 0.38)
        default:
            return Color(red: 0.84, green: 0.24, blue: 0.19)
        }
    }

    var heroBackground: [Color] {
        switch colorScheme {
        case .dark:
            return [
                Color(red: 0.07, green: 0.16, blue: 0.28),
                Color(red: 0.10, green: 0.36, blue: 0.46)
            ]
        default:
            return [
                Color(red: 0.06, green: 0.14, blue: 0.34),
                Color(red: 0.04, green: 0.44, blue: 0.55)
            ]
        }
    }

    var secondarySurface: Color {
        Color(uiColor: .tertiarySystemBackground)
    }

    var pageBackground: [Color] {
        switch colorScheme {
        case .dark:
            return [
                Color(uiColor: .systemBackground),
                Color(red: 0.06, green: 0.10, blue: 0.14)
            ]
        default:
            return [
                Color(red: 0.95, green: 0.97, blue: 0.99),
                Color(red: 0.90, green: 0.95, blue: 0.96)
            ]
        }
    }

    var primaryButton: [Color] {
        switch colorScheme {
        case .dark:
            return [
                Color(red: 0.14, green: 0.56, blue: 0.62),
                Color(red: 0.20, green: 0.72, blue: 0.76)
            ]
        default:
            return [
                Color(red: 0.04, green: 0.46, blue: 0.54),
                Color(red: 0.07, green: 0.63, blue: 0.67)
            ]
        }
    }

    var warningButton: [Color] {
        switch colorScheme {
        case .dark:
            return [
                Color(red: 0.92, green: 0.42, blue: 0.20),
                Color(red: 0.78, green: 0.22, blue: 0.17)
            ]
        default:
            return [
                Color(red: 0.98, green: 0.45, blue: 0.19),
                Color(red: 0.84, green: 0.24, blue: 0.19)
            ]
        }
    }

    var neutralButton: [Color] {
        switch colorScheme {
        case .dark:
            return [
                Color(red: 0.38, green: 0.43, blue: 0.50),
                Color(red: 0.26, green: 0.30, blue: 0.36)
            ]
        default:
            return [
                Color(red: 0.34, green: 0.39, blue: 0.45),
                Color(red: 0.23, green: 0.27, blue: 0.33)
            ]
        }
    }

    var neutralAccent: Color {
        switch colorScheme {
        case .dark:
            return Color(red: 0.26, green: 0.30, blue: 0.36)
        default:
            return Color(red: 0.23, green: 0.27, blue: 0.33)
        }
    }
}

struct ContactAccessPickerModifier: ViewModifier {
    @Binding var isPresented: Bool
    let onComplete: () -> Void

    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content.contactAccessPicker(isPresented: $isPresented) { _ in
                onComplete()
            }
        } else {
            content
        }
    }
}
