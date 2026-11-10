package app.tunely.tv.player

import androidx.media3.common.PlaybackException
import androidx.media3.datasource.HttpDataSource
import app.tunely.tv.data.Channel
import app.tunely.tv.data.ChannelSummary
import app.tunely.tv.data.Stream
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Player rules shared with the web (apps/web/lib/player): stream fallback, error types, channel up/down.

/** The schema's error types, declared most specific first: when every stream fails, the most specific one is shown. */
@Serializable
enum class PlaybackError {
    @SerialName("geo_blocked") GEO_BLOCKED,
    @SerialName("browser_blocked") BROWSER_BLOCKED,
    @SerialName("unsupported_codec") UNSUPPORTED_CODEC,
    @SerialName("offline") OFFLINE,
    @SerialName("timeout") TIMEOUT,
    @SerialName("media") MEDIA,
    @SerialName("unknown") UNKNOWN,
}

/**
 * The streams the TV tries, in the API's order (best first). Our checker loaded them recently (nativePlayable) and they
 * score >= 50. Unlike a browser, the TV needs no CORS or HTTPS, so http streams and ones needing headers count too.
 */
fun playableStreams(channel: Channel): List<Stream> = channel.streams.filter { it.nativePlayable && it.score >= 50 }

enum class Status { LOADING, PLAYING, ERROR }

/** One channel's attempt state. A failing stream falls through to the next; the error shows once all have failed. */
data class PlayerState(
    val status: Status,
    val streamIndex: Int = 0,
    val streamCount: Int = 0,
    val error: PlaybackError? = null,
    /** Bumped on every (re)load so the player re-attaches even when the stream is the same. */
    val attempt: Int = 0,
) {
    val hasNextStream get() = status != Status.ERROR && streamIndex + 1 < streamCount

    fun playing() = if (status == Status.ERROR) this else copy(status = Status.PLAYING, error = null)

    fun failed(e: PlaybackError): PlayerState {
        if (status == Status.ERROR) return this
        val worst = if (error != null && error < e) error else e
        return if (hasNextStream) copy(status = Status.LOADING, streamIndex = streamIndex + 1, error = worst, attempt = attempt + 1)
        else copy(status = Status.ERROR, error = worst)
    }

    /** The viewer asked for another stream (frozen picture, wrong audio…). */
    fun skip() = if (hasNextStream) copy(status = Status.LOADING, streamIndex = streamIndex + 1, attempt = attempt + 1) else this

    companion object {
        fun start(streamCount: Int, attempt: Int) = PlayerState(
            status = if (streamCount > 0) Status.LOADING else Status.ERROR,
            streamCount = streamCount,
            error = if (streamCount > 0) null else PlaybackError.OFFLINE,
            attempt = attempt,
        )
    }
}

/** The next live channel from [currentId] going [step] (+1 down, -1 up) through [lineup], wrapping around; null if none. */
fun neighbour(lineup: List<ChannelSummary>, currentId: String, step: Int): ChannelSummary? {
    val i = lineup.indexOfFirst { it.id == currentId }
    if (i == -1) return null
    for (k in 1 until lineup.size) {
        val c = lineup[Math.floorMod(i + step * k, lineup.size)]
        if (c.live) return c
    }
    return null
}

private val UNSUPPORTED = setOf(
    PlaybackException.ERROR_CODE_DECODER_INIT_FAILED,
    PlaybackException.ERROR_CODE_DECODER_QUERY_FAILED,
    PlaybackException.ERROR_CODE_DECODING_FORMAT_EXCEEDS_CAPABILITIES,
    PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED,
)

/** What a Media3 error tells the viewer, from its error code and the HTTP status behind it, if any. */
fun classify(errorCode: Int, httpStatus: Int?): PlaybackError = when {
    httpStatus == 403 || httpStatus == 451 -> PlaybackError.GEO_BLOCKED
    httpStatus != null -> PlaybackError.OFFLINE
    errorCode in UNSUPPORTED -> PlaybackError.UNSUPPORTED_CODEC
    errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT ||
        errorCode == PlaybackException.ERROR_CODE_TIMEOUT -> PlaybackError.TIMEOUT
    errorCode == PlaybackException.ERROR_CODE_IO_CLEARTEXT_NOT_PERMITTED -> PlaybackError.BROWSER_BLOCKED
    errorCode in 2000..2999 -> PlaybackError.OFFLINE // IO
    errorCode in 3000..5999 -> PlaybackError.MEDIA // parsing, decoding, audio output
    else -> PlaybackError.UNKNOWN
}

fun PlaybackException.toPlaybackError(): PlaybackError = classify(
    errorCode,
    generateSequence(cause) { it.cause }.filterIsInstance<HttpDataSource.InvalidResponseCodeException>().firstOrNull()?.responseCode,
)
