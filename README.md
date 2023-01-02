![BepInEx logo](https://avatars2.githubusercontent.com/u/39589027?s=256)

# BepInEx.Subnautica

This is a [BepInEx](https://github.com/BepInEx/BepInEx) pack for Subnautica. Preconfigured and ready to use.

BepInEx is a general purpose framework for Unity modding.
BepInEx includes tools and libraries to

-   load custom code (hereafter _plugins_) into the game on launch;
-   patch in-game methods, classes and even entire assemblies without touching original game files;
-   configure plugins and log game to desired outputs like console or file;
-   manage plugin dependencies.

BepInEx is currently [one of the most popular modding tools for Unity on GitHub](https://github.com/topics/modding?o=desc&s=stars).

## This pack's contents

This pack is preconfigured and ready to use for Subnautica modding.  
In particular, this pack comes with preconfigured `BepInEx.cfg` that enables the BepInEx console and more extensive logging.

## Installation (manual)

If you are installing this manually, do the following:

1. Download the relevant archive:
    - For Windows and Linux/SteamDeck, download the archive designated `x64`.
    - For macOS, download the archive designated `*nix`.
2. Extract the downloaded archive into the game folder:
    - On Windows and Linux/SteamDeck, the game folder is where the game executable `Subnautica.exe` is located.
    - On macOS, the game folder is where the game executable `Subnautica.app` is located.
3. Run the game. If everything runs correctly, you will see BepInEx console pop up on your desktop.
4. Follow either Windows, Linux/SteamDeck or macOS game running instructions below:

### Configuration (Windows)

No need to configure. Simply run the game as usual i.e. by launching from Steam/Epic Games/etc. If everything is correct, you will see a console pop up.

### Configuration (Linux/SteamDeck)

1. In Steam, go to the game's properties and set the launch arguments to:
    ```
    WINEDLLOVERRIDES="winhttp=n,b" %command%
    ```
2. Run the game via Steam.

### Configuration (macOS)

1. Make the `run_bepinex.sh` executable with `chmod u+x run_bepinex.sh`.
2. In Steam, go to the game's properties and set the launch arguments to:
    ```
    ./run_bepinex.sh %command%
    ```
3. Run the game via Steam.

At this moment you will not see any clear indication that BepInEx is working. It is suggested to test by installing a simple plugin such as [ConfigurationManager](https://www.nexusmods.com/subnautica/mods/1112) and then pressing F5 to open the Configuration Manager window.

## Useful links

-   [Third-party site with a list of known compatible BepInEx plugins](https://ramuneneptune.github.io/modlists/sn.html)

### Useful links for mod authors

-   [BepInEx: writing basic plugin walkthrough](https://docs.bepinex.dev/articles/dev_guide/plugin_tutorial/)
-   [BepInEx: useful plugins for modding](https://docs.bepinex.dev/articles/dev_guide/dev_tools.html)
-   [BepInEx: patching game methods at runtime](https://docs.bepinex.dev/articles/dev_guide/runtime_patching.html)

## Issues, questions, etc.

At this moment, you can use the following channels to ask for help

-   [Subnautica Modding Community](https://discord.gg/M27wjFAfTQ)
-   [BepInEx Discord](https://discord.gg/MpFEDAg) -- **Only technical support for THIS PACKAGE. No support for plugins.**
