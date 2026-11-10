package app.tunely.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import app.tunely.tv.data.ChannelSummary
import app.tunely.tv.data.Library
import app.tunely.tv.data.TunelyApi
import app.tunely.tv.player.WatchScreen
import app.tunely.tv.ui.ChannelsScreen
import app.tunely.tv.ui.FullScreen
import app.tunely.tv.ui.HomeScreen
import app.tunely.tv.ui.Kind
import app.tunely.tv.ui.OptionsScreen
import app.tunely.tv.ui.SearchScreen
import app.tunely.tv.ui.TunelyTheme
import coil3.ImageLoader
import coil3.compose.setSingletonImageLoaderFactory
import coil3.network.okhttp.OkHttpNetworkFetcherFactory

/** Screens opened on top of Home. */
sealed interface Destination {
    data object Search : Destination
    data class Options(val kind: Kind) : Destination
    data class Channels(val title: String, val kind: Kind, val id: String) : Destination
    data class Watch(val channel: ChannelSummary, val lineup: List<ChannelSummary>) : Destination
}

class MainActivity : ComponentActivity() {
    private val api by lazy { TunelyApi() }
    private val library by lazy { Library(applicationContext) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            setSingletonImageLoaderFactory { context ->
                ImageLoader.Builder(context)
                    .components { add(OkHttpNetworkFetcherFactory(callFactory = { api.client })) }
                    .build()
            }
            TunelyTheme { App(api, library) }
        }
    }
}

@Composable
private fun App(api: TunelyApi, library: Library) {
    // Each screen is a full-screen layer over the ones below (see FullScreen); Back closes the top one.
    val stack = remember { mutableStateListOf<Destination>() }
    val open: (Destination) -> Unit = { stack.add(it) }
    val close: () -> Unit = { if (stack.isNotEmpty()) stack.removeAt(stack.lastIndex) }
    HomeScreen(api, library, open)
    stack.forEachIndexed { i, d ->
        key(i) {
            when (d) {
                is Destination.Watch -> WatchScreen(api, library, d.channel, d.lineup, onExit = close)
                Destination.Search -> FullScreen(close) { SearchScreen(api, open) }
                is Destination.Options -> FullScreen(close) { OptionsScreen(api, d.kind, open) }
                is Destination.Channels -> FullScreen(close) { ChannelsScreen(api, d, open) }
            }
        }
    }
}
