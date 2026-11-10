plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

// The API base URL is baked in at build time (gradle.properties, or -Ptunely.apiUrl=...).
val apiUrl = providers.gradleProperty("tunely.apiUrl").get().trimEnd('/')
require(Regex("""https?://[\w.:\-\[\]]+""").matches(apiUrl)) { "tunely.apiUrl must be a bare http(s) origin, got $apiUrl" }

android {
    namespace = "app.tunely.tv"
    // 37: the current Compose, Coil and OkHttp releases require it. targetSdk stays at 36 (behaviour we know).
    compileSdk = 37

    defaultConfig {
        applicationId = "app.tunely.tv"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "API_URL", "\"$apiUrl\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2026.09.00"))
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.tv:tv-material:1.1.0")
    implementation("androidx.media3:media3-exoplayer:1.11.1")
    implementation("androidx.media3:media3-exoplayer-hls:1.11.1")
    implementation("androidx.datastore:datastore-preferences:1.3.0")
    implementation("com.squareup.okhttp3:okhttp:5.5.1")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.12.0")
    implementation("io.coil-kt.coil3:coil-compose:3.6.3")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.6.3")

    testImplementation("junit:junit:4.13.2")
}
