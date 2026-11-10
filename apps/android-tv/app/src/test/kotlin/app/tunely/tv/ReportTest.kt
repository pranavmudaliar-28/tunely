package app.tunely.tv

import app.tunely.tv.data.MAX_FAVORITES
import app.tunely.tv.data.json
import app.tunely.tv.data.toggled
import app.tunely.tv.player.PlaybackError
import app.tunely.tv.player.PlaybackReport
import app.tunely.tv.player.SESSION_ID
import app.tunely.tv.player.VisitorAge
import app.tunely.tv.player.playbackReport
import app.tunely.tv.player.visitorAgeBucket
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class ReportTest {
    private val streamId = "f48e2c43-1b53-45f2-9e0a-109707c719a2"
    private fun encode(r: PlaybackReport?): JsonObject = json.parseToJsonElement(json.encodeToString(r!!)).jsonObject

    @Test
    fun okReportMatchesTheSchema() {
        val body = encode(playbackReport(streamId, null, 1234, VisitorAge.WEEK, sessionId = "session-1234"))
        assertEquals(
            mapOf(
                "streamId" to JsonPrimitive(streamId),
                "platform" to JsonPrimitive("androidtv"),
                "result" to JsonPrimitive("ok"),
                "ttffMs" to JsonPrimitive(1234),
                "sessionId" to JsonPrimitive("session-1234"),
                "visitorAge" to JsonPrimitive("week"),
            ),
            body,
        )
    }

    @Test
    fun errorReportHasATypeAndNoTtff() {
        val body = encode(playbackReport(streamId, PlaybackError.GEO_BLOCKED, 900, null))
        assertEquals(JsonPrimitive("error"), body["result"])
        assertEquals(JsonPrimitive("geo_blocked"), body["errorType"])
        assertTrue("ttffMs" !in body)
        assertTrue("visitorAge" !in body) // optional but not nullable in the schema: left out, never null
        assertEquals(JsonPrimitive(SESSION_ID), body["sessionId"])
        assertTrue(SESSION_ID.length in 8..64)
    }

    @Test
    fun ttffIsClampedAndBadIdsAreNotSent() {
        assertEquals(120_000L, playbackReport(streamId, null, 500_000, null)!!.ttffMs)
        assertEquals(0L, playbackReport(streamId, null, -5, null)!!.ttffMs)
        assertNull(playbackReport("not-a-uuid", null, 100, null))
    }

    @Test
    fun visitorAgeBuckets() {
        val first = LocalDate.parse("2026-11-01")
        assertEquals(VisitorAge.FIRST_DAY, visitorAgeBucket(first, first))
        assertEquals(VisitorAge.FIRST_DAY, visitorAgeBucket(first, first.minusDays(3)))
        assertEquals(VisitorAge.WEEK, visitorAgeBucket(first, first.plusDays(1)))
        assertEquals(VisitorAge.WEEK, visitorAgeBucket(first, first.plusDays(7)))
        assertEquals(VisitorAge.MONTH, visitorAgeBucket(first, first.plusDays(8)))
        assertEquals(VisitorAge.MONTH, visitorAgeBucket(first, first.plusDays(30)))
        assertEquals(VisitorAge.OLDER, visitorAgeBucket(first, first.plusDays(31)))
    }

    @Test
    fun favoritesToggleNewestFirstAndAreCapped() {
        assertEquals(listOf("b", "a"), toggled(listOf("a"), "b"))
        assertEquals(listOf("a"), toggled(listOf("b", "a"), "b"))
        val full = (1..MAX_FAVORITES).map { "c$it" }
        val added = toggled(full, "new")
        assertEquals(MAX_FAVORITES, added.size)
        assertEquals("new", added.first())
    }
}
