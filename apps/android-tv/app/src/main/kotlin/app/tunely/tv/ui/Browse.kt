package app.tunely.tv.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp
import app.tunely.tv.Destination
import app.tunely.tv.data.Facet
import app.tunely.tv.data.FacetCount
import app.tunely.tv.data.TunelyApi
import app.tunely.tv.data.orNull

enum class Kind(val title: String) { CATEGORY("Categories"), LANGUAGE("Languages") }

/** The options that have live channels, most first, named from the facet list (unknown ids are dropped). */
fun liveOptions(names: List<Facet>, live: List<FacetCount>): List<Facet> {
    val byId = names.associateBy { it.id }
    return live.mapNotNull { f -> byId[f.id]?.takeIf { f.count > 0 }?.copy(count = f.count) }.sortedByDescending { it.count }
}

/** Every category or language with live channels. */
@Composable
fun OptionsScreen(api: TunelyApi, kind: Kind, open: (Destination) -> Unit) = Column {
    val options by produceState<List<Facet>?>(null) {
        value = orNull {
            val live = api.liveFacets()
            when (kind) {
                Kind.CATEGORY -> liveOptions(api.categories(), live.categories)
                Kind.LANGUAGE -> liveOptions(api.languages(), live.languages)
            }
        }.orEmpty()
    }
    val first = remember { FocusRequester() }
    LaunchedEffect(options) { if (!options.isNullOrEmpty()) first.focusSoon() }

    ScreenTitle(kind.title)
    val list = options
    when {
        list == null -> Message("Loading…")
        list.isEmpty() -> Message("Couldn't reach Tunely. Check your connection and try again.")
        else -> LazyVerticalGrid(
            columns = GridCells.Adaptive(240.dp),
            contentPadding = PaddingValues(horizontal = SafeX, vertical = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            itemsIndexed(list, key = { _, f -> f.id }) { i, f ->
                val modifier = if (i == 0) Modifier.focusRequester(first) else Modifier
                TvButton("${f.name} · ${f.count}", modifier.fillMaxWidth()) { open(Destination.Channels(f.name, kind, f.id)) }
            }
        }
    }
}

/** The live channels of one category or language, best first. */
@Composable
fun ChannelsScreen(api: TunelyApi, screen: Destination.Channels, open: (Destination) -> Unit) = Column {
    ScreenTitle(screen.title)
    ChannelGrid(key = screen.id, onOpen = { c, lineup -> open(Destination.Watch(c, lineup)) }) { cursor ->
        api.channels(
            category = screen.id.takeIf { screen.kind == Kind.CATEGORY },
            language = screen.id.takeIf { screen.kind == Kind.LANGUAGE },
            status = "live",
            sort = "best",
            cursor = cursor,
            limit = 48,
        )
    }
}
