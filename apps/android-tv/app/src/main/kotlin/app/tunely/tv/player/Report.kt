package app.tunely.tv.player

import app.tunely.tv.data.isUuid
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID

/** The value PlaybackReportSchema allows for this app. */
const val PLATFORM = "androidtv"
private const val MAX_TTFF_MS = 120_000L

/** Random per app launch (the web keeps one per tab) and never stored. The API hashes it with a daily salt. */
val SESSION_ID: String = UUID.randomUUID().toString()

@Serializable
enum class VisitorAge {
    @SerialName("first_day") FIRST_DAY,
    @SerialName("week") WEEK,
    @SerialName("month") MONTH,
    @SerialName("older") OLDER,
}

/** Days since first use, bucketed like the web: same day, within a week, within a month, older. */
fun visitorAgeBucket(firstDay: LocalDate, today: LocalDate): VisitorAge {
    val days = ChronoUnit.DAYS.between(firstDay, today)
    return when {
        days < 1 -> VisitorAge.FIRST_DAY // also a future date
        days <= 7 -> VisitorAge.WEEK
        days <= 30 -> VisitorAge.MONTH
        else -> VisitorAge.OLDER
    }
}

/** POST /v1/playback-reports. Null fields are left out of the JSON (visitorAge may be absent but not null). */
@Serializable
data class PlaybackReport(
    val streamId: String,
    val platform: String,
    val result: String,
    val errorType: PlaybackError? = null,
    val ttffMs: Long? = null,
    val sessionId: String,
    val visitorAge: VisitorAge? = null,
)

/** The report for one attempt at [streamId]: ok when [error] is null. Null if the API wouldn't accept the id (a UUID). */
fun playbackReport(
    streamId: String,
    error: PlaybackError?,
    elapsedMs: Long,
    visitorAge: VisitorAge?,
    sessionId: String = SESSION_ID,
): PlaybackReport? = if (!isUuid(streamId)) null else PlaybackReport(
    streamId = streamId,
    platform = PLATFORM,
    result = if (error == null) "ok" else "error",
    errorType = error,
    ttffMs = if (error == null) elapsedMs.coerceIn(0, MAX_TTFF_MS) else null,
    sessionId = sessionId,
    visitorAge = visitorAge,
)
