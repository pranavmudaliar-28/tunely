package app.tunely.tv.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import app.tunely.tv.player.VisitorAge
import app.tunely.tv.player.visitorAgeBucket
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.LocalDate
import java.time.ZoneOffset

/** The API's `ids` filter takes up to 50, so the favorites rail loads in one request. */
const val MAX_FAVORITES = 50

private val Context.store by preferencesDataStore(name = "library")
private val FAVORITES = stringPreferencesKey("favorites")
private val FIRST_DAY = stringPreferencesKey("first_day")

/** What stays on this device: favorite channel ids and the day Tunely was first opened. */
class Library(private val context: Context) {
    val favorites: Flow<List<String>> = context.store.data.map { p ->
        p[FAVORITES].orEmpty().split(',').filter(::isChannelId)
    }

    suspend fun toggleFavorite(id: String) {
        context.store.edit { p ->
            p[FAVORITES] = toggled(p[FAVORITES].orEmpty().split(',').filter(::isChannelId), id).joinToString(",")
        }
    }

    /** How long ago Tunely was first opened here, as the coarse bucket reports carry. The date never leaves the device. */
    suspend fun visitorAge(today: LocalDate = LocalDate.now(ZoneOffset.UTC)): VisitorAge {
        val prefs = context.store.edit { p ->
            if (p[FIRST_DAY]?.let(::parseDay) == null) p[FIRST_DAY] = today.toString()
        }
        return visitorAgeBucket(parseDay(prefs[FIRST_DAY]) ?: today, today)
    }
}

/** Newest favorite first; toggling one already there removes it. */
fun toggled(favorites: List<String>, id: String): List<String> =
    if (id in favorites) favorites - id else (listOf(id) + favorites).take(MAX_FAVORITES)

private fun parseDay(s: String?): LocalDate? = try {
    LocalDate.parse(s)
} catch (_: Exception) {
    null
}
