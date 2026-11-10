package app.tunely.tv.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

// The public API's shapes (packages/shared/src/api.ts), only the fields the TV app uses. Every field has a default so a
// missing or null value doesn't fail a whole response; sanitized() (Safe.kt) then checks what we actually use.

val json = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true
    explicitNulls = false
}

@Serializable
data class ChannelSummary(
    val id: String = "",
    val name: String = "",
    val country: String = "",
    val categories: List<String> = emptyList(),
    val languages: List<String> = emptyList(),
    val logo: String? = null,
    val quality: String? = null,
    /** live · offline · no_stream · closed */
    val status: String = "offline",
) {
    val live: Boolean get() = status == "live"
}

@Serializable
data class Stream(
    val id: String = "",
    val url: String = "",
    val quality: String? = null,
    val score: Int = 0,
    val webPlayable: Boolean = false,
    val nativePlayable: Boolean = false,
    val referrer: String? = null,
    val userAgent: String? = null,
)

@Serializable
data class Programme(
    val title: String = "",
    val description: String? = null,
    /** ISO times */
    val start: String = "",
    val stop: String = "",
)

@Serializable
data class Channel(
    val id: String = "",
    val name: String = "",
    val country: String = "",
    val categories: List<String> = emptyList(),
    val languages: List<String> = emptyList(),
    val logo: String? = null,
    val quality: String? = null,
    val status: String = "offline",
    /** Best first: verified streams, then by health score and resolution. */
    val streams: List<Stream> = emptyList(),
    /** The next few programmes not yet ended. */
    val schedule: List<Programme> = emptyList(),
) {
    fun summary() = ChannelSummary(id, name, country, categories, languages, logo, quality, status)
}

@Serializable
data class ChannelList(val items: List<ChannelSummary> = emptyList(), val nextCursor: String? = null)

@Serializable
data class Facet(val id: String = "", val name: String = "", val count: Int = 0)

@Serializable
data class FacetList(val items: List<Facet> = emptyList())

@Serializable
data class FacetCount(val id: String = "", val count: Int = 0)

/** Channel counts per category and language for a filter (the TV app asks for live ones). */
@Serializable
data class Facets(val categories: List<FacetCount> = emptyList(), val languages: List<FacetCount> = emptyList())
