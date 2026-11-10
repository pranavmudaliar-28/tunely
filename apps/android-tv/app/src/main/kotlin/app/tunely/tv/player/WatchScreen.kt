package app.tunely.tv.player

import android.os.SystemClock
import android.text.format.DateFormat
import android.view.SurfaceView
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.LifecycleStartEffect
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.VideoSize
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import app.tunely.tv.data.Channel
import app.tunely.tv.data.ChannelSummary
import app.tunely.tv.data.Library
import app.tunely.tv.data.Programme
import app.tunely.tv.data.Stream
import app.tunely.tv.data.TunelyApi
import app.tunely.tv.data.USER_AGENT
import app.tunely.tv.data.nowAndNext
import app.tunely.tv.data.orNull
import app.tunely.tv.data.startAt
import app.tunely.tv.data.stopAt
import app.tunely.tv.data.timeLeft
import app.tunely.tv.ui.ChannelLogo
import app.tunely.tv.ui.FullScreen
import app.tunely.tv.ui.SafeX
import app.tunely.tv.ui.SafeY
import app.tunely.tv.ui.Tokens
import app.tunely.tv.ui.TvButton
import app.tunely.tv.ui.focusSoon
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.Date

/** Same as the web: a stream that shows nothing within this long counts as failed (timeout). */
private const val LOAD_TIMEOUT_MS = 10_000L

/**
 * Fullscreen player. Up/down walk [lineup] (the list the viewer came from), OK shows the info overlay, Back closes the
 * overlay and then the player. Streams play directly from the broadcaster; nothing is proxied or stored.
 */
