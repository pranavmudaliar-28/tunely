package app.tunely.tv.data

import app.tunely.tv.BuildConfig
import app.tunely.tv.player.PlaybackReport
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * Sent on API, logo and stream requests (unless iptv-org names one for a stream). Wikimedia, which hosts many logos,
 * refuses generic library agents, and Android's default one would tell every broadcaster the device model.
 */
val USER_AGENT = "TunelyTV/${BuildConfig.VERSION_NAME} (Android TV; +https://tunely-tv.vercel.app)"
private const val MAX_BODY_BYTES = 4L * 1024 * 1024
/** The API caches lists for 5 min too; keeping them here makes Back and re-scrolled rails instant. */
private const val CACHE_MS = 5 * 60_000L

/** Read-only client for the public API (plus playback reports). Responses are parsed and sanitized before use. */
class TunelyApi(baseUrl: String = BuildConfig.API_URL) {
    private val base: HttpUrl = baseUrl.toHttpUrl()

    init {
        require(BuildConfig.DEBUG || base.isHttps) { "Release builds call the API over HTTPS only" }
    }

    /** Shared with the image loader for logos. */
    val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        // The API runs on Render's free plan: after idling, the first requests wait up to a minute for it to wake.
        .readTimeout(60, TimeUnit.SECONDS)
        .addInterceptor { chain -> chain.proceed(chain.request().newBuilder().header("User-Agent", USER_AGENT).build()) }
        .build()
    private val memo = ConcurrentHashMap<String, Pair<Long, String>>()

    suspend fun channels(
        category: String? = null,
        language: String? = null,
        q: String? = null,
        ids: List<String>? = null,
        status: String? = null,
        sort: String? = null,
        cursor: String? = null,
        limit: Int = 24,
    ): ChannelList = parseChannelList(
        get(
            "v1/channels",
            "category" to category, "language" to language, "q" to q, "ids" to ids?.joinToString(","),
            "status" to status, "sort" to sort, "cursor" to cursor, "limit" to "$limit",
        ),
    )

    suspend fun channel(id: String): Channel {
        require(isChannelId(id))
        return parseChannel(get("v1/channels/$id")) ?: throw IOException("Invalid channel")
    }

    suspend fun trending(): List<ChannelSummary> = parseChannelList(get("v1/trending")).items
    suspend fun categories(): List<Facet> = parseFacetList(get("v1/categories"))
    suspend fun languages(): List<Facet> = parseFacetList(get("v1/languages"))
    suspend fun liveFacets(): Facets = json.decodeFromString(get("v1/facets", "status" to "live"))

    /** Fire and forget: a report that doesn't arrive only costs one data point. */
    fun report(report: PlaybackReport) {
        val body = json.encodeToString(report).toRequestBody("application/json".toMediaType())
        val url = base.newBuilder().addPathSegments("v1/playback-reports").build()
        client.newCall(Request.Builder().url(url).post(body).build()).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {}
            override fun onResponse(call: Call, response: Response) = response.close()
        })
    }

    private suspend fun get(path: String, vararg params: Pair<String, String?>): String = withContext(Dispatchers.IO) {
        val url = base.newBuilder().addPathSegments(path).apply {
            for ((k, v) in params) if (!v.isNullOrEmpty()) addQueryParameter(k, v)
        }.build().toString()
        val now = System.currentTimeMillis()
        memo[url]?.let { (at, body) -> if (now - at < CACHE_MS) return@withContext body }
        val body = client.newCall(Request.Builder().url(url).build()).execute().use { res ->
            if (!res.isSuccessful) throw IOException("API ${res.code}")
            val source = res.body.source()
            if (source.request(MAX_BODY_BYTES + 1)) throw IOException("API response too large")
            source.readUtf8()
        }
        if (memo.size > 200) memo.clear() // search adds a key per query
        memo[url] = now to body
        body
    }
}

fun parseChannelList(body: String): ChannelList = json.decodeFromString<ChannelList>(body).let {
    ChannelList(it.items.mapNotNull(ChannelSummary::sanitized), it.nextCursor?.takeIf { c -> c.length <= 200 })
}

fun parseChannel(body: String): Channel? = json.decodeFromString<Channel>(body).sanitized()

fun parseFacetList(body: String): List<Facet> = json.decodeFromString<FacetList>(body).items.mapNotNull { f ->
    clean(f.id, 40)?.let { Facet(it, clean(f.name, 60) ?: it, f.count) }
}
