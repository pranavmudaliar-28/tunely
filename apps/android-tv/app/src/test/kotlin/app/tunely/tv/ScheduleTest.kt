package app.tunely.tv

import app.tunely.tv.data.Programme
import app.tunely.tv.data.nowAndNext
import app.tunely.tv.data.timeLeft
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test
import java.time.Instant

class ScheduleTest {
    private val schedule = listOf(
        Programme("Morning", null, "2026-11-07T10:00:00.000Z", "2026-11-07T11:00:00.000Z"),
        Programme("Noon", null, "2026-11-07T11:00:00.000Z", "2026-11-07T12:20:00.000Z"),
        // A gap from 12:20 to 13:00.
        Programme("Afternoon", null, "2026-11-07T13:00:00+00:00", "2026-11-07T15:00:00+00:00"),
    )
    private fun at(iso: String) = Instant.parse(iso)

    @Test
    fun onNowAndNext() {
        val (current, next) = nowAndNext(schedule, at("2026-11-07T10:29:00Z"))
        assertSame(schedule[0], current)
        assertSame(schedule[1], next)
    }

    @Test
    fun boundaryBelongsToTheNextProgramme() {
        val (current, next) = nowAndNext(schedule, at("2026-11-07T11:00:00Z"))
        assertSame(schedule[1], current)
        assertSame(schedule[2], next)
    }

    @Test
    fun beforeTheGuideInAGapAndAfterIt() {
        assertEquals(null to schedule[0], nowAndNext(schedule, at("2026-11-07T09:00:00Z")))
        assertEquals(null to schedule[2], nowAndNext(schedule, at("2026-11-07T12:30:00Z")))
        assertEquals(null to null, nowAndNext(schedule, at("2026-11-07T16:00:00Z")))
        val (current, next) = nowAndNext(emptyList(), at("2026-11-07T16:00:00Z"))
        assertNull(current)
        assertNull(next)
    }

    @Test
    fun timeLeftReadsLikeTheWeb() {
        val now = at("2026-11-07T10:00:00Z")
        assertEquals("31 min left", timeLeft(at("2026-11-07T10:31:00Z"), now))
        assertEquals("1 h 20 min left", timeLeft(at("2026-11-07T11:20:00Z"), now))
        assertEquals("2 h left", timeLeft(at("2026-11-07T12:00:00Z"), now))
        assertEquals("1 min left", timeLeft(at("2026-11-07T10:00:10Z"), now))
        assertEquals("1 min left", timeLeft(at("2026-11-07T09:59:00Z"), now)) // clock slightly ahead of the guide
    }
}
