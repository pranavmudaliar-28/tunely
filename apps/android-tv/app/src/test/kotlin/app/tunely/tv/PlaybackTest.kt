package app.tunely.tv

import androidx.media3.common.PlaybackException
import app.tunely.tv.data.ChannelSummary
import app.tunely.tv.player.PlaybackError
import app.tunely.tv.player.PlayerState
import app.tunely.tv.player.Status
import app.tunely.tv.player.classify
import app.tunely.tv.player.neighbour
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaybackTest {
    private fun ch(id: String, status: String = "live") = ChannelSummary(id = id, name = id, status = status)
    private val lineup = listOf(ch("a"), ch("b"), ch("dead", "offline"), ch("c"))

    @Test
    fun upAndDownWrapAround() {
        assertEquals("b", neighbour(lineup, "a", 1)?.id)
        assertEquals("a", neighbour(lineup, "c", 1)?.id)
        assertEquals("c", neighbour(lineup, "a", -1)?.id)
        assertEquals("b", neighbour(lineup, "c", -1)?.id)
    }

    @Test
    fun skipsChannelsThatArentLive() {
        assertEquals("c", neighbour(lineup, "b", 1)?.id)
        assertEquals("c", neighbour(lineup, "dead", 1)?.id)
    }

    @Test
    fun nothingToZapTo() {
        assertNull(neighbour(listOf(ch("a")), "a", 1))
        assertNull(neighbour(listOf(ch("a"), ch("x", "closed")), "a", -1))
        assertNull(neighbour(lineup, "missing", 1))
        assertNull(neighbour(emptyList(), "a", 1))
    }

    @Test
    fun streamsFallThroughInOrderAndTheMostSpecificErrorWins() {
        var s = PlayerState.start(3, attempt = 1)
        assertEquals(Status.LOADING, s.status)
        s = s.failed(PlaybackError.TIMEOUT)
        assertEquals(1 to 2, s.streamIndex to s.attempt)
        assertEquals(Status.LOADING, s.status)
        s = s.failed(PlaybackError.GEO_BLOCKED)
        assertEquals(2 to 3, s.streamIndex to s.attempt)
        assertFalse(s.hasNextStream)
        s = s.failed(PlaybackError.OFFLINE)
        assertEquals(Status.ERROR, s.status)
        assertEquals(PlaybackError.GEO_BLOCKED, s.error)
        assertSame(s, s.failed(PlaybackError.UNKNOWN))
        assertSame(s, s.playing())
    }

    @Test
    fun playingClearsTheErrorAndALaterFailureMovesOn() {
        var s = PlayerState.start(2, attempt = 0).failed(PlaybackError.MEDIA).playing()
        assertEquals(Status.PLAYING, s.status)
        assertNull(s.error)
        s = PlayerState.start(2, attempt = 0).playing().failed(PlaybackError.OFFLINE)
        assertEquals(Status.LOADING, s.status)
        assertEquals(1, s.streamIndex)
    }

    @Test
    fun noStreamsIsOfflineAndSkipStopsAtTheLast() {
        val none = PlayerState.start(0, attempt = 0)
        assertEquals(Status.ERROR, none.status)
        assertEquals(PlaybackError.OFFLINE, none.error)
        val s = PlayerState.start(2, attempt = 0).skip()
        assertEquals(1 to 1, s.streamIndex to s.attempt)
        assertSame(s, s.skip())
        assertTrue(PlayerState.start(2, attempt = 0).hasNextStream)
    }

    @Test
    fun classifiesMedia3Errors() {
        val io = PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS
        assertEquals(PlaybackError.GEO_BLOCKED, classify(io, 403))
        assertEquals(PlaybackError.GEO_BLOCKED, classify(io, 451))
        assertEquals(PlaybackError.OFFLINE, classify(io, 404))
        assertEquals(PlaybackError.OFFLINE, classify(PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED, null))
        assertEquals(PlaybackError.TIMEOUT, classify(PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT, null))
        assertEquals(
            PlaybackError.UNSUPPORTED_CODEC,
            classify(PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED, null),
        )
        assertEquals(PlaybackError.UNSUPPORTED_CODEC, classify(PlaybackException.ERROR_CODE_DECODER_INIT_FAILED, null))
        assertEquals(PlaybackError.MEDIA, classify(PlaybackException.ERROR_CODE_PARSING_MANIFEST_MALFORMED, null))
        assertEquals(PlaybackError.MEDIA, classify(PlaybackException.ERROR_CODE_DECODING_FAILED, null))
        assertEquals(PlaybackError.UNKNOWN, classify(PlaybackException.ERROR_CODE_UNSPECIFIED, null))
    }
}
