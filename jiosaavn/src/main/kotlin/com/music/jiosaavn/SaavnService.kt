/**
 * echomusic Project (C) 2026
 * Licensed under GPL-3.0 | See git history for contributors
 *
 * JioSaavn audio streaming service.
 * Uses the Melo API (saavn.echomusic.fun) which is an open wrapper around JioSaavn.
 *
 * API endpoints used:
 *   - GET /api/search/songs?query={q}        → search songs by name+artist
 *   - GET /api/songs/{id}                    → get song details + downloadUrl list
 */

package com.music.jiosaavn

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

// ─── Data models ────────────────────────────────────────────────────────────

@Serializable
data class SaavnDownloadUrl(
    val quality: String = "",
    val url: String = ""
)

@Serializable
data class SaavnImage(
    val quality: String = "",
    val url: String = ""
)

@Serializable
data class SaavnArtistItem(
    val id: String = "",
    val name: String = ""
)

@Serializable
data class SaavnArtists(
    val primary:  List<SaavnArtistItem> = emptyList(),
    val featured: List<SaavnArtistItem> = emptyList(),
    val all:      List<SaavnArtistItem> = emptyList()
)

@Serializable
data class SaavnImagesMap(
    @SerialName("50x50") val fifty: String? = null,
    @SerialName("150x150") val oneFifty: String? = null,
    @SerialName("500x500") val fiveHundred: String? = null
)

@Serializable
data class SaavnMoreInfo(
    val singers: String? = null,
    val language: String? = null
)

@Serializable
data class SaavnSong(
    @SerialName("id")              val id:              String                 = "",
    @SerialName("title")           val title:           String?                = null,
    @SerialName("song")            val song:            String?                = null,
    @SerialName("duration")        val durationStr:     String?                = null,
    @SerialName("images")          val images:          SaavnImagesMap?        = null,
    @SerialName("media_url")       val mediaUrl:        String?                = null,
    @SerialName("media_urls")      val mediaUrls:       Map<String, String>?   = null,
    @SerialName("more_info")       val moreInfo:        SaavnMoreInfo?         = null,
    @SerialName("primary_artists") val primaryArtistsStr: String?              = null,
    @SerialName("singers")         val singersStr:      String?                = null
) {
    val name: String
        get() = song ?: title ?: ""

    val duration: Int?
        get() {
            val dur = durationStr ?: return null
            val parts = dur.split(":")
            if (parts.size == 2) {
                val min = parts[0].toIntOrNull() ?: return null
                val sec = parts[1].toIntOrNull() ?: return null
                return min * 60 + sec
            }
            return dur.toIntOrNull()
        }

    val explicitContent: Boolean
        get() = false

    val artists: SaavnArtists
        get() {
            val s = singersStr ?: primaryArtistsStr ?: moreInfo?.singers ?: ""
            val items = if (s.isBlank()) emptyList() else s.split(",").map { 
                SaavnArtistItem(id = "", name = it.trim()) 
            }
            return SaavnArtists(primary = items, featured = emptyList(), all = items)
        }

    val image: List<SaavnImage>
        get() {
            val map = images ?: return emptyList()
            return listOfNotNull(
                map.fifty?.let { SaavnImage("50x50", it) },
                map.oneFifty?.let { SaavnImage("150x150", it) },
                map.fiveHundred?.let { SaavnImage("500x500", it) }
            )
        }

    val downloadUrl: List<SaavnDownloadUrl>
        get() {
            val urls = mediaUrls ?: return emptyList()
            return urls.map { (q, url) ->
                SaavnDownloadUrl(quality = q.lowercase().replace("_", ""), url = url)
            }
        }
}

// ─── Search response ─────────────────────────────────────────────────────────

@Serializable
data class SaavnSearchResponse(
    val status: Boolean = false,
    val results: List<SaavnSong> = emptyList()
)

// ─── Service ─────────────────────────────────────────────────────────────────

object SaavnService {

    private val json = Json {
        isLenient         = true
        ignoreUnknownKeys = true
        explicitNulls     = false
    }

    private val client by lazy {
        HttpClient(CIO) {
            install(ContentNegotiation) { json(json) }
            install(HttpTimeout) {
                // Keep timeouts short so that a slow/unavailable Saavn response
                // falls back to YouTube quickly without the user noticing a stall.
                requestTimeoutMillis = 4_000
                connectTimeoutMillis = 3_000
                socketTimeoutMillis  = 4_000
            }
            defaultRequest {
                headers.append(HttpHeaders.Accept, "application/json")
                headers.append(HttpHeaders.UserAgent, "EchoMusic/1.0")
            }
            expectSuccess = false
        }
    }

    private suspend fun getWithFallback(
        endpoint: String,
        block: io.ktor.client.request.HttpRequestBuilder.() -> Unit = {}
    ): io.ktor.client.statement.HttpResponse {
        var attempt = 0
        var lastException: Exception? = null
        
        while (attempt < 3) {
            try {
                val url = "${DeviceRouter.getCurrentServer()}/$endpoint"
                val response = client.get(url, block)
                if (response.status.value in 500..599) {
                    DeviceRouter.fallbackToNextServer()
                    attempt++
                    continue
                }
                return response
            } catch (e: Exception) {
                lastException = e
                DeviceRouter.fallbackToNextServer()
                attempt++
            }
        }
        throw lastException ?: IllegalStateException("All Saavn servers failed")
    }

    /**
     * Search for songs on JioSaavn by a free-form query (title + artist recommended).
     *
     * @return Result wrapping a list of matched [SaavnSong]s, or failure if the
     *         request fails or returns no results.
     */
    suspend fun searchSongs(query: String): Result<List<SaavnSong>> = runCatching {
        val response = getWithFallback("search") {
            parameter("query", query)
            parameter("limit", 5)   // fetch top-5 candidates; we only use #1
        }

        if (response.status != HttpStatusCode.OK) {
            throw IllegalStateException("Saavn search failed: HTTP ${response.status.value}")
        }

        val body = response.body<SaavnSearchResponse>()
        val results = body.results

        if (!body.status || results.isEmpty()) {
            throw NoSuchElementException("No songs found on JioSaavn for: \"$query\"")
        }

        results
    }

    /**
     * Fetch the [SaavnSong] detail for a known Saavn song ID and extract the
     * best stream URL matching [quality].
     *
     * The JioSaavn quality string is expected to be "320kbps", "160kbps", or "96kbps".
     * If the exact quality is unavailable, the highest available quality is returned
     * as a fallback. Returns null only if no downloadUrl entries exist at all.
     */
    suspend fun getBestStreamUrl(saavnSongId: String, quality: String): String? =
        runCatching {
            val response = getWithFallback("song") {
                parameter("id", saavnSongId)
            }

            if (response.status != HttpStatusCode.OK) return@runCatching null

            val song = response.body<SaavnSong>()
            if (song.id.isBlank()) return@runCatching null

            val urls = song.downloadUrl.filter { it.url.isNotBlank() }

            if (urls.isEmpty()) return@runCatching null

            // 1. Try the exact requested quality
            urls.firstOrNull { it.quality.equals(quality, ignoreCase = true) }?.url
                // 2. Fall back to 320kbps if available
                ?: urls.firstOrNull { it.quality.equals("320kbps", ignoreCase = true) }?.url
                // 3. Fall back to highest bitrate (last entry tends to be highest)
                ?: urls.lastOrNull()?.url
        }.getOrNull()
}
