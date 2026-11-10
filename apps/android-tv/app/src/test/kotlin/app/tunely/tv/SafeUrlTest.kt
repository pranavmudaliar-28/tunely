package app.tunely.tv

import app.tunely.tv.data.safeHeader
import app.tunely.tv.data.safeUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SafeUrlTest {
    @Test
    fun acceptsHttpAndHttps() {
        for (url in listOf(
            "https://feeds.intoday.in/aajtak/api/master.m3u8",
            "http://212.5.144.156:8080/cnn/index.m3u8",
            "HTTPS://Example.com/x=4/i=urn:bbc:pips:service:bbc_news/a.m3u8?token=a%20b",
        )) assertEquals(url, safeUrl(url))
    }

    @Test
    fun rejectsEverythingElse() {
        for (url in listOf(
            null, "", "javascript:alert(1)", "file:///sdcard/x.m3u8", "content://media/1", "rtmp://host/live",
            "data:application/x-mpegurl;base64,AAAA", "https://", "http:example.com", "//example.com/a.m3u8",
            "https://exa mple.com/a.m3u8", "https://example.com/a\n.m3u8", "https://example.com/\u0000",
            "https://example.com/" + "a".repeat(2048),
        )) assertNull(url, safeUrl(url))
    }

    @Test
    fun headersArePrintableAscii() {
        assertEquals("https://usnewson.com", safeHeader("https://usnewson.com"))
        assertNull(safeHeader("a\r\nX-Evil: 1"))
        assertNull(safeHeader(""))
        assertNull(safeHeader("x".repeat(513)))
    }
}
