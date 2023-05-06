![BepInEx logo](assets/logo.png)

# BepInEx.Subnautica

This is a [BepInEx](https://github.com/BepInEx/BepInEx) pack for Subnautica, preconfigured and ready to use.

BepInEx is a general purpose framework for Unity modding. BepInEx includes tools and libraries to

-   load custom code (hereafter _plugins_) into the game on launch;
-   patch in-game methods, classes and even entire assemblies without touching original game files;
-   configure plugins and log game to desired outputs like console or file;
-   manage plugin dependencies.

BepInEx is currently [one of the most popular modding tools for Unity on GitHub](https://github.com/topics/modding?o=desc&s=stars).

## This pack's contents

This pack is preconfigured and ready to use for Subnautica modding.  
In particular, this pack comes with

- a preconfigured `BepInEx.cfg` that enables the BepInEx console and more extensive logging,
- a preconfigured `BepInEx.legacy.cfg` for compatibility with legacy QModManager mods. Simply rename to `BepInEx.cfg` when using QModManager, and
- [Tobey.UnityAudio](https://github.com/toebeann/Tobey.UnityAudio), a configurable BepInEx patcher to automatically add Unity audio support when mods need it. Also includes a preconfigured `Tobey.UnityAudio.cfg` for use with Subnautica.

## QMODMANAGER AND LEGACY BRANCH PLAYERS

[Please see the sticky post at the top of the Posts tab on Nexus Mods.](https://www.nexusmods.com/subnautica/mods/1108?tab=posts)

## General FAQ

[There is an FAQ in the stickies of the Posts tab on Nexus Mods.](https://www.nexusmods.com/subnautica/mods/1108?tab=posts)

## Installation (automatic, Windows only)

1. Install [Vortex Mod Manager](https://www.nexusmods.com/about/vortex/) and the [Subnautica Support](https://www.nexusmods.com/site/mods/202) Vortex extension if you haven't already. Make sure they're fully up-to-date.
2. Click the Vortex button at the top of [the Nexus Mods mod page](https://www.nexusmods.com/subnautica/mods/1108) to install.
    - If you have QModManager installed, Vortex might notify you to reinstall/uninstall QModManager. Just do whatever it says.
3. Run the game. If everything runs correctly, you will see the BepInEx console pop up on your desktop.

## Installation (manual)

To install manually, follow these instructions:

1. Download the relevant archive:
    - For Windows and Linux/SteamDeck, download the archive designated `x64`
    - For macOS, download the archive designated `*nix`
2. Extract the contents of the downloaded archive into the game folder:
    - On Windows and Linux/SteamDeck, the game folder is the folder containing the game executable `Subnautica.exe`
    - On macOS, the game folder is the folder containing the game executable `Subnautica.app`
3. If you are using legacy QModManager mods then follow these steps, otherwise skip to step 4:
   1. Navigate to `<path to game folder>\BepInEx\config`
   2. Rename the file `BepInEx.cfg` to `BepInEx.stable.cfg`
   3. Rename the file `BepInEx.legacy.cfg` to `BepInEx.cfg`
   
   **Note**: Please remember to undo these changes if you later stop using QModManager mods.
4. Depending on your operating system:
    - Windows users: Run the game. If everything runs correctly, you will see the BepInEx console pop up on your desktop.
    - Linux/SteamDeck & macOS users: Follow the configuration instructions for your operating system below:

### Configuration (Linux/SteamDeck)

1. In Steam, go to the game's properties and set the launch arguments to:
    ```
    WINEDLLOVERRIDES="winhttp=n,b" %command%
    ```
2. Run the game via Steam

### Configuration (macOS)

1. Make the `run_bepinex.sh` executable by running this command in Terminal:
    ```
    chmod u+x "<path to game folder>/run_bepinex.sh"
    ```
    **Note**: Make sure to replace `<path to game folder>` with the path to the folder where Subnautica is installed!
2. In Steam, go to the game's properties and set the launch arguments to:
    ```
    "<path to game folder>/run_bepinex.sh" %command%
    ```
    **Note**: Make sure to replace `<path to game folder>` with the path to the folder where Subnautica is installed!
3. Run the game via Steam
4. At this point, you may see a prompt warning you that `libdoorstop_x64.dylib` cannot be opened because the developer is unverified. In this case:
   1. Open System Preferences
   2. Go to Security & Privacy and select the General tab
   3. Towards the bottom you should see a message saying that the program was blocked from opening. Click `Open Anyway` and confirm the prompt that pops up.
   4. Run the game via Steam

At this moment you will not see any clear indication that BepInEx is working. It is suggested to test by installing a simple plugin such as [Configuration Manager](https://www.nexusmods.com/subnautica/mods/1112) and then pressing F5 to open the Configuration Manager window.

## Useful links

-   [Third-party site with a list of known compatible BepInEx plugins](https://ramuneneptune.github.io/modlists/sn.html)

### Useful links for mod authors

-   [BepInEx: writing basic plugin walkthrough](https://docs.bepinex.dev/articles/dev_guide/plugin_tutorial/)
-   [BepInEx: useful plugins for modding](https://docs.bepinex.dev/articles/dev_guide/dev_tools.html)
-   [BepInEx: patching game methods at runtime](https://docs.bepinex.dev/articles/dev_guide/runtime_patching.html)

## Issues, questions, etc.

[First check the FAQ in the stickies of the Posts tab on Nexus Mods to see if there is an answer to your question/issue.](https://www.nexusmods.com/subnautica/mods/1108?tab=posts)

If not, at this moment, you can use the following channels to ask for help

-   [BepInEx Discord](https://discord.gg/MpFEDAg) -- **Only technical support for THIS PACKAGE. No support for plugins.**
