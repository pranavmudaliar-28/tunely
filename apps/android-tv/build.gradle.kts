// Versions are pinned exactly here and in app/build.gradle.kts (see README, "Versions").
plugins {
    id("com.android.application") version "9.5.1" apply false
    // AGP 9 compiles Kotlin itself; declaring KGP pins the Kotlin version so it matches the Compose compiler plugin.
    id("org.jetbrains.kotlin.android") version "2.4.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.21" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.4.21" apply false
}
