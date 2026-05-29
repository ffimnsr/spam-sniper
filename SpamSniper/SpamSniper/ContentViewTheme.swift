import ContactsUI
import SwiftUI

private enum AppColorTokens {
    static let tintDark = Color(red: 0.48, green: 0.92, blue: 0.94)
    static let tintLight = Color(red: 0.02, green: 0.44, blue: 0.54)
    
    static let warningDark = Color(red: 1.0, green: 0.63, blue: 0.42)
    static let warningLight = Color(red: 0.86, green: 0.28, blue: 0.18)
    
    static let successDark = Color(red: 0.42, green: 0.92, blue: 0.66)
    static let successLight = Color(red: 0.04, green: 0.56, blue: 0.31)
    
    static let heroBackgroundDark = [
        Color(red: 0.05, green: 0.08, blue: 0.18),
        Color(red: 0.05, green: 0.27, blue: 0.36),
        Color(red: 0.21, green: 0.16, blue: 0.42)
    ]
    static let heroBackgroundLight = [
        Color(red: 0.87, green: 0.98, blue: 1.0),
        Color(red: 0.74, green: 0.92, blue: 0.96),
        Color(red: 0.94, green: 0.90, blue: 1.0)
    ]
    
    static let heroForegroundLight = Color(red: 0.02, green: 0.12, blue: 0.18)
    
    static let ambientGlowDark = [
        Color(red: 0.10, green: 0.72, blue: 0.80).opacity(0.40),
        Color(red: 0.55, green: 0.35, blue: 1.0).opacity(0.24),
        .clear
    ]
    static let ambientGlowLight = [
        Color(red: 0.38, green: 0.86, blue: 0.93).opacity(0.34),
        Color(red: 0.78, green: 0.62, blue: 1.0).opacity(0.22),
        .clear
    ]
    
    static let pageBackgroundDark = [
        Color(red: 0.02, green: 0.03, blue: 0.07),
        Color(red: 0.05, green: 0.08, blue: 0.13),
        Color(red: 0.08, green: 0.10, blue: 0.18)
    ]
    static let pageBackgroundLight = [
        Color(red: 0.98, green: 0.99, blue: 1.0),
        Color(red: 0.92, green: 0.97, blue: 0.99),
        Color(red: 0.96, green: 0.94, blue: 1.0)
    ]
    
    static let primaryButtonDark = [
        Color(red: 0.10, green: 0.66, blue: 0.72),
        Color(red: 0.34, green: 0.86, blue: 0.88)
    ]
    static let primaryButtonLight = [
        Color(red: 0.02, green: 0.44, blue: 0.54),
        Color(red: 0.05, green: 0.68, blue: 0.72)
    ]
    
    static let warningButtonDark = [
        Color(red: 1.0, green: 0.54, blue: 0.26),
        Color(red: 0.84, green: 0.23, blue: 0.18)
    ]
    static let warningButtonLight = [
        Color(red: 1.0, green: 0.48, blue: 0.22),
        Color(red: 0.86, green: 0.28, blue: 0.18)
    ]
    
    static let neutralButtonDark = [
        Color(red: 0.42, green: 0.48, blue: 0.58),
        Color(red: 0.24, green: 0.29, blue: 0.36)
    ]
    static let neutralButtonLight = [
        Color(red: 0.36, green: 0.41, blue: 0.49),
        Color(red: 0.20, green: 0.24, blue: 0.31)
    ]
    
    static let neutralAccentDark = Color(red: 0.29, green: 0.34, blue: 0.42)
    static let neutralAccentLight = Color(red: 0.20, green: 0.24, blue: 0.31)
}

extension View {
    func cardStyle(cornerRadius: CGFloat = 30) -> some View {
        self
            .padding(20)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(.white.opacity(0.22), lineWidth: 1)
            }
            .shadow(color: Color.black.opacity(0.10), radius: 24, x: 0, y: 14)
    }
    
    func panelStyle(cornerRadius: CGFloat = 24) -> some View {
        self
            .padding(16)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(.white.opacity(0.18), lineWidth: 1)
            }
    }
}

struct AppPalette {
    let colorScheme: ColorScheme
    
    var tint: Color {
        colorScheme == .dark ? AppColorTokens.tintDark : AppColorTokens.tintLight
    }
    
    var tintSoft: Color {
        tint.opacity(colorScheme == .dark ? 0.22 : 0.12)
    }
    
    var warning: Color {
        colorScheme == .dark ? AppColorTokens.warningDark : AppColorTokens.warningLight
    }
    
    var success: Color {
        colorScheme == .dark ? AppColorTokens.successDark : AppColorTokens.successLight
    }
    
    var destructive: Color {
        warning
    }
    
    var primaryText: Color {
        .primary
    }
    
    var secondaryText: Color {
        .secondary
    }
    
    var tertiaryText: Color {
        Color(uiColor: .tertiaryLabel)
    }
    
    var onTint: Color {
        .white
    }
    
    var subduedFill: Color {
        Color(uiColor: .quaternarySystemFill)
    }
    
    var heroBackground: [Color] {
        colorScheme == .dark ? AppColorTokens.heroBackgroundDark : AppColorTokens.heroBackgroundLight
    }
    
    var heroForeground: Color {
        colorScheme == .dark ? onTint : AppColorTokens.heroForegroundLight
    }
    
    var heroSecondaryForeground: Color {
        heroForeground.opacity(colorScheme == .dark ? 0.76 : 0.68)
    }
    
    var ambientGlow: [Color] {
        colorScheme == .dark ? AppColorTokens.ambientGlowDark : AppColorTokens.ambientGlowLight
    }
    
    var secondarySurface: Color {
        Color(uiColor: colorScheme == .dark ? .secondarySystemBackground : .systemBackground).opacity(colorScheme == .dark ? 0.72 : 0.82)
    }
    
    var elevatedSurface: Color {
        Color(uiColor: colorScheme == .dark ? .tertiarySystemBackground : .secondarySystemBackground).opacity(0.74)
    }
    
    var pageBackground: [Color] {
        colorScheme == .dark ? AppColorTokens.pageBackgroundDark : AppColorTokens.pageBackgroundLight
    }
    
    var primaryButton: [Color] {
        colorScheme == .dark ? AppColorTokens.primaryButtonDark : AppColorTokens.primaryButtonLight
    }
    
    var warningButton: [Color] {
        colorScheme == .dark ? AppColorTokens.warningButtonDark : AppColorTokens.warningButtonLight
    }
    
    var neutralButton: [Color] {
        colorScheme == .dark ? AppColorTokens.neutralButtonDark : AppColorTokens.neutralButtonLight
    }
    
    var neutralAccent: Color {
        colorScheme == .dark ? AppColorTokens.neutralAccentDark : AppColorTokens.neutralAccentLight
    }
}

struct ContactAccessPickerModifier: ViewModifier {
    @Binding var isPresented: Bool
    let onComplete: @MainActor () -> Void
    
    func body(content: Content) -> some View {
        content
            .contactAccessPicker(isPresented: $isPresented)
            .onChange(of: isPresented) { wasPresented, isNowPresented in
                guard wasPresented, !isNowPresented else { return }

                Task { @MainActor in
                    // Refresh only after SwiftUI finishes dismissing the system picker.
                    await Task.yield()
                    onComplete()
                }
            }
    }
}
