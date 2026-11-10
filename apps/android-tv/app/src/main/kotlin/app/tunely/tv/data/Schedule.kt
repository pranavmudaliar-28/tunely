package app.tunely.tv.data

import java.time.Duration
import java.time.Instant
import java.time.OffsetDateTime

// Now & Next from the channel's schedule, worked out on the device clock (the web's lib/schedule.ts).

fun Programme.startAt(): Instant = OffsetDateTime.parse(start).toInstant()
fun Programme.stopAt(): Instant = OffsetDateTime.parse(stop).toInstant()

/** The programme on at [now] and the one after it (either may be missing). */
fun nowAndNext(schedule: List<Programme>, now: Instant): Pair<Programme?, Programme?> {
    val current = schedule.firstOrNull { it.startAt() <= now && it.stopAt() > now }
    val next = schedule.firstOrNull { it !== current && it.startAt() > now }
    return current to next
}

/** "23 min left", "1 h 20 min left", "2 h left". */
fun timeLeft(stop: Instant, now: Instant): String {
    val m = maxOf(1L, Math.round(Duration.between(now, stop).toMillis() / 60_000.0))
    return when {
        m < 60 -> "$m min left"
        m % 60 != 0L -> "${m / 60} h ${m % 60} min left"
        else -> "${m / 60} h left"
    }
}
