package app.tunely.tv.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyGridState
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.tv.material3.Border
import androidx.tv.material3.Button
import androidx.tv.material3.ButtonDefaults
import androidx.tv.material3.Card
import androidx.tv.material3.CardDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.SurfaceDefaults
import androidx.tv.material3.Text
import app.tunely.tv.data.ChannelList
import app.tunely.tv.data.ChannelSummary
import app.tunely.tv.data.orNull
import coil3.compose.AsyncImage

/** Horizontal and vertical TV overscan margins (5% of a 960x540 dp screen). */
val SafeX = 48.dp
val SafeY = 27.dp
private val CardWidth = 208.dp
private val RailHeight = 250.dp
private val CardShape = RoundedCornerShape(8.dp)

typealias OpenChannel = (channel: ChannelSummary, lineup: List<ChannelSummary>) -> Unit

/** A full-screen layer above the current one. Its own window keeps D-pad focus inside it and leaves the screen below
 * (its scroll position and focused card) as it was for when Back closes this one. */
@Composable
fun FullScreen(onBack: () -> Unit, content: @Composable BoxScope.() -> Unit) = Dialog(
    onDismissRequest = onBack,
    properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
) { Screen(content) }

@Composable
fun Screen(content: @Composable BoxScope.() -> Unit) =
    Surface(Modifier.fillMaxSize(), colors = SurfaceDefaults.colors(containerColor = Tokens.Bg), content = content)

/** Moves focus here once the next frame has laid the target out (it may only just have been composed). */
suspend fun FocusRequester.focusSoon() {
    withFrameNanos {}
    try {
        requestFocus()
    } catch (_: IllegalStateException) {
        // Not attached after all (the list emptied meanwhile): leave focus where it is.
    }
}

@Composable
fun ScreenTitle(title: String) = Text(
    title,
    Modifier.padding(start = SafeX, end = SafeX, top = SafeY, bottom = 8.dp),
    style = MaterialTheme.typography.headlineMedium,
)

@Composable
fun Message(text: String) =
    Text(text, Modifier.padding(horizontal = SafeX, vertical = 16.dp), color = Tokens.TextMuted, style = MaterialTheme.typography.titleMedium)

/** Light on focus (inverted), scaled up and ringed in the accent colour, so focus is obvious from the sofa. */
@Composable
fun TvButton(text: String, modifier: Modifier = Modifier, onClick: () -> Unit) = Button(
    onClick = onClick,
    modifier = modifier,
    colors = ButtonDefaults.colors(
        containerColor = Tokens.SurfaceRaised,
        contentColor = Tokens.Text,
        focusedContainerColor = Tokens.Text,
        focusedContentColor = Tokens.Bg,
    ),
    scale = ButtonDefaults.scale(focusedScale = 1.1f),
    border = ButtonDefaults.border(focusedBorder = Border(BorderStroke(3.dp, Tokens.Accent), shape = CircleShape)),
) { Text(text, maxLines = 1, overflow = TextOverflow.Ellipsis) }

@Composable
fun ChannelLogo(channel: ChannelSummary, modifier: Modifier = Modifier) =
    Box(modifier.background(Tokens.SurfaceRaised).padding(12.dp), contentAlignment = Alignment.Center) {
        if (channel.logo != null) {
            AsyncImage(
                model = channel.logo,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit,
            )
        } else {
            Text(channel.name.take(2).uppercase(), style = MaterialTheme.typography.headlineSmall, color = Tokens.TextMuted)
        }
    }

private fun statusLine(c: ChannelSummary) = when (c.status) {
    "live" -> listOfNotNull(c.country.takeIf { it.isNotEmpty() }, c.quality).joinToString(" · ").ifEmpty { "Live" }
    "closed" -> "Closed"
    "no_stream" -> "No stream yet"
    else -> "Offline"
}

@Composable
fun ChannelCard(channel: ChannelSummary, onClick: () -> Unit, modifier: Modifier = Modifier) = Card(
    onClick = onClick,
    modifier = modifier,
    shape = CardDefaults.shape(CardShape),
    colors = CardDefaults.colors(
        containerColor = Tokens.Surface,
        contentColor = Tokens.Text,
        focusedContainerColor = Tokens.SurfaceRaised,
        focusedContentColor = Tokens.Text,
    ),
    scale = CardDefaults.scale(focusedScale = 1.1f),
    border = CardDefaults.border(focusedBorder = Border(BorderStroke(3.dp, Tokens.FocusRing), shape = CardShape)),
) {
    ChannelLogo(channel, Modifier.fillMaxWidth().aspectRatio(16f / 9f))
    Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
        Text(channel.name, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleSmall)
        Text(statusLine(channel), maxLines = 1, color = Tokens.TextMuted, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
fun Rail(title: String, items: List<ChannelSummary>, onOpen: OpenChannel) = Column {
    Text(title, Modifier.padding(start = SafeX, top = 8.dp), style = MaterialTheme.typography.titleLarge)
    LazyRow(
        contentPadding = PaddingValues(horizontal = SafeX, vertical = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        items(items, key = { it.id }) { c -> ChannelCard(c, { onOpen(c, items) }, Modifier.width(CardWidth)) }
    }
}

/** A rail that loads when it first scrolls into view; it keeps its height while loading and disappears if empty. */
@Composable
fun LoadingRail(title: String, key: Any, onOpen: OpenChannel, load: suspend () -> List<ChannelSummary>) {
    val items by produceState<List<ChannelSummary>?>(null, key) { value = orNull { load() }.orEmpty() }
    val list = items
    when {
        list == null -> Spacer(Modifier.height(RailHeight))
        list.isNotEmpty() -> Rail(title, list, onOpen)
    }
}

/** A paged grid of channels: loads the next page as focus nears the end. Up/down in the player walks what's loaded. */
@Composable
fun ChannelGrid(
    key: Any,
    onOpen: OpenChannel,
    takeFocus: Boolean = true,
    empty: String = "No live channels here right now.",
    load: suspend (cursor: String?) -> ChannelList,
) {
    var items by remember(key) { mutableStateOf<List<ChannelSummary>?>(null) }
    var cursor by remember(key) { mutableStateOf<String?>(null) }
    var failed by remember(key) { mutableStateOf(false) }
    val grid = remember(key) { LazyGridState() }
    val first = remember { FocusRequester() }

    LaunchedEffect(key) {
        val page = orNull { load(null) }
        failed = page == null
        items = page?.items.orEmpty()
        cursor = page?.nextCursor
        if (takeFocus && items.orEmpty().isNotEmpty()) first.focusSoon()
    }
    LaunchedEffect(grid) {
        snapshotFlow { grid.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1 }.collect { last ->
            val loaded = items ?: return@collect
            val next = cursor ?: return@collect
            if (last < loaded.size - 12) return@collect
            val page = orNull { load(next) }
            items = (loaded + page?.items.orEmpty()).distinctBy { it.id }
            cursor = page?.nextCursor
        }
    }

    val list = items
    when {
        list == null -> Message("Loading…")
        failed -> Message("Couldn't reach Tunely. Check your connection and try again.")
        list.isEmpty() -> Message(empty)
        else -> LazyVerticalGrid(
            columns = GridCells.Adaptive(CardWidth),
            state = grid,
            contentPadding = PaddingValues(horizontal = SafeX, vertical = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(20.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp),
        ) {
            itemsIndexed(list, key = { _, c -> c.id }) { i, c ->
                ChannelCard(c, { onOpen(c, list) }, if (i == 0) Modifier.focusRequester(first) else Modifier)
            }
        }
    }
}
