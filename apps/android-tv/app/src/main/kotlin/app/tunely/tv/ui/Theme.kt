package app.tunely.tv.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.darkColorScheme

/** The design tokens from CLAUDE.md (apps/web/styles/tokens.css), dark theme. */
object Tokens {
    val Bg = Color(0xFF0B0D12)
    val Surface = Color(0xFF151922)
    val SurfaceRaised = Color(0xFF1E2330)
    val Border = Color(0xFF2A3040)
    val Text = Color(0xFFF2F4F8)
    val TextMuted = Color(0xFF9AA3B5)
    val Accent = Color(0xFFFF4D4F)
    val Live = Color(0xFFFF3B30)
    val FocusRing = Color(0xFFFFFFFF)
}

@Composable
fun TunelyTheme(content: @Composable () -> Unit) = MaterialTheme(
    colorScheme = darkColorScheme(
        primary = Tokens.Accent,
        onPrimary = Tokens.Bg,
        background = Tokens.Bg,
        onBackground = Tokens.Text,
        surface = Tokens.Surface,
        onSurface = Tokens.Text,
        surfaceVariant = Tokens.SurfaceRaised,
        onSurfaceVariant = Tokens.TextMuted,
        border = Tokens.FocusRing,
        borderVariant = Tokens.Border,
    ),
    content = content,
)
