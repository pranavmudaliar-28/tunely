package app.tunely.tv

import app.tunely.tv.data.Facets
import app.tunely.tv.data.json
import app.tunely.tv.data.parseChannel
import app.tunely.tv.data.parseChannelList
import app.tunely.tv.data.parseFacetList
import app.tunely.tv.player.playableStreams
import app.tunely.tv.ui.liveOptions
import app.tunely.tv.ui.railCategories
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Fixtures are real responses from the production API (7 Nov 2026). */
class ApiParsingTest {
    private fun fixture(name: String) = javaClass.getResource("/fixtures/$name")!!.readText()

    @Test
    fun trending() {
        val items = parseChannelList(fixture("trending.json")).items
        assertEquals(24, items.size)
        assertEquals("ABC.us", items[0].id)
        assertTrue(items.all { it.live && it.logo!!.startsWith("http") })
    }

    @Test
    fun channelListWithCursor() {
        val list = parseChannelList(fixture("channels-live-best.json"))
        assertEquals(5, list.items.size)
        assertEquals("BloombergTV.us", list.items[0].id)
        assertEquals("2160p", list.items[0].quality)
        assertEquals("eyJvIjo1fQ", list.nextCursor)
        assertEquals(emptyList<String>(), list.items[3].categories)
    }

    @Test
    fun channelDetailWithSchedule() {
        val c = parseChannel(fixture("channel-48hours.json"))!!
        assertEquals("48 Hours", c.name)
        assertEquals(6, c.streams.size)
        assertEquals(4, c.schedule.size)
        assertEquals("2026-11-07T10:01:00.000Z", c.schedule[0].start)
        // Only the stream our checker verified is tried.
        assertEquals(listOf("f48e2c43-1b53-45f2-9e0a-109707c719a2"), playableStreams(c).map { it.id })
    }

    @Test
    fun streamsNeedingHeadersOrHttpPlayOnTv() {
        val aajTak = parseChannel(fixture("channel-aajtak.json"))!!
        val playable = playableStreams(aajTak)
        // Five browser-verified streams, then one that needs a user agent; the dead http one (score 0) is left out.
        assertEquals(6, playable.size)
        assertTrue(playable.last().userAgent!!.startsWith("Mozilla/5.0"))
        assertTrue(playable.none { it.url.startsWith("http://103.213.31.109") })

        val cnn = playableStreams(parseChannel(fixture("channel-cnn.json"))!!)
        assertEquals(
            listOf(
                "https://tvsen6.aynaott.com/cnn/index.m3u8",
                "http://212.5.144.156:8080/cnn/index.m3u8",
                "https://p13.usnlive.com/stream/cnn.m3u8",
            ),
            cnn.map { it.url },
        )
        assertEquals("https://usnewson.com", cnn[2].referrer)
    }

    @Test
    fun categoriesAndHomeRails() {
        val categories = parseFacetList(fixture("categories.json"))
        assertEquals("general", categories[0].id)
        assertEquals("General", categories[0].name)
        val live = json.decodeFromString<Facets>(fixture("facets-live.json"))
        val rails = railCategories(categories, live).map { it.id }
        assertEquals(listOf("entertainment", "movies", "sports", "kids", "music", "news"), rails.take(6))
        assertEquals("shop", rails.last())
        assertTrue("interactive" !in rails) // 1 live channel: below the rail minimum
        val options = liveOptions(categories, live.categories)
        assertEquals("general", options[0].id)
        assertEquals(1289, options[0].count)
    }

    @Test
    fun toleratesNullsUnknownFieldsAndBadValues() {
        val c = parseChannel(
            """{"id":"X.us","name":null,"status":"weird","logo":"javascript:alert(1)","categories":null,"new":{"a":1},
               "streams":[
                 {"id":"a","url":"file:///etc/passwd","score":100,"nativePlayable":true},
                 {"id":"b","url":"rtmp://example.com/live","score":100,"nativePlayable":true},
                 {"id":"c","url":"https://ok.example/a.m3u8","score":100,"nativePlayable":true,"referrer":"https://x\r\nInjected: 1"},
                 {"id":"d","url":"https://ok.example/b.m3u8","score":250,"nativePlayable":true,"quality":null}
               ],
               "schedule":[{"title":"Bad time","start":"tomorrow","stop":"later"},{"title":"  ","start":"2026-11-07T10:00:00Z","stop":"2026-11-07T11:00:00Z"}]}""",
        )!!
        assertEquals("X.us", c.name)
        assertEquals("offline", c.status)
        assertNull(c.logo)
        assertEquals(emptyList<String>(), c.categories)
        assertEquals(listOf("d"), c.streams.map { it.id })
        assertEquals(100, c.streams[0].score)
        assertEquals(emptyList<Any>(), c.schedule)
    }

    @Test
    fun dropsChannelsWithUnsafeIds() {
        val list = parseChannelList("""{"items":[{"id":"../../etc"},{"id":"Good.us","name":"Good"},{"id":""}],"nextCursor":null}""")
        assertEquals(listOf("Good.us"), list.items.map { it.id })
        assertNull(parseChannel("""{"id":"a/b"}"""))
    }
}
