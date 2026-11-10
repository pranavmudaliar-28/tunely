package app.tunely.tv.data

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import java.time.OffsetDateTime
import kotlin.coroutines.cancellation.CancellationException

// Everything from the API comes from iptv-org in the end, so it is untrusted: bounded, and URLs limited to http(s).

private val CHANNEL_ID = Regex("""[\w.@-]{1,200}""")
private val UUID = Regex("""[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}""")
private val STATUSES = setOf("live", "offline", "no_stream", "closed")
private const val MAX_URL = 2048

fun isChannelId(s: String) = CHANNEL_ID.matches(s)

fun isUuid(s: String) = UUID.matches(s)

/** [s] if it is an http(s) URL with a host and no spaces or control characters, else null. Nothing else is played or loaded. */
fun safeUrl(s: String?): String? = s?.takeIf {
    it.length <= MAX_URL &&
        (it.startsWith("https://", ignoreCase = true) || it.startsWith("http://", ignoreCase = true)) &&
        it.none { c -> c <= ' ' || c == '\u007f' } &&
        it.toHttpUrlOrNull() != null
}

/** Trimmed, without control characters, at most [max] characters; null when nothing is left. */
fun clean(s: String?, max: Int): String? = s?.filterNot(Char::isISOControl)?.trim()?.take(max)?.ifEmpty { null }

/** A value we can send as an HTTP header: printable ASCII and bounded, so no CR/LF injection. */
fun safeHeader(s: String?): String? = s?.takeIf { it.length in 1..512 && it.all { c -> c in ' '..'~' } }

fun parsesAsTime(s: String) = try {
    OffsetDateTime.parse(s)
    true
} catch (_: Exception) {
    false
}

fun ChannelSummary.sanitized(): ChannelSummary? =
    if (!isChannelId(id)) null
    else copy(
        name = clean(name, 120) ?: id,
        country = clean(country, 3).orEmpty(),
        categories = categories.take(20).mapNotNull { clean(it, 40) },
        languages = languages.take(20).mapNotNull { clean(it, 8) },
        logo = safeUrl(logo),
        quality = clean(quality, 16),
        status = status.takeIf { it in STATUSES } ?: "offline",
    )

fun Channel.sanitized(): Channel? {
    val s = summary().sanitized() ?: return null
    return Channel(
        s.id, s.name, s.country, s.categories, s.languages, s.logo, s.quality, s.status,
        streams = streams.take(50).mapNotNull { st ->
            // A stream whose headers we can't send as given would fail for the wrong reason: leave it out.
            val headersOk = (st.referrer == null || safeHeader(st.referrer) != null) &&
                (st.userAgent == null || safeHeader(st.userAgent) != null)
            if (safeUrl(st.url) == null || !headersOk) null
            else st.copy(id = clean(st.id, 64).orEmpty(), quality = clean(st.quality, 16), score = st.score.coerceIn(0, 100))
        },
        schedule = schedule.take(20).mapNotNull { p ->
            val title = clean(p.title, 200)
            if (title == null || !parsesAsTime(p.start) || !parsesAsTime(p.stop)) null
            else p.copy(title = title, description = clean(p.description, 500))
        },
    )
}

/** [block]'s result, or null if it failed. Cancellation still propagates (a cancelled load must not report a failure). */
suspend fun <T> orNull(block: suspend () -> T): T? = try {
    block()
} catch (e: CancellationException) {
    throw e
} catch (_: Exception) {
    null
}
