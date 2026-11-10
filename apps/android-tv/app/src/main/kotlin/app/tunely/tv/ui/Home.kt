package app.tunely.tv.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import app.tunely.tv.Destination
import app.tunely.tv.data.Facet
import app.tunely.tv.data.Facets
import app.tunely.tv.data.Library
import app.tunely.tv.data.MAX_FAVORITES
import app.tunely.tv.data.TunelyApi
import app.tunely.tv.data.orNull

// Same rail order as the web home (apps/web/app/page.tsx).
private val RAIL_PRIORITY = listOf(
    "entertainment", "movies", "sports", "kids", "music", "news",
    "series", "documentary", "comedy", "animation", "religious", "general",
)
private val RAIL_LAST = setOf("shop")

/** Categories with fewer live channels than this get no rail (still reachable from Categories). */
const val MIN_RAIL_ITEMS = 6

/** A rail for every category with enough live channels: popular ones first, then the rest by size, shopping last. */
fun railCategories(categories: List<Facet>, live: Facets): List<Facet> {
    val liveCount = live.categories.associate { it.id to it.count }
    fun rank(id: String) = RAIL_PRIORITY.indexOf(id).takeIf { it >= 0 } ?: if (id in RAIL_LAST) 1000 else 100
    return categories
        .filter { (liveCount[it.id] ?: 0) >= MIN_RAIL_ITEMS }
        .sortedWith(compareBy<Facet> { rank(it.id) }.thenByDescending { it.count })
}

@Composable
fun HomeScreen(api: TunelyApi, library: Library, open: (Destination) -> Unit) = Screen {
    val favorites by library.favorites.collectAsState(initial = emptyList())
    val categories by produceState(emptyList<Facet>()) {
        value = orNull { railCategories(api.categories(), api.liveFacets()) }.orEmpty()
    }
    val searchFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) { searchFocus.focusSoon() }
    val watch: OpenChannel = { c, lineup -> open(Destination.Watch(c, lineup)) }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = SafeY)) {
        item(key = "header") {
            Row(
                Modifier.padding(horizontal = SafeX, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Tunely",
                    Modifier.padding(end = 24.dp),
                    color = Tokens.Accent,
                    style = MaterialTheme.typography.headlineMedium,
                )
                TvButton("Search", Modifier.focusRequester(searchFocus)) { open(Destination.Search) }
                TvButton("Categories") { open(Destination.Options(Kind.CATEGORY)) }
                TvButton("Languages") { open(Destination.Options(Kind.LANGUAGE)) }
            }
        }
        if (favorites.isNotEmpty()) {
            item(key = "favorites") {
                // Every status, so a favorite that went off air is still there; the player skips dead ones on up/down.
                LoadingRail("Favorites", favorites, watch) {
                    api.channels(ids = favorites, limit = MAX_FAVORITES).items.sortedBy { favorites.indexOf(it.id) }
                }
            }
        }
        item(key = "trending") { LoadingRail("Most watched now", "trending", watch) { api.trending() } }
        item(key = "live") {
            LoadingRail("Live now", "live", watch) { api.channels(status = "live", sort = "best").items }
        }
        items(categories, key = { "category:" + it.id }) { c ->
            LoadingRail(c.name, c.id, watch) { api.channels(category = c.id, status = "live", sort = "best").items }
        }
    }
}
