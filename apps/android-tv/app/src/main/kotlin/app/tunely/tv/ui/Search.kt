package app.tunely.tv.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import app.tunely.tv.Destination
import app.tunely.tv.data.TunelyApi
import kotlinx.coroutines.delay

private const val MAX_QUERY = 80

/** Search by name with the TV's on-screen keyboard; results update as you type. */
@Composable
fun SearchScreen(api: TunelyApi, open: (Destination) -> Unit) = Column {
    var text by remember { mutableStateOf("") }
    var query by remember { mutableStateOf("") }
    val field = remember { FocusRequester() }
    val focusManager = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    LaunchedEffect(Unit) { field.focusSoon() }
    LaunchedEffect(text) {
        delay(500)
        query = text.trim()
    }

    ScreenTitle("Search")
    SearchField(
        value = text,
        onValueChange = { text = it.take(MAX_QUERY) },
        onSearch = {
            query = text.trim()
            keyboard?.hide()
            focusManager.moveFocus(FocusDirection.Down)
        },
        modifier = Modifier.padding(horizontal = SafeX).focusRequester(field),
    )
    if (query.isNotEmpty()) {
        // All statuses: someone searching a channel by name wants it even if it's off air (live ones rank first).
        ChannelGrid(
            key = query,
            onOpen = { c, lineup -> open(Destination.Watch(c, lineup)) },
            takeFocus = false,
            empty = "No channels match “$query”.",
        ) { cursor -> api.channels(q = query, cursor = cursor, limit = 48) }
    }
}

@Composable
private fun SearchField(value: String, onValueChange: (String) -> Unit, onSearch: () -> Unit, modifier: Modifier) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val shape = RoundedCornerShape(8.dp)
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier
            .fillMaxWidth()
            .background(Tokens.Surface, shape)
            .border(if (focused) 3.dp else 1.dp, if (focused) Tokens.FocusRing else Tokens.Border, shape)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        singleLine = true,
        textStyle = MaterialTheme.typography.titleMedium.copy(color = Tokens.Text),
        cursorBrush = SolidColor(Tokens.Accent),
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        keyboardActions = KeyboardActions(onSearch = { onSearch() }),
        interactionSource = interaction,
        decorationBox = { inner ->
            Box {
                if (value.isEmpty()) {
                    Text("Channel name", color = Tokens.TextMuted, style = MaterialTheme.typography.titleMedium)
                }
                inner()
            }
        },
    )
}