@Composable
fun WatchScreen(api: TunelyApi, library: Library, start: ChannelSummary, lineup: List<ChannelSummary>, onExit: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val player = remember {
        ExoPlayer.Builder(context)
            .setAudioAttributes(
                AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(),
                true,
            )
            .build()
    }
    DisposableEffect(player) { onDispose { player.release() } }

    var channel by remember { mutableStateOf(start) }
    var reload by remember { mutableIntStateOf(0) }
    var detail by remember { mutableStateOf<Channel?>(null) }
    var loadFailed by remember { mutableStateOf(false) }
    var state by remember { mutableStateOf(PlayerState(Status.LOADING)) }
    var overlay by remember { mutableStateOf(false) }
    var active by remember { mutableStateOf(true) }
    var aspect by remember { mutableFloatStateOf(16f / 9f) }
    val favorites by library.favorites.collectAsState(initial = emptyList())
    val visitorAge by produceState<VisitorAge?>(null) { value = orNull { library.visitorAge() } }
    val streams = remember(detail) { detail?.let(::playableStreams).orEmpty() }
    val canZap = neighbour(lineup, channel.id, 1) != null

    fun go(step: Int) {
        neighbour(lineup, channel.id, step)?.let {
            channel = it
            overlay = false
        }
    }

    // Nothing plays while the app is in the background; coming back starts a fresh attempt.
    LifecycleStartEffect(Unit) {
        active = true
        onStopOrDispose { active = false }
    }

    LaunchedEffect(channel.id, reload) {
        detail = null
        loadFailed = false
        state = PlayerState(Status.LOADING, attempt = state.attempt + 1)
        val d = orNull { api.channel(channel.id) }
        detail = d
        loadFailed = d == null
        state = PlayerState.start(d?.let(::playableStreams)?.size ?: 0, state.attempt + 1)
    }

    // One attempt per stream: attach, wait for playback or an error (or the timeout), report once, fall through.
    val stream = streams.getOrNull(state.streamIndex)?.takeIf { state.status != Status.ERROR && active }
    LaunchedEffect(stream, state.attempt) {
        val s = stream ?: return@LaunchedEffect
        val started = SystemClock.elapsedRealtime()
        var reported = false
        fun report(error: PlaybackError?) {
            if (reported) return
            reported = true
            playbackReport(s.id, error, SystemClock.elapsedRealtime() - started, visitorAge)?.let(api::report)
        }
        fun fail(error: PlaybackError) {
            report(error)
            state = state.failed(error)
        }
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (!isPlaying) return
                report(null)
                state = state.playing()
            }

            override fun onVideoSizeChanged(videoSize: VideoSize) {
                if (videoSize.width > 0 && videoSize.height > 0) {
                    aspect = videoSize.width * videoSize.pixelWidthHeightRatio / videoSize.height
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                // A stall can leave us behind a live stream's window: jump back to the live edge instead of failing.
                if (error.errorCode == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW) {
                    player.seekToDefaultPosition()
                    player.prepare()
                    return
                }
                fail(error.toPlaybackError())
            }
        }
        player.addListener(listener)
        player.attach(s)
        try {
            delay(LOAD_TIMEOUT_MS)
            if (!reported) fail(PlaybackError.TIMEOUT)
            awaitCancellation()
        } finally {
            // Every channel change, retry or fallback tears the old stream down before the next one starts.
            player.removeListener(listener)
            player.stop()
        }
    }

    val rootFocus = remember { FocusRequester() }
    val overlayFocus = remember { FocusRequester() }
    val errorFocus = remember { FocusRequester() }
    val showError = state.status == Status.ERROR
    LaunchedEffect(overlay, showError) {
        when {
            overlay -> overlayFocus
            showError -> errorFocus
            else -> rootFocus
        }.focusSoon()
    }

    val back: () -> Unit = { if (overlay) overlay = false else onExit() }

    fun onKey(e: KeyEvent): Boolean = when (e.key) {
        // Handled here because Compose otherwise spends Back on moving focus out of the overlay's button row.
        Key.Back -> {
            if (e.type == KeyEventType.KeyUp) back()
            true
        }
        Key.DirectionUp, Key.ChannelUp -> {
            if (e.type == KeyEventType.KeyDown) go(-1)
            true
        }
        Key.DirectionDown, Key.ChannelDown -> {
            if (e.type == KeyEventType.KeyDown) go(1)
            true
        }
        // Opened on key up, so the same press doesn't also click the overlay's first button.
        Key.DirectionCenter, Key.Enter, Key.NumPadEnter -> if (overlay || showError) false else {
            if (e.type == KeyEventType.KeyUp) overlay = true
            true
        }
        else -> false
    }

    FullScreen(onBack = back) {
        Box(
            Modifier
                .fillMaxSize()
                .background(Color.Black)
                .onPreviewKeyEvent(::onKey)
                .focusRequester(rootFocus)
                .focusable(),
            contentAlignment = Alignment.Center,
        ) {
            AndroidView(
                factory = { SurfaceView(it).apply { keepScreenOn = true; player.setVideoSurfaceView(this) } },
                modifier = Modifier.aspectRatio(aspect),
            )
            when (state.status) {
                Status.LOADING -> Panel(channel, "Loading…", null)
                Status.ERROR -> {
                    val (title, body) = errorText(detail, loadFailed, state.error)
                    Panel(channel, title, body) {
                        Row(Modifier.focusRequester(errorFocus).focusGroup(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            if (canZap) TvButton("Try next channel") { go(1) }
                            TvButton("Try again") { reload++ }
                            TvButton("Back", onClick = onExit)
                        }
                    }
                }
                Status.PLAYING -> Unit
            }
            if (overlay) {
                Overlay(channel, detail?.schedule.orEmpty()) {
                    Row(Modifier.focusRequester(overlayFocus).focusGroup(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        val favorite = channel.id in favorites
                        TvButton(if (favorite) "Remove from favorites" else "Add to favorites") {
                            scope.launch { library.toggleFavorite(channel.id) }
                        }
                        if (state.hasNextStream) TvButton("Try next stream") { state = state.skip() }
                        if (canZap) TvButton("Next channel") { go(1) }
                    }
                }
            }
        }
    }
}

/** Starts [s] straight from the broadcaster, with the Referer/User-Agent iptv-org lists for it. */
@OptIn(UnstableApi::class)
private fun ExoPlayer.attach(s: Stream) {
    val http = DefaultHttpDataSource.Factory()
        .setConnectTimeoutMs(10_000)
        .setReadTimeoutMs(15_000)
        .setAllowCrossProtocolRedirects(true)
        .setUserAgent(s.userAgent ?: USER_AGENT)
    s.referrer?.let { http.setDefaultRequestProperties(mapOf("Referer" to it)) }
    // Every stream our checker verifies is HLS (it parses the playlist), whatever its URL looks like.
    setMediaSource(HlsMediaSource.Factory(http).createMediaSource(MediaItem.fromUri(s.url)))
    playWhenReady = true
    prepare()
}

private fun errorText(detail: Channel?, loadFailed: Boolean, error: PlaybackError?): Pair<String, String> = when {
    loadFailed -> "Couldn't reach Tunely" to "Check your internet connection and try again."
    error == PlaybackError.GEO_BLOCKED ->
        "Not available in your region" to "The broadcaster only streams this channel to some countries."
    error == PlaybackError.UNSUPPORTED_CODEC ->
        "Your TV can't play this stream" to "It uses a video format this device can't decode."
    detail?.status == "closed" -> "This channel has closed" to "It no longer broadcasts."
    detail?.status == "no_stream" -> "No stream yet" to "We don't know a working stream for this channel."
    else -> "This channel is offline" to "None of its streams are working right now."
}

/** Opaque, so the last frame of the previous stream never shows under "Loading" or an error. */
@Composable
private fun Panel(channel: ChannelSummary, title: String, body: String?, actions: @Composable () -> Unit = {}) = Column(
    Modifier.fillMaxSize().background(Tokens.Bg).padding(horizontal = SafeX, vertical = SafeY),
    verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
    horizontalAlignment = Alignment.CenterHorizontally,
) {
    ChannelLogo(channel, Modifier.width(192.dp).aspectRatio(16f / 9f).clip(RoundedCornerShape(8.dp)))
    Text(channel.name, style = MaterialTheme.typography.headlineSmall)
    Text(title, style = MaterialTheme.typography.titleLarge, color = if (body == null) Tokens.TextMuted else Tokens.Text)
    if (body != null) Text(body, color = Tokens.TextMuted, textAlign = TextAlign.Center)
    actions()
}

@Composable
private fun Overlay(channel: ChannelSummary, schedule: List<Programme>, actions: @Composable () -> Unit) {
    val context = LocalContext.current
    val timeFormat = remember(context) { DateFormat.getTimeFormat(context) }
    val now by produceState(Instant.now()) {
        while (true) {
            delay(30_000)
            value = Instant.now()
        }
    }
    val (current, next) = nowAndNext(schedule, now)
    Column(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(0.35f to Color.Transparent, 0.75f to Tokens.Bg.copy(alpha = 0.95f)))
            .padding(horizontal = SafeX, vertical = SafeY),
        verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.Bottom),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
            ChannelLogo(channel, Modifier.width(128.dp).aspectRatio(16f / 9f).clip(RoundedCornerShape(8.dp)))
            Text(channel.name, style = MaterialTheme.typography.headlineMedium)
        }
        if (current != null) {
            Text(
                "Now: ${current.title} · ${timeLeft(current.stopAt(), now)}",
                style = MaterialTheme.typography.titleMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            current.description?.let { Text(it, color = Tokens.TextMuted, maxLines = 2, overflow = TextOverflow.Ellipsis) }
        }
        if (next != null) {
            Text(
                "Next: ${timeFormat.format(Date.from(next.startAt()))} ${next.title}",
                color = Tokens.TextMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (current == null && next == null) Text("No programme guide for this channel", color = Tokens.TextMuted)
        Box(Modifier.padding(top = 8.dp)) { actions() }
    }
}
